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
    // ── Hent all tripdata ────────────────────────────────────────────────────

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
      supabase.from('activities').select('stop_id, name, activity_type, activity_date, notes').eq('trip_id' as never, tripId),
      supabase.from('dining').select('stop_id, name, booking_date').eq('trip_id' as never, tripId),
      supabase.from('hotels').select('stop_id, name').eq('trip_id' as never, tripId),
      supabase.from('notes').select('stop_id, title, content').eq('trip_id', tripId).is('archived_at', null),
    ])

    if (!trip || !stops?.length) {
      return NextResponse.json({ error: 'Ingen turdata funnet' }, { status: 404 })
    }

    const totalNights = stops.reduce((s: number, st: { nights: number }) => s + (st.nights ?? 0), 0)

    // ── Beregn total kjørelengde med Haversine-formelen ──────────────────────
    function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    let totalKm = 0
    for (let i = 1; i < stops.length; i++) {
      const prev = stops[i - 1] as { lat: number | null; lng: number | null }
      const curr = stops[i]     as { lat: number | null; lng: number | null }
      if (prev.lat != null && prev.lng != null && curr.lat != null && curr.lng != null) {
        totalKm += haversineKm(prev.lat, prev.lng, curr.lat, curr.lng)
      }
    }

    // ── Hjelpefunksjon: hent per-stopp-data ──────────────────────────────────

    const stopContext = (stopId: string) => {
      const stopActs = (activities ?? []).filter((a: { stop_id: string }) => a.stop_id === stopId)
      const stopDin  = (dining ?? []).filter((d: { stop_id: string }) => d.stop_id === stopId)
      const stopHot  = (hotels ?? []).find((h: { stop_id: string }) => h.stop_id === stopId)
      const stopNot  = (notes ?? []).filter((n: { stop_id: string | null }) => n.stop_id === stopId)
      return { stopActs, stopDin, stopHot, stopNot }
    }

    const client = new Anthropic({ apiKey })

    // ── Generer helhetsoversikt ───────────────────────────────────────────────

    const summaryPrompt = `
Reise: ${trip.name}
Periode: ${trip.date_from ?? '?'} – ${trip.date_to ?? '?'}
Reisefølge: ${(travelers ?? []).map((t: { name: string; age: number | null }) => `${t.name}${t.age ? ` (${t.age} år)` : ''}`).join(', ') || 'Ikke registrert'}
Transport: ${trip.transport_type ?? 'Bil'}
Rute: ${stops.map((s: { city: string; state: string | null; nights: number }) => `${s.city}${s.state ? `, ${s.state}` : ''} (${s.nights} netter)`).join(' → ')}
Totalt: ${totalNights} netter, ${stops.length} stoppesteder

Skriv et personlig reisessammendrag på 2-3 avsnitt (maks 300 ord). Skriv på norsk, dagbokstil – varmt og levende.
Returner KUN ren tekst, ingen markdown.
`.trim()

    const summaryMsg = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 1024,
      system:     'Du er en nostalgisk reiseskribent. Skriv på norsk med et varmt, personlig dagbokspråk.',
      messages:   [{ role: 'user', content: summaryPrompt }],
    })
    const summary = (summaryMsg.content[0] as { type: string; text: string }).type === 'text'
      ? (summaryMsg.content[0] as { text: string }).text.trim()
      : ''

    // ── Generer dagbokinnføringer i bolker à 5 stopp ─────────────────────────

    const BATCH = 5
    const allGeneratedEntries: Array<{ stop_id: string; diary_text: string; highlight: string }> = []

    for (let i = 0; i < stops.length; i += BATCH) {
      const batch = stops.slice(i, i + BATCH)

      const entriesPrompt = batch.map((stop: {
        id: string; city: string; state: string | null; arrival_date: string | null; nights: number
      }) => {
        const { stopActs, stopDin, stopHot, stopNot } = stopContext(stop.id)
        return `
--- STOPPESTED: ${stop.city}${stop.state ? `, ${stop.state}` : ''} ---
Ankomst: ${stop.arrival_date ?? 'ukjent'}. Netter: ${stop.nights}.
Hotell: ${stopHot?.name ?? 'ikke registrert'}
Aktiviteter: ${stopActs.length ? stopActs.map((a: { name: string }) => a.name).join(', ') : 'ingen'}
Restauranter: ${stopDin.length ? stopDin.map((d: { name: string }) => d.name).join(', ') : 'ingen'}
Notater: ${stopNot.length ? stopNot.map((n: { content: string }) => n.content).join(' | ') : 'ingen'}
`
      }).join('\n')

      const batchPrompt = `
${entriesPrompt}

For hvert stoppested ovenfor, skriv en kort dagbokinnføring (maks 180 ord) på norsk.
Avslutt hvert innlegg med én setning som begynner med "HØYDEPUNKT: " som oppsummerer det beste øyeblikket.

Returner KUN gyldig JSON (ingen markdown, ingen forklaring):
{
  "entries": [
    {
      "stop_id": "<stop.id>",
      "diary_text": "<dagboktekst uten høydepunktlinjen>",
      "highlight": "<teksten etter HØYDEPUNKT: >"
    }
  ]
}

Stop-IDer i denne bolken: ${batch.map((s: { id: string }) => s.id).join(', ')}
`.trim()

      const batchMsg = await client.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 4096,
        system:     'Du er en nostalgisk reiseskribent. Svar KUN med gyldig JSON.',
        messages:   [{ role: 'user', content: batchPrompt }],
      })

      const raw = (batchMsg.content[0] as { type: string; text?: string }).type === 'text'
        ? ((batchMsg.content[0] as { text: string }).text ?? '').trim()
        : ''

      try {
        // Fjern eventuelle markdown-kodefelt
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
        const parsed = JSON.parse(cleaned)
        if (parsed?.entries) allGeneratedEntries.push(...parsed.entries)
      } catch {
        console.error('JSON parse feilet for batch', i, raw.slice(0, 200))
      }
    }

    // ── Upsert memory_entries ─────────────────────────────────────────────────

    const stopOrderMap = new Map(stops.map((s: { id: string; order: number }, idx: number) => [s.id, s.order ?? idx]))

    for (const entry of allGeneratedEntries) {
      await supabase
        .from('memory_entries')
        .upsert(
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

    const stats = {
      summary,
      total_nights: totalNights,
      total_stops:  stops.length,
      total_km:     totalKm > 0 ? Math.round(totalKm) : null,
      generated_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }

    await supabase.from('trip_memories').update(stats).eq('id', memoryId)

    return NextResponse.json({ ok: true, summary, entryCount: allGeneratedEntries.length })
  } catch (err) {
    console.error('Minner generate error:', err)
    return NextResponse.json({ error: 'Generering feilet' }, { status: 500 })
  }
}
