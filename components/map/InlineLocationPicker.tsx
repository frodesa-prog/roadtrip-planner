'use client'

import { useEffect, useRef, useState } from 'react'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import { MapPin, X, Search } from 'lucide-react'

interface SelectedLocation {
  lat: number
  lng: number
  name: string
}

interface Props {
  selected: SelectedLocation | null
  onSelect: (lat: number, lng: number, name: string) => void
  onClear: () => void
  /** Tailwind color token used for focus ring and selected chip, e.g. 'purple' | 'red' | 'teal' */
  accentColor?: 'purple' | 'red' | 'teal' | 'blue'
}

// ─── Inner component (needs APIProvider context) ──────────────────────────────

function PickerBody({ selected, onSelect, onClear, accentColor = 'blue' }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef  = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput]   = useState(false)

  const focusBorder: Record<string, string> = {
    purple: 'focus-within:border-purple-500',
    red:    'focus-within:border-red-500',
    teal:   'focus-within:border-teal-500',
    blue:   'focus-within:border-blue-500',
  }
  const chipBg: Record<string, string> = {
    purple: 'bg-purple-900/30 border-purple-700/40 text-purple-300',
    red:    'bg-red-900/30 border-red-700/40 text-red-300',
    teal:   'bg-teal-900/30 border-teal-700/40 text-teal-300',
    blue:   'bg-blue-900/30 border-blue-700/40 text-blue-300',
  }
  const pinColor: Record<string, string> = {
    purple: 'text-purple-400',
    red:    'text-red-400',
    teal:   'text-teal-400',
    blue:   'text-blue-400',
  }

  useEffect(() => {
    if (!placesLib || !inputRef.current || !showInput) return

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'formatted_address'],
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      onSelect(
        place.geometry.location.lat(),
        place.geometry.location.lng(),
        place.formatted_address ?? place.name ?? '',
      )
      setInputValue('')
      setShowInput(false)
    })

    return () => google.maps.event.removeListener(listener)
  }, [placesLib, showInput, onSelect])

  // Auto-focus input when shown
  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  if (selected) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs ${chipBg[accentColor]}`}>
        <MapPin className={`w-3 h-3 flex-shrink-0 ${pinColor[accentColor]}`} />
        <span className="flex-1 truncate">{selected.name}</span>
        <button
          type="button"
          onClick={onClear}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Fjern kartplassering"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  if (showInput) {
    return (
      <div className={`flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 ${focusBorder[accentColor]} transition-colors`}>
        <Search className="w-3 h-3 text-slate-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Søk etter sted eller adresse…"
          className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-600 outline-none"
        />
        <button
          type="button"
          onClick={() => { setShowInput(false); setInputValue('') }}
          className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors py-0.5"
    >
      <MapPin className="w-3 h-3" />
      <span>Fest til kart (valgfritt)</span>
    </button>
  )
}

// ─── Public export – wraps in its own APIProvider ────────────────────────────

export default function InlineLocationPicker(props: Props) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <PickerBody {...props} />
    </APIProvider>
  )
}
