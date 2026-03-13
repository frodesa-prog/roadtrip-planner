'use client'

import { useState, useMemo } from 'react'
import { Loader2, MapPin, Car, Moon, CalendarDays, Hotel as HotelIcon, Ticket } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useDrivingInfo, LegInfo } from '@/hooks/useDrivingInfo'
import TripManager from '@/components/planning/TripManager'
import StopDetailPanel from '@/components/planning/StopDetailPanel'
import { Stop, Activity } from '@/types'

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

// Color palettes per stop index (full Tailwind strings for PurgeCSS)
const PALETTES = [
  { bg: 'bg-blue-900/50',   border: 'border-blue-700/60',   sel: 'ring-blue-400',   text: 'text-blue-200',   drive: 'text-blue-300',   dot: 'bg-blue-400'   },
  { bg: 'bg-emerald-900/50', border: 'border-emerald-700/60', sel: 'ring-emerald-400', text: 'text-emerald-200', drive: 'text-emerald-300', dot: 'bg-emerald-400' },
  { bg: 'bg-amber-900/50',  border: 'border-amber-700/60',  sel: 'ring-amber-400',  text: 'text-amber-200',  drive: 'text-amber-300',  dot: 'bg-amber-400'  },
  { bg: 'bg-pink-900/50',   border: 'border-pink-700/60',   sel: 'ring-pink-400',   text: 'text-pink-200',   drive: 'text-pink-300',   dot: 'bg-pink-400'   },
  { bg: 'bg-violet-900/50', border: 'border-violet-700/60', sel: 'ring-violet-400', text: 'text-violet-200', drive: 'text-violet-300', dot: 'bg-violet-400' },
  { bg: 'bg-teal-900/50',   border: 'border-teal-700/60',   sel: 'ring-teal-400',   text: 'text-teal-200',   drive: 'text-teal-300',   dot: 'bg-teal-400'   },
  { bg: 'bg-orange-900/50', border: 'border-orange-700/60', sel: 'ring-orange-400', text: 'text-orange-200', drive: 'text-orange-300', dot: 'bg-orange-400' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const { trips, currentTrip, loading: tripsLoading, setCurrentTrip, createTrip, deleteTrip } = useTrips()
  const { stops, loading: stopsLoading, updateStop } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, addActivity, removeActivity } = useActivities(stopIds)
  const drivingLegs = useDrivingInfo(stops)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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
  const stopPaletteIndex = useMemo(() => {
    const map: Record<string, number> = {}
    stops.forEach((stop, i) => { map[stop.id] = i % PALETTES.length })
    return map
  }, [stops])

  // Set of stop IDs with confirmed hotels
  const confirmedHotelStopIds = useMemo(
    () => new Set(hotels.filter((h) => h.status === 'confirmed').map((h) => h.stop_id)),
    [hotels]
  )

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

  // Calendar week grid
  const weeks = useMemo(() => buildWeeks(stops), [stops])

  // Selected stop (from clicked date)
  const selectedStop = selectedDate ? (stopsByDate[selectedDate] ?? null) : null
  const selectedStopLeg = selectedStop && selectedStop.arrival_date
    ? legByArrivalDate[selectedStop.arrival_date] ?? null
    : null
  const selectedStopIndex = selectedStop ? (stopPaletteIndex[selectedStop.id] ?? 0) : 0

  // Stats
  const totalNights = stops.reduce((s, st) => s + st.nights, 0)
  const totalKm = drivingLegs.reduce((s, l) => s + (l?.distanceKm ?? 0), 0)
  const totalDays = Object.keys(stopsByDate).length

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

        {currentTrip && !stopsLoading && stops.length > 0 && (
          <div className="px-4 py-3 space-y-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Statistikk</p>
            <div className="space-y-1.5">
              {[
                { icon: <MapPin className="w-3 h-3 text-blue-400" />, label: 'Stopp', val: stops.length },
                { icon: <CalendarDays className="w-3 h-3 text-orange-400" />, label: 'Dager', val: totalDays },
                { icon: <Moon className="w-3 h-3 text-purple-400" />, label: 'Netter', val: totalNights },
              ].map(({ icon, label, val }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">{icon}{label}</span>
                  <span className="text-xs font-semibold text-slate-200">{val}</span>
                </div>
              ))}
              {totalKm > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Car className="w-3 h-3 text-green-400" /> Kjøring
                  </span>
                  <span className="text-xs font-semibold text-slate-200">{totalKm.toLocaleString()} km</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1" />
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
                          hasConfirmedHotel={stop ? confirmedHotelStopIds.has(stop.id) : false}
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

        {/* Detail panel */}
        {selectedStop && selectedDate && (
          <div className="w-[320px] flex-shrink-0 overflow-hidden">
            <StopDetailPanel
              stop={selectedStop}
              hotel={hotels.find((h) => h.stop_id === selectedStop.id) ?? null}
              activities={activities.filter((a) => a.stop_id === selectedStop.id)}
              leg={selectedStopLeg}
              selectedDate={selectedDate}
              stopIndex={selectedStopIndex}
              onUpdateStop={(updates) => updateStop(selectedStop.id, updates)}
              onSaveHotel={(updates) => saveHotel(selectedStop.id, updates)}
              onAddActivity={(data) => addActivity(selectedStop.id, data)}
              onRemoveActivity={removeActivity}
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
  hasConfirmedHotel,
  onClick,
}: {
  date: Date
  stop: Stop | null
  isArrival: boolean
  leg: LegInfo | null
  palette: Palette
  isSelected: boolean
  activitiesOnDay: Activity[]
  hasConfirmedHotel: boolean
  onClick?: () => void
}) {
  const isFirstOfMonth = date.getDate() === 1

  const baseballActivities = activitiesOnDay.filter((a) =>
    a.name.toLowerCase().includes('baseball')
  )
  const otherActivities = activitiesOnDay.filter(
    (a) => !a.name.toLowerCase().includes('baseball')
  )

  const hasAnyIcons =
    hasConfirmedHotel || baseballActivities.length > 0 || otherActivities.length > 0

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
      {/* Date number – always at top */}
      <p className={`text-[11px] font-semibold leading-none ${stop ? 'text-slate-300' : 'text-slate-700'}`}>
        {isFirstOfMonth
          ? date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
          : date.getDate()}
      </p>

      {stop && (
        <>
          {/* Drive info – right under date on arrival days */}
          {isArrival && leg && (
            <div className={`mt-0.5 flex items-center gap-0.5 text-[9px] font-medium ${palette?.drive ?? 'text-slate-400'}`}>
              <Car className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{leg.durationText} · {leg.distanceText}</span>
            </div>
          )}

          {/* City name – always right under drive info (or date) */}
          <p className={`text-[11px] font-semibold truncate leading-tight mt-0.5 ${palette?.text ?? 'text-slate-300'}`}>
            {stop.city}
          </p>

          {/* Spacer pushes icons to bottom */}
          <div className="flex-1" />

          {/* Status icons at bottom – one row per activity so time is visible */}
          {hasAnyIcons && (
            <div className="flex flex-col gap-0.5 pt-0.5">
              {hasConfirmedHotel && (
                <div className="flex items-center gap-0.5">
                  <HotelIcon className="w-3 h-3 text-green-400 flex-shrink-0" />
                </div>
              )}
              {baseballActivities.map((a) => (
                <div key={a.id} className="flex items-center gap-0.5">
                  <span className="text-[11px] leading-none flex-shrink-0">⚾</span>
                  {a.activity_time && (
                    <span className="text-[8px] text-slate-400 truncate">{a.activity_time}</span>
                  )}
                </div>
              ))}
              {otherActivities.map((a) => (
                <div key={a.id} className="flex items-center gap-0.5">
                  <Ticket className="w-3 h-3 text-purple-400 flex-shrink-0" />
                  {a.activity_time && (
                    <span className="text-[8px] text-purple-300 truncate">{a.activity_time}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
