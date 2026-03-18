import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Kjøres periodisk via Vercel Cron (se vercel.json)
// Krever CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY og RESEND_API_KEY i miljøvariabler
//
// Logikk:
//   For hvert turmedlem (eier + reisende med linked_user_id):
//     1. Finn uleste meldinger som ikke allerede er varslet om
//     2. Hvis den siste uleste meldingen ble sendt for >= 30 min siden → send samle-e-post
//     3. Oppdater trip_chat_notification_log slik at vi ikke sender dobbelt

const NOTIFY_AFTER_MINUTES = 30

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sirkussand.com'

  if (!resendApiKey || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - NOTIFY_AFTER_MINUTES * 60 * 1000).toISOString()

  // ── Finn turer med nylige meldinger (siste 24 timer) ──────────────────────
  const { data: recentMsgs, error: msgsErr } = await supabase
    .from('trip_group_messages')
    .select('trip_id')
    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())

  if (msgsErr) {
    console.error('[chat-notify] DB error:', msgsErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const uniqueTripIds = [...new Set((recentMsgs ?? []).map((r) => r.trip_id))]
  if (uniqueTripIds.length === 0) {
    return NextResponse.json({ sent: 0, checked: 0 })
  }

  let sentCount = 0
  let checkedCount = 0

  for (const tripId of uniqueTripIds) {
    // Hent turinformasjon
    const { data: trip } = await supabase
      .from('trips')
      .select('id, name, owner_id')
      .eq('id', tripId)
      .maybeSingle()
    if (!trip) continue

    // Hent alle turmedlemmer: eier + reisende med linked_user_id
    const { data: travelers } = await supabase
      .from('travelers')
      .select('linked_user_id')
      .eq('trip_id', tripId)
      .not('linked_user_id', 'is', null)

    const memberIds = new Set<string>([
      trip.owner_id,
      ...((travelers ?? []).map((t: { linked_user_id: string }) => t.linked_user_id)),
    ])

    for (const userId of memberIds) {
      checkedCount++

      // Når leste brukeren sist chatten? (fra trip_chat_read_receipts)
      const { data: readReceipt } = await supabase
        .from('trip_chat_read_receipts')
        .select('last_read_at')
        .eq('user_id', userId)
        .eq('trip_id', tripId)
        .maybeSingle()
      const lastReadAt: string = readReceipt?.last_read_at ?? new Date(0).toISOString()

      // Når ble siste varsel sendt? (fra trip_chat_notification_log)
      const { data: notifLog } = await supabase
        .from('trip_chat_notification_log')
        .select('last_notified_at')
        .eq('user_id', userId)
        .eq('trip_id', tripId)
        .maybeSingle()
      const lastNotifiedAt: string = notifLog?.last_notified_at ?? new Date(0).toISOString()

      // Cutoff: meldinger etter det seneste av (lest, varslet) – unngår dobbel-varsling
      const msgCutoff = lastReadAt > lastNotifiedAt ? lastReadAt : lastNotifiedAt

      // Finn uleste, uvarslede meldinger fra ANDRE brukere
      const { data: unread } = await supabase
        .from('trip_group_messages')
        .select('id, sender_name, content, created_at')
        .eq('trip_id', tripId)
        .neq('user_id', userId)
        .gt('created_at', msgCutoff)
        .order('created_at', { ascending: true })

      if (!unread || unread.length === 0) continue

      // Den nyeste uleste meldingen
      const latestMsg = unread[unread.length - 1]

      // Send bare hvis den nyeste meldingen er minst 30 min gammel
      if (latestMsg.created_at > cutoffTime) continue

      // Hent e-postadresse og visningsnavn for mottakeren
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, display_name')
        .eq('user_id', userId)
        .maybeSingle()
      const recipientEmail = (profile as { email?: string } | null)?.email
      if (!recipientEmail) continue

      const displayName =
        (profile as { display_name?: string } | null)?.display_name ?? recipientEmail.split('@')[0]

      // ── Bygg e-posttekst ────────────────────────────────────────────────
      const count = unread.length
      const msgRows = unread
        .map((m: { sender_name: string; created_at: string; content: string }) => {
          const time = new Intl.DateTimeFormat('nb-NO', {
            timeZone: 'Europe/Oslo',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(m.created_at))
          // Escape HTML i meldingsinnhold
          const safeContent = m.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
          return `
            <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #334155;">
              <div style="margin-bottom:6px;">
                <strong style="color:#e2e8f0;">${m.sender_name}</strong>
                <span style="color:#64748b;font-size:0.8rem;margin-left:8px;">${time}</span>
              </div>
              <div style="color:#cbd5e1;line-height:1.5;">${safeContent}</div>
            </div>`
        })
        .join('')

      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;">
          <h2 style="color:#60a5fa;margin-top:0;">💬 ${count} ulest${count === 1 ? '' : 'e'} chat-melding${count === 1 ? '' : 'er'}</h2>
          <p style="color:#94a3b8;">Hei${displayName ? ` ${displayName}` : ''}! Du har ${count} ulest${count === 1 ? '' : 'e'} melding${count === 1 ? '' : 'er'} i chatten for turen <strong style="color:#e2e8f0;">${trip.name}</strong>:</p>
          <div style="background:#1e293b;border-radius:8px;padding:16px 20px;margin:16px 0;">
            ${msgRows}
            <div style="color:#64748b;font-size:0.8rem;margin-top:4px;">... og ingenting mer å vise</div>
          </div>
          <p>
            <a href="${appUrl}/plan"
               style="background:#2563eb;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">
              Åpne chatten
            </a>
          </p>
          <p style="color:#475569;font-size:0.78rem;margin-top:20px;border-top:1px solid #1e293b;padding-top:16px;">
            Du mottar dette fordi du er registrert på turen «${trip.name}» i Ferieplanleggeren.
          </p>
        </div>
      `

      const subject =
        count === 1
          ? `💬 Ny melding fra ${unread[0].sender_name} – ${trip.name}`
          : `💬 ${count} nye meldinger i chatten – ${trip.name}`

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Reiseplanlegger <noreply@sirkussand.com>',
          to: recipientEmail,
          subject,
          html,
        }),
      })

      if (emailRes.ok) {
        sentCount++
        // Marker som varslet slik at vi ikke sender dobbelt ved neste kjøring
        await supabase
          .from('trip_chat_notification_log')
          .upsert({ user_id: userId, trip_id: tripId, last_notified_at: now.toISOString() })
      } else {
        console.error('[chat-notify] Resend error for user', userId, await emailRes.text())
      }
    }
  }

  return NextResponse.json({ sent: sentCount, checked: checkedCount, trips: uniqueTripIds.length })
}
