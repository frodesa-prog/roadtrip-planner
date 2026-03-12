'use client'

import { useEffect, useRef, useState } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Search, X } from 'lucide-react'

interface PlaceResult {
  lat: number
  lng: number
  city: string
  state: string
}

interface MapSearchBoxProps {
  onPlaceSelect: (result: PlaceResult) => void
}

export default function MapSearchBox({ onPlaceSelect }: MapSearchBoxProps) {
  const map = useMap()
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!placesLib || !inputRef.current) return

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'address_components', 'name'],
      componentRestrictions: { country: 'us' },
      types: ['(cities)'],
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return

      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()

      const components = place.address_components ?? []
      const cityComp = components.find((c) =>
        c.types.includes('locality') || c.types.includes('administrative_area_level_2')
      )
      const stateComp = components.find((c) =>
        c.types.includes('administrative_area_level_1')
      )

      if (map) { map.panTo({ lat, lng }); map.setZoom(11) }
      onPlaceSelect({ lat, lng, city: cityComp?.long_name ?? place.name ?? '', state: stateComp?.short_name ?? '' })
      setInputValue('')
      inputRef.current?.blur()
    })

    return () => { google.maps.event.removeListener(listener) }
  }, [placesLib, map, onPlaceSelect])

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[420px] max-w-[calc(100vw-2rem)]">
      <div className={`
        bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border transition-all duration-200
        ${isFocused ? 'border-blue-500 shadow-blue-900/30' : 'border-slate-700'}
        flex items-center gap-2.5 px-4 py-3
      `}>
        <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${isFocused ? 'text-blue-400' : 'text-slate-500'}`} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Søk etter by eller sted i USA..."
          className="flex-1 text-sm outline-none bg-transparent text-slate-100 placeholder:text-slate-500 min-w-0"
          autoComplete="off"
        />
        {inputValue && (
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              setInputValue('')
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="text-slate-600 hover:text-slate-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isFocused && (
        <p className="text-xs text-slate-400 text-center mt-1.5 drop-shadow">
          Velg et sted fra listen for å legge det til som stoppested
        </p>
      )}
    </div>
  )
}
