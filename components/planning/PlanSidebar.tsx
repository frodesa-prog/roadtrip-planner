'use client'

import { useState, useEffect } from 'react'

import { MapPin, Loader2, Car, CalendarDays, List, Check, X } from 'lucide-react'
import { Stop, Trip, Hotel, Activity, Dining, PossibleActivity, RouteLeg, NewTripData } from '@/types'
import StopCard from './StopCard'
import CalendarView from './CalendarView'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import TripPanels from './TripPanels'
import TripManager from './TripManager'
import NewTripWizard from './NewTripWizard'
import { useDrivingInfo, addMinutes } from '@/hooks/useDrivingInfo'
import { OPEN_NEW_TRIP_WIZARD_EVENT } from '@/components/NavBar'

interface PlanSidebarProps {
  trips: Trip[]
  currentTrip: Trip | null
  tripsLoading: boolean
  userId?: string | null
  stops: Stop[]
  stopsLoading: boolean
  selectedStopId: string | null
  hotels: Hotel[]
  activities: Activity[]
  dining: Dining[]
  possibleActivities: PossibleActivity[]
  onSelectStop: (id: string) => void
  onRemoveStop: (id: string) => void
  onReorderStops: (stops: Stop[]) => void
  onUpdateStop: (id: string, updates: Partial<Stop>) => void
  onSelectTrip: (trip: Trip) => void
  onCreateTrip: (data: NewTripData) => Promise<Trip | null>
  onDeleteTrip: (id: string) => void
  routeLegs?: RouteLeg[]
  routeStates?: string[]
  onUpdateGroupDescription?: (desc: string) => void
  onUpdateTripDates?: (dateFrom: string, dateTo: string) => void
}

export default function PlanSidebar({
  trips, currentTrip, tripsLoading, userId,
  stops, stopsLoading,
  selectedStopId,
  hotels,
  activities,
  dining,
  possibleActivities,
  onSelectStop, onRemoveStop, onReorderStops, onUpdateStop,
  onSelectTrip, onCreateTrip, onDeleteTrip,
  routeLegs,
  routeStates,
  onUpdateGroupDescription,
  onUpdateTripDates,
}: PlanSidebarProps) {
  const [departureTimes, setDepartureTimes] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showDetailed, setShowDetailed] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  // Open wizard when navigated with ?new=1 (reads URL directly, avoids useSearchParams/Suspense)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') === '1') {
      setShowWizard(true)
      window.history.replaceState({}, '', '/plan')
    }
  }, [])

  // Åpne veilederen automatisk når innlogget bruker ikke har noen reiser ennå
  useEffect(() => {
    if (!tripsLoading && userId && trips.length === 0) {
      setShowWizard(true)
    }
  }, [tripsLoading, trips.length, userId])

  useEffect(() => {
    function onOpenWizard() { setShowWizard(true) }
    window.addEventListener(OPEN_NEW_TRIP_WIZARD_EVENT, onOpenWizard)
    return () => window.removeEventListener(OPEN_NEW_TRIP_WIZARD_EVENT, onOpenWizard)
  }, [])

  // ── Edit dates state (road trip – ingen stopp-oppdatering) ──────────────────
  const [editingDates, setEditingDates] = useState(false)
  const [editDateFrom, setEditDateFrom] = useState('')
  const [editDateTo, setEditDateTo] = useState('')

  function openEditDates() {
    setEditDateFrom(currentTrip?.date_from ?? '')
    setEditDateTo(currentTrip?.date_to ?? '')
    setEditingDates(true)
  }

  function cancelEditDates() { setEditingDates(false) }

  function saveEditDates() {
    if (editDateFrom && editDateTo && editDateFrom <= editDateTo) {
      onUpdateTripDates?.(editDateFrom, editDateTo)
    }
    setEditingDates(false)
  }
  const drivingLegs = useDrivingInfo(stops, routeLegs)

  // ── Separate home stops from regular stops ──────────────────────────────────
  const homeStart     = stops.find((s) => s.stop_type === 'home_start') ?? null
  const homeEnd       = stops.find((s) => s.stop_type === 'home_end')   ?? null
  const regularStops  = stops.filter((s) => s.stop_type === 'stop')

  // ── Auto-cascade arrival dates (regular stops only) ─────────────────────────
  useEffect(() => {
    if (regularStops.length < 2) return
    regularStops.forEach((stop, i) => {
      if (i === regularStops.length - 1) return
      if (!stop.arrival_date) return  // 0 netter tillatt – neste stopp får samme dato
      const next = regularStops[i + 1]
      const d = new Date(stop.arrival_date + 'T12:00:00')
      d.setDate(d.getDate() + stop.nights)
      const computed = d.toISOString().split('T')[0]
      if (computed !== next.arrival_date) {
        onUpdateStop(next.id, { arrival_date: computed })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regularStops.map((s) => `${s.id}:${s.arrival_date}:${s.nights}`).join('|')])

  // ── Arrival times (from departure time chain, all stops) ────────────────────
  const arrivalTimes: Record<string, string> = {}
  stops.forEach((stop, i) => {
    if (i === 0) return
    const prevDeparture = departureTimes[stops[i - 1].id]
    const leg = drivingLegs[drivingLegIndex(i)]
    if (prevDeparture && leg) {
      arrivalTimes[stop.id] = addMinutes(prevDeparture, leg.durationMinutes)
    }
  })

  const totalNights = regularStops.reduce((sum, s) => sum + s.nights, 0)
  const totalKm = drivingLegs.reduce((sum, l) => sum + (l?.distanceKm ?? 0), 0)
  const statesVisited = (() => {
    if (currentTrip?.road_trip_region === 'international') {
      // For internasjonale turer brukes routeStates som er geocodet direkte
      // fra hvert stoppesteds koordinater → eksakte land uavhengig av DB-data.
      // Faller tilbake til state-feltet hvis kartet ikke er lastet ennå.
      const intlStates = routeStates && routeStates.length > 0
        ? routeStates
        : regularStops.map((s) => s.state).filter(Boolean) as string[]
      return new Set(intlStates).size
    }
    // USA: kombiner delstater fra stopp + delstater langs hele ruten
    const all = new Set(regularStops.map((s) => s.state).filter(Boolean) as string[])
    for (const s of (routeStates ?? [])) all.add(s)
    return all.size
  })()

  function moveStop(regularIndex: number, direction: 'up' | 'down') {
    const updated = [...regularStops]
    const swapIndex = direction === 'up' ? regularIndex - 1 : regularIndex + 1
    if (swapIndex < 0 || swapIndex >= updated.length) return
    ;[updated[regularIndex], updated[swapIndex]] = [updated[swapIndex], updated[regularIndex]]
    onReorderStops(updated.map((s, i) => ({ ...s, order: i })))
  }

  // Helper: get driving leg index for a stop within the full stops array
  // (home_start is index 0 in all-stops, so regular stops are offset by 1 when home_start exists)
  function drivingLegIndex(stopInAllStops: number): number {
    return stopInAllStops - 1
  }

  return (
    <div
      className={`${
        showCalendar ? 'w-full md:w-[730px]' : 'w-full md:w-[420px]'
      } h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-[width] duration-300 overflow-hidden`}
    >
      <TripManager
        currentTrip={currentTrip}
        loading={tripsLoading}
        startDate={stops.filter(s => s.arrival_date).sort((a, b) => a.arrival_date!.localeCompare(b.arrival_date!))[0]?.arrival_date ?? null}
        onEditDates={onUpdateTripDates ? openEditDates : undefined}
        showCountdown
      />

      {/* Inline datoeditor for road trip */}
      {editingDates && currentTrip && (
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/40 flex-shrink-0 space-y-2">
          <p className="text-[11px] font-medium text-slate-300">Rediger datoer</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-0.5 block">Fra</label>
              <input
                type="date"
                value={editDateFrom}
                onChange={(e) => {
                  setEditDateFrom(e.target.value)
                  if (editDateTo && e.target.value > editDateTo) setEditDateTo('')
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-0.5 block">Til</label>
              <input
                type="date"
                value={editDateTo}
                min={editDateFrom || undefined}
                onChange={(e) => setEditDateTo(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {editDateFrom && editDateTo && (
            <p className="text-[10px] text-slate-500">
              {Math.max(0, Math.round(
                (new Date(editDateTo + 'T12:00:00').getTime() - new Date(editDateFrom + 'T12:00:00').getTime()) / 86_400_000
              ))} netter
            </p>
          )}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={saveEditDates}
              disabled={!editDateFrom || !editDateTo || editDateFrom > editDateTo}
              className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              <Check className="w-3 h-3" /> Lagre
            </button>
            <button
              onClick={cancelEditDates}
              className="flex items-center gap-1 text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              <X className="w-3 h-3" /> Avbryt
            </button>
          </div>
        </div>
      )}

      <NewTripWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreateTrip={onCreateTrip}
      />

      {/* Fly tur/retur + Turfølge */}
      {currentTrip && (
        <TripPanels
          tripId={currentTrip.id}
          groupDescription={currentTrip.group_description}
          onUpdateGroupDescription={onUpdateGroupDescription}
          tripDateFrom={currentTrip.date_from ?? undefined}
          transportType={currentTrip.transport_type ?? (currentTrip.has_flight !== false ? 'fly' : 'ingen')}
        />
      )}

      {/* Stats + calendar toggle */}
      {currentTrip && (
        <div className="px-4 py-2.5 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-slate-400">
                <span className="font-semibold text-slate-200">{regularStops.length}</span> stopp
              </span>
            </div>
            <span className="text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{statesVisited}</span>{' '}
              {currentTrip?.road_trip_region === 'international' ? 'land' : 'stater'}
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

          {/* Toggle list ↔ calendar */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Detaljert-toggle – kun synlig i kalendervisning */}
            {showCalendar && (
              <button
                onClick={() => setShowDetailed((v) => !v)}
                title={showDetailed ? 'Vis kompakt' : 'Vis mer detaljert info'}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  showDetailed
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {showDetailed ? 'Kompakt' : 'Detaljert'}
              </button>
            )}

            <button
              onClick={() => setShowCalendar((v) => !v)}
              title={showCalendar ? 'Vis liste' : 'Vis kalender'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                showCalendar
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {showCalendar ? (
                <><List className="w-3 h-3" />Liste</>
              ) : (
                <><CalendarDays className="w-3 h-3" />Kalender</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stop list OR calendar view */}
      {showCalendar && currentTrip ? (
        <CalendarView
          stops={stops}
          hotels={hotels}
          activities={activities}
          dining={dining}
          drivingLegs={drivingLegs}
          selectedStopId={selectedStopId}
          onSelectStop={onSelectStop}
          detailed={showDetailed}
        />
      ) : (
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
          ) : regularStops.length === 0 && !homeStart ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="bg-slate-800 rounded-full p-4 mb-3">
                <MapPin className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm font-medium">Ingen stopp ennå</p>
              <p className="text-slate-500 text-xs mt-1">Søk etter en by eller klikk på kartet</p>
            </div>
          ) : (() => {
            // Build an ordered render list: [homeStart?, ...regularStops, homeEnd?]
            // For driving connectors we use the index in the full `stops` array
            const renderItems: { stop: Stop; allStopsIndex: number }[] = []
            if (homeStart) {
              const idx = stops.findIndex((s) => s.id === homeStart.id)
              renderItems.push({ stop: homeStart, allStopsIndex: idx })
            }
            regularStops.forEach((s) => {
              const idx = stops.findIndex((st) => st.id === s.id)
              renderItems.push({ stop: s, allStopsIndex: idx })
            })
            if (homeEnd) {
              const idx = stops.findIndex((s) => s.id === homeEnd.id)
              renderItems.push({ stop: homeEnd, allStopsIndex: idx })
            }

            return renderItems.map(({ stop, allStopsIndex }, renderIndex) => {
              const isHome = stop.stop_type === 'home_start' || stop.stop_type === 'home_end'
              const regularIndex = regularStops.findIndex((s) => s.id === stop.id)
              const leg = renderIndex > 0 ? drivingLegs[drivingLegIndex(allStopsIndex)] : null

              return (
                <div key={stop.id}>
                  {/* Drive connector between items */}
                  {renderIndex > 0 && (
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
                    index={isHome ? 0 : regularIndex}
                    totalStops={regularStops.length}
                    isSelected={stop.id === selectedStopId}
                    hotel={hotels.find((h) => h.stop_id === stop.id) ?? null}
                    activities={activities.filter((a) => a.stop_id === stop.id)}
                    dining={dining.filter((d) => d.stop_id === stop.id)}
                    possibleActivities={possibleActivities.filter((p) => p.stop_id === stop.id)}
                    isInternational={currentTrip?.road_trip_region === 'international'}
                    stopType={stop.stop_type}
                    pinLabel={
                      stop.stop_type === 'home_start'
                        ? '0'
                        : stop.stop_type === 'home_end'
                        ? (currentTrip?.different_end_location ? String(regularStops.length + 1) : '↩')
                        : undefined
                    }
                    onSelect={() => onSelectStop(stop.id)}
                    onRemove={() => onRemoveStop(stop.id)}
                    onMoveUp={() => !isHome && moveStop(regularIndex, 'up')}
                    onMoveDown={() => !isHome && moveStop(regularIndex, 'down')}
                  />
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 bg-slate-800/30 border-t border-slate-800">
        <p className="text-xs text-slate-600">Alle endringer lagres automatisk</p>
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
