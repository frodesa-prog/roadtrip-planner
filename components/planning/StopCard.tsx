'use client'

import { ChevronUp, ChevronDown, Trash2, Car, Loader2 } from 'lucide-react'
import { Stop, Hotel as HotelType, Activity } from '@/types'
import { LegInfo } from '@/hooks/useDrivingInfo'

interface StopCardProps {
  stop: Stop
  index: number
  totalStops: number
  isSelected: boolean
  legFromPrev?: LegInfo | null
  arrivalTime?: string
  hotel: HotelType | null
  activities: Activity[]
  onSelect: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export default function StopCard({
  stop,
  index,
  totalStops,
  isSelected,
  legFromPrev,
  arrivalTime,
  hotel,
  activities,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StopCardProps) {
  const displayDate = stop.arrival_date
    ? new Date(stop.arrival_date + 'T12:00:00').toLocaleDateString('nb-NO', {
        day: 'numeric', month: 'short',
      })
    : null

  const hotelBooked = hotel?.status === 'confirmed'

  return (
    <div
      className={`rounded-xl border transition-all duration-150 ${
        isSelected
          ? 'border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30'
          : 'border-slate-700 bg-slate-800/80 hover:border-slate-500 hover:bg-slate-800'
      }`}
    >
      {/* Drive connector info above (shown inline in card for context) */}
      {index > 0 && legFromPrev === null && (
        <div className="flex items-center gap-1.5 px-3 pt-2 text-[10px] text-slate-500">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          <span>Beregner kjøretid…</span>
        </div>
      )}
      {index > 0 && legFromPrev && (
        <div className="flex items-center gap-1.5 px-3 pt-2 text-[10px] text-blue-400 font-medium">
          <Car className="w-2.5 h-2.5" />
          <span>{legFromPrev.durationText} · {legFromPrev.distanceText}</span>
          {arrivalTime && <span className="text-slate-500 ml-1">· Ankomst {arrivalTime}</span>}
        </div>
      )}

      {/* Main clickable row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={onSelect}
      >
        {/* Index badge */}
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
          isSelected ? 'bg-orange-500' : 'bg-blue-600'
        }`}>
          {index + 1}
        </div>

        {/* Stop info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-sm truncate">
            {stop.city}
            {stop.state && <span className="text-slate-500 font-normal">, {stop.state}</span>}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {displayDate && (
              <span className="text-xs text-slate-400">{displayDate}</span>
            )}
            <span className="text-xs text-slate-500">
              {stop.nights} {stop.nights === 1 ? 'natt' : 'netter'}
            </span>
            {hotelBooked && (
              <span className="text-xs text-green-400">✓ Hotell</span>
            )}
            {activities.length > 0 && (
              <span className="text-xs text-purple-400">
                {activities.length} aktivitet{activities.length !== 1 ? 'er' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-20 text-slate-500"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalStops - 1}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-20 text-slate-500"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-900/30 text-slate-600 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
