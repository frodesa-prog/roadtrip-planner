'use client'

import { useState, useEffect } from 'react'
import { MapPin, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AddStopPopupProps {
  lat: number
  lng: number
  initialCity?: string
  initialState?: string
  fromSearch?: boolean
  onConfirm: (city: string, state: string) => void
  onCancel: () => void
}

export default function AddStopPopup({
  lat,
  lng,
  initialCity,
  initialState,
  fromSearch = false,
  onConfirm,
  onCancel,
}: AddStopPopupProps) {
  const [city, setCity] = useState(initialCity ?? '')
  const [state, setState] = useState(initialState ?? '')
  const [loading, setLoading] = useState(!initialCity)

  // Gjør reverse geocoding kun hvis vi ikke allerede har stedsnavn (fra søk)
  useEffect(() => {
    if (initialCity) {
      setLoading(false)
      return
    }

    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      setLoading(false)
      if (status === 'OK' && results && results[0]) {
        const components = results[0].address_components
        const cityComp = components.find((c) =>
          c.types.includes('locality') ||
          c.types.includes('administrative_area_level_2')
        )
        const stateComp = components.find((c) =>
          c.types.includes('administrative_area_level_1')
        )
        if (cityComp) setCity(cityComp.long_name)
        if (stateComp) setState(stateComp.short_name)
      }
    })
  }, [lat, lng, initialCity])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!city.trim()) return
    onConfirm(city.trim(), state.trim())
  }

  // Ved søkeresultat: vis en kompakt bekreftelses-popup
  if (fromSearch && !loading) {
    return (
      <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-10 w-[420px] max-w-[calc(100vw-2rem)]">
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 p-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-900/50 rounded-full p-2 flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 text-sm">
                {city}{state && <span className="text-slate-400 font-normal">, {state}</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </p>
            </div>
            <button onClick={onCancel} className="text-slate-600 hover:text-slate-300 mt-0.5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rediger navn om ønskelig */}
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">By / Sted</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Stat</label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onConfirm(city.trim(), state.trim())}
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8"
                disabled={!city.trim()}
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Legg til som stopp
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCancel}
                className="h-8 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                Avbryt
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Standard popup (ved klikk på kart)
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-80">
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-blue-900/50 rounded-full p-1.5">
            <MapPin className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-100 text-sm">Nytt stoppested</h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-600 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            Henter stedsinfo…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">By / Sted</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="f.eks. Las Vegas"
                className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Stat</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="f.eks. NV"
                className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8"
                disabled={!city.trim()}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Legg til
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCancel}
                className="h-8 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                Avbryt
              </Button>
            </div>
          </form>
        )}

        <p className="text-xs text-slate-600 mt-2">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      </div>
    </div>
  )
}
