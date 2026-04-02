'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTripMemories } from '@/hooks/useTripMemories'
import { useMemoryPhotos } from '@/hooks/useMemoryPhotos'
import { useDrivingInfo } from '@/hooks/useDrivingInfo'
import { Trip, TripMemory, Stop, RouteLeg, Activity, Dining } from '@/types'
import MemoryTimeline from '@/components/minner/MemoryTimeline'
import MemoryStats from '@/components/minner/MemoryStats'
import MapReplay from '@/components/minner/MapReplay'
import CollageGenerator from '@/components/minner/CollageGenerator'
import PublicSharePanel from '@/components/minner/PublicSharePanel'
import MemoryPDFButton from '@/components/minner/MemoryPDFButton'
import PhotoUploadZone from '@/components/minner/PhotoUploadZone'
import PhotoManageGrid from '@/components/minner/PhotoManageGrid'
import { ArrowLeft, Sparkles, BookOpen, Image, Map, Share2 } from 'lucide-react'
import Link from 'next/link'

type Tab = 'dagbok' | 'bilder' | 'kart' | 'del'

export default function MemoryDetailPage({ params }: { params: Promise<{ memoryId: string }> }) {
  const { memoryId } = use(params)

  const [trip, setTrip]           = useState<Trip | null>(null)
  const [stops, setStops]         = useState<Stop[]>([])
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [dining, setDining]         = useState<Dining[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('dagbok')

  const supabase = useMemo(() => createClient(), [])

  // Faktisk kjørevei fra Google Directions (samme kilde som planleggeren)
  const drivingLegs = useDrivingInfo(stops, routeLegs)
  const computedTotalKm = useMemo(() => {
    if (!drivingLegs.length) return null
    const total = drivingLegs.reduce((sum, l) => sum + (l?.distanceKm ?? 0), 0)
    return total > 0 ? Math.round(total) : null
  }, [drivingLegs])

  const {
    memory, entries, generating,
    updateMemory, updateEntry, togglePublic, generateMemory,
  } = useTripMemories(trip?.id ?? null)

  const {
    photos, favoritePhotos, photosByStop,
    addPhoto, toggleFavorite, updateCaption, deletePhoto, bulkDeletePhotos, assignPhoto, bulkAssignPhotos,
  } = useMemoryPhotos(memoryId)

  // Overstyr memory fra memoryId direkte
  const [directMemory, setDirectMemory] = useState<TripMemory | null>(null)

  useEffect(() => {
    async function load() {
      const { data: mem } = await supabase
        .from('trip_memories')
        .select('*')
        .eq('id', memoryId)
        .single()

      if (!mem) { setLoading(false); return }
      setDirectMemory(mem as TripMemory)

      const [{ data: tripData }, { data: stopsData }, { data: legsData }] = await Promise.all([
        supabase.from('trips').select('*').eq('id', mem.trip_id).single(),
        supabase.from('stops').select('*').eq('trip_id', mem.trip_id).order('order'),
        supabase.from('route_legs').select('*').eq('trip_id', mem.trip_id),
      ])

      const stops = (stopsData ?? []) as Stop[]
      setTrip(tripData as Trip)
      setStops(stops)
      setRouteLegs((legsData ?? []) as RouteLeg[])

      // Fetch activities + dining keyed by stop_id
      if (stops.length > 0) {
        const stopIds = stops.map(s => s.id)
        const [{ data: actsData }, { data: dinData }] = await Promise.all([
          supabase.from('activities')
            .select('id, stop_id, name, activity_type, activity_date, activity_time, notes, url, cost, remaining_amount, map_lat, map_lng, stadium, section, seat_row, seat')
            .in('stop_id', stopIds)
            .order('activity_date', { ascending: true }),
          supabase.from('dining')
            .select('id, stop_id, name, url, booking_date, booking_time, map_lat, map_lng, notes')
            .in('stop_id', stopIds)
            .order('booking_date', { ascending: true }),
        ])
        setActivities((actsData ?? []) as Activity[])
        setDining((dinData ?? []) as Dining[])
      }

      setLoading(false)
    }
    load()
  }, [memoryId, supabase])

  // Sett fanens tittel til reisens navn
  useEffect(() => {
    const title = directMemory?.title ?? trip?.name
    if (title) document.title = title
  }, [directMemory, trip])

  // Bruk direktehentet memory hvis tilgjengelig, ellers fra hook
  const activeMemory = directMemory

  async function handleGenerate() {
    if (!trip || !activeMemory) return
    await fetch('/api/minner/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: trip.id, memoryId }),
    })
    // Refresh
    const { data } = await supabase.from('trip_memories').select('*').eq('id', memoryId).single()
    if (data) setDirectMemory(data as TripMemory)
  }

  async function handleTogglePublic() {
    if (!activeMemory) return
    const { data } = await supabase
      .from('trip_memories')
      .update({ is_public: !activeMemory.is_public, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .select()
      .single()
    if (data) setDirectMemory(data as TripMemory)
  }

  function handleCoverUpdated(url: string) {
    setDirectMemory((prev) => prev ? { ...prev, cover_image_url: url } : prev)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Laster minnebok…
      </div>
    )
  }

  if (!activeMemory) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <p>Minnebok ikke funnet.</p>
        <Link href="/minner" className="text-amber-400 hover:underline text-sm">
          ← Tilbake til minner
        </Link>
      </div>
    )
  }

  const TABS = [
    { id: 'dagbok' as Tab, label: 'Dagbok',   icon: BookOpen },
    { id: 'bilder' as Tab, label: 'Bilder',   icon: Image },
    { id: 'kart'   as Tab, label: 'Kart',     icon: Map },
    { id: 'del'    as Tab, label: 'Del & Eksporter', icon: Share2 },
  ]

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Hero-header */}
      <div
        className="relative h-48 sm:h-64 flex flex-col justify-end"
        style={{
          background: activeMemory.cover_image_url
            ? `url(${activeMemory.cover_image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #1e3a2f 0%, #2d1b4e 50%, #1a2744 100%)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80" />
        <div className="relative z-10 max-w-4xl mx-auto w-full px-4 pb-5">
          <Link href="/minner" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white mb-3 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Alle minner
          </Link>
          <h1 className="text-2xl font-bold text-white drop-shadow">{activeMemory.title ?? trip?.name}</h1>
          {trip && (
            <p className="text-sm text-white/60 mt-1">
              {trip.date_from?.slice(0, 7).replace('-', '/')} – {trip.date_to?.slice(0, 7).replace('-', '/')}
              {activeMemory.total_stops != null && ` · ${activeMemory.total_stops} stopp`}
              {activeMemory.total_nights != null && ` · ${activeMemory.total_nights} netter`}
            </p>
          )}
        </div>
      </div>

      {/* Faner */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-700/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}

            {/* Generer-knapp */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              {generating ? (
                <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Genererer…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generer AI</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Innhold */}
      <div className="max-w-4xl mx-auto px-4 pt-6">

        {/* ── Dagbok ── */}
        {activeTab === 'dagbok' && (
          <div className="space-y-6">
            <MemoryStats memory={activeMemory} computedTotalKm={computedTotalKm} />
            <MemoryTimeline
              memory={activeMemory}
              entries={entries}
              stops={stops}
              activities={activities}
              dining={dining}
              onUpdateEntry={updateEntry}
            />
          </div>
        )}

        {/* ── Bilder ── */}
        {activeTab === 'bilder' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">
                Alle bilder ({photos.length})
              </h2>
              <PhotoUploadZone memoryId={memoryId} stopId={null} addPhoto={addPhoto} />
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p>Ingen bilder ennå. Last opp bilder fra turen din!</p>
              </div>
            ) : (
              <PhotoManageGrid
                photos={photos}
                stops={stops}
                activities={activities}
                dining={dining}
                onToggleFavorite={toggleFavorite}
                onUpdateCaption={updateCaption}
                onDelete={deletePhoto}
                onBulkDelete={bulkDeletePhotos}
                onAssignPhoto={assignPhoto}
                onBulkAssign={bulkAssignPhotos}
              />
            )}
          </div>
        )}

        {/* ── Kart ── */}
        {activeTab === 'kart' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Se ruten dere kjørte animert – trykk play for å starte replay.
            </p>
            <MapReplay stops={stops} color="#f59e0b" />
          </div>
        )}

        {/* ── Del & Eksporter ── */}
        {activeTab === 'del' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Del minnebok</h2>
              <PublicSharePanel memory={activeMemory} onTogglePublic={handleTogglePublic} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Forsidebilde (kollasj)</h2>
              <CollageGenerator
                memory={activeMemory}
                favoritePhotos={favoritePhotos}
                onCoverUpdated={handleCoverUpdated}
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Eksporter</h2>
              <MemoryPDFButton memory={activeMemory} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
