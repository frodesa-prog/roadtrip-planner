'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, MapPin, UtensilsCrossed, NotebookPen } from 'lucide-react'
import { Trip, Activity, Dining, Note } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTH_LABELS   = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

// ── Props ─────────────────────────────────────────────────────────────────────

interface CityTripOverviewModalProps {
  trip: Trip
  activities: Activity[]
  dining: Dining[]
  notes: Note[]
  stopId: string
  onSelectDay: (day: string) => void
  onSaveDayPlan: (dateStr: string, text: string) => void
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CityTripOverviewModal({
  trip,
  activities,
  dining,
  notes,
  stopId,
  onSelectDay,
  onSaveDayPlan,
  onClose,
}: CityTripOverviewModalProps) {
  const [focusedDay, setFocusedDay] = useState<string | null>(null)
  const [planText, setPlanText]     = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Build trip day list
  const days: string[] = []
  if (trip.date_from && trip.date_to) {
    const count = Math.max(
      1,
      Math.round(
        (new Date(trip.date_to + 'T12:00:00').getTime() -
          new Date(trip.date_from + 'T12:00:00').getTime()) /
          86_400_000,
      ),
    )
    for (let i = 0; i < count; i++) days.push(addDays(trip.date_from, i))
  }

  // Build calendar weeks (Mon=0 … Sun=6)
  // weeks: array of rows, each row is 7 cells (null = outside trip)
  type Week = { dateStr: string | null; monthLabel?: string }[]
  const weeks: Week[] = []
  if (days.length > 0) {
    const firstDate = new Date(days[0] + 'T12:00:00')
    const startDow  = (firstDate.getDay() + 6) % 7
    let week: Week  = Array.from({ length: startDow }, () => ({ dateStr: null }))
    let prevMonth   = -1

    for (const dateStr of days) {
      const d     = new Date(dateStr + 'T12:00:00')
      const month = d.getMonth()
      week.push({
        dateStr,
        monthLabel: month !== prevMonth ? MONTH_LABELS[month] : undefined,
      })
      prevMonth = month
      if (week.length === 7) { weeks.push(week); week = [] }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push({ dateStr: null })
      weeks.push(week)
    }
  }

  // Focused day helpers
  const focusedIndex     = focusedDay ? days.indexOf(focusedDay) : -1
  const focusedPlan      = focusedDay
    ? notes.find(
        (n) =>
          n.stop_id === stopId &&
          n.note_date === focusedDay &&
          n.title === '__day_plan__',
      )
    : undefined
  const focusedActivities = focusedDay
    ? activities.filter((a) => a.activity_date === focusedDay)
    : []
  const focusedDining = focusedDay
    ? dining.filter((d) => d.booking_date === focusedDay)
    : []

  // Sync plan text when focused day changes
  useEffect(() => {
    setPlanText(focusedPlan?.content ?? '')
  }, [focusedDay, focusedPlan?.content])

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])
  useEffect(() => { adjustHeight() }, [planText, adjustHeight])

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-100">Reiseoversikt</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{trip.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Calendar ── */}
          <div className="p-4 pb-2">
            {days.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Ingen datoer satt for turen.
              </p>
            ) : (
              <>
                {/* Weekday header */}
                <div className="grid grid-cols-7 mb-1.5">
                  {WEEKDAY_LABELS.map((lbl) => (
                    <div
                      key={lbl}
                      className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-1"
                    >
                      {lbl}
                    </div>
                  ))}
                </div>

                {/* Week rows */}
                <div className="space-y-1.5">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1.5">
                      {week.map((cell, ci) => {
                        if (!cell.dateStr) {
                          return (
                            <div
                              key={ci}
                              className="rounded-xl border border-slate-800/30 bg-slate-800/10 min-h-[76px]"
                            />
                          )
                        }

                        const { dateStr, monthLabel } = cell
                        const idx     = days.indexOf(dateStr)
                        const d       = new Date(dateStr + 'T12:00:00')
                        const dayActs = activities.filter((a) => a.activity_date === dateStr)
                        const dayDin  = dining.filter((d2) => d2.booking_date === dateStr)
                        const plan    = notes.find(
                          (n) =>
                            n.stop_id === stopId &&
                            n.note_date === dateStr &&
                            n.title === '__day_plan__',
                        )
                        const firstLine = plan?.content?.split('\n')[0]?.trim() ?? ''
                        const isFocused = focusedDay === dateStr

                        return (
                          <button
                            key={dateStr}
                            onClick={() =>
                              setFocusedDay(isFocused ? null : dateStr)
                            }
                            className={`rounded-xl border text-left p-2 min-h-[76px] flex flex-col gap-0.5 transition-all ${
                              isFocused
                                ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.4)]'
                                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                            }`}
                          >
                            {/* Month label (first day of new month) */}
                            {monthLabel && (
                              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider leading-none">
                                {monthLabel}
                              </span>
                            )}

                            {/* Date number + dag number */}
                            <div className="flex items-start justify-between gap-0.5">
                              <span
                                className={`text-[9px] font-semibold leading-tight ${
                                  isFocused ? 'text-blue-400' : 'text-slate-500'
                                }`}
                              >
                                Dag&nbsp;{idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-200 leading-tight">
                                {d.getDate()}
                              </span>
                            </div>

                            {/* First plan line */}
                            {firstLine && (
                              <p className="text-[8px] text-slate-500 italic leading-tight line-clamp-2 mt-0.5">
                                {firstLine}
                              </p>
                            )}

                            {/* Activity + dining badges */}
                            {(dayActs.length > 0 || dayDin.length > 0) && (
                              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                                {dayActs.length > 0 && (
                                  <span className="flex items-center gap-0.5 text-[8px] text-blue-400 font-medium">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {dayActs.length}
                                  </span>
                                )}
                                {dayDin.length > 0 && (
                                  <span className="flex items-center gap-0.5 text-[8px] text-orange-400 font-medium">
                                    <UtensilsCrossed className="w-2.5 h-2.5" />
                                    {dayDin.length}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Day detail / edit panel ── */}
          {focusedDay && (
            <div className="border-t border-slate-700/60 px-5 py-4 space-y-3">
              {/* Day heading + open-full-edit link */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">
                  {(() => {
                    const d   = new Date(focusedDay + 'T12:00:00')
                    const dow = WEEKDAY_LABELS[(d.getDay() + 6) % 7]
                    return `Dag ${focusedIndex + 1} – ${dow} ${d.getDate()}. ${MONTH_LABELS[d.getMonth()]}`
                  })()}
                </span>
                <button
                  onClick={() => { onSelectDay(focusedDay); onClose() }}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Åpne full redigering →
                </button>
              </div>

              {/* Day plan text */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1.5">
                  <NotebookPen className="w-3 h-3" /> Plan for dagen
                </label>
                <textarea
                  ref={textareaRef}
                  value={planText}
                  onChange={(e) => { setPlanText(e.target.value); adjustHeight() }}
                  onBlur={() => onSaveDayPlan(focusedDay, planText)}
                  placeholder="Skriv planen for dagen…"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none overflow-hidden leading-relaxed"
                />
              </div>

              {/* Activities list */}
              {focusedActivities.length > 0 && (
                <div className="space-y-1">
                  {focusedActivities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60"
                    >
                      <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-slate-300 flex-1 truncate">{a.name}</span>
                      {a.activity_time && (
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {a.activity_time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dining list */}
              {focusedDining.length > 0 && (
                <div className="space-y-1">
                  {focusedDining.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60"
                    >
                      <UtensilsCrossed className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-xs text-slate-300 flex-1 truncate">{d.name}</span>
                      {d.booking_time && (
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {d.booking_time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {focusedActivities.length === 0 &&
                focusedDining.length === 0 &&
                !planText && (
                  <p className="text-xs text-slate-600 italic">
                    Ingen aktiviteter eller spisesteder planlagt ennå.
                  </p>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
