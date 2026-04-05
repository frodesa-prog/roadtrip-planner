import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  console.log('[share-trip-email] POST called')
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log('[share-trip-email] No RESEND_API_KEY')
    return NextResponse.json({ sent: false, reason: 'no_api_key' })
  }

  const body = await req.json() as {
    recipientEmail: string
    tripName: string
    senderName: string
    accessLevel: 'read' | 'write'
    alreadyMember?: boolean  // true = existing user added directly (vs. invite to register)
  }
  const { recipientEmail, tripName, senderName, accessLevel, alreadyMember } = body

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myvacayplanner.com'

  const html = alreadyMember
    ? `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1d4ed8;">Du er lagt til i en ferietur! 🗺️</h2>
      <p><strong>${senderName}</strong> har lagt deg til i turen <strong>"${tripName}"</strong>.</p>
      <p>Turen er nå tilgjengelig på din konto og du kan åpne den direkte i appen.</p>
      <p>
        <a href="${appUrl}"
           style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Åpne turen i appen
        </a>
      </p>
      <p style="color:#6b7280;font-size:0.85rem;">
        Logg inn med ${recipientEmail} for å se turen.
      </p>
    </div>
  `
    : `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1d4ed8;">Du er invitert til en ferietur! 🗺️</h2>
      <p><strong>${senderName}</strong> har invitert deg til turen <strong>"${tripName}"</strong>.</p>
      <p>Opprett en konto med denne e-postadressen (${recipientEmail}) for å få tilgang til turen.</p>
      <p>
        <a href="${appUrl}"
           style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Opprett konto og åpne turen
        </a>
      </p>
      <p style="color:#6b7280;font-size:0.85rem;">
        ${accessLevel === 'write' ? 'Du vil få full tilgang og kan redigere turen.' : 'Du vil få lesetilgang til turen.'}
      </p>
    </div>
  `

  const subject = alreadyMember
    ? `${senderName} har lagt deg til i "${tripName}"`
    : `${senderName} har invitert deg til "${tripName}"`

  console.log('[share-trip-email] Sending to:', recipientEmail, 'alreadyMember:', alreadyMember)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Reiseplanlegger <noreply@sirkussand.com>',
      to: recipientEmail,
      subject,
      html,
    }),
  })

  const responseText = await res.text()
  console.log('[share-trip-email] Resend status:', res.status, 'body:', responseText)

  if (!res.ok) {
    return NextResponse.json({ sent: false, reason: 'resend_error', detail: responseText })
  }

  return NextResponse.json({ sent: true })
}
