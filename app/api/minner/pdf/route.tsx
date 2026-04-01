import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

export const runtime = 'nodejs'

// ── Stiler ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  coverPage:    { fontFamily: 'Helvetica', backgroundColor: '#0f172a', color: '#e2e8f0', padding: 0 },
  coverBg:      { width: '100%', height: 280 },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  coverContent: { position: 'absolute', top: 160, left: 40, right: 40 },
  coverTitle:   { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 6 },
  coverSub:     { fontSize: 11, color: '#94a3b8' },
  statsRow:     { flexDirection: 'row', marginTop: 32, paddingHorizontal: 40, gap: 16 },
  statBox:      { flex: 1, backgroundColor: '#1e293b', borderRadius: 8, padding: 12, alignItems: 'center' },
  statValue:    { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#f59e0b' },
  statLabel:    { fontSize: 9,  color: '#64748b', marginTop: 3 },
  summarySection: { marginTop: 28, paddingHorizontal: 40 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#f59e0b', marginBottom: 8 },
  summaryText:  { fontSize: 11, color: '#cbd5e1', lineHeight: 1.7 },

  stopPage:   { fontFamily: 'Helvetica', backgroundColor: '#0f172a', color: '#e2e8f0', padding: 40 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  stopBadge:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#92400e', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stopBadgeText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fcd34d' },
  stopCity:   { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#f1f5f9' },
  stopMeta:   { fontSize: 9, color: '#64748b', marginTop: 2 },
  highlight:  { backgroundColor: '#1c1208', borderLeftWidth: 3, borderLeftColor: '#f59e0b', padding: 10, marginTop: 12, marginBottom: 12, borderRadius: 4 },
  highlightText: { fontSize: 10, color: '#fcd34d', fontStyle: 'italic' },
  diaryText:  { fontSize: 11, color: '#cbd5e1', lineHeight: 1.7, marginTop: 8 },
  photoRow:   { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 6 },
  photo:      { width: '31%', height: 90, borderRadius: 6 },
})

// ── Types ─────────────────────────────────────────────────────────────────────

type Mem   = { title: string | null; summary: string | null; cover_image_url: string | null; total_km: number | null; total_nights: number | null; total_stops: number | null; generated_at: string | null }
type Entry = { stop_id: string; diary_text: string | null; highlight: string | null }
type Stop  = { id: string; city: string; state: string | null; arrival_date: string | null; nights: number; order: number }
type Photo = { stop_id: string | null; cloudinary_url: string; thumbnail_url: string | null }

// ── PDF-komponent (JSX) ───────────────────────────────────────────────────────

function MemoryPDF({ m, entries, stops, photos }: { m: Mem; entries: Entry[]; stops: Stop[]; photos: Photo[] }) {
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('nb-NO') : ''

  return (
    <Document>
      {/* ── Forside ── */}
      <Page size="A4" style={S.coverPage}>
        {m.cover_image_url
          ? <Image src={m.cover_image_url} style={S.coverBg} />
          : <View style={{ ...S.coverBg, backgroundColor: '#1e3a2f' }} />
        }
        <View style={S.coverOverlay} />
        <View style={S.coverContent}>
          <Text style={S.coverTitle}>{m.title ?? 'Minnebok'}</Text>
          <Text style={S.coverSub}>{m.generated_at ? `Generert ${fmt(m.generated_at)}` : 'Minnebok'}</Text>
        </View>
        <View style={S.statsRow}>
          {[
            { value: String(m.total_stops ?? '–'), label: 'Stoppesteder' },
            { value: String(m.total_nights ?? '–'), label: 'Netter' },
            { value: m.total_km ? `${Math.round(m.total_km).toLocaleString('nb-NO')} km` : '–', label: 'Kjørt' },
          ].map(st => (
            <View key={st.label} style={S.statBox}>
              <Text style={S.statValue}>{st.value}</Text>
              <Text style={S.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
        {m.summary && (
          <View style={S.summarySection}>
            <Text style={S.sectionLabel}>REISEOVERSIKT</Text>
            <Text style={S.summaryText}>{m.summary}</Text>
          </View>
        )}
      </Page>

      {/* ── Stopp-sider ── */}
      {stops.map((stop, i) => {
        const entry      = entries.find(e => e.stop_id === stop.id)
        const stopPhotos = photos.filter(p => p.stop_id === stop.id).slice(0, 6)
        return (
          <Page key={stop.id} size="A4" style={S.stopPage}>
            <View style={S.stopHeader}>
              <View style={S.stopBadge}>
                <Text style={S.stopBadgeText}>{String(i + 1)}</Text>
              </View>
              <View>
                <Text style={S.stopCity}>{stop.city}{stop.state ? `, ${stop.state}` : ''}</Text>
                <Text style={S.stopMeta}>{fmt(stop.arrival_date)} · {stop.nights} netter</Text>
              </View>
            </View>
            {entry?.highlight && (
              <View style={S.highlight}>
                <Text style={S.highlightText}>★ {entry.highlight}</Text>
              </View>
            )}
            {entry?.diary_text && (
              <Text style={S.diaryText}>{entry.diary_text}</Text>
            )}
            {stopPhotos.length > 0 && (
              <View style={S.photoRow}>
                {stopPhotos.map((p, pi) => (
                  <Image key={pi} src={p.thumbnail_url ?? p.cloudinary_url} style={S.photo} />
                ))}
              </View>
            )}
          </Page>
        )
      })}
    </Document>
  )
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

    const m       = memory as Mem
    const entries = (entriesRaw ?? []) as Entry[]
    const stops   = ([...(stopsRaw ?? [])] as Stop[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const photos  = (photosRaw ?? []) as Photo[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(<MemoryPDF m={m} entries={entries} stops={stops} photos={photos} /> as any)

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
