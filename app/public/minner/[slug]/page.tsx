import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BookHeart, MapPin, Moon } from 'lucide-react'
import Image from 'next/image'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: memory } = await supabase
    .from('trip_memories')
    .select('title, summary, cover_image_url')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .single()

  if (!memory) return { title: 'Minnebok' }

  return {
    title:       memory.title ?? 'Minnebok',
    description: memory.summary?.slice(0, 160) ?? 'En vakker reiseminnebok',
    openGraph: {
      title:       memory.title ?? 'Minnebok',
      description: memory.summary?.slice(0, 160) ?? '',
      images:      memory.cover_image_url ? [memory.cover_image_url] : [],
    },
  }
}

export default async function PublicMemoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // Hent minnebok
  const { data: memory } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .single()

  if (!memory) notFound()

  // Hent stopp, innlegg og bilder
  const [{ data: stopsRaw }, { data: entriesRaw }, { data: photosRaw }] = await Promise.all([
    supabase.from('stops').select('*').eq('trip_id', memory.trip_id).order('order'),
    supabase.from('memory_entries').select('*').eq('memory_id', memory.id).order('stop_order'),
    supabase.from('memory_photos').select('*').eq('memory_id', memory.id).order('sort_order'),
  ])

  const stops   = stopsRaw ?? []
  const entries = entriesRaw ?? []
  const photos  = photosRaw ?? []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Hero */}
      <div
        className="relative h-64 sm:h-80 flex flex-col justify-end"
        style={{
          background: memory.cover_image_url
            ? `url(${memory.cover_image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #1e3a2f 0%, #2d1b4e 50%, #1a2744 100%)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/80" />
        <div className="relative z-10 max-w-3xl mx-auto w-full px-5 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <BookHeart className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Reiseminner</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{memory.title}</h1>
          <div className="flex gap-4 mt-2 text-xs text-white/60">
            {memory.total_stops  != null && <span>📍 {memory.total_stops} stoppesteder</span>}
            {memory.total_nights != null && <span>🌙 {memory.total_nights} netter</span>}
            {memory.total_km     != null && <span>🚗 {Math.round(memory.total_km).toLocaleString('nb-NO')} km</span>}
          </div>
        </div>
      </div>

      {/* Innhold */}
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-10 space-y-12">

        {/* Sammendrag */}
        {memory.summary && (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-amber-700/30">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">✈️ Reiseoversikt</p>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{memory.summary}</p>
          </div>
        )}

        {/* Stopp */}
        {stops.map((stop: { id: string; city: string; state: string | null; arrival_date: string | null; nights: number; order: number }, i: number) => {
          const entry      = entries.find((e: { stop_id: string }) => e.stop_id === stop.id)
          const stopPhotos = photos.filter((p: { stop_id: string | null }) => p.stop_id === stop.id)

          return (
            <div key={stop.id} className="space-y-4">
              {/* By-header */}
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="w-8 h-8 rounded-full bg-amber-900/60 border-2 border-amber-600/60 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-300 font-bold text-sm">{i + 1}</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    {stop.city}{stop.state ? `, ${stop.state}` : ''}
                    {(entry as { mood_emoji?: string | null } | undefined)?.mood_emoji && (
                      <span className="ml-2">{(entry as { mood_emoji: string }).mood_emoji}</span>
                    )}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    {stop.arrival_date && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {new Date(stop.arrival_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      {stop.nights} {stop.nights === 1 ? 'natt' : 'netter'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Høydepunkt */}
              {(entry as { highlight?: string | null } | undefined)?.highlight && (
                <div className="px-4 py-2.5 rounded-xl bg-amber-900/30 border border-amber-700/30">
                  <p className="text-xs text-amber-300">✨ <strong>Høydepunkt:</strong> {(entry as { highlight: string }).highlight}</p>
                </div>
              )}

              {/* Dagbok */}
              {(entry as { diary_text?: string | null } | undefined)?.diary_text && (
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {(entry as { diary_text: string }).diary_text}
                </p>
              )}

              {/* Bilder */}
              {stopPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {stopPhotos.map((photo: { id: string; cloudinary_url: string; thumbnail_url: string | null; caption: string | null }) => (
                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-800">
                      <Image
                        src={photo.thumbnail_url ?? photo.cloudinary_url}
                        alt={photo.caption ?? ''}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        Laget med ❤️ i Roadtrip Planner
      </footer>
    </div>
  )
}
