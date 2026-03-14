'use client'

import { useState, useEffect } from 'react'
import { MapPin, LogOut, Loader2, Car } from 'lucide-react'
import { Stop, Trip, Hotel, Activity, RouteLeg } from '@/types'
import StopCard from './StopCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FlightPanel from './FlightPanel'
import TripManager from './TripManager'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useDrivingInfo, addMinutes } from '@/hooks/useDrivingInfo'

interface PlanSidebarProps {
  trips: Trip[]
  currentTrip: Trip | null
  tripsLoading: boolean
  stops: Stop[]
  stopsLoading: boolean
  selectedStopId: string | null
  hotels: Hotel[]
  activities: Activity[]
  onSelectStop: (id: string) => void
  onRemoveStop: (id: string) => void
  onReorderStops: (stops: Stop[]) => void
  onUpdateStop: (id: string, updates: Partial<Stop>) => void
  onSelectTrip: (trip: Trip) => void
  onCreateTrip: (name: string, year: number) => Promise<Trip | null>
  onDeleteTrip: (id: string) => void
  routeLegs?: RouteLeg[]
  routeStates?: string[]
}

export default function PlanSidebar({
  trips, currentTrip, tripsLoading,
  stops, stopsLoading,
  selectedStopId,
  hotels,
  activities,
  onSelectStop, onRemoveStop, onReorderStops, onUpdateStop,
  onSelectTrip, onCreateTrip, onDeleteTrip,
  routeLegs,
  routeStates,
}: PlanSidebarProps) {
  const [departureTimes, setDepartureTimes] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const router = useRouter()
  const drivingLegs = useDrivingInfo(stops, routeLegs)

  // ── Auto-cascade arrival dates ──────────────────────────────────────────────
  useEffect(() => {
    if (stops.length < 2) return
    stops.forEach((stop, i) => {
      if (i === stops.length - 1) return
      if (!stop.arrival_date || stop.nights < 1) return
      const next = stops[i + 1]
      const d = new Date(stop.arrival_date + 'T12:00:00')
      d.setDate(d.getDate() + stop.nights)
      const computed = d.toISOString().split('T')[0]
      if (computed !== next.arrival_date) {
        onUpdateStop(next.id, { arrival_date: computed })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.map((s) => `${s.id}:${s.arrival_date}:${s.nights}`).join('|')])

  // ── Arrival times (from departure time chain) ───────────────────────────────
  const arrivalTimes: Record<string, string> = {}
  stops.forEach((stop, i) => {
    if (i === 0) return
    const prevDeparture = departureTimes[stops[i - 1].id]
    const leg = drivingLegs[i - 1]
    if (prevDeparture && leg) {
      arrivalTimes[stop.id] = addMinutes(prevDeparture, leg.durationMinutes)
    }
  })

  const totalNights = stops.reduce((sum, s) => sum + s.nights, 0)
  const totalKm = drivingLegs.reduce((sum, l) => sum + (l?.distanceKm ?? 0), 0)
  const statesVisited = (() => {
    const all = new Set(stops.map((s) => s.state).filter(Boolean) as string[])
    for (const s of (routeStates ?? [])) all.add(s)
    return all.size
  })()

  function moveStop(index: number, direction: 'up' | 'down') {
    const updated = [...stops]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= updated.length) return
    ;[updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]]
    onReorderStops(updated.map((s, i) => ({ ...s, order: i })))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="w-[340px] min-w-[300px] h-full bg-slate-900 border-r border-slate-800 flex flex-col">
      <TripManager
        trips={trips} currentTrip={currentTrip} loading={tripsLoading}
        onSelectTrip={onSelectTrip} onCreateTrip={onCreateTrip}
        onDeleteTrip={(id) => {
          const name = trips.find((t) => t.id === id)?.name ?? 'denne turen'
          setConfirmDelete({ id, name })
        }}
      />

      {/* Fly */}
      {currentTrip && <FlightPanel tripId={currentTrip.id} />}

      {/* Stats */}
      {currentTrip && (
        <div className="px-4 py-2.5 bg-slate-800/50 border-b border-slate-800 flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{stops.length}</span> stopp
            </span>
          </div>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{statesVisited}</span> stater
          </span>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{totalNights}</span> netter
          </span>
          {totalKm > 0 && (
            <span className="text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{totalKm.toLocaleString()}</span> km
            </span>
          )}
        </div>
      )}

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {!currentTrip ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <p className="text-slate-500 text-sm">
              Velg en tur øverst, eller opprett en ny for å komme i gang
            </p>
          </div>
        ) : stopsLoading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Laster stopp…</span>
          </div>
        ) : stops.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <div className="bg-slate-800 rounded-full p-4 mb-3">
              <MapPin className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 text-sm font-medium">Ingen stopp ennå</p>
            <p className="text-slate-500 text-xs mt-1">Søk etter en by eller klikk på kartet</p>
          </div>
        ) : (
          stops.map((stop, index) => {
            const leg = index > 0 ? drivingLegs[index - 1] : null
            return (
              <div key={stop.id}>
                {/* Drive connector */}
                {index > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="flex-1 border-t border-dashed border-slate-700" />
                    {leg === null ? (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Beregner…</span>
                      </div>
                    ) : leg ? (
                      <div className="flex items-center gap-1 text-[10px] text-blue-400 font-medium whitespace-nowrap">
                        <Car className="w-2.5 h-2.5 flex-shrink-0" />
                        <span>{leg.durationText} · {leg.distanceText}</span>
                        {arrivalTimes[stop.id] && (
                          <span className="text-slate-500 ml-0.5">· {arrivalTimes[stop.id]}</span>
                        )}
                      </div>
                    ) : null}
                    <div className="flex-1 border-t border-dashed border-slate-700" />
                  </div>
                )}
                <StopCard
                  stop={stop}
                  index={index}
                  totalStops={stops.length}
                  isSelected={stop.id === selectedStopId}
                  hotel={hotels.find((h) => h.stop_id === stop.id) ?? null}
                  activities={activities.filter((a) => a.stop_id === stop.id)}
                  onSelect={() => onSelectStop(stop.id)}
                  onRemove={() => onRemoveStop(stop.id)}
                  onMoveUp={() => moveStop(index, 'up')}
                  onMoveDown={() => moveStop(index, 'down')}
                />
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-slate-800/30 border-t border-slate-800 flex items-center justify-between">
        <p className="text-xs text-slate-600">Alle endringer lagres automatisk</p>
        <button
          onClick={handleLogout}
          className="text-slate-600 hover:text-slate-400 transition-colors"
          title="Logg ut"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Slett turen "${confirmDelete.name}"? Dette kan ikke angres.`}
          onConfirm={() => { onDeleteTrip(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
