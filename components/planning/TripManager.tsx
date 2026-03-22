'use client'

import { Loader2, Pencil } from 'lucide-react'
import { Trip } from '@/types'
import { useAppTheme, ThemeName } from '@/contexts/ThemeContext'

interface TripManagerProps {
  currentTrip: Trip | null
  loading: boolean
  startDate?: string | null
  onEditDates?: () => void
  showCountdown?: boolean
}

const THEME_GRADIENT: Record<ThemeName, string> = {
  'default':        'bg-gradient-to-r from-blue-700    to-blue-800',
  'light-white':    'bg-gradient-to-r from-indigo-600  to-indigo-700',
  'light-ocean':    'bg-gradient-to-r from-cyan-700    to-cyan-800',
  'light-sunset':   'bg-gradient-to-r from-orange-600  to-orange-700',
  'light-steel':    'bg-gradient-to-r from-blue-700    to-blue-800',
  'dark-forest':    'bg-gradient-to-r from-emerald-800 to-emerald-900',
  'dark-midnight':  'bg-gradient-to-r from-violet-800  to-violet-900',
  'dark-dodgers':   'bg-gradient-to-r from-blue-700    to-blue-800',
  'light-vacay':    'bg-gradient-to-r from-blue-700    to-blue-800',
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
  currentTrip,
  loading,
  startDate,
  onEditDates,
  showCountdown = false,
}: TripManagerProps) {
  const { theme } = useAppTheme()
  const gradientClass = THEME_GRADIENT[theme] ?? THEME_GRADIENT['default']

  const countdownDate = currentTrip?.date_from ?? startDate ?? null

  // Resolve badge ahead of render so we can conditionally apply layout classes
  const countdownBadge = (() => {
    if (!showCountdown || !countdownDate) return null
    const days = getDaysUntil(countdownDate)
    if (days > 0) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-yellow-200/90 border border-yellow-300/20 whitespace-nowrap">
          ✈️ {days} dager igjen
        </span>
      )
    } else if (days === 0) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-green-300 border border-green-400/20 whitespace-nowrap">
          🎉 i dag!
        </span>
      )
    }
    return null
  })()

  return (
    <div className={`flex items-center gap-2 px-5 py-3 flex-shrink-0 ${gradientClass}`}>
      {/* Name + dates — takes natural width when badge is shown, full width otherwise */}
      <div className={`text-left min-w-0 ${countdownBadge ? 'overflow-hidden' : 'flex-1'}`}>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-white/60 animate-spin" />
            <span className="text-white/60 text-sm">Laster…</span>
          </div>
        ) : currentTrip ? (
          <>
            <p className="text-white font-bold text-sm leading-tight truncate">
              {currentTrip.name}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-blue-200/70 text-xs">{formatTripDateLabel(currentTrip)}</p>
              {onEditDates && (
                <button
                  onClick={onEditDates}
                  title="Rediger datoer"
                  className="p-0.5 rounded text-blue-300/40 hover:text-blue-200 hover:bg-white/10 transition-colors"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-blue-200/80 text-sm font-medium">Ingen reise valgt</p>
        )}
      </div>

      {/* Badge — centred in the remaining space between name and right edge */}
      {countdownBadge && (
        <div className="flex-1 flex items-center justify-center">
          {countdownBadge}
        </div>
      )}
    </div>
  )
}
