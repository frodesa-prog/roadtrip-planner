'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { Stop, Hotel as HotelType, Activity } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface StopCardProps {
  stop: Stop
  index: number
  totalStops: number
  isSelected: boolean
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
  hotel,
  activities,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StopCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const displayDate = stop.arrival_date
    ? new Date(stop.arrival_date + 'T12:00:00').toLocaleDateString('nb-NO', {
        day: 'numeric', month: 'short',
      })
    : null

  const hotelBooked = hotel?.status === 'confirmed'

  return (
    <>
      <div
        className={`rounded-xl border transition-all duration-150 ${
          isSelected
            ? 'border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30'
            : 'border-slate-700 bg-slate-800/80 hover:border-slate-500 hover:bg-slate-800'
        }`}
      >
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
              {hotel?.name ? (
                <span className={`text-xs truncate max-w-[130px] ${hotelBooked ? 'text-green-400' : 'text-slate-400'}`}>
                  {hotelBooked ? '✓ ' : ''}{hotel.name}
                </span>
              ) : hotelBooked ? (
                <span className="text-xs text-green-400">✓ Hotell</span>
              ) : null}
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
              onClick={() => setShowConfirm(true)}
              className="p-1 rounded hover:bg-red-900/30 text-slate-600 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          message={`Fjerne ${stop.city} fra turen? Dette kan ikke angres.`}
          onConfirm={() => { setShowConfirm(false); onRemove() }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
