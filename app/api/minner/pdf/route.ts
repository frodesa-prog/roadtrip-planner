import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  Document, Page, Text, View, Image, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

export const runtime = 'nodejs'

// Helvetica er innebygd i alle PDF-lesere – krever ingen nedlasting.

// ── Hjelpefunksjon: filtrer bort null/undefined barn ─────────────────────────
// @react-pdf/renderer aksepterer IKKE null som barn (i motsetning til React DOM)
function ch(...children: (React.ReactElement | null | undefined | false)[]): React.ReactElement[] {
  return children.filter((c): c is React.ReactElement => c != null && c !== false)
}

// ── Stiler ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  coverPage: {
    fontFamily: 'Helvetica', backgroundColor: '#0f172a', color: '#e2e8f0', padding: 0,
  },
  coverBg: { width: '100%', height: 280 },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  coverContent: { position: 'absolute', top: 160, left: 40, right: 40 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 6 },
  coverSub: { fontSize: 11, color: '#94a3b8' },
  statsRow: { flexDirection: 'row', marginTop: 32, paddingHorizontal: 40, gap: 16 },
  statBox: { flex: 1, backgroundColor: '#1e293b', borderRadius: 8, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#f59e0b' },
  statLabel: { fontSize: 9, color: '#64748b', marginTop: 3 },
  summarySection: { marginTop: 28, paddingHorizontal: 40 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#f59e0b', marginBottom: 8 },
  summaryText: { fontSize: 11, color: '#cbd5e1', lineHeight: 1.7 },

  stopPage: { fontFamily: 'Helvetica', backgroundColor: '#0f172a', color: '#e2e8f0', padding: 40 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  stopNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#92400e', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stopNumberText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fcd34d' },
  stopCity: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#f1f5f9' },
  stopMeta: { fontSize: 9, color: '#64748b', marginTop: 2 },
  highlight: { backgroundColor: '#1c1208', borderLeftWidth: 3, borderLeftColor: '#f59e0b', padding: 10, marginTop: 12, marginBottom: 12, borderRadius: 4 },
  highlightText: { fontSize: 10, color: '#fcd34d', fontStyle: 'italic' },
  diaryText: { fontSize: 11, color: '#cbd5e1', lineHeight: 1.7, marginTop: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 6 },
  photo: { width: '31%', height: 90, borderRadius: 6 },
})

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

    type Mem   = { title: string | null; summary: string | null; cover_image_url: string | null; total_km: number | null; total_nights: number | null; total_stops: number | null; generated_at: string | null }
    type Entry = { stop_id: string; diary_text: string | null; highlight: string | null; stop_order: number }
    type Stop  = { id: string; city: string; state: string | null; arrival_date: string | null; nights: number; order: number }
    type Photo = { stop_id: string | null; cloudinary_url: string; thumbnail_url: string | null }

    const m  = memory   as Mem
    const e  = (entriesRaw ?? []) as Entry[]
    const s  = ([...(stopsRaw ?? [])] as Stop[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const ph = (photosRaw ?? []) as Photo[]

    // ── Forside ───────────────────────────────────────────────────────────────
    const coverPage = React.createElement(Page, { size: 'A4', style: S.coverPage, key: 'cover' },
      ...ch(
        m.cover_image_url
          ? React.createElement(Image, { src: m.cover_image_url, style: S.coverBg })
          : React.createElement(View, { style: { ...S.coverBg, backgroundColor: '#1e3a2f' } }),

        React.createElement(View, { style: S.coverOverlay }),

        React.createElement(View, { style: S.coverContent },
          React.createElement(Text, { style: S.coverTitle }, m.title ?? 'Minnebok'),
          React.createElement(Text, { style: S.coverSub },
            m.generated_at ? `Generert ${new Date(m.generated_at).toLocaleDateString('nb-NO')}` : 'Minnebok'
          ),
        ),

        React.createElement(View, { style: S.statsRow },
          ...[
            { value: String(m.total_stops ?? '–'), label: 'Stoppesteder' },
            { value: String(m.total_nights ?? '–'), label: 'Netter' },
            { value: m.total_km ? `${Math.round(m.total_km).toLocaleString('nb-NO')} km` : '–', label: 'Kjørt' },
          ].map((st) =>
            React.createElement(View, { style: S.statBox, key: st.label },
              React.createElement(Text, { style: S.statValue }, st.value),
              React.createElement(Text, { style: S.statLabel }, st.label),
            )
          ),
        ),

        m.summary
          ? React.createElement(View, { style: S.summarySection },
              React.createElement(Text, { style: S.sectionLabel }, 'REISEOVERSIKT'),
              React.createElement(Text, { style: S.summaryText }, m.summary),
            )
          : undefined,
      )
    )

    // ── Stopp-sider ───────────────────────────────────────────────────────────
    const stopPages = s.map((stop, i) => {
      const entry      = e.find((en) => en.stop_id === stop.id)
      const stopPhotos = ph.filter((p) => p.stop_id === stop.id).slice(0, 6)

      return React.createElement(Page, { size: 'A4', style: S.stopPage, key: stop.id },
        ...ch(
          React.createElement(View, { style: S.stopHeader },
            React.createElement(View, { style: S.stopNumber },
              React.createElement(Text, { style: S.stopNumberText }, String(i + 1)),
            ),
            React.createElement(View, null,
              React.createElement(Text, { style: S.stopCity }, `${stop.city}${stop.state ? `, ${stop.state}` : ''}`),
              React.createElement(Text, { style: S.stopMeta },
                `${stop.arrival_date ? new Date(stop.arrival_date).toLocaleDateString('nb-NO') : ''} · ${stop.nights} netter`
              ),
            ),
          ),

          entry?.highlight
            ? React.createElement(View, { style: S.highlight },
                React.createElement(Text, { style: S.highlightText }, `★ ${entry.highlight}`),
              )
            : undefined,

          entry?.diary_text
            ? React.createElement(Text, { style: S.diaryText }, entry.diary_text)
            : undefined,

          stopPhotos.length > 0
            ? React.createElement(View, { style: S.photoRow },
                ...stopPhotos.map((p, pi) =>
                  React.createElement(Image, { src: p.thumbnail_url ?? p.cloudinary_url, style: S.photo, key: String(pi) })
                ),
              )
            : undefined,
        )
      )
    })

    const doc = React.createElement(Document, null, coverPage, ...stopPages)
    const pdfBuffer = await renderToBuffer(doc as React.ReactElement<import('@react-pdf/renderer').DocumentProps>)

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
