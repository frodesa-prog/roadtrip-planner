import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ sent: false, reason: 'no_api_key' })
  }

  const { email } = await req.json() as { email: string }
  if (!email) {
    return NextResponse.json({ sent: false, reason: 'missing_email' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myvacayplanner.com'

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px 24px;border-radius:16px;">

      <!-- Logo / ikon -->
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:3rem;">🗺️</span>
        <h1 style="color:#60a5fa;font-size:1.4rem;margin:12px 0 4px;line-height:1.3;">
          Velkommen til MyVacayPlanner!
        </h1>
        <p style="color:#64748b;font-size:0.82rem;margin:0;">Din reiseplanlegger for uforglemmelige ferier</p>
      </div>

      <!-- Velkomstmelding -->
      <div style="background:#1e293b;border-radius:12px;padding:20px 24px;margin-bottom:20px;border:1px solid #334155;">
        <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7;margin:0 0 14px;">
          Hei! 👋
        </p>
        <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7;margin:0 0 14px;">
          Kontoen din er nå opprettet og klar til bruk. Med MyVacayPlanner kan du planlegge
          hele ferien på ett sted — stopp, overnatting, aktiviteter, flyreiser og minner fra turen.
        </p>
        <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7;margin:0;">
          Logg inn og kom i gang med å planlegge din neste drømmeferie!
        </p>
      </div>

      <!-- CTA-knapp -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${appUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  padding:13px 32px;border-radius:10px;text-decoration:none;
                  font-size:0.95rem;font-weight:700;letter-spacing:0.02em;">
          Logg inn og start planleggingen →
        </a>
      </div>

      <!-- Påloggingsinfo -->
      <div style="background:#1e293b;border-radius:10px;padding:14px 20px;margin-bottom:20px;border:1px solid #334155;">
        <p style="font-size:0.8rem;color:#94a3b8;margin:0 0 4px;">Din innlogging:</p>
        <p style="font-size:0.9rem;color:#e2e8f0;font-weight:600;margin:0;">${email}</p>
      </div>

      <!-- Footer -->
      <p style="color:#334155;font-size:0.72rem;text-align:center;margin:0;line-height:1.7;">
        Du mottar denne e-posten fordi du nettopp opprettet en konto på MyVacayPlanner.<br>
        Besøk oss på <a href="${appUrl}" style="color:#475569;">${appUrl.replace('https://', '')}</a>
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MyVacayPlanner <noreply@sirkussand.com>',
      to: email,
      subject: '🗺️ Velkommen til MyVacayPlanner!',
      html,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('[send-welcome-email] Resend error:', res.status, detail)
    return NextResponse.json({ sent: false, reason: 'resend_error', detail })
  }

  console.log('[send-welcome-email] Sent welcome email to:', email)
  return NextResponse.json({ sent: true })
}
