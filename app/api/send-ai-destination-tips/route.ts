import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Kjøres daglig via Vercel Cron (se vercel.json).
// Sender AI-genererte reisedestinasjonsnips til brukere som har aktivert denne
// nyhetsbrevtypen, og der det har gått minst frequency_days siden forrige sending.
//
// Krever CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
// ANTHROPIC_API_KEY og RESEND_API_KEY som Vercel-miljøvariabler.

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripRow {
  id: string
  name: string
  owner_id: string
  date_from: string | null
  date_to: string | null
  year: number | null
  destination_city: string | null
  destination_country: string | null
}

interface StopRow {
  id: string
  trip_id: string
  city: string
  state: string | null
  nights: number
  arrival_date: string | null
  order: number
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

interface SubscriptionRow {
  user_id: string
  trip_id: string
  frequency_days: number
  last_sent_at: string | null
  enabled: boolean
}

interface CityTips {
  city: string
  general_info: string
  restaurants: string[]
  activities: string[]
}

// ── Helper: days-until label ───────────────────────────────────────────────────

function buildDaysLabel(dateFrom: string | null, year: number | null, today: string): string {
  if (dateFrom) {
    const msPerDay = 1000 * 60 * 60 * 24
    const todayMs  = new Date(today + 'T12:00:00').getTime()
    const startMs  = new Date(dateFrom + 'T12:00:00').getTime()
    const diff = Math.round((startMs - todayMs) / msPerDay)
    if (diff > 0)  return `${diff} dag${diff === 1 ? '' : 'er'} til avreise`
    if (diff === 0) return 'Avreise i dag!'
    return 'Turen er i gang'
  }
  if (year) return `Planlagt i ${year}`
  return 'Dato ikke satt ennå'
}

// ── AI: generate destination tips ──────────────────────────────────────────────

async function generateDestinationTips(
  client: Anthropic,
  tripName: string,
  destinations: string[],
): Promise<CityTips[]> {
  if (destinations.length === 0) return []

  const destList = destinations.join(', ')
  const prompt = `Generer reisedestinasjonsnips på norsk for disse stedene på en tur som heter "${tripName}": ${destList}.

For hvert sted, returner et JSON-objekt med disse feltene:
- "city": stedets navn (nøyaktig som angitt)
- "general_info": 2-3 setninger om stedet (størrelse, innbyggertall, kort historikk, særpreg)
- "restaurants": array med 3 konkrete restauranttips (navn + en linje med hva stedet er kjent for)
- "activities": array med 4 konkrete aktiviteter eller severdigheter å besøke

Returner KUN et gyldig JSON-array med ett objekt per sted. Ingen ekstra tekst utenfor JSON.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system: 'Du er en erfaren reiserådgiver. Returner KUN gyldig JSON, ingen annen tekst.',
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  const raw = block.type === 'text' ? block.text.trim() : '[]'

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? (parsed as CityTips[]) : []
  } catch {
    console.error('[ai-destination-tips] Failed to parse AI JSON:', cleaned.slice(0, 200))
    return []
  }
}

// ── Helper: build HTML email ───────────────────────────────────────────────────

function buildEmailHtml({
  tripName,
  daysLabel,
  cityTips,
  appUrl,
}: {
  tripName: string
  daysLabel: string
  cityTips: CityTips[]
  appUrl: string
}): string {
  const cityHtml = cityTips.length > 0
    ? cityTips.map((c) => {
        const restaurantItems = c.restaurants
          .map((r) => `<li style="margin:4px 0;color:#cbd5e1;">${r}</li>`)
          .join('')
        const activityItems = c.activities
          .map((a) => `<li style="margin:4px 0;color:#cbd5e1;">${a}</li>`)
          .join('')

        return `
          <div style="background:#1e293b;border-radius:10px;padding:16px 20px;margin-bottom:14px;">
            <h2 style="color:#60a5fa;font-size:1rem;margin:0 0 10px;border-bottom:1px solid #334155;padding-bottom:8px;">
              📍 ${c.city}
            </h2>
            ${c.general_info ? `
            <p style="font-size:0.82rem;color:#94a3b8;margin:0 0 14px;line-height:1.55;">
              ${c.general_info}
            </p>` : ''}
            <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 6px;">
              🍽️ Restauranttips
            </p>
            <ul style="margin:0 0 14px;padding-left:18px;">${restaurantItems}</ul>
            <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 6px;">
              🎟️ Aktiviteter og severdigheter
            </p>
            <ul style="margin:0;padding-left:18px;">${activityItems}</ul>
          </div>
        `
      }).join('')
    : '<p style="color:#64748b;font-style:italic;">Ingen destinasjoner å generere tips for ennå.</p>'

  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px 24px;border-radius:14px;">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:22px;">
        <span style="font-size:2.8rem;">🗺️</span>
        <h1 style="color:#60a5fa;font-size:1.3rem;margin:10px 0 2px;line-height:1.3;">${tripName}</h1>
        <p style="color:#64748b;font-size:0.8rem;margin:0;">AI-genererte reisedestinasjonsnips</p>
      </div>

      <!-- Days until trip -->
      <div style="background:#451a03;border:1px solid #b45309;border-radius:10px;padding:14px 20px;margin-bottom:20px;text-align:center;">
        <p style="font-size:1.1rem;font-weight:700;color:#fbbf24;margin:0;">✈️ ${daysLabel}</p>
      </div>

      <!-- City tips -->
      ${cityHtml}

      <!-- Open app button -->
      <div style="text-align:center;margin:22px 0 18px;">
        <a href="${appUrl}/plan"
           style="display:inline-block;background:#2563eb;color:white;
                  padding:10px 24px;border-radius:8px;text-decoration:none;
                  font-size:0.85rem;font-weight:600;">
          Åpne reiseplanleggeren →
        </a>
      </div>

      <!-- Footer -->
      <p style="color:#334155;font-size:0.72rem;text-align:center;margin:0;line-height:1.6;">
        Du mottar denne e-posten fordi du har aktivert AI-reisedestinasjonsnips i Reiseplanleggeren.<br>
        Administrer innstillingene dine på <a href="${appUrl}/minside" style="color:#475569;">Min side → Nyhetsbrev</a>.
      </p>
    </div>
  `
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verifiser cron-secret
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey    = process.env.RESEND_API_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!resendApiKey || !anthropicApiKey || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sirkussand.com'

  // "I dag" i Oslo-tidssone
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(new Date())

  // ── 1. Hent alle aktive abonnement for ai_destination_tips ──────────────────
  // Hent kun aktive abonnement (enabled=true) eller der ingen rad finnes (default=on)
  // Vi henter bare rader der enabled=true; default (ingen rad) håndteres ikke her siden
  // vi bruker opt-out-modellen — vi sender til alle som har enabled=true eller ingen rad.
  //
  // Strategi: hent alle aktive reiser, deretter hent opt-outs, og sjekk last_sent_at.

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, owner_id, date_from, date_to, year, destination_city, destination_country')
    .eq('status', 'planning')
    .or(`date_to.is.null,date_to.gte.${today}`)

  if (tripsError) {
    console.error('[ai-destination-tips] DB error fetching trips:', tripsError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!trips || trips.length === 0) {
    return NextResponse.json({ sent: 0, trips: 0 })
  }

  const typedTrips = trips as TripRow[]
  const tripIds    = typedTrips.map((t) => t.id)
  const ownerIds   = [...new Set(typedTrips.map((t) => t.owner_id))]

  // ── 2. Hent stopp for alle reiser ───────────────────────────────────────────
  const { data: stops } = await supabase
    .from('stops')
    .select('id, trip_id, city, state, nights, arrival_date, order')
    .in('trip_id', tripIds)
    .order('order', { ascending: true })

  // ── 3. Hent alle eksplisitte abonnement for ai_destination_tips ─────────────
  const { data: subscriptions } = await supabase
    .from('newsletter_subscriptions')
    .select('user_id, trip_id, frequency_days, last_sent_at, enabled')
    .in('trip_id', tripIds)
    .eq('newsletter_type', 'ai_destination_tips')

  // ── 4. Hent eierprofiles ─────────────────────────────────────────────────────
  const { data: ownerProfiles } = await supabase
    .from('user_profiles')
    .select('user_id, email, display_name')
    .in('user_id', ownerIds)

  // ── 5. Hent reisende med linkede brukere ─────────────────────────────────────
  const { data: travelers } = await supabase
    .from('travelers')
    .select('id, trip_id, name, linked_user_id')
    .in('trip_id', tripIds)

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

  // ── Bygg oppslags-maps ───────────────────────────────────────────────────────

  const profileMap = new Map<string, ProfileRow>()
  for (const p of [
    ...(ownerProfiles as ProfileRow[] | null ?? []),
    ...(linkedProfiles as ProfileRow[] | null ?? []),
  ]) {
    profileMap.set(p.user_id, p)
  }

  const stopsByTrip = new Map<string, StopRow[]>()
  for (const s of stops as StopRow[] | null ?? []) {
    const list = stopsByTrip.get(s.trip_id) ?? []
    list.push(s)
    stopsByTrip.set(s.trip_id, list)
  }

  const travelersByTrip = new Map<string, TravelerRow[]>()
  for (const t of travelers as TravelerRow[] | null ?? []) {
    const list = travelersByTrip.get(t.trip_id) ?? []
    list.push(t)
    travelersByTrip.set(t.trip_id, list)
  }

  // subscriptionMap: "user_id:trip_id" → SubscriptionRow
  const subscriptionMap = new Map<string, SubscriptionRow>()
  for (const sub of subscriptions as SubscriptionRow[] | null ?? []) {
    subscriptionMap.set(`${sub.user_id}:${sub.trip_id}`, sub)
  }

  // ── Helper: should this user+trip get a send today? ──────────────────────────

  function shouldSend(userId: string, tripId: string): boolean {
    const sub = subscriptionMap.get(`${userId}:${tripId}`)

    // Explicit opt-out
    if (sub && !sub.enabled) return false

    // Determine frequency (default 3 days)
    const frequencyDays = sub?.frequency_days ?? 3

    // If never sent, send now
    if (!sub?.last_sent_at) return true

    // Check if enough days have passed
    const lastSent = new Date(sub.last_sent_at)
    const todayDate = new Date(today + 'T12:00:00')
    const daysSinceLast = Math.floor((todayDate.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24))
    return daysSinceLast >= frequencyDays
  }

  // ── Send e-poster ─────────────────────────────────────────────────────────────

  let sentCount = 0
  const nowIso = new Date().toISOString()

  for (const trip of typedTrips) {
    const tripStops     = stopsByTrip.get(trip.id) ?? []
    const tripTravelers = travelersByTrip.get(trip.id) ?? []

    // Samle destinasjoner: stopp-byer + fallback til destination_city
    const destinations: string[] = tripStops.length > 0
      ? tripStops.map((s) => s.state ? `${s.city}, ${s.state}` : s.city)
      : [trip.destination_city, trip.destination_country]
          .filter((d): d is string => Boolean(d))

    if (destinations.length === 0) continue

    // Finn mottakere for denne turen som skal ha e-post i dag
    const eligibleEmails = new Map<string, string>() // email → userId

    const ownerProfile = profileMap.get(trip.owner_id)
    if (ownerProfile?.email && shouldSend(trip.owner_id, trip.id)) {
      eligibleEmails.set(ownerProfile.email, trip.owner_id)
    }

    for (const traveler of tripTravelers) {
      if (!traveler.linked_user_id) continue
      const p = profileMap.get(traveler.linked_user_id)
      if (p?.email && shouldSend(traveler.linked_user_id, trip.id)) {
        eligibleEmails.set(p.email, traveler.linked_user_id)
      }
    }

    if (eligibleEmails.size === 0) continue

    // Generer AI-tips én gang per tur
    let cityTips: CityTips[] = []
    try {
      cityTips = await generateDestinationTips(anthropic, trip.name, destinations)
    } catch (err) {
      console.error('[ai-destination-tips] Anthropic error for trip', trip.id, err)
      // Send e-post uten AI-innhold heller enn å hoppe over
    }

    const daysLabel = buildDaysLabel(trip.date_from, trip.year, today)
    const html      = buildEmailHtml({ tripName: trip.name, daysLabel, cityTips, appUrl })

    for (const [email, userId] of eligibleEmails.entries()) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Reiseplanlegger <noreply@sirkussand.com>',
          to:   email,
          subject: `🗺️ Reisedestinasjonsnips – ${trip.name}`,
          html,
        }),
      })

      if (res.ok) {
        sentCount++
        // Oppdater last_sent_at for denne brukeren
        await supabase
          .from('newsletter_subscriptions')
          .upsert(
            {
              user_id:          userId,
              trip_id:          trip.id,
              newsletter_type:  'ai_destination_tips',
              enabled:          true,
              last_sent_at:     nowIso,
              updated_at:       nowIso,
            },
            { onConflict: 'user_id,trip_id,newsletter_type' }
          )
      } else {
        console.error(
          '[ai-destination-tips] Resend error for trip', trip.id,
          'to', email,
          await res.text()
        )
      }
    }
  }

  return NextResponse.json({ sent: sentCount, trips: typedTrips.length })
}
