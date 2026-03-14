'use client'

import { useEffect, useRef, useState } from 'react'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import { MapPin, X, Search } from 'lucide-react'

interface Props {
  activityName: string
  onConfirm: (lat: number, lng: number) => void
  onClose: () => void
}

// ─── Inner component (needs APIProvider) ─────────────────────────────────────

function SearchBody({ activityName, onConfirm, onClose }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef  = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [selected, setSelected] = useState<{ lat: number; lng: number; name: string } | null>(null)

  useEffect(() => {
    if (!placesLib || !inputRef.current) return

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'formatted_address'],
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      setSelected({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.formatted_address ?? place.name ?? '',
      })
    })

    return () => google.maps.event.removeListener(listener)
  }, [placesLib])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-100">Fest aktivitet på kart</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-400 truncate italic">{activityName}</p>

          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setSelected(null) }}
              placeholder="Søk etter sted, adresse, attraksjon…"
              autoFocus
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none"
            />
          </div>

          {selected && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-900/30 border border-blue-700/40 rounded-lg">
              <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-300 truncate">{selected.name}</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => selected && onConfirm(selected.lat, selected.lng)}
            disabled={!selected}
            className="flex-1 h-8 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
          >
            Legg til på kart
          </button>
          <button
            onClick={onClose}
            className="px-3 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Public export – wraps in its own APIProvider ────────────────────────────
// (Google Maps JS API loads only once per page, so this is safe alongside PlanningMap's provider)

export default function ActivityLocationSearch({ activityName, onConfirm, onClose }: Props) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <SearchBody activityName={activityName} onConfirm={onConfirm} onClose={onClose} />
    </APIProvider>
  )
}
