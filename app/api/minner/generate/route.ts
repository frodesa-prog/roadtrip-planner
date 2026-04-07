import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { tripId, memoryId } = await req.json()
  if (!tripId || !memoryId) return NextResponse.json({ error: 'tripId og memoryId er påkrevd' }, { status: 400 })

  try {
    const [
      { data: trip },
      { data: stops },
      { data: travelers },
      { data: activities },
      { data: dining },
      { data: hotels },
      { data: notes },
    ] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('stops').select('*').eq('trip_id', tripId).order('order'),
      supabase.from('travelers').select('name, age').eq('trip_id', tripId),
      supabase.from('activities')
        .select('stop_id, name, activity_type, activity_date, activity_time, notes')
        .eq('trip_id' as never, tripId)
        .order('activity_date', { ascending: true }),
      supabase.from('dining')
        .select('stop_id, name, booking_date, booking_time')
        .eq('trip_id' as never, tripId)
        .order('booking_date', { ascending: true }),
      supabase.from('hotels').select('stop_id, name').eq('trip_id' as never, tripId),
      supabase.from('notes').select('stop_id, content').eq('trip_id', tripId).is('archived_at', null),
    ])

    if (!trip || !stops?.length) {
      return NextResponse.json({ error: 'Ingen turdata funnet' }, { status: 404 })
    }

    const totalNights = stops.reduce((s: number, st: { nights: number }) => s + (st.nights ?? 0), 0)

    type StopRow = {
      id: string; city: string; state: string | null; arrival_date: string | null
      nights: number; lat: number | null; lng: number | null; order: number
    }
    const stopsTyped = stops as StopRow[]

    // Bruk kjørelengde fra Google Directions (lagret av planleggeren) hvis tilgjengelig.
    // Faller tilbake til Haversine-estimat kun dersom trips.total_km ikke er satt.
    const tripRow = trip as { total_km?: number | null }
    let totalKm: number
    let legKm: number[]
    if (tripRow.total_km && tripRow.total_km > 0) {
      totalKm = tripRow.total_km
      // Fordel km proporsjonalt på etapper (for per-stopp-tekst i AI-prompt)
      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLng = (lng2 - lng1) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      const rawLeg: number[] = stopsTyped.map((stop, i) => {
        if (i === 0) return 0
        const prev = stopsTyped[i - 1]
        if (prev.lat == null || prev.lng == null || stop.lat == null || stop.lng == null) return 0
        return haversineKm(prev.lat, prev.lng, stop.lat, stop.lng)
      })
      const rawTotal = rawLeg.reduce((s, d) => s + d, 0)
      legKm = rawTotal > 0
        ? rawLeg.map((d) => (d / rawTotal) * totalKm)
        : rawLeg
    } else {
      // Haversine-fallback
      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLng = (lng2 - lng1) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      legKm = stopsTyped.map((stop, i) => {
        if (i === 0) return 0
        const prev = stopsTyped[i - 1]
        if (prev.lat == null || prev.lng == null || stop.lat == null || stop.lng == null) return 0
        return haversineKm(prev.lat, prev.lng, stop.lat, stop.lng)
      })
      totalKm = legKm.reduce((s, d) => s + d, 0)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function fmtDate(d: string | null): string {
      if (!d) return ''
      return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
    }
    function fmtTime(t: string | null): string {
      return t ? ` kl. ${t.slice(0, 5)}` : ''
    }

    type ActRow = { stop_id: string; name: string; activity_type: string | null; activity_date: string | null; activity_time: string | null; notes: string | null }
    type DinRow = { stop_id: string; name: string; booking_date: string | null; booking_time: string | null }
    type HotRow = { stop_id: string; name: string }
    type NoteRow = { stop_id: string | null; content: string }

    function stopContext(stopId: string, stopIndex: number) {
      const stopActs = ((activities ?? []) as ActRow[]).filter(a => a.stop_id === stopId)
      const stopDin  = ((dining ?? []) as DinRow[]).filter(d => d.stop_id === stopId)
      const stopHot  = ((hotels ?? []) as HotRow[]).find(h => h.stop_id === stopId)
      const stopNot  = ((notes ?? []) as NoteRow[]).filter(n => n.stop_id === stopId)
      const distKm   = legKm[stopIndex]

      const actsText = stopActs.length
        ? stopActs.map(a => {
            const typeStr = a.activity_type ? ` (${a.activity_type})` : ''
            const dateStr = a.activity_date ? ` – ${fmtDate(a.activity_date)}${fmtTime(a.activity_time)}` : ''
            const noteStr = a.notes ? ` – ${a.notes}` : ''
            return `  • ${a.name}${typeStr}${dateStr}${noteStr}`
          }).join('\n')
        : '  (ingen registrert)'

      const dinText = stopDin.length
        ? stopDin.map(d => {
            const dateStr = d.booking_date ? ` – ${fmtDate(d.booking_date)}${fmtTime(d.booking_time)}` : ''
            return `  • ${d.name}${dateStr}`
          }).join('\n')
        : '  (ingen registrert)'

      const notesText = stopNot.length ? stopNot.map(n => n.content).join(' | ') : '(ingen)'
      const drivingLine = (stopIndex > 0 && distKm > 0)
        ? `Kjørt fra forrige stoppested: ca. ${Math.round(distKm)} km\n` : ''

      return { actsText, dinText, notesText, drivingLine, stopHot }
    }

    const client = new Anthropic({ apiKey })

    // ── Helhetsoversikt ──────────────────────────────────────────────────────
    const routeStr = stopsTyped.map((s, i) => {
      const km = legKm[i] > 0 ? ` (~${Math.round(legKm[i])} km)` : ''
      return `${s.city}${s.state ? `, ${s.state}` : ''} (${s.nights} netter)${km}`
    }).join(' → ')

    const summaryPrompt = `
Reise: ${trip.name}
Periode: ${trip.date_from ?? '?'} – ${trip.date_to ?? '?'}
Reisefølge: ${((travelers ?? []) as { name: string; age: number | null }[]).map(t => `${t.name}${t.age ? ` (${t.age} år)` : ''}`).join(', ') || 'Ikke registrert'}
Transport: ${trip.transport_type ?? 'Bil'}
Total kjørelengde: ca. ${totalKm > 0 ? Math.round(totalKm) + ' km' : 'ukjent'}
Rute med kjørelengder: ${routeStr}
Totalt: ${totalNights} netter, ${stopsTyped.length} stoppesteder, ${(activities ?? []).length} aktiviteter, ${(dining ?? []).length} restaurantbesøk

Skriv et personlig reisesammendrag på 2–3 avsnitt (maks 300 ord). Nevn gjerne total kjørelengde og stedene som ble besøkt. Skriv på norsk, dagbokstil – varmt og levende.
Returner KUN ren tekst, ingen markdown.
`.trim()

    const summaryMsg = await client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 1024,
      system: 'Du er en nostalgisk reiseskribent. Skriv på norsk med et varmt, personlig dagbokspråk.',
      messages: [{ role: 'user', content: summaryPrompt }],
    })
    const summary = (summaryMsg.content[0] as { type: string; text: string }).type === 'text'
      ? (summaryMsg.content[0] as { text: string }).text.trim() : ''

    // ── Dagbokinnføringer i bolker à 5 stopp ─────────────────────────────────
    const BATCH = 5
    const allGeneratedEntries: Array<{ stop_id: string; diary_text: string; highlight: string }> = []

    for (let i = 0; i < stopsTyped.length; i += BATCH) {
      const batch = stopsTyped.slice(i, i + BATCH)

      const entriesPrompt = batch.map((stop, batchIdx) => {
        const stopIndex = i + batchIdx
        const { actsText, dinText, notesText, drivingLine, stopHot } = stopContext(stop.id, stopIndex)

        return `
=== STOPPESTED ${stopIndex + 1}: ${stop.city}${stop.state ? `, ${stop.state}` : ''} ===
Ankomst: ${stop.arrival_date ? fmtDate(stop.arrival_date) : 'ukjent dato'}. Netter: ${stop.nights}.
${drivingLine}Hotell: ${stopHot?.name ?? 'ikke registrert'}

AKTIVITETER:
${actsText}

RESTAURANTER / SPISESTEDER:
${dinText}

NOTATER: ${notesText}`.trim()
      }).join('\n\n')

      const batchPrompt = `
${entriesPrompt}

Skriv en personlig dagbokinnføring for hvert stoppested (maks 200 ord per stopp).
- Nevn konkrete aktiviteter og restauranter ved navn, med datoer der oppgitt
- Nevn kjørelengden fra forrige sted kort i innledningen dersom den er oppgitt
- Avslutt hvert innlegg med én setning som begynner med "HØYDEPUNKT: "

Returner KUN gyldig JSON (ingen markdown):
{"entries":[{"stop_id":"<id>","diary_text":"<tekst uten høydepunktlinje>","highlight":"<tekst etter HØYDEPUNKT: >"}]}

Stop-IDer: ${batch.map(s => s.id).join(', ')}
`.trim()

      const batchMsg = await client.messages.create({
        model: 'claude-haiku-4-5', max_tokens: 4096,
        system: 'Du er en nostalgisk reiseskribent. Svar KUN med gyldig JSON.',
        messages: [{ role: 'user', content: batchPrompt }],
      })

      const raw = (batchMsg.content[0] as { type: string; text?: string }).type === 'text'
        ? ((batchMsg.content[0] as { text: string }).text ?? '').trim() : ''

      try {
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
        const parsed  = JSON.parse(cleaned)
        if (parsed?.entries) allGeneratedEntries.push(...parsed.entries)
      } catch {
        console.error('JSON parse feilet for batch', i, raw.slice(0, 200))
      }
    }

    // ── Upsert memory_entries ─────────────────────────────────────────────────
    const stopOrderMap = new Map(stopsTyped.map((s, idx) => [s.id, s.order ?? idx]))

    for (const entry of allGeneratedEntries) {
      await supabase.from('memory_entries').upsert(
        {
          memory_id:  memoryId,
          stop_id:    entry.stop_id,
          diary_text: entry.diary_text,
          highlight:  entry.highlight,
          stop_order: stopOrderMap.get(entry.stop_id) ?? 0,
        },
        { onConflict: 'memory_id,stop_id' }
      )
    }

    // ── Oppdater minneboken ───────────────────────────────────────────────────
    await supabase.from('trip_memories').update({
      summary,
      total_nights: totalNights,
      total_stops:  stopsTyped.length,
      total_km:     totalKm > 0 ? Math.round(totalKm) : null,
      generated_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('id', memoryId)

    return NextResponse.json({ ok: true, summary, entryCount: allGeneratedEntries.length })
  } catch (err) {
    console.error('Minner generate error:', err)
    return NextResponse.json({ error: 'Generering feilet' }, { status: 500 })
  }
}
