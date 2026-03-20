'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown, Plus, Check, Route,
  Loader2, Trash2, Share2, Pencil,
} from 'lucide-react'
import { Trip } from '@/types'
import { useAppTheme, ThemeName } from '@/contexts/ThemeContext'

interface TripManagerProps {
  trips: Trip[]
  currentTrip: Trip | null
  loading: boolean
  userId?: string | null
  startDate?: string | null
  onSelectTrip: (trip: Trip) => void
  onRequestCreate: () => void
  onDeleteTrip: (id: string) => void
  onEditDates?: () => void
}

const THEME_GRADIENT: Record<ThemeName, string> = {
  'default':        'bg-gradient-to-r from-blue-700    to-blue-800    hover:from-blue-800    hover:to-blue-900',
  'light-white':    'bg-gradient-to-r from-indigo-600  to-indigo-700  hover:from-indigo-700  hover:to-indigo-800',
  'light-ocean':    'bg-gradient-to-r from-cyan-700    to-cyan-800    hover:from-cyan-800    hover:to-cyan-900',
  'light-sunset':   'bg-gradient-to-r from-orange-600  to-orange-700  hover:from-orange-700  hover:to-orange-800',
  'light-steel':    'bg-gradient-to-r from-blue-700    to-blue-800    hover:from-blue-800    hover:to-blue-900',
  'dark-forest':    'bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-900 hover:to-green-950',
  'dark-midnight':  'bg-gradient-to-r from-violet-800  to-violet-900  hover:from-violet-900  hover:to-purple-950',
}

const TRIP_TYPE_EMOJI: Record<string, string> = {
  road_trip: '🚗',
  storbytur: '🏙️',
  resort: '🌴',
}

/** Returns "yyyy: dd.mm – dd.mm" if both dates exist, else just the year number */
function formatTripDateLabel(trip: Trip): string {
  if (trip.date_from && trip.date_to) {
    const from = new Date(trip.date_from + 'T00:00:00')
    const to   = new Date(trip.date_to   + 'T00:00:00')
    const pad  = (n: number) => String(n).padStart(2, '0')
    const year = from.getFullYear()
    const fromStr = `${pad(from.getDate())}.${pad(from.getMonth() + 1)}`
    const toStr   = `${pad(to.getDate())}.${pad(to.getMonth() + 1)}`
    return `${year}: ${fromStr} – ${toStr}`
  }
  return String(trip.year)
}

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export default function TripManager({
  trips,
  currentTrip,
  loading,
  userId,
  startDate,
  onSelectTrip,
  onRequestCreate,
  onDeleteTrip,
  onEditDates,
}: TripManagerProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { theme } = useAppTheme()
  const gradientClass = THEME_GRADIENT[theme] ?? THEME_GRADIENT['default']

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Determine countdown: use date_from if available, else startDate prop (from stops)
  const countdownDate = currentTrip?.date_from ?? startDate ?? null

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-5 py-4 transition-colors ${gradientClass}`}
      >
        <Route className="w-5 h-5 text-white/80 flex-shrink-0" />
        <div className="flex-1 text-left min-w-0">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-white/60 animate-spin" />
              <span className="text-white/60 text-sm">Laster turer…</span>
            </div>
          ) : currentTrip ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{TRIP_TYPE_EMOJI[currentTrip.trip_type ?? 'road_trip'] ?? '🚗'}</span>
                <p className="text-white font-bold text-base leading-tight truncate">{currentTrip.name}</p>
                {countdownDate && (() => {
                  const days = getDaysUntil(countdownDate)
                  if (days > 0) {
                    return (
                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-yellow-200/90 border border-yellow-300/20">
                        ✈️ {days} d
                      </span>
                    )
                  } else if (days === 0) {
                    return (
                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-green-300 border border-green-400/20">
                        🎉 i dag!
                      </span>
                    )
                  }
                  return null
                })()}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-blue-200/60 text-xs">{formatTripDateLabel(currentTrip)}</p>
                {onEditDates && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditDates() }}
                    title="Rediger datoer"
                    className="p-0.5 rounded text-blue-300/40 hover:text-blue-200 hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-blue-200/80 text-sm font-medium">Velg eller opprett en tur</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-b-xl overflow-hidden">
          {trips.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              {trips.map((trip) => {
                const isShared = userId != null && trip.owner_id !== userId
                const typeEmoji = TRIP_TYPE_EMOJI[trip.trip_type ?? 'road_trip'] ?? '🚗'
                return (
                  <div key={trip.id} className="flex items-center group">
                    <button
                      onClick={() => { onSelectTrip(trip); setOpen(false) }}
                      className={`flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        currentTrip?.id === trip.id
                          ? 'bg-blue-900/40'
                          : 'hover:bg-slate-800'
                      }`}
                    >
                      {currentTrip?.id === trip.id && (
                        <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      )}
                      <div className={currentTrip?.id === trip.id ? '' : 'ml-5'}>
                        <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5">
                          <span>{typeEmoji}</span>
                          {trip.name}
                          {isShared && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
                              <Share2 className="w-2.5 h-2.5" /> Delt
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{formatTripDateLabel(trip)}</p>
                      </div>
                    </button>
                    {!isShared && (
                      <button
                        onClick={() => onDeleteTrip(trip.id)}
                        className="px-3 py-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Slett tur"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {trips.length > 0 && <div className="border-t border-slate-700/50" />}

          <button
            onClick={() => { setOpen(false); onRequestCreate() }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-blue-400 hover:bg-slate-800 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Opprett ny tur
          </button>
        </div>
      )}
    </div>
  )
}
