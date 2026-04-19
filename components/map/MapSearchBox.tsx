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
  /** Bias autocomplete results toward this location (e.g. the selected stop) */
  biasLocation?: { lat: number; lng: number } | null
}

export default function MapSearchBox({ onPlaceSelect, biasLocation }: MapSearchBoxProps) {
  const map = useMap()
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // Create autocomplete once when placesLib is ready
  useEffect(() => {
    if (!placesLib || !inputRef.current) return

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'address_components', 'name', 'types'],
    })
    autocompleteRef.current = autocomplete

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

      // Zoom based on place type: street address → 17, named POI → 16, city → 13, other → 14
      const hasStreet = components.some((c) => c.types.includes('street_number'))
      const placeTypes = place.types ?? []
      let zoom: number
      if (hasStreet) {
        zoom = 17
      } else if (placeTypes.some((t) =>
        ['lodging', 'restaurant', 'food', 'point_of_interest', 'establishment',
         'tourist_attraction', 'museum', 'stadium', 'park', 'bar', 'cafe'].includes(t)
      )) {
        zoom = 16
      } else if (placeTypes.some((t) => ['locality', 'sublocality', 'sublocality_level_1'].includes(t))) {
        zoom = 13
      } else {
        zoom = 14
      }

      if (map) { map.panTo({ lat, lng }); map.setZoom(zoom) }
      onPlaceSelect({ lat, lng, city: cityComp?.long_name ?? place.name ?? '', state: stateComp?.short_name ?? '' })
      setInputValue('')
      inputRef.current?.blur()
    })

    return () => {
      google.maps.event.removeListener(listener)
      autocompleteRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib])

  // Update geographic bias whenever the selected stop changes
  useEffect(() => {
    const ac = autocompleteRef.current
    if (!ac) return
    if (biasLocation) {
      // ~150 km radius around the stop — biases ranking without restricting results
      const delta = 1.5
      ac.setBounds({
        north: biasLocation.lat + delta,
        south: biasLocation.lat - delta,
        east:  biasLocation.lng + delta,
        west:  biasLocation.lng - delta,
      })
    } else {
      // No stop selected — remove bias so Google uses the current map viewport
      ac.setBounds(undefined as unknown as google.maps.LatLngBounds)
    }
  }, [biasLocation])

  // Keep onPlaceSelect up to date without recreating the autocomplete
  const onPlaceSelectRef = useRef(onPlaceSelect)
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect }, [onPlaceSelect])

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
          placeholder="Søk etter by, adresse eller hotell..."
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
          Søk på by, adresse eller stedsnavn – velg fra listen for å gå dit
        </p>
      )}
    </div>
  )
}
