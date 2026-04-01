import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit')

export const runtime = 'nodejs'

type Mem   = { title: string | null; summary: string | null; cover_image_url: string | null; total_km: number | null; total_nights: number | null; total_stops: number | null; generated_at: string | null }
type Entry = { stop_id: string; diary_text: string | null; highlight: string | null }
type Stop  = { id: string; city: string; state: string | null; arrival_date: string | null; nights: number; order: number }

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('nb-NO') : ''
}

async function buildPDF(m: Mem, entries: Entry[], stops: Stop[]): Promise<Buffer> {
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

    // ── Helper: filled rect ────────────────────────────────────────────────
    function rect(x: number, y: number, w: number, h: number, color: string, r = 0) {
      doc.save().roundedRect(x, y, w, h, r).fill(color).restore()
    }

    // ── COVER PAGE ────────────────────────────────────────────────────────────
    rect(0, 0, W, H, BG)

    // Cover image area (top 280 px)
    rect(0, 0, W, 280, '#1e3a2f')

    // Dark overlay
    doc.save()
      .rect(0, 0, W, 280)
      .fillOpacity(0.6)
      .fill('#000000')
      .fillOpacity(1)
      .restore()

    // Title block
    doc.font('Helvetica-Bold').fontSize(26).fillColor(WHITE)
      .text(m.title ?? 'Minnebok', 40, 160, { width: W - 80 })

    const subY = doc.y + 6
    doc.font('Helvetica').fontSize(11).fillColor(SLATE400)
      .text(m.generated_at ? `Generert ${fmt(m.generated_at)}` : 'Minnebok', 40, subY)

    // Stats row (3 cards)
    const statsY = 320
    const stats = [
      { value: String(m.total_stops ?? '–'), label: 'Stoppesteder' },
      { value: String(m.total_nights ?? '–'), label: 'Netter' },
      { value: m.total_km ? `${Math.round(m.total_km).toLocaleString('nb-NO')} km` : '–', label: 'Kjørt' },
    ]
    const cardW = (W - 80 - 32) / 3   // 40px margins, 16px gaps × 2
    stats.forEach((s, i) => {
      const x = 40 + i * (cardW + 16)
      rect(x, statsY, cardW, 60, CARD, 8)
      doc.font('Helvetica-Bold').fontSize(15).fillColor(AMBER)
        .text(s.value, x, statsY + 10, { width: cardW, align: 'center' })
      doc.font('Helvetica').fontSize(9).fillColor(SLATE500)
        .text(s.label, x, statsY + 30, { width: cardW, align: 'center' })
    })

    // Summary
    if (m.summary) {
      const sumY = statsY + 80
      doc.font('Helvetica-Bold').fontSize(9).fillColor(AMBER)
        .text('REISEOVERSIKT', 40, sumY)
      doc.font('Helvetica').fontSize(11).fillColor(SLATE200)
        .text(m.summary, 40, sumY + 16, { width: W - 80, lineGap: 4 })
    }

    // ── STOP PAGES ────────────────────────────────────────────────────────────
    stops.forEach((stop, i) => {
      doc.addPage({ size: 'A4', margin: 0 })
      rect(0, 0, W, H, BG)

      const entry = entries.find(e => e.stop_id === stop.id)

      // Header
      const headerY = 40
      // Badge circle
      doc.save()
        .circle(54, headerY + 14, 14)
        .fill(AMBER_DK)
        .restore()
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#fcd34d')
        .text(String(i + 1), 40, headerY + 7, { width: 28, align: 'center' })

      // City name
      const cityStr = stop.city + (stop.state ? `, ${stop.state}` : '')
      doc.font('Helvetica-Bold').fontSize(17).fillColor('#f1f5f9')
        .text(cityStr, 78, headerY, { width: W - 118 })

      // Meta
      const metaStr = `${fmt(stop.arrival_date)} · ${stop.nights} netter`
      doc.font('Helvetica').fontSize(9).fillColor(SLATE500)
        .text(metaStr, 78, headerY + 22, { width: W - 118 })

      // Divider
      const divY = headerY + 48
      doc.save().moveTo(40, divY).lineTo(W - 40, divY).lineWidth(1).strokeColor(CARD).stroke().restore()

      let curY = divY + 16

      // Highlight
      if (entry?.highlight) {
        rect(40, curY, W - 80, 40, '#1c1208', 4)
        doc.save()
          .moveTo(40, curY)
          .lineTo(40, curY + 40)
          .lineWidth(3)
          .strokeColor(AMBER)
          .stroke()
          .restore()
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#fcd34d')
          .text(`★ ${entry.highlight}`, 52, curY + 8, { width: W - 100 })
        curY = doc.y + 16
      }

      // Diary text
      if (entry?.diary_text) {
        doc.font('Helvetica').fontSize(11).fillColor(SLATE200)
          .text(entry.diary_text, 40, curY, { width: W - 80, lineGap: 4 })
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
    ] = await Promise.all([
      supabase.from('trip_memories').select('*').eq('id', memoryId).single(),
      supabase.from('memory_entries').select('*').eq('memory_id', memoryId).order('stop_order'),
    ])

    if (!memory) return NextResponse.json({ error: 'Minnebok ikke funnet' }, { status: 404 })

    const { data: stopsRaw } = await supabase
      .from('stops').select('*').eq('trip_id', memory.trip_id).order('order')

    const m       = memory as Mem
    const entries = (entriesRaw ?? []) as Entry[]
    const stops   = ([...(stopsRaw ?? [])] as Stop[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const pdfBuffer = await buildPDF(m, entries, stops)

    return new NextResponse(pdfBuffer, {
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
