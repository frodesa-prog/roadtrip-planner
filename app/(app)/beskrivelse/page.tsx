'use client'

import { useMemo } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useDining } from '@/hooks/useDining'
import { useFlights } from '@/hooks/useFlights'
import { useDrivingInfo, LegInfo } from '@/hooks/useDrivingInfo'
import type { Activity, Dining, Stop, Hotel, Flight } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const DAYS_NO = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTHS_NO = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

function formatDateNO(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAYS_NO[d.getDay()]} ${d.getDate()}. ${MONTHS_NO[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(time: string | null): string {
  if (!time) return ''
  return time.slice(0, 5)
}

const ORDINALS = [
  '', 'Første', 'Andre', 'Tredje', 'Fjerde', 'Femte',
  'Sjette', 'Sjuende', 'Åttende', 'Niende', 'Tiende',
]

function dayLeadText(dayInStop: number, totalNights: number, city: string, state: string | null, hotel: Hotel | undefined): string {
  const place = `${city}${state ? `, ${state}` : ''}`
  let lead = ''

  if (totalNights <= 1) {
    lead = `Kort stopp i ${place}.`
  } else if (dayInStop === 0) {
    lead = `Ankommer ${place}.`
  } else if (dayInStop === totalNights - 1) {
    lead = `Siste dag i ${city}. I morgen kjører vi videre.`
  } else {
    const ord = ORDINALS[dayInStop + 1] ?? `${dayInStop + 1}.`
    lead = `${ord} dag i ${city}.`
  }

  if (hotel?.name && dayInStop === 0) {
    lead += ` Sjekker inn på ${hotel.name}.`
  }

  return lead
}

function activityIcon(type: string | null): string {
  switch (type) {
    case 'baseball':    return '⚾'
    case 'hiking':      return '🥾'
    case 'trening':     return '💪'
    case 'shopping':    return '🛍'
    case 'museum':      return '🏛'
    case 'sightseeing': return '🗺'
    case 'concert':     return '🎵'
    default:            return '📍'
  }
}

// ─── Stop colors (same palette as summary page) ───────────────────────────────

const COLORS = [
  { border: 'border-l-blue-500',    badge: 'bg-blue-500/20 text-blue-300',    label: 'text-blue-400' },
  { border: 'border-l-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300', label: 'text-emerald-400' },
  { border: 'border-l-amber-500',   badge: 'bg-amber-500/20 text-amber-300',   label: 'text-amber-400' },
  { border: 'border-l-pink-500',    badge: 'bg-pink-500/20 text-pink-300',    label: 'text-pink-400' },
  { border: 'border-l-violet-500',  badge: 'bg-violet-500/20 text-violet-300', label: 'text-violet-400' },
  { border: 'border-l-teal-500',    badge: 'bg-teal-500/20 text-teal-300',    label: 'text-teal-400' },
  { border: 'border-l-orange-500',  badge: 'bg-orange-500/20 text-orange-300', label: 'text-orange-400' },
  { border: 'border-l-sky-500',     badge: 'bg-sky-500/20 text-sky-300',      label: 'text-sky-400' },
  { border: 'border-l-lime-500',    badge: 'bg-lime-500/20 text-lime-300',    label: 'text-lime-400' },
  { border: 'border-l-rose-500',    badge: 'bg-rose-500/20 text-rose-300',    label: 'text-rose-400' },
  { border: 'border-l-purple-500',  badge: 'bg-purple-500/20 text-purple-300', label: 'text-purple-400' },
]

// ─── DayEntry type ────────────────────────────────────────────────────────────

interface DayEntry {
  dayNumber: number
  dateStr: string
  stop: Stop
  hotel: Hotel | undefined
  activities: Activity[]
  dining: Dining[]
  isFirstDay: boolean
  isLastDay: boolean
  colorIdx: number
  dayInStop: number
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

function DayCard({ entry }: { entry: DayEntry }) {
  const { dayNumber, dateStr, stop, hotel, activities, dining, colorIdx, dayInStop } = entry
  const color = COLORS[colorIdx % COLORS.length]

  const sortedActivities = [...activities].sort((a, b) => {
    if (!a.activity_time && !b.activity_time) return 0
    if (!a.activity_time) return 1
    if (!b.activity_time) return -1
    return a.activity_time.localeCompare(b.activity_time)
  })

  const sortedDining = [...dining].sort((a, b) => {
    if (!a.booking_time && !b.booking_time) return 0
    if (!a.booking_time) return 1
    if (!b.booking_time) return -1
    return a.booking_time.localeCompare(b.booking_time)
  })

  const leadText = dayLeadText(dayInStop, stop.nights, stop.city, stop.state, hotel)
  const hasContent = sortedActivities.length > 0 || sortedDining.length > 0

  return (
    <div className={`bg-slate-900 border border-slate-800 border-l-4 ${color.border} rounded-xl overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${color.label}`}>
            Dag {dayNumber}
          </span>
          <span className="text-sm font-medium text-slate-200 capitalize">
            {formatDateNO(dateStr)}
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${color.badge}`}>
          {stop.city}{stop.state ? `, ${stop.state}` : ''}
        </span>
      </div>

      <div className="border-t border-slate-800" />

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Lead sentence */}
        <p className="text-sm text-slate-300 leading-relaxed">{leadText}</p>

        {/* Activities */}
        {sortedActivities.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5">
            <span className="text-base mt-px flex-shrink-0">{activityIcon(a.activity_type)}</span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                {a.activity_time && (
                  <span className="text-xs font-mono text-slate-500 flex-shrink-0">
                    {formatTime(a.activity_time)}
                  </span>
                )}
                <span className="text-sm text-slate-100 font-medium">{a.name}</span>
              </div>
              {a.activity_type === 'baseball' && a.stadium && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.stadium}
                  {(a.section || a.seat_row || a.seat) && (
                    <span>
                      {' · '}
                      {[
                        a.section  && `Seksjon ${a.section}`,
                        a.seat_row && `Rad ${a.seat_row}`,
                        a.seat     && `Sete ${a.seat}`,
                      ].filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
              )}
              {a.notes && (
                <p className="text-xs text-slate-500 mt-0.5 italic">{a.notes}</p>
              )}
            </div>
          </div>
        ))}

        {/* Dining */}
        {sortedDining.map((d) => (
          <div key={d.id} className="flex items-start gap-2.5">
            <span className="text-base mt-px flex-shrink-0">🍽</span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                {d.booking_time && (
                  <span className="text-xs font-mono text-slate-500 flex-shrink-0">
                    {formatTime(d.booking_time)}
                  </span>
                )}
                <span className="text-sm text-slate-100 font-medium">{d.name}</span>
              </div>
            </div>
          </div>
        ))}

        {!hasContent && (
          <p className="text-xs text-slate-600 italic">
            Ingen aktiviteter eller restauranter planlagt denne dagen.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── FlightCard ───────────────────────────────────────────────────────────────

function FlightCard({ flight, label }: { flight: Flight; label: string }) {
  const hasData = !!(flight.flight_date || flight.leg1_from || flight.leg1_to)
  if (!hasData) return null

  return (
    <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-sky-500 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-baseline gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-sky-400">✈ {label}</span>
        {flight.flight_date && (
          <span className="text-sm font-medium text-slate-200 capitalize">
            {formatDateNO(flight.flight_date)}
          </span>
        )}
      </div>
      <div className="border-t border-slate-800" />
      <div className="px-4 py-3 space-y-1.5">
        {flight.leg1_from && flight.leg1_to && (
          <div className="flex items-center gap-2 text-sm text-slate-300 flex-wrap">
            <span className="font-medium">{flight.leg1_from}</span>
            {flight.leg1_departure && (
              <span className="text-xs font-mono text-slate-500">{formatTime(flight.leg1_departure)}</span>
            )}
            <span className="text-slate-600">→</span>
            <span className="font-medium">{flight.leg1_to}</span>
            {flight.leg1_arrival && (
              <span className="text-xs font-mono text-slate-500">{formatTime(flight.leg1_arrival)}</span>
            )}
            {flight.leg1_flight_nr && (
              <span className="text-xs text-slate-600">({flight.leg1_flight_nr})</span>
            )}
          </div>
        )}
        {flight.has_stopover && (
          <p className="text-xs text-slate-600 pl-1">
            Mellomlanding{flight.stopover_duration ? ` – ${flight.stopover_duration}` : ''}
          </p>
        )}
        {flight.has_stopover && flight.leg2_to && (
          <div className="flex items-center gap-2 text-sm text-slate-300 flex-wrap">
            <span className="font-medium">{flight.leg1_to}</span>
            {flight.leg2_departure && (
              <span className="text-xs font-mono text-slate-500">{formatTime(flight.leg2_departure)}</span>
            )}
            <span className="text-slate-600">→</span>
            <span className="font-medium">{flight.leg2_to}</span>
            {flight.leg2_arrival && (
              <span className="text-xs font-mono text-slate-500">{formatTime(flight.leg2_arrival)}</span>
            )}
            {flight.leg2_flight_nr && (
              <span className="text-xs text-slate-600">({flight.leg2_flight_nr})</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Driving divider ──────────────────────────────────────────────────────────

function DrivingDivider({ to, leg }: { to: string; leg: LegInfo | null }) {
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="flex-1 border-t border-dashed border-slate-800" />
      <div className="text-center space-y-0.5">
        <p className="text-xs text-slate-500 flex-shrink-0">
          🚗 Kjører videre til {to}
        </p>
        {leg ? (
          <p className="text-xs text-slate-700">
            {leg.distanceText} · {leg.durationText}
          </p>
        ) : (
          <p className="text-xs text-slate-800">Henter kjøretid…</p>
        )}
      </div>
      <div className="flex-1 border-t border-dashed border-slate-800" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BeskrivelsePage() {
  const { currentTrip } = useTrips()
  const { stops } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { hotels } = useHotels(stopIds)
  const { activities } = useActivities(stopIds)
  const { dining } = useDining(stopIds)
  const { outbound, returnFlight } = useFlights(currentTrip?.id ?? null)

  // Sorted stops used for both day-building and driving legs
  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.order - b.order),
    [stops],
  )

  // Driving legs: index i = leg from sortedStops[i] to sortedStops[i+1]
  const drivingLegs = useDrivingInfo(sortedStops)

  // Build day-by-day entries
  const days = useMemo(() => {
    const result: DayEntry[] = []
    let dayNumber = 1

    sortedStops.forEach((stop, stopIdx) => {
      if (!stop.arrival_date) return
      const totalNights = Math.max(stop.nights, 1)
      const hotel = hotels.find((h) => h.stop_id === stop.id)

      for (let i = 0; i < totalNights; i++) {
        const dateStr = addDays(stop.arrival_date, i)

        // Activities: dated for this day + undated on arrival day
        const dayActivities = activities.filter((a) => {
          if (a.stop_id !== stop.id) return false
          if (a.activity_date) return a.activity_date === dateStr
          return i === 0
        })

        // Dining for this day
        const dayDining = dining.filter(
          (d) => d.stop_id === stop.id && d.booking_date === dateStr,
        )

        result.push({
          dayNumber: dayNumber++,
          dateStr,
          stop,
          hotel,
          activities: dayActivities,
          dining: dayDining,
          isFirstDay: i === 0,
          isLastDay: i === totalNights - 1,
          colorIdx: stopIdx,
          dayInStop: i,
        })
      }
    })

    return result
  }, [sortedStops, activities, dining, hotels])

  const totalNights = stops.reduce((s, st) => s + (st.nights || 0), 0)
  const totalCities = new Set(stops.filter((s) => s.arrival_date).map((s) => s.city)).size
  const firstDate = days[0]?.dateStr ?? null

  // End date = departure day of the last stop (arrival_date + nights)
  const lastSortedStop = sortedStops.filter((s) => s.arrival_date).at(-1)
  const lastDate = lastSortedStop
    ? addDays(lastSortedStop.arrival_date!, lastSortedStop.nights)
    : null

  if (!currentTrip) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <p className="text-slate-500 text-sm">
          Ingen tur valgt. Gå til Planlegg for å opprette en tur.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">{currentTrip.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalNights > 0 && `${totalNights} netter`}
            {totalCities > 0 && ` · ${totalCities} ${totalCities === 1 ? 'destinasjon' : 'destinasjoner'}`}
            {firstDate && lastDate && (
              <>
                {' · '}
                <span className="capitalize">{formatDateNO(firstDate)}</span>
                {' – '}
                <span className="capitalize">{formatDateNO(lastDate)}</span>
              </>
            )}
          </p>
        </div>

        {/* Outbound flight */}
        {outbound && <FlightCard flight={outbound} label="Utreise" />}

        {/* Day cards */}
        {days.map((entry, idx) => (
          <div key={`${entry.stop.id}-${entry.dateStr}`}>
            {idx > 0 && entry.isFirstDay && (
              <DrivingDivider
                to={entry.stop.city}
                leg={drivingLegs[entry.colorIdx - 1] ?? null}
              />
            )}
            <DayCard entry={entry} />
          </div>
        ))}

        {/* Return flight */}
        {returnFlight && <FlightCard flight={returnFlight} label="Hjemreise" />}

        {/* Empty state */}
        {days.length === 0 && (
          <div className="text-center py-16 text-slate-600">
            <p className="text-4xl mb-4">🗓</p>
            <p className="text-sm font-medium text-slate-500">Ingen stopp med datoer lagt til ennå.</p>
            <p className="text-xs mt-1">Legg til ankomstdato på stopp under Planlegg.</p>
          </div>
        )}

      </div>
    </div>
  )
}
