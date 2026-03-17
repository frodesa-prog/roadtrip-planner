'use client'

import { X, Pencil, MapPin, UtensilsCrossed, NotebookPen } from 'lucide-react'
import { Trip, Activity, Dining, Note } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDayHeader(dateStr: string, index: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekdays = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
  const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
  return `Dag ${index + 1} – ${weekdays[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CityTripOverviewModalProps {
  trip: Trip
  activities: Activity[]
  dining: Dining[]
  notes: Note[]
  stopId: string
  onSelectDay: (day: string) => void
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
  onClose,
}: CityTripOverviewModalProps) {
  // Build day list from trip dates
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

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
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

        {/* Scrollable day list */}
        <div className="flex-1 overflow-y-auto">
          {days.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-500">
              Ingen datoer satt for turen.
            </div>
          ) : (
            days.map((dateStr, i) => {
              const dayActivities = activities.filter(
                (a) => a.activity_date === dateStr,
              )
              const dayDining = dining.filter((d) => d.booking_date === dateStr)
              const dayPlan = notes.find(
                (n) =>
                  n.stop_id === stopId &&
                  n.note_date === dateStr &&
                  n.title === '__day_plan__',
              )
              const firstLine = dayPlan?.content?.split('\n')[0]?.trim() ?? ''
              const hasContent =
                firstLine || dayActivities.length > 0 || dayDining.length > 0

              return (
                <div
                  key={dateStr}
                  className="border-b border-slate-800/60 last:border-0"
                >
                  {/* Day header */}
                  <div className="flex items-center gap-2 px-5 pt-3 pb-2">
                    <span className="text-sm font-semibold text-slate-200 flex-1">
                      {formatDayHeader(dateStr, i)}
                    </span>
                    <button
                      onClick={() => { onSelectDay(dateStr); onClose() }}
                      title="Rediger denne dagen"
                      className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day content */}
                  <div className="px-5 pb-3 space-y-1.5">
                    {hasContent ? (
                      <>
                        {/* Day plan – first line */}
                        {firstLine && (
                          <div className="flex items-start gap-2">
                            <NotebookPen className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-slate-400 italic leading-relaxed">
                              {firstLine}
                            </p>
                          </div>
                        )}

                        {/* Activities */}
                        {dayActivities.map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-slate-300 flex-1 truncate">
                              {a.name}
                            </span>
                            {a.activity_time && (
                              <span className="text-[10px] text-slate-500 flex-shrink-0">
                                {a.activity_time}
                              </span>
                            )}
                          </div>
                        ))}

                        {/* Dining */}
                        {dayDining.map((d) => (
                          <div key={d.id} className="flex items-center gap-2">
                            <UtensilsCrossed className="w-3 h-3 text-orange-400 flex-shrink-0" />
                            <span className="text-xs text-slate-300 flex-1 truncate">
                              {d.name}
                            </span>
                            {d.booking_time && (
                              <span className="text-[10px] text-slate-500 flex-shrink-0">
                                {d.booking_time}
                              </span>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-xs text-slate-600 italic">
                        Ingen plan lagt inn ennå
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
