'use client'

import { useState } from 'react'
import { MapPin, UtensilsCrossed, X, Clock } from 'lucide-react'

type PinType = 'activity' | 'dining'

interface CityMapPinModalProps {
  lat: number
  lng: number
  /** Default date to pre-fill (e.g. currently selected day) */
  defaultDate?: string | null
  onConfirm: (
    type: PinType,
    name: string,
    time: string,
    date: string | null,
    setAsStartPin: boolean,
  ) => void
  onCancel: () => void
}

export default function CityMapPinModal({
  lat, lng,
  defaultDate,
  onConfirm,
  onCancel,
}: CityMapPinModalProps) {
  const [pinType, setPinType]         = useState<PinType>('activity')
  const [name, setName]               = useState('')
  const [time, setTime]               = useState('')
  const [date, setDate]               = useState(defaultDate ?? '')
  const [setAsStartPin, setSetAsStartPin] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() && !setAsStartPin) return
    onConfirm(pinType, name.trim(), time, date || null, setAsStartPin)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <p className="text-sm font-semibold text-slate-100">Legg til pin i kartet</p>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          {/* Coordinates hint */}
          <p className="text-[10px] text-slate-600 font-mono">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>

          {/* Type picker */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPinType('activity')}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${
                pinType === 'activity'
                  ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <MapPin className="w-5 h-5" />
              <span className="text-xs font-medium">Aktivitet</span>
            </button>
            <button
              type="button"
              onClick={() => setPinType('dining')}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${
                pinType === 'dining'
                  ? 'border-orange-500 bg-orange-500/15 text-orange-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <UtensilsCrossed className="w-5 h-5" />
              <span className="text-xs font-medium">Spisested</span>
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">
              {pinType === 'activity' ? 'Aktivitetsnavn' : 'Restaurantnavn'} *
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={pinType === 'activity' ? 'f.eks. Eiffeltårnet' : 'f.eks. Café de Flore'}
              required={!setAsStartPin}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Date + time row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Dato</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Klokkeslett
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Set as start pin checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={setAsStartPin}
              onChange={(e) => setSetAsStartPin(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-blue-500 cursor-pointer"
            />
            <span className="text-xs text-slate-400">Sett som startpunkt (blå pin)</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!name.trim() && !setAsStartPin}
              className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              Legg til pin
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 h-9 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors"
            >
              Avbryt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
