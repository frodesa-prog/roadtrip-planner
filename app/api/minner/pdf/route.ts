import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

export const runtime = 'nodejs'

// ── Fonter ────────────────────────────────────────────────────────────────────

// Bruker Helvetica – innebygd i alle PDF-lesere, krever ingen nedlasting

// ── Stiler ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    backgroundColor: '#0f172a',
    color:           '#e2e8f0',
    padding:         40,
  },
  coverPage: {
    fontFamily:      'Helvetica',
    backgroundColor: '#0f172a',
    color:           '#e2e8f0',
    padding:         0,
    position:        'relative',
  },
  coverBg: {
    width:  '100%',
    height: 320,
    objectFit: 'cover',
  },
  coverOverlay: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverContent: {
    position: 'absolute',
    top:      200,
    left:     40,
    right:    40,
  },
  coverTitle: {
    fontSize:   28,
    fontWeight: 700,
    color:      '#ffffff',
    marginBottom: 6,
  },
  coverSub: {
    fontSize: 12,
    color:    '#94a3b8',
  },
  statsRow: {
    flexDirection: 'row',
    gap:           20,
    marginTop:     40,
    paddingHorizontal: 40,
  },
  statBox: {
    flex:            1,
    backgroundColor: '#1e293b',
    borderRadius:    8,
    padding:         12,
    alignItems:      'center',
  },
  statValue: {
    fontSize:   16,
    fontWeight: 700,
    color:      '#f59e0b',
  },
  statLabel: {
    fontSize: 9,
    color:    '#64748b',
    marginTop: 3,
  },
  summarySection: {
    marginTop:   32,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  sectionLabel: {
    fontSize:   9,
    fontWeight: 700,
    color:      '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  summaryText: {
    fontSize:   11,
    color:      '#cbd5e1',
    lineHeight: 1.7,
  },
  stopPage: {
    fontFamily:      'Helvetica',
    backgroundColor: '#0f172a',
    color:           '#e2e8f0',
    padding:         40,
  },
  stopHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   20,
    paddingBottom:  12,
    borderBottom:   '1px solid #1e293b',
  },
  stopNumber: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#92400e',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     10,
  },
  stopNumberText: {
    fontSize:   12,
    fontWeight: 700,
    color:      '#fcd34d',
  },
  stopCity: {
    fontSize:   18,
    fontWeight: 700,
    color:      '#f1f5f9',
  },
  stopMeta: {
    fontSize: 9,
    color:    '#64748b',
    marginTop: 2,
  },
  highlight: {
    backgroundColor: 'rgba(146,64,14,0.3)',
    borderLeft:      '3px solid #f59e0b',
    padding:         10,
    marginTop:       12,
    marginBottom:    12,
    borderRadius:    4,
  },
  highlightText: {
    fontSize: 10,
    color:    '#fcd34d',
    fontStyle: 'italic',
  },
  diaryText: {
    fontSize:   11,
    color:      '#cbd5e1',
    lineHeight: 1.7,
    marginTop:  8,
  },
  photoRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            6,
    marginTop:      16,
  },
  photo: {
    width:  '31%',
    height: 90,
    borderRadius: 6,
    objectFit: 'cover',
  },
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
      .from('stops')
      .select('*')
      .eq('trip_id', memory.trip_id)
      .order('order')

    const element = React.createElement(Document, null,
      // Re-use the same document structure via inline render
      ...(() => {
        const m = memory as {
          title: string | null; summary: string | null; cover_image_url: string | null
          total_km: number | null; total_nights: number | null; total_stops: number | null
          generated_at: string | null; trip_id: string
        }
        const e  = (entriesRaw ?? []) as Array<{ stop_id: string; diary_text: string | null; highlight: string | null; stop_order: number }>
        const s  = (stopsRaw  ?? []).sort((a: { order: number }, b: { order: number }) => (a.order ?? 0) - (b.order ?? 0)) as Array<{ id: string; city: string; state: string | null; arrival_date: string | null; nights: number; order: number }>
        const ph = (photosRaw ?? []) as Array<{ stop_id: string | null; cloudinary_url: string; thumbnail_url: string | null; is_favorite: boolean }>

        const pages: React.ReactElement[] = []

        // Forside
        pages.push(
          React.createElement(Page, { size: 'A4', style: styles.coverPage, key: 'cover' },
            m.cover_image_url
              ? React.createElement(Image, { src: m.cover_image_url, style: styles.coverBg })
              : React.createElement(View, { style: { ...styles.coverBg, backgroundColor: '#1e3a2f' } }),
            React.createElement(View, { style: styles.coverOverlay }),
            React.createElement(View, { style: styles.coverContent },
              React.createElement(Text, { style: styles.coverTitle }, m.title ?? 'Minnebok'),
              React.createElement(Text, { style: styles.coverSub }, `Generert ${m.generated_at ? new Date(m.generated_at).toLocaleDateString('nb-NO') : ''}`),
            ),
            React.createElement(View, { style: styles.statsRow },
              ...[
                { value: `${m.total_stops ?? '–'}`, label: 'Stoppesteder' },
                { value: `${m.total_nights ?? '–'}`, label: 'Netter' },
                { value: m.total_km ? `${Math.round(m.total_km).toLocaleString('nb-NO')} km` : '–', label: 'Kjørt' },
              ].map((st) =>
                React.createElement(View, { style: styles.statBox, key: st.label },
                  React.createElement(Text, { style: styles.statValue }, st.value),
                  React.createElement(Text, { style: styles.statLabel }, st.label),
                )
              ),
            ),
            m.summary
              ? React.createElement(View, { style: styles.summarySection },
                  React.createElement(Text, { style: styles.sectionLabel }, 'Reiseoversikt'),
                  React.createElement(Text, { style: styles.summaryText }, m.summary),
                )
              : null,
          )
        )

        // Stopp-sider
        s.forEach((stop, i) => {
          const entry      = e.find((en) => en.stop_id === stop.id)
          const stopPhotos = ph.filter((p) => p.stop_id === stop.id).slice(0, 6)

          pages.push(
            React.createElement(Page, { size: 'A4', style: styles.stopPage, key: stop.id },
              React.createElement(View, { style: styles.stopHeader },
                React.createElement(View, { style: styles.stopNumber },
                  React.createElement(Text, { style: styles.stopNumberText }, String(i + 1)),
                ),
                React.createElement(View, null,
                  React.createElement(Text, { style: styles.stopCity }, `${stop.city}${stop.state ? `, ${stop.state}` : ''}`),
                  React.createElement(Text, { style: styles.stopMeta }, `${stop.arrival_date ? new Date(stop.arrival_date).toLocaleDateString('nb-NO') : ''} · ${stop.nights} netter`),
                ),
              ),
              entry?.highlight
                ? React.createElement(View, { style: styles.highlight },
                    React.createElement(Text, { style: styles.highlightText }, `✨ ${entry.highlight}`),
                  )
                : null,
              entry?.diary_text
                ? React.createElement(Text, { style: styles.diaryText }, entry.diary_text)
                : null,
              stopPhotos.length > 0
                ? React.createElement(View, { style: styles.photoRow },
                    ...stopPhotos.map((p) =>
                      React.createElement(Image, { src: p.thumbnail_url ?? p.cloudinary_url, style: styles.photo, key: p.cloudinary_url })
                    ),
                  )
                : null,
            )
          )
        })

        return pages
      })()
    ) as React.ReactElement<import('@react-pdf/renderer').DocumentProps>

    const pdfBuffer = await renderToBuffer(element)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${(memory.title ?? 'Minnebok').replace(/[^a-zA-Z0-9-_ æøå]/gi, '_')}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generering feilet:', err)
    return NextResponse.json({ error: 'PDF-generering feilet' }, { status: 500 })
  }
}
