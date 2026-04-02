import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit')

export const runtime = 'nodejs'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mem   = { title: string | null; summary: string | null; cover_image_url: string | null; total_km: number | null; total_nights: number | null; total_stops: number | null; generated_at: string | null }
type Entry = { stop_id: string; diary_text: string | null; highlight: string | null }
type Stop  = { id: string; city: string; state: string | null; arrival_date: string | null; nights: number; order: number }
type Photo = { stop_id: string | null; cloudinary_url: string; thumbnail_url: string | null; caption: string | null }
type Act   = { stop_id: string; name: string; activity_type: string | null; activity_date: string | null; activity_time: string | null; notes: string | null; url: string | null }
type Din   = { stop_id: string; name: string; booking_date: string | null; booking_time: string | null; url: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : ''
}
function fmtTime(t: string | null): string {
  return t ? ` ${t.slice(0, 5)}` : ''
}

const ACT_TYPE_LABELS: Record<string, string> = {
  baseball: 'Baseball', trening: 'Trening', hiking: 'Hiking',
  sightseeing: 'Sightseeing', shopping: 'Shopping', mat: 'Mat',
}
function actLabel(type: string | null): string {
  if (!type) return ''
  return ACT_TYPE_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1))
}

function cloudinaryTransform(url: string, transform: string): string {
  return url.replace('/upload/', `/upload/${transform}/`)
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildPDF(
  m: Mem,
  entries: Entry[],
  stops: Stop[],
  actsByStop: Map<string, Act[]>,
  dinByStop:  Map<string, Din[]>,
  coverBuf: Buffer | null,
  photosByStop: Map<string, Buffer[]>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: m.title ?? 'Minnebok' } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width   // 595
    const H = doc.page.height  // 842

    // ── Palette ───────────────────────────────────────────────────────────────
    const BG       = '#0f172a'
    const CARD     = '#1e293b'
    const AMBER    = '#f59e0b'
    const AMBER_DK = '#92400e'
    const WHITE    = '#ffffff'
    const SLATE200 = '#e2e8f0'
    const SLATE400 = '#94a3b8'
    const SLATE500 = '#64748b'
    const PURPLE   = '#a78bfa'
    const PAGE_BOTTOM = H - 40

    function rect(x: number, y: number, w: number, h: number, color: string, r = 0) {
      doc.save().roundedRect(x, y, w, h, r).fill(color).restore()
    }

    function newStopPage() {
      doc.addPage({ size: 'A4', margin: 0 })
      rect(0, 0, W, H, BG)
      return 40
    }

    // ── COVER PAGE ────────────────────────────────────────────────────────────
    rect(0, 0, W, H, BG)

    if (coverBuf) {
      try { doc.image(coverBuf, 0, 0, { width: W, height: 280, cover: [W, 280] }) }
      catch { rect(0, 0, W, 280, '#1e3a2f') }
    } else {
      rect(0, 0, W, 280, '#1e3a2f')
    }

    doc.save().rect(0, 0, W, 280).fillOpacity(0.55).fill('#000000').fillOpacity(1).restore()

    doc.font('Helvetica-Bold').fontSize(26).fillColor(WHITE)
      .text(m.title ?? 'Minnebok', 40, 160, { width: W - 80 })
    doc.font('Helvetica').fontSize(11).fillColor(SLATE400)
      .text(m.generated_at ? `Generert ${fmtDate(m.generated_at)}` : 'Minnebok', 40, doc.y + 6)

    const statsY = 320
    const statsData = [
      { value: String(m.total_stops ?? '–'), label: 'Stoppesteder' },
      { value: String(m.total_nights ?? '–'), label: 'Netter' },
      { value: m.total_km ? `${Math.round(m.total_km).toLocaleString('nb-NO')} km` : '–', label: 'Kjørt' },
    ]
    const cardW = (W - 80 - 32) / 3
    statsData.forEach((s, i) => {
      const x = 40 + i * (cardW + 16)
      rect(x, statsY, cardW, 60, CARD, 8)
      doc.font('Helvetica-Bold').fontSize(15).fillColor(AMBER).text(s.value, x, statsY + 10, { width: cardW, align: 'center' })
      doc.font('Helvetica').fontSize(9).fillColor(SLATE500).text(s.label, x, statsY + 30, { width: cardW, align: 'center' })
    })

    if (m.summary) {
      const sumY = statsY + 80
      doc.font('Helvetica-Bold').fontSize(9).fillColor(AMBER).text('REISEOVERSIKT', 40, sumY)
      doc.font('Helvetica').fontSize(11).fillColor(SLATE200).text(m.summary, 40, doc.y + 6, { width: W - 80, lineGap: 4 })
    }

    // ── STOP PAGES ────────────────────────────────────────────────────────────
    const COLS    = 3
    const PGAP    = 8
    const PHOTO_W = Math.floor((W - 80 - PGAP * (COLS - 1)) / COLS)
    const PHOTO_H = Math.round(PHOTO_W * 0.72)

    stops.forEach((stop, si) => {
      let curY = newStopPage()

      const entry = entries.find(e => e.stop_id === stop.id)
      const acts  = actsByStop.get(stop.id) ?? []
      const dins  = dinByStop.get(stop.id) ?? []
      const bufs  = photosByStop.get(stop.id) ?? []

      // ── Header ──
      doc.save().circle(54, curY + 14, 14).fill(AMBER_DK).restore()
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#fcd34d')
        .text(String(si + 1), 40, curY + 7, { width: 28, align: 'center' })
      doc.font('Helvetica-Bold').fontSize(17).fillColor('#f1f5f9')
        .text(stop.city + (stop.state ? `, ${stop.state}` : ''), 78, curY, { width: W - 118 })
      doc.font('Helvetica').fontSize(9).fillColor(SLATE500)
        .text(`${fmtDate(stop.arrival_date)} · ${stop.nights} netter`, 78, curY + 22, { width: W - 118 })

      const divY = curY + 48
      doc.save().moveTo(40, divY).lineTo(W - 40, divY).lineWidth(1).strokeColor(CARD).stroke().restore()
      curY = divY + 16

      // ── Highlight ──
      if (entry?.highlight) {
        const hlH = 42
        rect(40, curY, W - 80, hlH, '#1c1208', 4)
        doc.save().moveTo(40, curY).lineTo(40, curY + hlH).lineWidth(3).strokeColor(AMBER).stroke().restore()
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#fcd34d')
          .text(`★ ${entry.highlight}`, 52, curY + 10, { width: W - 100 })
        curY += hlH + 14
      }

      // ── Diary text ──
      if (entry?.diary_text) {
        doc.font('Helvetica').fontSize(11).fillColor(SLATE200)
          .text(entry.diary_text, 40, curY, { width: W - 80, lineGap: 4 })
        curY = doc.y + 14
      }

      // ── Activities ──
      if (acts.length > 0) {
        if (curY + 32 > PAGE_BOTTOM) curY = newStopPage()

        doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER)
          .text('AKTIVITETER', 40, curY)
        curY = doc.y + 5

        for (const act of acts) {
          const hasNotes = !!act.notes
          const rowH = hasNotes ? 38 : 22
          if (curY + rowH > PAGE_BOTTOM) curY = newStopPage()

          // Thin row separator
          doc.save().moveTo(40, curY).lineTo(W - 40, curY).lineWidth(0.5).strokeColor(CARD).stroke().restore()
          curY += 5

          // Type label
          const typeStr = actLabel(act.activity_type)
          if (typeStr) {
            doc.font('Helvetica').fontSize(9).fillColor(SLATE500)
              .text(typeStr, 40, curY, { width: 82 })
          }

          // Name (+ ↗ if has URL)
          const nameStr = act.name + (act.url ? '  \u2197' : '')
          doc.font('Helvetica-Bold').fontSize(10).fillColor(SLATE200)
            .text(nameStr, 128, curY, { width: W - 208 })

          // Date + time (right-aligned)
          const dateStr = fmtDate(act.activity_date) + fmtTime(act.activity_time)
          if (dateStr) {
            doc.font('Helvetica').fontSize(9).fillColor(SLATE400)
              .text(dateStr, W - 120, curY, { width: 80, align: 'right' })
          }

          curY += 14

          if (hasNotes) {
            doc.font('Helvetica-Oblique').fontSize(9).fillColor(SLATE500)
              .text(act.notes!, 128, curY, { width: W - 168 })
            curY = doc.y + 4
          } else {
            curY += 4
          }
        }
        curY += 10
      }

      // ── Dining ──
      if (dins.length > 0) {
        if (curY + 32 > PAGE_BOTTOM) curY = newStopPage()

        doc.font('Helvetica-Bold').fontSize(8).fillColor(PURPLE)
          .text('RESTAURANTER / SPISESTEDER', 40, curY)
        curY = doc.y + 5

        for (const d of dins) {
          if (curY + 22 > PAGE_BOTTOM) curY = newStopPage()

          doc.save().moveTo(40, curY).lineTo(W - 40, curY).lineWidth(0.5).strokeColor(CARD).stroke().restore()
          curY += 5

          // Name (+ ↗ if has URL)
          const nameStr = d.name + (d.url ? '  \u2197' : '')
          doc.font('Helvetica-Bold').fontSize(10).fillColor(SLATE200)
            .text(nameStr, 40, curY, { width: W - 160 })

          // Date + time (right-aligned)
          const dateStr = fmtDate(d.booking_date) + fmtTime(d.booking_time)
          if (dateStr) {
            doc.font('Helvetica').fontSize(9).fillColor(SLATE400)
              .text(dateStr, W - 120, curY, { width: 80, align: 'right' })
          }
          curY += 18
        }
        curY += 10
      }

      // ── Photo grid ──
      if (bufs.length > 0) {
        if (curY + PHOTO_H + 20 > PAGE_BOTTOM) curY = newStopPage()

        doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER).text('BILDER', 40, curY)
        curY = doc.y + 8

        bufs.forEach((buf, pi) => {
          const col = pi % COLS
          const row = Math.floor(pi / COLS)
          const x = 40 + col * (PHOTO_W + PGAP)
          const y = curY + row * (PHOTO_H + PGAP)
          if (y + PHOTO_H > PAGE_BOTTOM) return
          rect(x, y, PHOTO_W, PHOTO_H, CARD, 4)
          try {
            doc.save().roundedRect(x, y, PHOTO_W, PHOTO_H, 4).clip()
              .image(buf, x, y, { width: PHOTO_W, height: PHOTO_H, cover: [PHOTO_W, PHOTO_H] })
              .restore()
          } catch { /* keep placeholder */ }
        })
      }
    })

    doc.end()
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memoryId } = await req.json()
  if (!memoryId) return NextResponse.json({ error: 'memoryId er påkrevd' }, { status: 400 })

  try {
    const [
      { data: memory },
      { data: entriesRaw },
      { data: photosRaw },
    ] = await Promise.all([
      supabase.from('trip_memories').select('*').eq('id', memoryId).single(),
      supabase.from('memory_entries').select('*').eq('memory_id', memoryId).order('stop_order'),
      supabase.from('memory_photos').select('*').eq('memory_id', memoryId).order('sort_order'),
    ])

    if (!memory) return NextResponse.json({ error: 'Minnebok ikke funnet' }, { status: 404 })

    const { data: stopsRaw } = await supabase
      .from('stops').select('*').eq('trip_id', memory.trip_id).order('order')

    const stops = ([...(stopsRaw ?? [])] as Stop[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const stopIds = stops.map(s => s.id)

    // Fetch activities + dining for all stops
    const [{ data: actsRaw }, { data: dinsRaw }] = await Promise.all([
      supabase.from('activities')
        .select('stop_id, name, activity_type, activity_date, activity_time, notes, url')
        .in('stop_id', stopIds)
        .order('activity_date', { ascending: true }),
      supabase.from('dining')
        .select('stop_id, name, booking_date, booking_time, url')
        .in('stop_id', stopIds)
        .order('booking_date', { ascending: true }),
    ])

    const m       = memory as Mem
    const entries = (entriesRaw ?? []) as Entry[]
    const photos  = (photosRaw ?? []) as Photo[]
    const acts    = (actsRaw ?? []) as Act[]
    const dins    = (dinsRaw ?? []) as Din[]

    // Group activities and dining by stop
    const actsByStop = new Map<string, Act[]>()
    const dinByStop  = new Map<string, Din[]>()
    for (const a of acts) {
      if (!actsByStop.has(a.stop_id)) actsByStop.set(a.stop_id, [])
      actsByStop.get(a.stop_id)!.push(a)
    }
    for (const d of dins) {
      if (!dinByStop.has(d.stop_id)) dinByStop.set(d.stop_id, [])
      dinByStop.get(d.stop_id)!.push(d)
    }

    // ── Pre-fetch images ──────────────────────────────────────────────────────
    const coverBufPromise = m.cover_image_url
      ? fetchImage(cloudinaryTransform(m.cover_image_url, 'c_fill,w_595,h_280,q_80'))
      : Promise.resolve(null)

    const photosByStopRaw: Record<string, Photo[]> = {}
    for (const p of photos) {
      if (!p.stop_id) continue
      if (!photosByStopRaw[p.stop_id]) photosByStopRaw[p.stop_id] = []
      if (photosByStopRaw[p.stop_id].length < 6) photosByStopRaw[p.stop_id].push(p)
    }

    const photoFetchEntries = Object.entries(photosByStopRaw).flatMap(([stopId, ps]) =>
      ps.map(p => ({ stopId, url: cloudinaryTransform(p.cloudinary_url, 'c_fill,w_200,h_150,q_75') }))
    )

    const [coverBuf, ...photoBufs] = await Promise.all([
      coverBufPromise,
      ...photoFetchEntries.map(e => fetchImage(e.url)),
    ])

    const photosByStop = new Map<string, Buffer[]>()
    photoFetchEntries.forEach((e, i) => {
      const buf = photoBufs[i]
      if (!buf) return
      if (!photosByStop.has(e.stopId)) photosByStop.set(e.stopId, [])
      photosByStop.get(e.stopId)!.push(buf)
    })

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const pdfBuffer = await buildPDF(
      m, entries, stops,
      actsByStop, dinByStop,
      coverBuf as Buffer | null,
      photosByStop,
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${(m.title ?? 'Minnebok').replace(/[^a-zA-Z0-9 _æøåÆØÅ-]/g, '_')}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('PDF generering feilet:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
