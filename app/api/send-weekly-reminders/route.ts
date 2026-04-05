import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Kjøres hver mandag morgen via Vercel Cron (se vercel.json)
// Sender ukentlig påminnelse til alle brukere med en aktiv reise:
//   – Antall dager til avreise
//   – Turfølget
//   – Påminnelse om gjøremålslisten med lenke
//
// Krever CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY og RESEND_API_KEY
// som Vercel-miljøvariabler.

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripRow {
  id: string
  name: string
  owner_id: string
  date_from: string | null
  date_to: string | null
  year: number | null
}

interface ProfileRow {
  user_id: string
  email: string
  display_name: string | null
}

interface TravelerRow {
  id: string
  trip_id: string
  name: string
  linked_user_id: string | null
}

// ── Helper: days-until label ───────────────────────────────────────────────────

function buildDaysLabel(dateFrom: string | null, year: number | null, today: string): string {
  if (dateFrom) {
    const msPerDay = 1000 * 60 * 60 * 24
    const todayMs  = new Date(today + 'T12:00:00').getTime()
    const startMs  = new Date(dateFrom + 'T12:00:00').getTime()
    const diff = Math.round((startMs - todayMs) / msPerDay)
    if (diff > 0)  return `${diff} dag${diff === 1 ? '' : 'er'} igjen til avreise`
    if (diff === 0) return '🎉 Avreise i dag!'
    return 'Turen er i gang'
  }
  if (year) return `Planlagt i ${year}`
  return 'Dato ikke satt ennå'
}

// ── Helper: build HTML email ───────────────────────────────────────────────────

function buildEmailHtml({
  tripName,
  daysLabel,
  travelerNames,
  uncompletedTodos,
  appUrl,
}: {
  tripName: string
  daysLabel: string
  travelerNames: string[]
  uncompletedTodos: number
  appUrl: string
}): string {
  const travelersHtml =
    travelerNames.length > 0
      ? `<ul style="margin:8px 0;padding-left:20px;color:#cbd5e1;">
           ${travelerNames.map((n) => `<li style="margin:3px 0;">${n}</li>`).join('')}
         </ul>`
      : '<p style="color:#64748b;font-style:italic;margin:8px 0;">Ingen reisende lagt til ennå</p>'

  const todosHtml =
    uncompletedTodos > 0
      ? `<p style="margin:0;">Du har <strong style="color:#f59e0b;">${uncompletedTodos}&nbsp;uferdig${uncompletedTodos === 1 ? '' : 'e'} gjøremål</strong> på listen.</p>`
      : '<p style="margin:0;color:#22c55e;">✓ Alle gjøremål er fullført!</p>'

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px 24px;border-radius:14px;">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:22px;">
        <span style="font-size:2.8rem;">✈️</span>
        <h1 style="color:#60a5fa;font-size:1.3rem;margin:10px 0 2px;line-height:1.3;">${tripName}</h1>
        <p style="color:#64748b;font-size:0.8rem;margin:0;">Ukentlig reisepåminnelse</p>
      </div>

      <!-- Days until trip -->
      <div style="background:#172554;border:1px solid #1d4ed8;border-radius:10px;padding:16px 20px;margin-bottom:16px;text-align:center;">
        <p style="font-size:1.15rem;font-weight:700;color:#93c5fd;margin:0;">${daysLabel}</p>
      </div>

      <!-- Travel group -->
      <div style="background:#1e293b;border-radius:10px;padding:16px 20px;margin-bottom:14px;">
        <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 8px;">
          👥 Turfølge
        </p>
        ${travelersHtml}
      </div>

      <!-- Todo list -->
      <div style="background:#1e293b;border-radius:10px;padding:16px 20px;margin-bottom:22px;">
        <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 8px;">
          📋 Gjøremålsliste
        </p>
        ${todosHtml}
        <a href="${appUrl}/todo"
           style="display:inline-block;margin-top:14px;background:#2563eb;color:white;
                  padding:9px 20px;border-radius:8px;text-decoration:none;font-size:0.85rem;
                  font-weight:600;">
          Åpne gjøremålslisten →
        </a>
      </div>

      <!-- Open app button -->
      <div style="text-align:center;margin-bottom:20px;">
        <a href="${appUrl}/plan"
           style="display:inline-block;background:#0f172a;border:1px solid #334155;
                  color:#94a3b8;padding:10px 24px;border-radius:8px;text-decoration:none;
                  font-size:0.85rem;">
          Åpne reiseplanleggeren
        </a>
      </div>

      <!-- Footer -->
      <p style="color:#334155;font-size:0.72rem;text-align:center;margin:0;line-height:1.6;">
        Du mottar denne e-posten fordi du har en aktiv ferietur i Reiseplanleggeren.<br>
        Sendes automatisk hver mandag morgen.
      </p>
    </div>
  `
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verifiser cron-secret for å hindre uautoriserte kall
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey   = process.env.RESEND_API_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!resendApiKey || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myvacayplanner.com'

  // "I dag" i Oslo-tidssone (YYYY-MM-DD)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(new Date())

  // ── 1. Hent alle aktive reiser som ikke er avsluttet ────────────────────────
  // Aktiv = status = 'planning' og (date_to er null ELLER date_to >= i dag)
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, owner_id, date_from, date_to, year')
    .eq('status', 'planning')
    .or(`date_to.is.null,date_to.gte.${today}`)

  if (tripsError) {
    console.error('[weekly-reminders] DB error fetching trips:', tripsError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!trips || trips.length === 0) {
    return NextResponse.json({ sent: 0, trips: 0 })
  }

  const typedTrips = trips as TripRow[]
  const tripIds    = typedTrips.map((t) => t.id)
  const ownerIds   = [...new Set(typedTrips.map((t) => t.owner_id))]

  // ── 2. Hent e-postadresser for alle eiere ───────────────────────────────────
  const { data: ownerProfiles } = await supabase
    .from('user_profiles')
    .select('user_id, email, display_name')
    .in('user_id', ownerIds)

  // ── 3. Hent reisende for alle turer ─────────────────────────────────────────
  const { data: travelers } = await supabase
    .from('travelers')
    .select('id, trip_id, name, linked_user_id')
    .in('trip_id', tripIds)

  // ── 4. Hent e-postadresser for koblede reisende ─────────────────────────────
  const linkedUserIds = [
    ...new Set(
      (travelers as TravelerRow[] | null ?? [])
        .map((t) => t.linked_user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const { data: linkedProfiles } =
    linkedUserIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('user_id, email, display_name')
          .in('user_id', linkedUserIds)
      : { data: [] }

  // ── 5. Tell ufuligte gjøremål per tur ───────────────────────────────────────
  const { data: todos } = await supabase
    .from('todo_items')
    .select('trip_id')
    .in('trip_id', tripIds)
    .eq('completed', false)

  // ── 5b. Hent opt-in abonnementer ────────────────────────────────────────────
  // Kun brukere som eksplisitt har slått PÅ ukentlig påminnelse for en tur
  const { data: optIns } = await supabase
    .from('newsletter_subscriptions')
    .select('user_id, trip_id')
    .in('trip_id', tripIds)
    .eq('newsletter_type', 'weekly_reminder')
    .eq('enabled', true)

  // Set med "user_id:trip_id"-nøkler for rask oppslag
  const optInSet = new Set<string>(
    (optIns ?? []).map((o: { user_id: string; trip_id: string }) => `${o.user_id}:${o.trip_id}`)
  )

  // ── Bygg oppslags-maps ──────────────────────────────────────────────────────

  const profileMap = new Map<string, ProfileRow>()
  for (const p of [...(ownerProfiles as ProfileRow[] | null ?? []), ...(linkedProfiles as ProfileRow[] | null ?? [])]) {
    profileMap.set(p.user_id, p)
  }

  // Omvendt oppslag: e-post → user_id (for opt-out-sjekk)
  const emailToUserId = new Map<string, string>()
  for (const [uid, profile] of profileMap.entries()) {
    if (profile.email) emailToUserId.set(profile.email, uid)
  }

  const travelersByTrip = new Map<string, TravelerRow[]>()
  for (const t of travelers as TravelerRow[] | null ?? []) {
    const list = travelersByTrip.get(t.trip_id) ?? []
    list.push(t)
    travelersByTrip.set(t.trip_id, list)
  }

  const todosCountByTrip = new Map<string, number>()
  for (const todo of todos as { trip_id: string }[] | null ?? []) {
    todosCountByTrip.set(todo.trip_id, (todosCountByTrip.get(todo.trip_id) ?? 0) + 1)
  }

  // ── Send e-poster ────────────────────────────────────────────────────────────

  let sentCount = 0

  for (const trip of typedTrips) {
    const tripTravelers    = travelersByTrip.get(trip.id) ?? []
    const uncompletedTodos = todosCountByTrip.get(trip.id) ?? 0
    const daysLabel        = buildDaysLabel(trip.date_from, trip.year, today)
    const travelerNames    = tripTravelers.map((t) => t.name)

    // Samle unike mottakere: eier + koblede reisende
    const recipientEmails = new Set<string>()

    const ownerProfile = profileMap.get(trip.owner_id)
    if (ownerProfile?.email) recipientEmails.add(ownerProfile.email)

    for (const traveler of tripTravelers) {
      if (traveler.linked_user_id) {
        const p = profileMap.get(traveler.linked_user_id)
        if (p?.email) recipientEmails.add(p.email)
      }
    }

    if (recipientEmails.size === 0) continue

    const html = buildEmailHtml({ tripName: trip.name, daysLabel, travelerNames, uncompletedTodos, appUrl })

    for (const email of recipientEmails) {
      // Send kun til brukere som eksplisitt har slått PÅ ukentlig påminnelse
      const uid = emailToUserId.get(email)
      if (!uid || !optInSet.has(`${uid}:${trip.id}`)) continue

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Reiseplanlegger <noreply@sirkussand.com>',
          to:   email,
          subject: `🗓️ Ukentlig påminnelse – ${trip.name}`,
          html,
        }),
      })

      if (res.ok) {
        sentCount++
      } else {
        console.error('[weekly-reminders] Resend error for trip', trip.id, 'to', email, await res.text())
      }
    }
  }

  return NextResponse.json({ sent: sentCount, trips: typedTrips.length })
}
