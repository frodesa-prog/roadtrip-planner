'use client'

import { useState, useEffect } from 'react'
import { MapPin, X, Check, Loader2, Star, UtensilsCrossed, BedDouble, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Stop } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType = 'stopp' | 'aktivitet' | 'spisested' | 'hotell' | 'mulig'

const ACTION_TABS: { id: ActionType; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { id: 'stopp',     label: 'Stopp',     icon: <MapPin className="w-3 h-3" />,           color: 'text-blue-400',   activeColor: 'bg-blue-600/20 border-blue-600/50 text-blue-300' },
  { id: 'aktivitet', label: 'Aktivitet', icon: <Star className="w-3 h-3" />,             color: 'text-violet-400', activeColor: 'bg-violet-600/20 border-violet-600/50 text-violet-300' },
  { id: 'spisested', label: 'Spisestad', icon: <UtensilsCrossed className="w-3 h-3" />, color: 'text-purple-400', activeColor: 'bg-purple-600/20 border-purple-600/50 text-purple-300' },
  { id: 'hotell',    label: 'Hotell',    icon: <BedDouble className="w-3 h-3" />,        color: 'text-emerald-400', activeColor: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-300' },
  { id: 'mulig',     label: 'Mulig',     icon: <Lightbulb className="w-3 h-3" />,        color: 'text-amber-400',  activeColor: 'bg-amber-600/20 border-amber-600/50 text-amber-300' },
]

interface AddStopPopupProps {
  lat: number
  lng: number
  initialCity?: string
  initialState?: string
  fromSearch?: boolean
  stops?: Stop[]
  activeStopId?: string | null
  onConfirm: (city: string, state: string, nights: number) => void
  onAddActivity?: (stopId: string, name: string, lat: number, lng: number) => void
  onAddDining?:   (stopId: string, name: string, lat: number, lng: number) => void
  onAddHotel?:    (stopId: string, name: string, lat: number, lng: number) => void
  onAddPossible?: (stopId: string, description: string, lat: number, lng: number) => void
  onCancel: () => void
}

export default function AddStopPopup({
  lat, lng,
  initialCity, initialState,
  fromSearch = false,
  stops = [],
  activeStopId,
  onConfirm,
  onAddActivity,
  onAddDining,
  onAddHotel,
  onAddPossible,
  onCancel,
}: AddStopPopupProps) {
  const [actionType, setActionType] = useState<ActionType>('stopp')

  // Stop form
  const [city, setCity]     = useState(initialCity ?? '')
  const [state, setState]   = useState(initialState ?? '')
  const [nights, setNights] = useState(1)
  const [loading, setLoading] = useState(!initialCity)

  // Non-stop forms
  const [itemName, setItemName] = useState('')
  const [selectedStopId, setSelectedStopId] = useState(
    activeStopId ?? stops[0]?.id ?? ''
  )

  const hasStops = stops.length > 0
  const canAddNonStop = hasStops && (onAddActivity || onAddDining || onAddHotel || onAddPossible)

  // Reverse geocoding (only when no initialCity)
  useEffect(() => {
    if (initialCity) { setLoading(false); return }
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      setLoading(false)
      if (status === 'OK' && results && results[0]) {
        const components = results[0].address_components
        const cityComp  = components.find((c) =>
          c.types.includes('locality') || c.types.includes('administrative_area_level_2')
        )
        const stateComp = components.find((c) =>
          c.types.includes('administrative_area_level_1')
        )
        const resolved = cityComp?.long_name ?? ''
        if (cityComp)  setCity(resolved)
        if (stateComp) setState(stateComp.short_name)
        // Pre-fill non-stop name with resolved location
        setItemName(resolved)
      }
    })
  }, [lat, lng, initialCity])

  // Pre-fill non-stop name when city resolves or when switching to initialCity
  useEffect(() => {
    if (initialCity) setItemName(initialCity)
  }, [initialCity])

  // Keep selectedStopId in sync if activeStopId changes
  useEffect(() => {
    if (activeStopId) setSelectedStopId(activeStopId)
    else if (stops.length > 0 && !selectedStopId) setSelectedStopId(stops[0].id)
  }, [activeStopId, stops]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleStopSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!city.trim()) return
    onConfirm(city.trim(), state.trim(), nights)
  }

  function handleNonStopSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = itemName.trim()
    if (!name || !selectedStopId) return
    if (actionType === 'aktivitet') onAddActivity?.(selectedStopId, name, lat, lng)
    else if (actionType === 'spisested') onAddDining?.(selectedStopId, name, lat, lng)
    else if (actionType === 'hotell') onAddHotel?.(selectedStopId, name, lat, lng)
    else if (actionType === 'mulig') onAddPossible?.(selectedStopId, name, lat, lng)
    onCancel()
  }

  // ── Stop selector helper ───────────────────────────────────────────────────

  function StopSelector() {
    return (
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Knytt til stopp</label>
        <select
          value={selectedStopId}
          onChange={(e) => setSelectedStopId(e.target.value)}
          className="w-full h-8 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-2 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.city}{s.state ? `, ${s.state}` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // ── fromSearch variant: compact confirmation, stop only ───────────────────

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
              <p className="text-xs text-slate-500 mt-0.5">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
            </div>
            <button onClick={onCancel} className="text-slate-600 hover:text-slate-300 mt-0.5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">By / Sted</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)}
                  className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600" autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Stat</label>
                <Input value={state} onChange={(e) => setState(e.target.value)}
                  className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Antall netter</label>
              <Input type="number" min={0} value={nights}
                onChange={(e) => setNights(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => onConfirm(city.trim(), state.trim(), nights)}
                size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8" disabled={!city.trim()}>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Legg til som stopp
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCancel}
                className="h-8 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
                Avbryt
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Standard popup (map click) ────────────────────────────────────────────

  const activeTab = ACTION_TABS.find((t) => t.id === actionType)!

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-80">
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 p-4">

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`rounded-full p-1.5 ${actionType === 'stopp' ? 'bg-blue-900/50' : actionType === 'aktivitet' ? 'bg-violet-900/50' : actionType === 'spisested' ? 'bg-purple-900/50' : actionType === 'hotell' ? 'bg-emerald-900/50' : 'bg-amber-900/50'}`}>
            <span className={activeTab.color}>{activeTab.icon}</span>
          </div>
          <h3 className="font-semibold text-slate-100 text-sm">Legg til fra kart</h3>
          <button onClick={onCancel} className="ml-auto text-slate-600 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {ACTION_TABS.map((tab) => {
            const isDisabled = tab.id !== 'stopp' && !canAddNonStop
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActionType(tab.id)}
                disabled={isDisabled}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  actionType === tab.id
                    ? tab.activeColor
                    : isDisabled
                      ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
                title={isDisabled ? 'Legg til et stoppested først' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Loading spinner (while reverse geocoding) */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            Henter stedsinfo…
          </div>
        ) : actionType === 'stopp' ? (
          /* ── Stoppested-form ──────────────────────────────────────────── */
          <form onSubmit={handleStopSubmit} className="space-y-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">By / Sted</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="f.eks. Las Vegas"
                className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600"
                autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Stat</label>
                <Input value={state} onChange={(e) => setState(e.target.value)}
                  placeholder="f.eks. NV"
                  className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Antall netter</label>
                <Input type="number" min={0} value={nights}
                  onChange={(e) => setNights(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8" disabled={!city.trim()}>
                <Check className="w-3.5 h-3.5 mr-1" />
                Legg til
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCancel}
                className="h-8 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
                Avbryt
              </Button>
            </div>
          </form>
        ) : (
          /* ── Aktivitet / Spisestad / Hotell / Mulig-form ─────────────── */
          <form onSubmit={handleNonStopSubmit} className="space-y-2">
            <StopSelector />
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                {actionType === 'mulig' ? 'Beskrivelse' : 'Navn'}
              </label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={
                  actionType === 'aktivitet' ? 'f.eks. Hiking trail'
                  : actionType === 'spisested' ? 'f.eks. In-N-Out Burger'
                  : actionType === 'hotell'    ? 'f.eks. Marriott Las Vegas'
                  : 'f.eks. Besøk Grand Canyon'
                }
                className="h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-600"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="submit" size="sm"
                disabled={!itemName.trim() || !selectedStopId}
                className={`flex-1 h-8 text-white ${
                  actionType === 'aktivitet' ? 'bg-violet-600 hover:bg-violet-700'
                  : actionType === 'spisested' ? 'bg-purple-600 hover:bg-purple-700'
                  : actionType === 'hotell'   ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Legg til
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCancel}
                className="h-8 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
                Avbryt
              </Button>
            </div>
          </form>
        )}

        <p className="text-xs text-slate-700 mt-2">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
      </div>
    </div>
  )
}
