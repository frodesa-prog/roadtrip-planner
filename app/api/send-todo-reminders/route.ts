import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Kjøres daglig via Vercel Cron (se vercel.json)
// Krever CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY og RESEND_API_KEY i Vercel-miljøvariabler

export async function GET(req: NextRequest) {
  // Sjekk cron-secret for å hindre uautoriserte kall
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!resendApiKey || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  // Bruk service role for å lese på tvers av brukere
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const today = new Date().toISOString().slice(0, 10)

  // Hent alle gjøremål med påminnelse i dag som ikke er fullført
  const { data: todos, error } = await supabase
    .from('todo_items')
    .select('id, description, link, responsible, trips(name, owner_id)')
    .eq('reminder_date', today)
    .eq('completed', false)

  if (error) {
    console.error('DB error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!todos || todos.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sentCount = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sirkussand.com'

  for (const todo of todos) {
    const trip = Array.isArray(todo.trips) ? todo.trips[0] : todo.trips
    if (!trip) continue

    let recipientEmail: string | null = null

    if (todo.responsible === 'felles') {
      // Send til turens eier
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('user_id', (trip as { owner_id: string }).owner_id)
        .maybeSingle()
      recipientEmail = (profile as { email: string } | null)?.email ?? null
    } else {
      // Finn reisende og dennes koblede bruker
      const { data: traveler } = await supabase
        .from('travelers')
        .select('linked_user_id')
        .eq('id', todo.responsible)
        .maybeSingle()
      const linkedId = (traveler as { linked_user_id: string | null } | null)?.linked_user_id
      if (linkedId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('user_id', linkedId)
          .maybeSingle()
        recipientEmail = (profile as { email: string } | null)?.email ?? null
      }
    }

    if (!recipientEmail) continue

    const tripName = (trip as { name: string }).name
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;">
        <h2 style="color:#60a5fa;margin-top:0;">📋 Påminnelse om gjøremål</h2>
        <p>Du har et gjøremål som bør utføres før turen <strong>${tripName}</strong>:</p>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;font-size:1rem;color:#f1f5f9;">${todo.description}</p>
          ${todo.link ? `<a href="${todo.link}" style="color:#60a5fa;font-size:0.85rem;display:block;margin-top:8px;">${todo.link}</a>` : ''}
        </div>
        <p><a href="${appUrl}/todo" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Åpne gjøremålslisten</a></p>
        <p style="color:#64748b;font-size:0.8rem;margin-top:16px;">Denne påminnelsen ble satt i Ferieplanleggeren.</p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Reiseplanlegger <noreply@sirkussand.com>',
        to: recipientEmail,
        subject: `Påminnelse: ${todo.description.slice(0, 60)} – ${tripName}`,
        html,
      }),
    })

    if (res.ok) {
      sentCount++
    } else {
      console.error('Resend error for todo', todo.id, await res.text())
    }
  }

  return NextResponse.json({ sent: sentCount, total: todos.length })
}
