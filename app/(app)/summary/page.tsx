'use client'

import { useState, useMemo } from 'react'
import { Loader2, Car, CalendarDays, Hotel as HotelIcon, PlaneTakeoff, PlaneLanding, X, Clock, FileText, Plus, Navigation, UtensilsCrossed, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities, UpdateActivityData } from '@/hooks/useActivities'
import { useDining } from '@/hooks/useDining'
import { usePossibleActivities } from '@/hooks/usePossibleActivities'
import { ActivityTypeIcon, getActivityTypeConfig, ACTIVITY_TYPE_PRESETS } from '@/lib/activityTypes'
import { useDrivingInfo, LegInfo } from '@/hooks/useDrivingInfo'
import { useFlights } from '@/hooks/useFlights'
import { useNotes } from '@/hooks/useNotes'
import TripManager from '@/components/planning/TripManager'
import StopDetailPanel from '@/components/planning/StopDetailPanel'
import { Stop, Activity, Flight, Note, Dining } from '@/types'
import { UpdateDiningData } from '@/hooks/useDining'
import { getOffset, calcFlightMinutes, calcStopoverMinutes, formatDuration } from '@/data/airports'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function buildWeeks(stops: Stop[]): Date[][] {
  const dated = stops.filter((s) => s.arrival_date)
  if (dated.length === 0) return []

  const firstDate = new Date(dated[0].arrival_date! + 'T12:00:00')

  // Find Monday of the first week (ISO week: Mon=start)
  const start = new Date(firstDate)
  const dow = start.getDay()
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

  // Always show exactly 6 complete weeks
  const weeks: Date[][] = []
  const cur = new Date(start)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

// Color palettes per stop – 11 distinct hues (full Tailwind strings for PurgeCSS)
const PALETTES = [
  { bg: 'bg-blue-900/50',    border: 'border-blue-700/60',    sel: 'ring-blue-400',    text: 'text-blue-200',    drive: 'text-blue-300',    dot: 'bg-blue-400'    },
  { bg: 'bg-emerald-900/50', border: 'border-emerald-700/60', sel: 'ring-emerald-400', text: 'text-emerald-200', drive: 'text-emerald-300', dot: 'bg-emerald-400' },
  { bg: 'bg-amber-900/50',   border: 'border-amber-700/60',   sel: 'ring-amber-400',   text: 'text-amber-200',   drive: 'text-amber-300',   dot: 'bg-amber-400'   },
  { bg: 'bg-pink-900/50',    border: 'border-pink-700/60',    sel: 'ring-pink-400',    text: 'text-pink-200',    drive: 'text-pink-300',    dot: 'bg-pink-400'    },
  { bg: 'bg-violet-900/50',  border: 'border-violet-700/60',  sel: 'ring-violet-400',  text: 'text-violet-200',  drive: 'text-violet-300',  dot: 'bg-violet-400'  },
  { bg: 'bg-teal-900/50',    border: 'border-teal-700/60',    sel: 'ring-teal-400',    text: 'text-teal-200',    drive: 'text-teal-300',    dot: 'bg-teal-400'    },
  { bg: 'bg-orange-900/50',  border: 'border-orange-700/60',  sel: 'ring-orange-400',  text: 'text-orange-200',  drive: 'text-orange-300',  dot: 'bg-orange-400'  },
  { bg: 'bg-sky-900/50',     border: 'border-sky-700/60',     sel: 'ring-sky-400',     text: 'text-sky-200',     drive: 'text-sky-300',     dot: 'bg-sky-400'     },
  { bg: 'bg-lime-900/50',    border: 'border-lime-700/60',    sel: 'ring-lime-400',    text: 'text-lime-200',    drive: 'text-lime-300',    dot: 'bg-lime-400'    },
  { bg: 'bg-rose-900/50',    border: 'border-rose-700/60',    sel: 'ring-rose-400',    text: 'text-rose-200',    drive: 'text-rose-300',    dot: 'bg-rose-400'    },
  { bg: 'bg-purple-900/50',  border: 'border-purple-700/60',  sel: 'ring-purple-400',  text: 'text-purple-200',  drive: 'text-purple-300',  dot: 'bg-purple-400'  },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const router = useRouter()
  const { trips, currentTrip, loading: tripsLoading, setCurrentTrip, createTrip, deleteTrip } = useTrips()
  const { stops, loading: stopsLoading, updateStop } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, addActivity, removeActivity, updateActivity } = useActivities(stopIds)
  const { dining, addDining, removeDining, updateDining } = useDining(stopIds)
  const { possibleActivities, addPossibleActivity, removePossibleActivity, updatePossibleActivity } = usePossibleActivities(stopIds)
  const drivingLegs = useDrivingInfo(stops)
  const { outbound, returnFlight } = useFlights(currentTrip?.id ?? null)
  const { notes, addNote, updateNote, deleteNote } = useNotes(currentTrip?.id ?? null)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [flightModal, setFlightModal] = useState<Flight | null>(null)
  const [activityModal, setActivityModal] = useState<Activity | null>(null)
  const [diningModal, setDiningModal] = useState<Dining | null>(null)
  type NoteModalState =
    | { mode: 'new'; stopId: string | null; initialDate: string | null }
    | { mode: 'edit'; note: Note }
  const [noteModal, setNoteModal] = useState<NoteModalState | null>(null)

  // ── Derived data ────────────────────────────────────────────────────────────

  // Map: ISO date → Stop active on that day
  const stopsByDate = useMemo(() => {
    const map: Record<string, Stop> = {}
    stops.forEach((stop) => {
      if (!stop.arrival_date) return
      for (let n = 0; n < Math.max(1, stop.nights); n++) {
        const d = new Date(stop.arrival_date + 'T12:00:00')
        d.setDate(d.getDate() + n)
        map[toISO(d)] = stop
      }
    })
    return map
  }, [stops])

  // Set of arrival dates
  const arrivalDates = useMemo(
    () => new Set(stops.filter((s) => s.arrival_date).map((s) => s.arrival_date!)),
    [stops]
  )

  // Map: arrival ISO date → driving leg arriving at that stop
  const legByArrivalDate = useMemo(() => {
    const map: Record<string, LegInfo | null> = {}
    stops.forEach((stop, i) => {
      if (stop.arrival_date && i > 0) {
        map[stop.arrival_date] = drivingLegs[i - 1] ?? null
      }
    })
    return map
  }, [stops, drivingLegs])

  // Map: stop id → palette index
  // Strategy: first use a color no other stop has ever received (prefer unique);
  // only recycle when all 11 colors are exhausted, avoiding proximity conflicts.
  const stopPaletteIndex = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.order - b.order)
    const assigned: number[] = []
    sorted.forEach((stop, i) => {
      // Colors forbidden by proximity (calendar adjacency ≤ 21 days or adjacent in sequence)
      const forbidden = new Set<number>()
      if (i > 0) forbidden.add(assigned[i - 1])
      if (i > 1) forbidden.add(assigned[i - 2])
      if (stop.arrival_date) {
        const d0 = +new Date(stop.arrival_date + 'T00:00:00')
        sorted.forEach((other, j) => {
          if (j >= i || !other.arrival_date) return
          const d1 = +new Date(other.arrival_date + 'T00:00:00')
          if (Math.abs(d0 - d1) <= 21 * 86_400_000) forbidden.add(assigned[j])
        })
      }
      const usedSoFar = new Set(assigned)
      // 1st priority: a color that has never been used AND is not forbidden
      const freshColor = [...Array(PALETTES.length).keys()].find(
        (c) => !usedSoFar.has(c) && !forbidden.has(c)
      )
      if (freshColor !== undefined) {
        assigned.push(freshColor)
        return
      }
      // 2nd priority: any color not forbidden by proximity (even if reused)
      let color = 0
      while (forbidden.has(color) && color < PALETTES.length) color++
      assigned.push(color < PALETTES.length ? color : 0)
    })
    return Object.fromEntries(sorted.map((s, i) => [s.id, assigned[i]]))
  }, [stops])

  // Set of stop IDs with confirmed hotels
  const confirmedHotelStopIds = useMemo(
    () => new Set(hotels.filter((h) => h.status === 'confirmed').map((h) => h.stop_id)),
    [hotels]
  )

  // Map: stop id → hotel URL for confirmed hotels (null if no URL registered)
  const confirmedHotelUrls = useMemo(() => {
    const map: Record<string, string | null> = {}
    hotels.filter((h) => h.status === 'confirmed').forEach((h) => { map[h.stop_id] = h.url ?? null })
    return map
  }, [hotels])

  // Map: ISO date → activities scheduled on that day
  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {}
    activities.forEach((act) => {
      const date = act.activity_date ?? (stops.find((s) => s.id === act.stop_id)?.arrival_date ?? null)
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(act)
    })
    return map
  }, [activities, stops])

  // Map: ISO date → dining bookings on that day
  const diningByDate = useMemo(() => {
    const map: Record<string, Dining[]> = {}
    dining.forEach((d) => {
      const date = d.booking_date ?? (stops.find((s) => s.id === d.stop_id)?.arrival_date ?? null)
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(d)
    })
    return map
  }, [dining, stops])

  // Calendar week grid
  const weeks = useMemo(() => buildWeeks(stops), [stops])

  // Map: ISO date → Flight on that day
  const flightsByDate = useMemo(() => {
    const map: Record<string, Flight> = {}
    if (outbound?.flight_date) map[outbound.flight_date] = outbound
    if (returnFlight?.flight_date) map[returnFlight.flight_date] = returnFlight
    return map
  }, [outbound, returnFlight])

  // Map: ISO date → notes on that day (stop notes only; unattached shown in sidebar)
  const notesByDate = useMemo(() => {
    const map: Record<string, Note[]> = {}
    notes.filter((n) => n.stop_id).forEach((note) => {
      const date = note.note_date
        ?? stops.find((s) => s.id === note.stop_id)?.arrival_date
        ?? null
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(note)
    })
    return map
  }, [notes, stops])

  const unattachedNotes = useMemo(() => notes.filter((n) => !n.stop_id), [notes])

  // Selected stop (from clicked date)
  const selectedStop = selectedDate ? (stopsByDate[selectedDate] ?? null) : null
  const selectedStopLeg = selectedStop && selectedStop.arrival_date
    ? legByArrivalDate[selectedStop.arrival_date] ?? null
    : null
  const selectedStopIndex = selectedStop ? (stopPaletteIndex[selectedStop.id] ?? 0) : 0

  const hasEnoughData = stops.length > 0 && stops.some((s) => s.arrival_date)

  // Date range label
  const dated = stops.filter((s) => s.arrival_date)
  const firstStop = dated[0]
  const lastStop = dated[dated.length - 1]
  const dateRange = firstStop && lastStop
    ? (() => {
        const f = new Date(firstStop.arrival_date! + 'T12:00:00')
        const l = new Date(lastStop.arrival_date! + 'T12:00:00')
        l.setDate(l.getDate() + lastStop.nights - 1)
        return `${f.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} – ${l.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}`
      })()
    : null

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />

        {currentTrip && !stopsLoading && stops.filter((s) => s.arrival_date).length > 0 && (
          <div className="flex-1 overflow-y-auto py-3 flex flex-col">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide px-4 mb-2">
              Stoppesteder
            </p>
            <div className="px-2">
              {stops.filter((s) => s.arrival_date).map((stop) => {
                const pal = PALETTES[stopPaletteIndex[stop.id] ?? 0]
                const hotel = hotels.find((h) => h.stop_id === stop.id)
                const hotelUrl = hotel?.url ?? null
                const dateLabel = new Date(stop.arrival_date! + 'T12:00:00').toLocaleDateString('nb-NO', {
                  day: 'numeric', month: 'short',
                })
                return (
                  <div
                    key={stop.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border-l-2 ${pal.border} bg-transparent group/stop`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pal.dot}`} />
                    <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                      {hotelUrl ? (
                        <a
                          href={hotelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs font-semibold truncate flex-shrink-0 max-w-[50%] hover:underline ${pal.text}`}
                        >
                          {stop.city}
                        </a>
                      ) : (
                        <span className={`text-xs font-semibold truncate flex-shrink-0 max-w-[50%] ${pal.text}`}>
                          {stop.city}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 truncate whitespace-nowrap">
                        {dateLabel}{stop.nights > 0 && ` · ${stop.nights}n`}
                      </span>
                    </div>
                    <button
                      onClick={() => setNoteModal({ mode: 'new', stopId: stop.id, initialDate: stop.arrival_date })}
                      title="Legg til notat"
                      className="opacity-0 group-hover/stop:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-amber-400"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Turnotater (unattached) */}
            <div className="mt-3 pt-2 border-t border-slate-800 px-2">
              <div className="flex items-center justify-between px-2 mb-1">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Turnotater</p>
                <button
                  onClick={() => setNoteModal({ mode: 'new', stopId: null, initialDate: null })}
                  title="Nytt turnotat"
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-amber-400 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {unattachedNotes.length === 0 && (
                <p className="text-[10px] text-slate-600 px-2 italic">Ingen turnotater ennå</p>
              )}
              {unattachedNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setNoteModal({ mode: 'edit', note })}
                  className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded hover:bg-slate-800/60 text-left transition-colors"
                >
                  <FileText className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 truncate leading-snug">
                    {note.title || note.content.slice(0, 28) || 'Tomt notat'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(!currentTrip || stopsLoading || stops.filter((s) => s.arrival_date).length === 0) && (
          <div className="flex-1" />
        )}
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Calendar */}
        <div className="flex-1 overflow-y-auto p-5">
          {!currentTrip ? (
            <EmptyState message="Velg en tur til venstre for å se oppsummering" />
          ) : stopsLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" /><span>Laster…</span>
            </div>
          ) : !hasEnoughData ? (
            <EmptyState message="Legg til stoppesteder med ankomstdato i planleggeren for å se kalenderen" />
          ) : (
            <>
              {/* Trip header */}
              <div className="mb-5">
                <h1 className="text-xl font-bold text-slate-100">{currentTrip.name}</h1>
                {dateRange && <p className="text-sm text-slate-400 mt-0.5">{dateRange}</p>}
              </div>

              {/* Stop legend */}
              <div className="flex flex-wrap gap-2 mb-4">
                {stops.filter((s) => s.arrival_date).map((stop) => {
                  const pal = PALETTES[stopPaletteIndex[stop.id]]
                  return (
                    <div key={stop.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <div className={`w-2 h-2 rounded-full ${pal.dot}`} />
                      {stop.city}
                    </div>
                  )
                })}
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
                ))}
              </div>

              {/* Week rows */}
              <div className="space-y-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((date, di) => {
                      const dateStr = toISO(date)
                      const stop = stopsByDate[dateStr] ?? null
                      const isArrival = arrivalDates.has(dateStr)
                      const leg = isArrival ? (legByArrivalDate[dateStr] ?? null) : null
                      const pal = stop ? PALETTES[stopPaletteIndex[stop.id] ?? 0] : null
                      const isSelected = selectedDate === dateStr
                      return (
                        <DayCell
                          key={di}
                          date={date}
                          stop={stop}
                          isArrival={isArrival}
                          leg={leg}
                          palette={pal}
                          isSelected={isSelected}
                          activitiesOnDay={activitiesByDate[dateStr] ?? []}
                          diningOnDay={diningByDate[dateStr] ?? []}
                          hasConfirmedHotel={stop ? confirmedHotelStopIds.has(stop.id) : false}
                          confirmedHotelUrl={stop ? (confirmedHotelUrls[stop.id] ?? null) : null}
                          flight={flightsByDate[dateStr] ?? null}
                          onFlightClick={setFlightModal}
                          notesOnDay={notesByDate[dateStr] ?? []}
                          onNoteClick={(note) => setNoteModal({ mode: 'edit', note })}
                          onActivityClick={setActivityModal}
                          onDiningClick={setDiningModal}
                          onClick={stop ? () => setSelectedDate(isSelected ? null : dateStr) : undefined}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Flight modal */}
        {flightModal && (
          <FlightModal flight={flightModal} onClose={() => setFlightModal(null)} />
        )}

        {/* Note modal */}
        {noteModal && (
          <NoteModal
            mode={noteModal.mode}
            note={noteModal.mode === 'edit' ? noteModal.note : undefined}
            stopId={noteModal.mode === 'new' ? noteModal.stopId : undefined}
            initialDate={noteModal.mode === 'new' ? noteModal.initialDate : undefined}
            stops={stops}
            onSave={async (data) => {
              if (noteModal.mode === 'new') {
                await addNote({
                  title: data.title,
                  content: data.content,
                  stop_id: data.stop_id,
                  note_date: data.note_date,
                })
              } else {
                await updateNote(noteModal.note.id, {
                  title: data.title,
                  content: data.content,
                  stop_id: data.stop_id,
                  note_date: data.note_date,
                })
              }
              setNoteModal(null)
            }}
            onDelete={noteModal.mode === 'edit'
              ? async () => { await deleteNote(noteModal.note.id); setNoteModal(null) }
              : undefined
            }
            onClose={() => setNoteModal(null)}
          />
        )}

        {/* Activity modal */}
        {activityModal && (
          <ActivityModal
            activity={activityModal}
            stop={stops.find((s) => s.id === activityModal.stop_id) ?? null}
            onSave={(updates) => updateActivity(activityModal.id, updates)}
            onDelete={() => { removeActivity(activityModal.id); setActivityModal(null) }}
            onClose={() => setActivityModal(null)}
            onNavigate={() => {
              router.push(`/aktiviteter#${activityModal.id}`)
              setActivityModal(null)
            }}
          />
        )}

        {/* Dining modal */}
        {diningModal && (
          <DiningModal
            dining={diningModal}
            stop={stops.find((s) => s.id === diningModal.stop_id) ?? null}
            onSave={(updates) => updateDining(diningModal.id, updates)}
            onDelete={() => { removeDining(diningModal.id); setDiningModal(null) }}
            onClose={() => setDiningModal(null)}
            onNavigate={() => { setDiningModal(null); router.push(`/aktiviteter#d-${diningModal.id}`) }}
          />
        )}

        {/* Detail panel */}
        {selectedStop && selectedDate && (
          <div className="w-[320px] flex-shrink-0 overflow-hidden">
            <StopDetailPanel
              stop={selectedStop}
              hotel={hotels.find((h) => h.stop_id === selectedStop.id) ?? null}
              activities={activities.filter((a) => a.stop_id === selectedStop.id)}
              dining={dining.filter((d) => d.stop_id === selectedStop.id)}
              possibleActivities={possibleActivities.filter((a) => a.stop_id === selectedStop.id)}
              leg={selectedStopLeg}
              selectedDate={selectedDate}
              stopIndex={selectedStopIndex}
              onUpdateStop={(updates) => updateStop(selectedStop.id, updates)}
              onSaveHotel={(updates) => saveHotel(selectedStop.id, updates)}
              onAddActivity={(data) => addActivity(selectedStop.id, data)}
              onRemoveActivity={removeActivity}
              onUpdateActivity={updateActivity}
              onAddDining={(data) => addDining(selectedStop.id, data)}
              onRemoveDining={removeDining}
              onUpdateDining={updateDining}
              onAddPossibleActivity={(data) => addPossibleActivity(selectedStop.id, data)}
              onRemovePossibleActivity={removePossibleActivity}
              onUpdatePossibleActivity={updatePossibleActivity}
              stopNotes={notes.filter((n) => n.stop_id === selectedStop.id)}
              onClose={() => setSelectedDate(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Day Cell ────────────────────────────────────────────────────────────────

type Palette = (typeof PALETTES)[0] | null

function DayCell({
  date,
  stop,
  isArrival,
  leg,
  palette,
  isSelected,
  activitiesOnDay,
  diningOnDay,
  hasConfirmedHotel,
  confirmedHotelUrl,
  flight,
  onFlightClick,
  notesOnDay,
  onNoteClick,
  onActivityClick,
  onDiningClick,
  onClick,
}: {
  date: Date
  stop: Stop | null
  isArrival: boolean
  leg: LegInfo | null
  palette: Palette
  isSelected: boolean
  activitiesOnDay: Activity[]
  diningOnDay: Dining[]
  hasConfirmedHotel: boolean
  confirmedHotelUrl: string | null
  flight: Flight | null
  onFlightClick: (f: Flight) => void
  notesOnDay: Note[]
  onNoteClick: (note: Note) => void
  onActivityClick: (activity: Activity) => void
  onDiningClick: (dining: Dining) => void
  onClick?: () => void
}) {
  const isFirstOfMonth = date.getDate() === 1

  return (
    <div
      onClick={onClick}
      className={[
        'min-h-[72px] rounded-lg border p-1.5 transition-all flex flex-col',
        stop && onClick ? 'cursor-pointer' : 'cursor-default',
        palette
          ? `${palette.bg} ${palette.border} hover:brightness-125`
          : 'border-slate-800/40 bg-slate-900/20',
        isSelected ? `ring-2 ${palette?.sel ?? 'ring-white'} ring-offset-1 ring-offset-slate-950` : '',
      ].join(' ')}
    >
      {/* Date + drive info on same line */}
      <div className="flex items-center gap-1 leading-none min-w-0">
        <span className={`text-[11px] font-semibold flex-shrink-0 ${stop || flight ? 'text-slate-300' : 'text-slate-700'}`}>
          {isFirstOfMonth
            ? date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
            : date.getDate()}
        </span>
        {stop && isArrival && leg && (
          <div className={`flex items-center gap-0.5 text-[9px] font-medium min-w-0 ${palette?.drive ?? 'text-slate-400'}`}>
            <Car className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{leg.durationText} · {leg.distanceText}</span>
          </div>
        )}
      </div>

      {/* City name – always on line 2, same position for all days */}
      {stop && (
        <p className={`text-[11px] font-semibold truncate leading-tight mt-0.5 ${palette?.text ?? 'text-slate-300'}`}>
          {stop.city}
        </p>
      )}

      {/* Spacer pushes icons to bottom */}
      <div className="flex-1" />

      {/* Icons row at bottom – horizontal */}
      <div className="flex flex-row flex-wrap items-center gap-x-1 gap-y-0.5 pt-0.5">
        {/* Flight icon */}
        {flight && (
          <button
            onClick={(e) => { e.stopPropagation(); onFlightClick(flight) }}
            className="flex items-center gap-0.5 hover:opacity-80 transition-opacity flex-shrink-0"
            title={flight.direction === 'outbound' ? 'Utreise – vis flyinfo' : 'Hjemreise – vis flyinfo'}
          >
            {flight.direction === 'outbound'
              ? <PlaneTakeoff className="w-3 h-3 text-sky-400" />
              : <PlaneLanding className="w-3 h-3 text-sky-400" />
            }
            {flight.leg1_departure && (
              <span className="text-[8px] text-sky-400/70">{flight.leg1_departure}</span>
            )}
          </button>
        )}

        {/* Hotel icon – link if URL is registered */}
        {hasConfirmedHotel && (
          confirmedHotelUrl
            ? (
              <a
                href={confirmedHotelUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Åpne hotell"
                className="flex-shrink-0 hover:opacity-75 transition-opacity"
              >
                <HotelIcon className="w-3 h-3 text-green-400" />
              </a>
            ) : (
              <HotelIcon className="w-3 h-3 text-green-400 flex-shrink-0" />
            )
        )}

        {/* Activities – type-specific icon, clickable */}
        {activitiesOnDay.map((a) => {
          const cfg = getActivityTypeConfig(a.activity_type)
          return (
            <button
              key={a.id}
              onClick={(e) => { e.stopPropagation(); onActivityClick(a) }}
              title={a.name}
              className="flex items-center gap-0.5 flex-shrink-0 hover:opacity-75 transition-opacity"
            >
              <span className="leading-none"><ActivityTypeIcon type={a.activity_type} size={12} /></span>
              {a.activity_time && (
                <span className="text-[8px]" style={{ color: cfg.color }}>
                  {a.activity_time}
                </span>
              )}
            </button>
          )
        })}

        {/* Dining icons */}
        {diningOnDay.map((d) => (
          <button
            key={d.id}
            onClick={(e) => { e.stopPropagation(); onDiningClick(d) }}
            title={d.name}
            className="flex items-center gap-0.5 flex-shrink-0 hover:opacity-75 transition-opacity"
          >
            <UtensilsCrossed className="w-3 h-3 text-red-400" />
            {d.booking_time && (
              <span className="text-[8px] text-red-400/70">{d.booking_time}</span>
            )}
          </button>
        ))}

        {/* Note icons */}
        {notesOnDay.map((note) => (
          <button
            key={note.id}
            onClick={(e) => { e.stopPropagation(); onNoteClick(note) }}
            title={note.title || 'Notat'}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
          >
            <FileText className="w-3 h-3 text-amber-400" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Flight Modal ─────────────────────────────────────────────────────────────

function FlightModal({ flight, onClose }: { flight: Flight; onClose: () => void }) {
  const isOutbound = flight.direction === 'outbound'
  const label = isOutbound ? 'Utreise' : 'Hjemreise'
  const Icon = isOutbound ? PlaneTakeoff : PlaneLanding

  // Duration calculations
  const fromOffset  = getOffset(flight.leg1_from)
  const viaOffset   = getOffset(flight.leg1_to)
  const finalOffset = getOffset(flight.leg2_to)

  const leg1Min = calcFlightMinutes(flight.leg1_departure, fromOffset, flight.leg1_arrival, viaOffset)
  const leg2Min = flight.has_stopover
    ? calcFlightMinutes(flight.leg2_departure, viaOffset, flight.leg2_arrival, finalOffset)
    : null
  const stopoverMin = flight.has_stopover
    ? calcStopoverMinutes(flight.leg1_arrival, flight.leg2_departure)
    : null

  const dateStr = flight.flight_date
    ? new Date(flight.flight_date + 'T12:00:00').toLocaleDateString('nb-NO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-100 text-sm">{label}</span>
            {dateStr && <span className="text-xs text-slate-400 capitalize">{dateStr}</span>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          {/* Leg 1 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Fra</p>
                <p className="text-sm font-semibold text-slate-100">{flight.leg1_from ?? '—'}</p>
              </div>
              <div className="text-center px-3">
                <p className="text-xs text-slate-400">{flight.leg1_departure ?? ''}</p>
                <div className="flex items-center gap-1 my-0.5">
                  <div className="h-px w-8 bg-slate-600" />
                  <PlaneTakeoff className="w-3 h-3 text-sky-500" />
                  <div className="h-px w-8 bg-slate-600" />
                </div>
                <p className="text-xs text-slate-400">{flight.leg1_arrival ?? ''}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                  {flight.has_stopover ? 'Via' : 'Til'}
                </p>
                <p className="text-sm font-semibold text-slate-100">{flight.leg1_to ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {flight.leg1_flight_nr && (
                <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                  {flight.leg1_flight_nr}
                </span>
              )}
              {leg1Min !== null && (
                <span className="text-[10px] text-sky-500/80 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(leg1Min)}
                </span>
              )}
            </div>
          </div>

          {/* Stopover + Leg 2 */}
          {flight.has_stopover && (
            <>
              {stopoverMin !== null && (
                <div className="flex items-center gap-2 py-1 text-[10px] text-amber-400/80">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                  <span>Ventetid på flyplass: {formatDuration(stopoverMin)}</span>
                </div>
              )}

              <div className="border-t border-slate-800 pt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Fra</p>
                    <p className="text-sm font-semibold text-slate-100">{flight.leg1_to ?? '—'}</p>
                  </div>
                  <div className="text-center px-3">
                    <p className="text-xs text-slate-400">{flight.leg2_departure ?? ''}</p>
                    <div className="flex items-center gap-1 my-0.5">
                      <div className="h-px w-8 bg-slate-600" />
                      <PlaneTakeoff className="w-3 h-3 text-sky-500" />
                      <div className="h-px w-8 bg-slate-600" />
                    </div>
                    <p className="text-xs text-slate-400">{flight.leg2_arrival ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Til</p>
                    <p className="text-sm font-semibold text-slate-100">{flight.leg2_to ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {flight.leg2_flight_nr && (
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      {flight.leg2_flight_nr}
                    </span>
                  )}
                  {leg2Min !== null && (
                    <span className="text-[10px] text-sky-500/80 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDuration(leg2Min)}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Note Modal ──────────────────────────────────────────────────────────────

function getStopDateRange(stop: Stop): string[] {
  if (!stop.arrival_date) return []
  const dates: string[] = []
  for (let n = 0; n < Math.max(1, stop.nights); n++) {
    const d = new Date(stop.arrival_date + 'T12:00:00')
    d.setDate(d.getDate() + n)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function NoteModal({
  mode, note, stopId, initialDate, stops, onSave, onDelete, onClose,
}: {
  mode: 'new' | 'edit'
  note?: Note
  stopId?: string | null
  initialDate?: string | null
  stops: Stop[]
  onSave: (data: { title: string | null; content: string; stop_id: string | null; note_date: string | null }) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [title, setTitle]     = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    note?.stop_id ?? stopId ?? null
  )
  const [noteDate, setNoteDate] = useState<string | null>(
    note?.note_date ?? initialDate ?? null
  )

  const stop = selectedStopId ? stops.find((s) => s.id === selectedStopId) ?? null : null
  const stopDates = stop ? getStopDateRange(stop) : []

  function handleStopChange(newStopId: string | null) {
    setSelectedStopId(newStopId)
    // Reset date if it no longer belongs to the new stop
    if (noteDate) {
      const newStop = newStopId ? stops.find((s) => s.id === newStopId) : null
      const newDates = newStop ? getStopDateRange(newStop) : []
      if (!newDates.includes(noteDate)) setNoteDate(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-100">
              {mode === 'new' ? 'Nytt notat' : 'Rediger notat'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tittel (valgfritt)"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Skriv notat her…"
            rows={5}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors resize-none"
          />

          {/* City selector */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">By</p>
            <select
              value={selectedStopId ?? ''}
              onChange={(e) => handleStopChange(e.target.value || null)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
            >
              <option value="">— Ingen by (turnotat) —</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>{s.city}</option>
              ))}
            </select>
          </div>

          {/* Date picker – only shown when a stop with dates is selected */}
          {stopDates.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Dato</p>
              <div className="flex flex-wrap gap-1">
                {stopDates.map((d) => {
                  const label = new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNoteDate(d === noteDate ? null : d)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        d === noteDate
                          ? 'bg-amber-700 border-amber-600 text-white'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {!noteDate && (
                <p className="text-[10px] text-slate-600 mt-1">Vises på første dag i {stop?.city}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => onSave({ title: title.trim() || null, content, stop_id: selectedStopId, note_date: noteDate })}
            disabled={!content.trim()}
            className="flex-1 h-8 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
          >
            Lagre
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 h-8 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-900/30 text-xs transition-colors"
            >
              Slett
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Modal ───────────────────────────────────────────────────────────

function ActivityModal({
  activity, stop, onSave, onDelete, onClose, onNavigate,
}: {
  activity: Activity
  stop: Stop | null
  onSave: (updates: UpdateActivityData) => void
  onDelete: () => void
  onClose: () => void
  onNavigate: () => void
}) {
  const [name, setName]       = useState(activity.name)
  const [type, setType]       = useState(activity.activity_type)
  const [date, setDate]       = useState(activity.activity_date ?? '')
  const [time, setTime]       = useState(activity.activity_time ?? '')
  const [cost, setCost]       = useState(activity.cost != null ? String(activity.cost) : '')
  const [url, setUrl]         = useState(activity.url ?? '')
  const [customType, setCustomType] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const stopDates = stop ? getStopDateRange(stop) : []
  const cfg = getActivityTypeConfig(type)

  function handleSave() {
    onSave({
      name: name.trim() || activity.name,
      activity_type: type,
      activity_date: date || null,
      activity_time: time || null,
      cost: cost ? Number(cost) : null,
      url: url.trim() || null,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: cfg.color + '33' }}
            >
              <ActivityTypeIcon type={type} size={15} />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-100">Aktivitet</span>
              {stop && <span className="text-xs text-slate-500 ml-1.5">{stop.city}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Name */}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aktivitetsnavn"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/60 transition-colors"
          />

          {/* Type */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Type</p>
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_TYPE_PRESETS.map((p) => (
                <button key={p.value} type="button"
                  onClick={() => { setType(p.value); setShowCustom(false) }}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    type === p.value
                      ? 'bg-purple-700 border-purple-600 text-white'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}>
                  <ActivityTypeIcon type={p.value} size={11} />
                  <span>{p.label}</span>
                </button>
              ))}
              <button type="button"
                onClick={() => { setShowCustom(!showCustom); if (!showCustom) setType(null) }}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  showCustom
                    ? 'border-slate-600 text-slate-300 bg-slate-700'
                    : 'border-dashed border-slate-700 text-slate-500 hover:border-slate-500'
                }`}>
                + Annen
              </button>
            </div>
            {showCustom && (
              <input value={customType}
                onChange={(e) => { setCustomType(e.target.value); setType(e.target.value || null) }}
                placeholder="Skriv inn type…"
                className="mt-1.5 w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors"
              />
            )}
          </div>

          {/* Date pills */}
          {stopDates.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Dato</p>
              <div className="flex flex-wrap gap-1">
                {stopDates.map((d) => (
                  <button key={d} type="button"
                    onClick={() => setDate(d === date ? '' : d)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      d === date
                        ? 'bg-purple-700 border-purple-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time + Cost */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Klokkeslett</p>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 outline-none focus:border-purple-500 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Kostnad (kr)</p>
              <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)}
                placeholder="0"
                className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
            </div>
          </div>

          {/* URL */}
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Lenke</p>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
          </div>

          {/* Navigate to activities page */}
          {activity.map_lat && activity.map_lng && (
            <button onClick={onNavigate}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-xs transition-colors">
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
              Vis i Aktiviteter og zoom inn
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex gap-2">
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex-1 h-8 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
            Lagre
          </button>
          <button onClick={onDelete}
            className="px-3 h-8 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-900/30 text-xs transition-colors">
            Slett
          </button>
          <button onClick={onClose}
            className="px-3 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Dining Modal ────────────────────────────────────────────────────────────

function DiningModal({
  dining, stop, onSave, onDelete, onClose, onNavigate,
}: {
  dining: Dining
  stop: Stop | null
  onSave: (updates: UpdateDiningData) => void
  onDelete: () => void
  onClose: () => void
  onNavigate: () => void
}) {
  const [name, setName] = useState(dining.name)
  const [url, setUrl]   = useState(dining.url ?? '')
  const [date, setDate] = useState(dining.booking_date ?? '')
  const [time, setTime] = useState(dining.booking_time ?? '')

  const stopDates = stop ? getStopDateRange(stop) : []

  function handleSave() {
    onSave({
      name: name.trim() || dining.name,
      url: url.trim() || null,
      booking_date: date || null,
      booking_time: time || null,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-red-800/40 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-red-900/40">
              <UtensilsCrossed className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-100">Spisested</span>
              {stop && <span className="text-xs text-slate-500 ml-1.5">{stop.city}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Name */}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på spisested"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/60 transition-colors"
          />

          {/* URL */}
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1 h-8 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/60 transition-colors"
            />
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center px-2 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            )}
          </div>

          {/* Date pills */}
          {stopDates.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Dato</p>
              <div className="flex flex-wrap gap-1">
                {stopDates.map((d) => (
                  <button key={d} type="button"
                    onClick={() => setDate(d === date ? '' : d)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      d === date
                        ? 'bg-red-700 border-red-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time */}
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Bookingklokkeslett</p>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 outline-none focus:border-red-500 transition-colors" />
          </div>

          {/* Navigate to aktiviteter page */}
          <button onClick={onNavigate}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-xs transition-colors">
            <Navigation className="w-3.5 h-3.5 text-red-400" />
            Vis på aktivitetssiden
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex gap-2">
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex-1 h-8 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
            Lagre
          </button>
          <button
            onClick={() => { if (window.confirm(`Slett spisestedet "${dining.name}"?`)) onDelete() }}
            className="px-3 h-8 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-900/30 text-xs transition-colors">
            Slett
          </button>
          <button onClick={onClose}
            className="px-3 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="bg-slate-800 rounded-full p-5 mb-4">
        <CalendarDays className="w-10 h-10 text-slate-600" />
      </div>
      <p className="text-slate-400 text-sm max-w-xs">{message}</p>
    </div>
  )
}
