'use client'

import { Stop, Hotel, Activity, Dining } from '@/types'
import { LegInfo } from '@/hooks/useDrivingInfo'

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Returns the Monday on or before the given date */
function mondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}

/** Returns the Sunday on or after the given date */
function sundayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  const offset = dow === 0 ? 0 : 7 - dow
  d.setDate(d.getDate() + offset)
  return d
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DayInfo {
  date: Date
  stop: Stop | null
  stopOrder: number
  isArrival: boolean
  transitCity: string | null
}

interface CalendarViewProps {
  stops: Stop[]
  hotels: Hotel[]
  activities: Activity[]
  dining: Dining[]
  drivingLegs: (LegInfo | null | undefined)[]
  selectedStopId: string | null
  onSelectStop: (id: string) => void
  detailed?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarView({
  stops,
  hotels,
  activities,
  dining,
  drivingLegs,
  selectedStopId,
  onSelectStop,
  detailed = false,
}: CalendarViewProps) {
  const dated = [...stops]
    .filter((s) => s.arrival_date)
    .sort((a, b) => a.order - b.order)

  if (dated.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Ingen stopp med datoer ennå
      </div>
    )
  }

  // ── Build the calendar grid ─────────────────────────────────────────────────

  const tripStart = new Date(dated[0].arrival_date! + 'T12:00:00')
  const lastStop  = dated[dated.length - 1]
  const tripEnd   = addDays(new Date(lastStop.arrival_date! + 'T12:00:00'), lastStop.nights)

  const gridStart = mondayOf(tripStart)
  const gridEnd   = sundayOf(tripEnd)

  const days: DayInfo[] = []
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
    const date = new Date(d)
    let stop: Stop | null = null
    let stopOrder = 0
    let isArrival = false
    let transitCity: string | null = null

    for (let i = 0; i < dated.length; i++) {
      const s = dated[i]
      const arrival = new Date(s.arrival_date! + 'T12:00:00')

      if (s.nights === 0 && sameDay(date, arrival)) {
        const next = dated[i + 1]
        if (next?.arrival_date === s.arrival_date) {
          transitCity = s.city
          continue
        }
      }

      const departure = addDays(arrival, Math.max(1, s.nights))
      if (date >= arrival && date < departure) {
        stop = s
        stopOrder = i + 1
        isArrival = sameDay(date, arrival)
        break
      }
    }

    days.push({ date, stop, stopOrder, isArrival, transitCity })
  }

  const weeks: DayInfo[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  // Height class: fixed in compact mode, min-height in detailed (grid row stretches to tallest cell)
  const cellH = detailed ? 'min-h-[72px]' : 'h-[72px]'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {/* Column headers: Mon – Sun */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-[10px] text-slate-500 text-center font-medium uppercase tracking-wide py-0.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-2">
        {weeks.map((week, wi) => {
          const prevMonth = wi > 0 ? weeks[wi - 1][0].date.getMonth() : -1
          const showMonth = week[0].date.getMonth() !== prevMonth

          return (
            <div key={wi}>
              {showMonth && (
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 pl-0.5">
                  {MONTH_NAMES[week[0].date.getMonth()]} {week[0].date.getFullYear()}
                </p>
              )}

              {/* items-stretch ensures all cells in the same row share the tallest cell's height */}
              <div className="grid grid-cols-7 gap-1 items-stretch">
                {week.map((cell, ci) => {
                  // ── Empty cell ──────────────────────────────────────────────
                  if (!cell.stop) {
                    return (
                      <div
                        key={ci}
                        className={`${cellH} rounded-xl border border-slate-800/40 bg-slate-900/20 p-1.5`}
                      >
                        <span className="text-[10px] text-slate-700 leading-none">
                          {cell.date.getDate()}
                        </span>
                      </div>
                    )
                  }

                  // ── Stop cell ──────────────────────────────────────────────
                  const hotel         = hotels.find((h) => h.stop_id === cell.stop!.id) ?? null
                  const hotelBooked   = hotel?.status === 'confirmed'
                  const isSelected    = cell.stop.id === selectedStopId
                  const dayStr        = toDateStr(cell.date)

                  const globalIdx  = stops.findIndex((s) => s.id === cell.stop!.id)
                  const drivingLeg = cell.isArrival && globalIdx > 0
                    ? (drivingLegs[globalIdx - 1] ?? null)
                    : null

                  // In compact mode: count all activities for the stop
                  const stopActivities = activities.filter((a) => a.stop_id === cell.stop!.id)

                  // In detailed mode: filter activities/dining to this specific day
                  const dayActivities = detailed
                    ? activities.filter((a) => {
                        if (a.stop_id !== cell.stop!.id) return false
                        return a.activity_date ? a.activity_date === dayStr : cell.isArrival
                      })
                    : []

                  const dayDining = detailed
                    ? dining.filter((d) => {
                        if (d.stop_id !== cell.stop!.id) return false
                        return d.booking_date ? d.booking_date === dayStr : cell.isArrival
                      })
                    : []

                  return (
                    <div
                      key={ci}
                      onClick={() => onSelectStop(cell.stop!.id)}
                      className={`${cellH} rounded-xl border cursor-pointer transition-all duration-150 p-1.5 flex flex-col ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30'
                          : cell.isArrival
                          ? 'border-slate-600 bg-slate-800 hover:border-slate-500 hover:bg-slate-800/90'
                          : 'border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      {/* Top row: date number + stop index badge */}
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-slate-400 leading-none font-medium">
                          {cell.date.getDate()}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 ${
                            isSelected ? 'bg-orange-500' : 'bg-blue-600'
                          }`}
                        >
                          {cell.stopOrder}
                        </div>
                      </div>

                      {/* City name */}
                      <p className="text-[10px] font-semibold text-slate-100 truncate leading-tight">
                        {cell.transitCity
                          ? `${cell.transitCity} → ${cell.stop.city}`
                          : cell.stop.city}
                      </p>

                      {/* Arrival indicator */}
                      {cell.isArrival && (
                        <p className="text-[9px] text-blue-400/80 leading-tight">
                          {drivingLeg ? `🚗 ${drivingLeg.durationText}` : '↓ Ankomst'}
                        </p>
                      )}

                      {/* ── Bottom section ──────────────────────────────────── */}
                      <div className="flex-1 flex flex-col justify-end mt-0.5 gap-0.5 overflow-hidden">

                        {detailed ? (
                          /* ── Detailed mode ─────────────────────────────────── */
                          <>
                            {/* Activities for this day */}
                            {dayActivities.map((a) => (
                              <p key={a.id} className="text-[9px] text-violet-400 leading-tight truncate">
                                {a.activity_time
                                  ? <><span className="text-slate-500">{a.activity_time}</span> {a.name}</>
                                  : a.name
                                }
                              </p>
                            ))}

                            {/* Dining for this day */}
                            {dayDining.map((d) => (
                              <p key={d.id} className="text-[9px] text-purple-400 leading-tight truncate">
                                {d.booking_time
                                  ? <><span className="text-slate-500">{d.booking_time}</span> {d.name}</>
                                  : d.name
                                }
                              </p>
                            ))}

                            {/* Hotel – always shown in detailed mode */}
                            {hotel?.name ? (
                              <p className={`text-[9px] truncate leading-tight mt-auto pt-0.5 border-t border-slate-700/50 ${
                                hotelBooked ? 'text-green-400' : 'text-slate-500'
                              }`}>
                                {hotelBooked ? '✓ ' : ''}{hotel.name}
                              </p>
                            ) : (
                              <p className="text-[9px] text-red-600/70 leading-tight mt-auto pt-0.5 border-t border-slate-700/50">
                                Mangler hotell
                              </p>
                            )}
                          </>
                        ) : (
                          /* ── Compact mode (existing) ───────────────────────── */
                          <>
                            {hotel?.name ? (
                              <p className={`text-[9px] truncate leading-tight ${
                                hotelBooked ? 'text-green-400' : 'text-slate-500'
                              }`}>
                                {hotelBooked ? '✓ ' : ''}{hotel.name}
                              </p>
                            ) : (
                              <p className="text-[9px] text-red-600/70 leading-tight">Mangler hotell</p>
                            )}
                            {stopActivities.length > 0 && (
                              <p className="text-[9px] text-purple-400 leading-tight">
                                {stopActivities.length} akt.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
