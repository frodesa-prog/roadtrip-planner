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
  }
  const { recipientEmail, tripName, senderName, accessLevel } = body

  const accessLabel = accessLevel === 'write' ? 'full tilgang (kan redigere)' : 'lesetilgang'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://din-app.no'

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1d4ed8;">Du er invitert til en ferietur! 🗺️</h2>
      <p><strong>${senderName}</strong> har delt turen <strong>"${tripName}"</strong> med deg.</p>
      <p>Du har fått ${accessLabel}.</p>
      <p>
        <a href="${appUrl}"
           style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Åpne appen
        </a>
      </p>
      <p style="color:#6b7280;font-size:0.85rem;">
        Logg inn med ${recipientEmail} for å se turen.
      </p>
    </div>
  `

  console.log('[share-trip-email] Sending to:', recipientEmail, 'from key:', resendApiKey.slice(0, 10) + '...')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Reiseplanlegger <noreply@sirkussand.com>',
      to: recipientEmail,
      subject: `${senderName} har delt "${tripName}" med deg`,
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
