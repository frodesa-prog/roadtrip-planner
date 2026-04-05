'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Ruler, Images, X, RotateCcw, RotateCw, Layers3, ExternalLink, Phone, Globe, Star, Clock, Loader2, Plus, MapPin, CheckCircle2 } from 'lucide-react'
import {
  APIProvider,
  Map,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import { Activity, Dining, Hotel, PossibleActivity, RouteLeg, Stop } from '@/types'
import RoutePolyline, { LegWaypoints } from './RoutePolyline'
import StopMarker from './StopMarker'
import AddStopPopup from './AddStopPopup'
import MapSearchBox from './MapSearchBox'
import ActivityMarker from './ActivityMarker'
import DiningMarker from './DiningMarker'
import PossibleActivityMarker from './PossibleActivityMarker'
import ActivityRoutePolyline, { RouteInfo } from './ActivityRoutePolyline'
import { AddActivityData } from '@/hooks/useActivities'
import { AddDiningData } from '@/hooks/useDining'
import { AddPossibleActivityData } from '@/hooks/usePossibleActivities'
import { ACTIVITY_TYPE_PRESETS, ActivityTypeIcon } from '@/lib/activityTypes'
import { useAppTheme } from '@/contexts/ThemeContext'

interface ActivityRoute {
  fromLat: number
  fromLng: number
  toAddress: string | null
  toLat: number
  toLng: number
}

interface PlanningMapProps {
  stops: Stop[]
  selectedStopId: string | null
  onAddStop: (stop: Stop) => void
  onSelectStop: (id: string) => void
  disabled?: boolean
  readOnly?: boolean
  /** Trip start date — auto-filled as arrival_date on the first stop */
  tripDateFrom?: string | null
  activities?: Activity[]
  selectedActivityId?: string | null
  onSelectActivity?: (id: string) => void
  dining?: Dining[]
  selectedDiningId?: string | null
  onSelectDining?: (id: string) => void
  mapCenter?: { lat: number; lng: number } | null
  mapFitPoints?: Array<{ lat: number; lng: number }> | null
  /** Increment to force MapController to re-pan/fit even if coords haven't changed */
  mapForcePanVersion?: number
  activityRoute?: ActivityRoute | null
  onActivityRouteInfo?: (info: RouteInfo) => void
  hotels?: Hotel[]
  possibleActivities?: PossibleActivity[]
  selectedPossibleId?: string | null
  onSelectPossible?: (id: string) => void
  onPoiAction?: PoiActionCallbacks
  routeLegs?: RouteLeg[]
  routeLegsLoaded?: boolean
  onRouteLegsChange?: (legs: LegWaypoints[]) => void
  onRouteStatesChange?: (states: string[]) => void
  /** When provided, shows search box even in readOnly mode but only pans the map (no stop added) */
  onCitySearch?: (result: { lat: number; lng: number; city: string; state: string }) => void
  /** When provided, a map click in readOnly mode emits the coords instead of being ignored */
  onCityMapClick?: (lat: number, lng: number) => void
  /** When true, marks the first stop pin with a hotel bed icon instead of a number */
  cityTripMode?: boolean
  /** When true, store country name (not state) when adding stops (international road trips) */
  useCountryForState?: boolean
}


// ─── POI info popup ────────────────────────────────────────────────────────────

const POI_TYPE_LABEL: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Kafé', bar: 'Bar', pub: 'Pub',
  bakery: 'Bakeri', meal_takeaway: 'Take-away', food: 'Matsted',
  lodging: 'Overnatting', hotel: 'Hotell',
  gas_station: 'Bensinstasjon', car_repair: 'Bilverksted',
  museum: 'Museum', art_gallery: 'Kunstgalleri', tourist_attraction: 'Attraksjon',
  amusement_park: 'Fornøyelsespark', zoo: 'Dyrepark',
  park: 'Park', natural_feature: 'Natur',
  church: 'Kirke', mosque: 'Moské', place_of_worship: 'Trossted',
  hospital: 'Sykehus', pharmacy: 'Apotek', doctor: 'Lege',
  supermarket: 'Supermarked', grocery_or_supermarket: 'Dagligvare',
  store: 'Butikk', shopping_mall: 'Kjøpesenter', clothing_store: 'Klesbutikk',
  bank: 'Bank', atm: 'Minibank',
  train_station: 'Jernbanestasjon', bus_station: 'Bussterminal', airport: 'Flyplass',
  movie_theater: 'Kino', gym: 'Treningssenter', spa: 'Spa',
  school: 'Skole', library: 'Bibliotek',
}

const PRICE_LABEL = ['Gratis', 'Rimelig', 'Moderat', 'Dyr', 'Eksklusiv']

interface PoiDetails {
  name: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  ratingCount: number | null
  openNow: boolean | null
  googleUrl: string
  types: string[]
  priceLevel: number | null
  lat: number | null
  lng: number | null
}

export interface PoiActionCallbacks {
  linkActivity: (activityId: string, lat: number, lng: number) => void
  linkDining: (diningId: string, lat: number, lng: number) => void
  addActivity: (stopId: string, data: AddActivityData) => void
  addDining: (stopId: string, data: AddDiningData) => void
  addPossible: (stopId: string, data: AddPossibleActivityData) => void
  saveHotel: (stopId: string, name: string, address: string | null, website: string | null, lat: number | null, lng: number | null) => void
}

type PoiTab = 'aktivitet' | 'spisested' | 'mulig' | 'hotell'

function getStopDates(stop: Stop): string[] {
  if (!stop.arrival_date) return []
  const dates: string[] = []
  for (let n = 0; n <= stop.nights; n++) {
    const d = new Date(stop.arrival_date + 'T12:00:00')
    d.setDate(d.getDate() + n)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function PoiInfoBox({
  placeId,
  onClose,
  stops = [],
  activities = [],
  dining = [],
  possibleActivities = [],
  hotels = [],
  onPoiAction,
  activeStopId,
}: {
  placeId: string
  onClose: () => void
  stops?: Stop[]
  activities?: Activity[]
  dining?: Dining[]
  possibleActivities?: PossibleActivity[]
  hotels?: Hotel[]
  onPoiAction?: PoiActionCallbacks
  activeStopId?: string | null
}) {
  const map = useMap()
  const placesLib = useMapsLibrary('places')
  const [info, setInfo] = useState<PoiDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // Action panel state
  const [actionOpen, setActionOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<PoiTab>('aktivitet')
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Auto-select stop when stops become available, prefer activeStopId
  useEffect(() => {
    if (stops.length > 0 && !selectedStopId) {
      const preferred = activeStopId && stops.some((s) => s.id === activeStopId) ? activeStopId : stops[0].id
      setSelectedStopId(preferred)
    }
  }, [stops, selectedStopId, activeStopId])

  // Activity form state
  const [showActForm, setShowActForm] = useState(false)
  const [poiActName, setPoiActName] = useState('')
  const [poiActUrl, setPoiActUrl] = useState('')
  const [poiActCost, setPoiActCost] = useState('')
  const [poiActTime, setPoiActTime] = useState('')
  const [poiActDate, setPoiActDate] = useState<string | null>(null)
  const [poiActType, setPoiActType] = useState<string | null>(null)
  const [poiActCustomType, setPoiActCustomType] = useState('')
  const [poiActShowCustom, setPoiActShowCustom] = useState(false)
  const [poiActStadium, setPoiActStadium] = useState('')
  const [poiActSection, setPoiActSection] = useState('')
  const [poiActRow, setPoiActRow] = useState('')
  const [poiActSeat, setPoiActSeat] = useState('')

  // Dining form state
  const [showDinForm, setShowDinForm] = useState(false)
  const [poiDinName, setPoiDinName] = useState('')
  const [poiDinUrl, setPoiDinUrl] = useState('')
  const [poiDinTime, setPoiDinTime] = useState('')
  const [poiDinDate, setPoiDinDate] = useState<string | null>(null)

  // Possible form state
  const [showPossForm, setShowPossForm] = useState(false)
  const [poiPossDesc, setPoiPossDesc] = useState('')
  const [poiPossUrl, setPoiPossUrl] = useState('')
  const [poiPossCategory, setPoiPossCategory] = useState<string | null>(null)
  const [poiPossDate, setPoiPossDate] = useState<string | null>(null)

  // Derive stop dates for the currently selected stop
  const selectedStopObj = stops.find((s) => s.id === selectedStopId) ?? null
  const poiStopDates = selectedStopObj ? getStopDates(selectedStopObj) : []

  function openActForm() {
    setPoiActName(info?.name ?? '')
    setPoiActUrl(info?.website ?? '')
    setPoiActCost(''); setPoiActTime(''); setPoiActDate(null)
    setPoiActType(null); setPoiActCustomType(''); setPoiActShowCustom(false)
    setPoiActStadium(''); setPoiActSection(''); setPoiActRow(''); setPoiActSeat('')
    setShowActForm(true)
  }

  function openDinForm() {
    setPoiDinName(info?.name ?? '')
    setPoiDinUrl(info?.website ?? '')
    setPoiDinTime(''); setPoiDinDate(null)
    setShowDinForm(true)
  }

  function openPossForm() {
    setPoiPossDesc(info?.name ?? '')
    setPoiPossUrl(info?.website ?? '')
    setPoiPossCategory(null)
    setPoiPossDate(null)
    setShowPossForm(true)
  }

  function handleSubmitActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStopId || !poiActName.trim()) return
    const data: AddActivityData = {
      name: poiActName.trim(),
      url: poiActUrl.trim() || undefined,
      cost: poiActCost ? parseFloat(poiActCost) : undefined,
      activity_time: poiActTime || undefined,
      activity_date: poiActDate ?? undefined,
      activity_type: poiActType ?? undefined,
      stadium: poiActStadium.trim() || undefined,
      section: poiActSection.trim() || undefined,
      seat_row: poiActRow.trim() || undefined,
      seat: poiActSeat.trim() || undefined,
      map_lat: info?.lat ?? undefined,
      map_lng: info?.lng ?? undefined,
    }
    onPoiAction?.addActivity(selectedStopId, data)
    setShowActForm(false)
    showSaved('Ny aktivitet opprettet!')
  }

  function handleSubmitDining(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStopId || !poiDinName.trim()) return
    const data: AddDiningData = {
      name: poiDinName.trim(),
      url: poiDinUrl.trim() || undefined,
      booking_time: poiDinTime || undefined,
      booking_date: poiDinDate ?? undefined,
      map_lat: info?.lat ?? undefined,
      map_lng: info?.lng ?? undefined,
    }
    onPoiAction?.addDining(selectedStopId, data)
    setShowDinForm(false)
    showSaved('Nytt spisested opprettet!')
  }

  function handleSubmitPossible(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStopId || !poiPossDesc.trim()) return
    const data: AddPossibleActivityData = {
      description: poiPossDesc.trim(),
      url: poiPossUrl.trim() || undefined,
      category: poiPossCategory ?? undefined,
      activity_date: poiPossDate ?? undefined,
      map_lat: info?.lat ?? undefined,
      map_lng: info?.lng ?? undefined,
    }
    onPoiAction?.addPossible(selectedStopId, data)
    setShowPossForm(false)
    showSaved('Mulig aktivitet lagt til!')
  }

  function showSaved(msg: string) {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(null), 2000)
  }

  useEffect(() => {
    setInfo(null)
    setLoading(true)
    setFailed(false)

    if (!map || !placesLib) {
      setLoading(false)
      setFailed(true)
      return
    }

    const service = new placesLib.PlacesService(map)
    service.getDetails(
      {
        placeId,
        fields: [
          'name', 'formatted_address', 'formatted_phone_number',
          'website', 'rating', 'user_ratings_total',
          'opening_hours', 'url', 'types', 'price_level', 'geometry',
        ],
      },
      (result, status) => {
        setLoading(false)
        if (status === placesLib.PlacesServiceStatus.OK && result) {
          setInfo({
            name: result.name ?? '',
            address: result.formatted_address ?? null,
            phone: result.formatted_phone_number ?? null,
            website: result.website ?? null,
            rating: result.rating ?? null,
            ratingCount: result.user_ratings_total ?? null,
            openNow: result.opening_hours?.isOpen?.() ?? null,
            googleUrl: result.url ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            types: (result.types ?? [])
              .filter((t) => t !== 'point_of_interest' && t !== 'establishment')
              .slice(0, 3),
            priceLevel: result.price_level ?? null,
            lat: result.geometry?.location?.lat() ?? null,
            lng: result.geometry?.location?.lng() ?? null,
          })
        } else {
          setFailed(true)
        }
      }
    )
  }, [map, placesLib, placeId])

  const fallbackUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`

  const stopActivities = activities.filter((a) => a.stop_id === selectedStopId)
  const stopDining = dining.filter((d) => d.stop_id === selectedStopId)
  const stopPossible = possibleActivities.filter((p) => p.stop_id === selectedStopId)
  const stopHotel = hotels.find((h) => h.stop_id === selectedStopId) ?? null

  function handleLinkActivity(activityId: string) {
    if (!info?.lat || !info?.lng) return
    onPoiAction?.linkActivity(activityId, info.lat, info.lng)
    showSaved('Koblet til aktivitet!')
  }

  function handleLinkDining(diningId: string) {
    if (!info?.lat || !info?.lng) return
    onPoiAction?.linkDining(diningId, info.lat, info.lng)
    showSaved('Koblet til spisested!')
  }

  function handleSaveHotel() {
    if (!selectedStopId || !info?.name) return
    onPoiAction?.saveHotel(selectedStopId, info.name, info.address, info.website, info.lat, info.lng)
    showSaved('Hotell lagret!')
  }

  const canDoAction = !!onPoiAction && info != null && stops.length > 0

  return (
    <div className="absolute bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[340px] max-w-[calc(100vw-2rem)]">
      <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-2xl overflow-y-auto max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-3.5 pb-2 border-b border-slate-800">
          <div className="min-w-0 pr-2">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span className="text-sm">Henter informasjon…</span>
              </div>
            ) : (
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {info?.name ?? 'Ukjent sted'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        {!loading && info && (
          <div className="px-4 py-3 space-y-2.5">
            {/* Types + price */}
            <div className="flex flex-wrap gap-1">
              {info.types.map((t) => (
                <span key={t} className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 rounded-full px-2 py-0.5">
                  {POI_TYPE_LABEL[t] ?? t.replace(/_/g, ' ')}
                </span>
              ))}
              {info.priceLevel != null && (
                <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 rounded-full px-2 py-0.5">
                  {PRICE_LABEL[info.priceLevel] ?? ''}
                </span>
              )}
            </div>

            {/* Rating + open */}
            <div className="flex items-center gap-3">
              {info.rating != null && (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-semibold text-white">{info.rating.toFixed(1)}</span>
                  {info.ratingCount != null && (
                    <span className="text-[10px] text-slate-500">({info.ratingCount.toLocaleString('nb-NO')})</span>
                  )}
                </div>
              )}
              {info.openNow != null && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className={`text-[11px] font-medium ${info.openNow ? 'text-green-400' : 'text-red-400'}`}>
                    {info.openNow ? 'Åpent nå' : 'Stengt nå'}
                  </span>
                </div>
              )}
            </div>

            {/* Address */}
            {info.address && (
              <p className="text-[11px] text-slate-400 leading-snug">{info.address}</p>
            )}

            {/* Phone */}
            {info.phone && (
              <a href={`tel:${info.phone}`} className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                <Phone className="w-3 h-3" />
                {info.phone}
              </a>
            )}

            {/* Website */}
            {info.website && (
              <a
                href={info.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors truncate"
              >
                <Globe className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{info.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </a>
            )}
          </div>
        )}

        {/* Failed fallback */}
        {!loading && failed && (
          <p className="px-4 py-3 text-xs text-slate-500">Kunne ikke hente detaljer for dette stedet.</p>
        )}

        {/* Footer – Google Maps link */}
        <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
          <a
            href={info?.googleUrl ?? fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Åpne i Google Maps
          </a>
        </div>

        {/* ── Add to trip section ── */}
        {canDoAction && (
          <div className="border-t border-slate-800">
            {/* Toggle */}
            <button
              onClick={() => setActionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Legg til i tur
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${actionOpen ? 'rotate-180' : ''}`} />
            </button>

            {actionOpen && (
              <div className="px-3 pb-3 space-y-2.5 border-t border-slate-800/60">
                {/* Success message */}
                {savedMsg && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-900/30 border border-green-700/40 rounded-lg mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-[11px] text-green-300">{savedMsg}</span>
                  </div>
                )}

                {/* Stop picker */}
                {stops.length > 1 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 mb-1">Stoppested</p>
                    <select
                      value={selectedStopId ?? ''}
                      onChange={(e) => setSelectedStopId(e.target.value)}
                      className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-200 outline-none focus:border-slate-500 transition-colors"
                    >
                      {stops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.city}{s.state ? `, ${s.state}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tab bar */}
                <div className="flex gap-0.5 bg-slate-800/70 rounded-lg p-0.5 mt-2">
                  {(['aktivitet', 'spisested', 'mulig', 'hotell'] as PoiTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      className={`flex-1 text-[10px] font-medium py-1 rounded-md transition-colors ${
                        selectedTab === tab
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab === 'aktivitet' ? 'Aktivitet' : tab === 'spisested' ? 'Spise' : tab === 'mulig' ? 'Mulig' : 'Hotell'}
                    </button>
                  ))}
                </div>

                {/* ── Aktivitet tab ── */}
                {selectedTab === 'aktivitet' && (
                  <div className="space-y-1.5">
                    {stopActivities.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500">Knytt til eksisterende:</p>
                        {stopActivities.slice(0, 4).map((a) => {
                          const pinned = !!(a.map_lat && a.map_lng)
                          return (
                            <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 rounded-md">
                              <span className="text-[11px] text-slate-300 truncate flex-1">{a.name}</span>
                              {pinned ? (
                                <span className="text-[10px] text-teal-400 flex items-center gap-0.5 flex-shrink-0">
                                  <MapPin className="w-2.5 h-2.5" /> Festet
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleLinkActivity(a.id)}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 flex-shrink-0 transition-colors"
                                >
                                  <MapPin className="w-2.5 h-2.5" /> Knytt hit
                                </button>
                              )}
                            </div>
                          )
                        })}
                        {stopActivities.length > 4 && (
                          <p className="text-[10px] text-slate-600 text-center">og {stopActivities.length - 4} til</p>
                        )}
                      </div>
                    )}
                    {showActForm ? (
                      <form onSubmit={handleSubmitActivity} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                        <input value={poiActName} onChange={(e) => setPoiActName(e.target.value)}
                          placeholder="Aktivitetsnavn" autoFocus
                          className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
                        <div className="flex gap-1.5">
                          <input value={poiActUrl} onChange={(e) => setPoiActUrl(e.target.value)} placeholder="https://..."
                            className="h-7 text-xs flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
                          <input type="number" min={0} value={poiActCost} onChange={(e) => setPoiActCost(e.target.value)}
                            placeholder="Pris" className="h-7 text-xs w-16 bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
                          <span className="text-xs text-slate-500 self-center flex-shrink-0">kr</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input type="time" value={poiActTime} onChange={(e) => setPoiActTime(e.target.value)}
                            className="h-7 text-xs w-28 bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 outline-none focus:border-purple-500 transition-colors" />
                          <span className="text-[10px] text-slate-500">Klokkeslett</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Type</p>
                          <div className="flex flex-wrap gap-1">
                            {ACTIVITY_TYPE_PRESETS.map((p) => (
                              <button key={p.value} type="button"
                                onClick={() => { if (poiActType === p.value) { setPoiActType(null) } else { setPoiActType(p.value); setPoiActShowCustom(false); setPoiActCustomType('') } }}
                                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  poiActType === p.value ? 'bg-purple-700 border-purple-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                }`}>
                                <ActivityTypeIcon type={p.value} size={11} />
                                <span>{p.label}</span>
                              </button>
                            ))}
                            <button type="button"
                              onClick={() => { setPoiActShowCustom(!poiActShowCustom); if (!poiActShowCustom) setPoiActType(null) }}
                              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                poiActShowCustom ? 'border-slate-600 text-slate-300 bg-slate-700' : 'border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                              }`}>
                              + Annen
                            </button>
                          </div>
                          {poiActShowCustom && (
                            <input value={poiActCustomType}
                              onChange={(e) => { setPoiActCustomType(e.target.value); setPoiActType(e.target.value.trim() || null) }}
                              placeholder="Skriv inn type…"
                              className="mt-1 h-7 text-xs w-full bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
                          )}
                        </div>
                        {poiStopDates.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">Dato</p>
                            <div className="flex flex-wrap gap-1">
                              {poiStopDates.map((d) => (
                                <button key={d} type="button" onClick={() => setPoiActDate(poiActDate === d ? null : d)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                    d === poiActDate ? 'bg-purple-700 border-purple-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                  }`}>
                                  {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {poiActType === 'baseball' && (
                          <div className="space-y-1.5 pt-0.5">
                            <p className="text-[10px] text-orange-400/80">⚾ Baseballdetaljer</p>
                            <input value={poiActStadium} onChange={(e) => setPoiActStadium(e.target.value)}
                              placeholder="Stadion"
                              className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                            <div className="grid grid-cols-3 gap-1.5">
                              <input value={poiActSection} onChange={(e) => setPoiActSection(e.target.value)} placeholder="Felt"
                                className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                              <input value={poiActRow} onChange={(e) => setPoiActRow(e.target.value)} placeholder="Rad"
                                className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                              <input value={poiActSeat} onChange={(e) => setPoiActSeat(e.target.value)} placeholder="Sete"
                                className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <button type="submit" disabled={!poiActName.trim()}
                            className="flex-1 h-7 rounded-md bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                            Legg til
                          </button>
                          <button type="button" onClick={() => setShowActForm(false)}
                            className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                            Avbryt
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={openActForm}
                        className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-[11px] transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Opprett ny aktivitet
                      </button>
                    )}
                  </div>
                )}

                {/* ── Spisested tab ── */}
                {selectedTab === 'spisested' && (
                  <div className="space-y-1.5">
                    {stopDining.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500">Knytt til eksisterende:</p>
                        {stopDining.slice(0, 4).map((d) => {
                          const pinned = !!(d.map_lat && d.map_lng)
                          return (
                            <div key={d.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 rounded-md">
                              <span className="text-[11px] text-slate-300 truncate flex-1">{d.name}</span>
                              {pinned ? (
                                <span className="text-[10px] text-teal-400 flex items-center gap-0.5 flex-shrink-0">
                                  <MapPin className="w-2.5 h-2.5" /> Festet
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleLinkDining(d.id)}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 flex-shrink-0 transition-colors"
                                >
                                  <MapPin className="w-2.5 h-2.5" /> Knytt hit
                                </button>
                              )}
                            </div>
                          )
                        })}
                        {stopDining.length > 4 && (
                          <p className="text-[10px] text-slate-600 text-center">og {stopDining.length - 4} til</p>
                        )}
                      </div>
                    )}
                    {showDinForm ? (
                      <form onSubmit={handleSubmitDining} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                        <input value={poiDinName} onChange={(e) => setPoiDinName(e.target.value)}
                          placeholder="Navn på spisested" autoFocus
                          className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors" />
                        <input value={poiDinUrl} onChange={(e) => setPoiDinUrl(e.target.value)} placeholder="https://..."
                          className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors" />
                        <div className="flex items-center gap-1.5">
                          <input type="time" value={poiDinTime} onChange={(e) => setPoiDinTime(e.target.value)}
                            className="h-7 text-xs w-28 bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 outline-none focus:border-red-500 transition-colors" />
                          <span className="text-[10px] text-slate-500">Bookingklokkeslett</span>
                        </div>
                        {poiStopDates.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">Dato</p>
                            <div className="flex flex-wrap gap-1">
                              {poiStopDates.map((d) => (
                                <button key={d} type="button" onClick={() => setPoiDinDate(poiDinDate === d ? null : d)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                    d === poiDinDate ? 'bg-red-700 border-red-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                  }`}>
                                  {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <button type="submit" disabled={!poiDinName.trim()}
                            className="flex-1 h-7 rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                            Legg til
                          </button>
                          <button type="button" onClick={() => setShowDinForm(false)}
                            className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                            Avbryt
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={openDinForm}
                        className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-[11px] transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Opprett nytt spisested
                      </button>
                    )}
                  </div>
                )}

                {/* ── Mulig aktivitet tab ── */}
                {selectedTab === 'mulig' && (
                  <div className="space-y-1.5">
                    {stopPossible.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500">Eksisterende mulige aktiviteter:</p>
                        {stopPossible.slice(0, 4).map((p) => (
                          <div key={p.id} className="px-2 py-1 bg-slate-800/60 rounded-md">
                            <span className="text-[11px] text-slate-300 line-clamp-1">{p.description}</span>
                          </div>
                        ))}
                        {stopPossible.length > 4 && (
                          <p className="text-[10px] text-slate-600 text-center">og {stopPossible.length - 4} til</p>
                        )}
                      </div>
                    )}
                    {showPossForm ? (
                      <form onSubmit={handleSubmitPossible} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                        <input value={poiPossDesc} onChange={(e) => setPoiPossDesc(e.target.value)}
                          placeholder="Beskrivelse av aktivitet" autoFocus
                          className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-teal-500 transition-colors" />
                        <input value={poiPossUrl} onChange={(e) => setPoiPossUrl(e.target.value)} placeholder="https://..."
                          className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-teal-500 transition-colors" />
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Kategori</p>
                          <div className="flex flex-wrap gap-1">
                            {ACTIVITY_TYPE_PRESETS.map((p) => (
                              <button key={p.value} type="button"
                                onClick={() => setPoiPossCategory(poiPossCategory === p.value ? null : p.value)}
                                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  poiPossCategory === p.value ? 'bg-teal-700 border-teal-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                }`}>
                                <ActivityTypeIcon type={p.value} size={11} />
                                <span>{p.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        {poiStopDates.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">Dag (valgfritt)</p>
                            <div className="flex flex-wrap gap-1">
                              {poiStopDates.map((d) => (
                                <button key={d} type="button"
                                  onClick={() => setPoiPossDate(poiPossDate === d ? null : d)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                    poiPossDate === d
                                      ? 'bg-teal-700 border-teal-600 text-white'
                                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                  }`}>
                                  {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <button type="submit" disabled={!poiPossDesc.trim()}
                            className="flex-1 h-7 rounded-md bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                            Legg til
                          </button>
                          <button type="button" onClick={() => setShowPossForm(false)}
                            className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                            Avbryt
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={openPossForm}
                        className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-[11px] transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Legg til som mulig aktivitet
                      </button>
                    )}
                  </div>
                )}

                {/* ── Hotell tab ── */}
                {selectedTab === 'hotell' && (
                  <div className="space-y-1.5">
                    {stopHotel && (
                      <div className="px-2 py-1.5 bg-slate-800/60 rounded-md border border-slate-700/50">
                        <p className="text-[10px] text-slate-500 mb-0.5">Eksisterende hotell</p>
                        <p className="text-[11px] text-slate-300 truncate">{stopHotel.name || '(uten navn)'}</p>
                      </div>
                    )}
                    <button
                      onClick={handleSaveHotel}
                      className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-[11px] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {stopHotel ? 'Oppdater hotell med dette stedet' : 'Registrer som hotell'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

interface PendingStop {
  lat: number
  lng: number
  city?: string
  state?: string
  fromSearch?: boolean
}

const USA_CENTER = { lat: 39.5, lng: -98.35 }

// ─── Custom map controls (zoom + map type) ────────────────────────────────────

type BaseMapType = 'roadmap' | 'terrain' | 'satellite'

const MAP_TYPES: { id: BaseMapType; label: string }[] = [
  { id: 'roadmap',   label: 'Kart' },
  { id: 'terrain',   label: 'Terreng' },
  { id: 'satellite', label: 'Satellitt' },
]

function MapControls() {
  const map = useMap()
  const { isDark } = useAppTheme()

  // Light themes default to roadmap; dark themes default to satellite
  const [baseType, setBaseType] = useState<BaseMapType>(() =>
    typeof window !== 'undefined'
      ? (document.documentElement.getAttribute('data-theme') ?? 'default').startsWith('light')
        ? 'roadmap'
        : 'satellite'
      : 'satellite'
  )
  const [showLabels, setShowLabels] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [tilted, setTilted] = useState(false)
  const [heading, setHeading] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Resolve actual Google Maps map type ID
  const actualTypeId = baseType === 'satellite'
    ? (showLabels ? 'hybrid' : 'satellite')
    : baseType

  // Sync map type whenever it changes
  useEffect(() => {
    if (!map) return
    map.setMapTypeId(actualTypeId)
  }, [map, actualTypeId])

  // Sync tilt whenever it changes
  useEffect(() => {
    if (!map) return
    map.setTilt(tilted ? 45 : 0)
  }, [map, tilted])

  // Sync heading whenever it changes
  useEffect(() => {
    if (!map) return
    map.setHeading(heading)
  }, [map, heading])

  // Switch map type automatically when theme changes
  useEffect(() => {
    setBaseType(isDark ? 'satellite' : 'roadmap')
  }, [isDark])

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [dropdownOpen])

  function zoomIn()    { if (map) map.setZoom((map.getZoom() ?? 4) + 1) }
  function zoomOut()   { if (map) map.setZoom((map.getZoom() ?? 4) - 1) }
  function rotateLeft()  { setHeading((h) => (h - 45 + 360) % 360) }
  function rotateRight() { setHeading((h) => (h + 45) % 360) }

  const currentLabel = MAP_TYPES.find((t) => t.id === baseType)?.label ?? 'Kart'

  // Shared panel style
  const panel = 'bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg'

  return (
    <>
      {/* ── Top-left: Map type selector ─────────────────────────────────── */}
      <div ref={containerRef} className="absolute top-2.5 left-2.5 z-10 pointer-events-auto">

        {/* Trigger button */}
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={`${panel} flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors`}
        >
          {currentLabel}
          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className={`${panel} absolute top-full left-0 mt-1 min-w-[152px] overflow-hidden`}>

            {/* Map type options */}
            {MAP_TYPES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setBaseType(id); setDropdownOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-left transition-colors ${
                  baseType === id
                    ? 'bg-blue-600/25 text-blue-300'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {/* Radio indicator */}
                <span
                  className={`w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center ${
                    baseType === id ? 'border-blue-400 bg-blue-500' : 'border-slate-600 bg-transparent'
                  }`}
                >
                  {baseType === id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {label}
              </button>
            ))}

            {/* Divider */}
            <div className="border-t border-slate-700/60 mx-0" />

            {/* Labels toggle */}
            <button
              onClick={() => setShowLabels((v) => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              {/* Checkbox indicator */}
              <span
                className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                  showLabels ? 'border-blue-400 bg-blue-500' : 'border-slate-600 bg-transparent'
                }`}
              >
                {showLabels && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
              </span>
              Etiketter
              {baseType !== 'satellite' && (
                <span className="text-[9px] text-slate-600 ml-auto">kun satellitt</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom-right: Zoom + Rotate + Tilt ──────────────────────────── */}
      <div className={`${panel} absolute bottom-6 right-2.5 z-10 pointer-events-auto flex flex-col overflow-hidden`}>

        {/* Zoom */}
        <button
          onClick={zoomIn}
          title="Zoom inn"
          className="hover:bg-slate-800 text-slate-200 text-base font-semibold px-3.5 py-0.5 transition-colors border-b border-slate-700 leading-tight"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          title="Zoom ut"
          className="hover:bg-slate-800 text-slate-200 text-base font-semibold px-3.5 py-0.5 transition-colors border-b border-slate-700 leading-tight"
        >
          −
        </button>

        {/* Rotate */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={rotateLeft}
            title="Roter mot klokka"
            className="flex-1 flex items-center justify-center py-1.5 hover:bg-slate-800 text-slate-200 transition-colors border-r border-slate-700"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={rotateRight}
            title="Roter med klokka"
            className="flex-1 flex items-center justify-center py-1.5 hover:bg-slate-800 text-slate-200 transition-colors"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </div>

        {/* Tilt / 3D */}
        <button
          onClick={() => setTilted((v) => !v)}
          title="3D-visning"
          className={`flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
            tilted
              ? 'bg-blue-600/30 text-blue-300'
              : 'text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Layers3 className="w-3 h-3 flex-shrink-0" />
          3D
        </button>
      </div>
    </>
  )
}

// ─── Haversine helpers ────────────────────────────────────────────────────────

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function sumKm(pts: { lat: number; lng: number }[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1], pts[i])
  return total
}

function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return km >= 10 ? `${Math.round(km).toLocaleString('no-NO')} km` : `${km.toFixed(1)} km`
}

// ─── Map tools (measure distance + travel time + photos) ─────────────────────

interface MapToolsProps {
  onActiveChange: (active: boolean) => void
}

function MapTools({ onActiveChange }: MapToolsProps) {
  const map = useMap()
  const [measuring, setMeasuring] = useState(false)
  const [points, setPoints] = useState<{ lat: number; lng: number }[]>([])
  const [driveInfo, setDriveInfo] = useState<{ dist: string; time: string } | null>(null)
  const [loadingDrive, setLoadingDrive] = useState(false)

  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const markersRef = useRef<google.maps.Marker[]>([])

  const panel = 'bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg'

  // Notify parent whenever measure mode toggles
  useEffect(() => {
    onActiveChange(measuring)
  }, [measuring, onActiveChange])

  // Attach / detach click listener on the raw map
  useEffect(() => {
    if (!map) return

    if (measuring) {
      listenerRef.current = map.addListener(
        'click',
        (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return
          const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() }

          setPoints((prev) => {
            const next = [...prev, pt]

            // Draw marker
            const marker = new google.maps.Marker({
              position: pt,
              map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
              zIndex: 99,
            })
            markersRef.current.push(marker)

            // Draw segment polyline
            if (next.length >= 2) {
              const line = new google.maps.Polyline({
                path: [next[next.length - 2], next[next.length - 1]],
                geodesic: true,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.85,
                strokeWeight: 2,
                map,
              })
              polylinesRef.current.push(line)
            }

            return next
          })
        },
      )
    } else {
      listenerRef.current?.remove()
      listenerRef.current = null
    }

    return () => {
      listenerRef.current?.remove()
      listenerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, measuring])

  // Fetch drive time when exactly 2 points are set
  useEffect(() => {
    if (points.length !== 2) {
      setDriveInfo(null)
      return
    }
    let cancelled = false
    setLoadingDrive(true)

    const origin = `${points[0].lat},${points[0].lng}`
    const destination = `${points[1].lat},${points[1].lng}`

    fetch(`/api/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.durationText && data.distanceText) {
          setDriveInfo({ dist: data.distanceText, time: data.durationText })
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => { if (!cancelled) setLoadingDrive(false) })

    return () => { cancelled = true }
  }, [points])

  function clearOverlays() {
    polylinesRef.current.forEach((l) => l.setMap(null))
    polylinesRef.current = []
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
  }

  function handleToggleMeasure() {
    if (measuring) {
      // Turn off → clear everything
      clearOverlays()
      setPoints([])
      setDriveInfo(null)
      setMeasuring(false)
    } else {
      setMeasuring(true)
    }
  }

  function handleReset() {
    clearOverlays()
    setPoints([])
    setDriveInfo(null)
  }

  function handleOpenPhotos() {
    if (!map) return
    const center = map.getCenter()
    const zoom = map.getZoom() ?? 14
    if (!center) return
    const lat = center.lat().toFixed(6)
    const lng = center.lng().toFixed(6)
    window.open(
      `https://www.google.com/maps/@${lat},${lng},${zoom}z/data=!3m1!1e3`,
      '_blank',
    )
  }

  const straightKm = points.length >= 2 ? sumKm(points) : null

  return (
    <div className="absolute top-2.5 right-2.5 z-10 pointer-events-auto flex flex-col items-end gap-1.5">

      {/* Tool buttons */}
      <div className={`${panel} flex flex-col overflow-hidden`}>

        {/* Measure button */}
        <button
          onClick={handleToggleMeasure}
          title="Mål avstand"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors border-b border-slate-700 ${
            measuring
              ? 'bg-blue-600/30 text-blue-300'
              : 'text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Ruler className="w-3 h-3 flex-shrink-0" />
          Mål avstand
        </button>

        {/* Photos button */}
        <button
          onClick={handleOpenPhotos}
          title="Åpne bilder fra Google"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Images className="w-3 h-3 flex-shrink-0" />
          Bilder
        </button>
      </div>

      {/* Info panel – shown when measuring and at least 1 point placed */}
      {measuring && points.length > 0 && (
        <div className={`${panel} p-2.5 min-w-[170px] text-[11px] text-slate-200`}>

          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-semibold text-slate-100">
              {points.length === 1 ? 'Klikk neste punkt' : `${points.length} punkt`}
            </span>
            <button
              onClick={handleReset}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Nullstill"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Straight-line distance */}
          {straightKm !== null && (
            <div className="flex items-center justify-between gap-3 text-slate-300">
              <span>Luftlinje</span>
              <span className="font-medium text-white">{fmtKm(straightKm)}</span>
            </div>
          )}

          {/* Drive info (only for exactly 2 points) */}
          {points.length === 2 && (
            <div className="mt-1 pt-1.5 border-t border-slate-700/60 space-y-0.5">
              {loadingDrive ? (
                <span className="text-slate-500">Henter kjøretid…</span>
              ) : driveInfo ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-slate-300">
                    <span>Kjøring</span>
                    <span className="font-medium text-white">{driveInfo.dist}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-300">
                    <span>Reisetid</span>
                    <span className="font-medium text-white">{driveInfo.time}</span>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Hint */}
          <p className="mt-1.5 text-[10px] text-slate-500">
            {points.length < 2 ? 'Klikk i kartet for å legge til punkt' : 'Klikk for å legge til flere punkt'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Pans + zooms map; zooms back out to full route on deselect ──────────────

function MapController({
  center,
  stops,
  fitPoints,
  forcePanVersion,
}: {
  center: { lat: number; lng: number } | null | undefined
  stops: Stop[]
  fitPoints?: Array<{ lat: number; lng: number }> | null
  forcePanVersion?: number
}) {
  const map = useMap()
  const prevCenterRef = useRef<typeof center>(undefined)
  const prevFitPointsRef = useRef<typeof fitPoints>(undefined)
  const prevForcePanRef = useRef<number | undefined>(undefined)
  const stopsRef = useRef(stops)
  stopsRef.current = stops

  useEffect(() => {
    if (!map) return
    const prev = prevCenterRef.current
    prevCenterRef.current = center
    const prevFit = prevFitPointsRef.current
    prevFitPointsRef.current = fitPoints
    const prevForce = prevForcePanRef.current
    prevForcePanRef.current = forcePanVersion

    const forceTriggered = forcePanVersion !== prevForce && forcePanVersion !== undefined

    if (fitPoints && fitPoints.length >= 2) {
      // Skip if points haven't changed (unless forced)
      const same = !forceTriggered && prevFit &&
        prevFit.length === fitPoints.length &&
        fitPoints.every((p, i) => prevFit![i].lat === p.lat && prevFit![i].lng === p.lng)
      if (!same) {
        const bounds = new google.maps.LatLngBounds()
        fitPoints.forEach((p) => bounds.extend(p))
        map.fitBounds(bounds, 80)
      }
    } else if (fitPoints && fitPoints.length === 1) {
      // Single point – pan in (forced or when coords change)
      const [p] = fitPoints
      if (forceTriggered || prevFit?.[0]?.lat !== p.lat || prevFit?.[0]?.lng !== p.lng) {
        map.panTo(p)
        map.setZoom(13)
      }
    } else if (center) {
      if (!forceTriggered && prev?.lat === center.lat && prev?.lng === center.lng) return
      map.panTo(center)
      map.setZoom(18)
    } else if ((prev != null || (prevFit && prevFit.length > 0)) && stopsRef.current.length > 0) {
      // Deselected – zoom out to show all stops
      const bounds = new google.maps.LatLngBounds()
      stopsRef.current.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }))
      map.fitBounds(bounds, 80)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center, fitPoints, forcePanVersion])

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlanningMap({
  stops,
  selectedStopId,
  onAddStop,
  onSelectStop,
  disabled = false,
  readOnly = false,
  activities = [],
  selectedActivityId = null,
  onSelectActivity,
  dining = [],
  selectedDiningId = null,
  onSelectDining,
  mapCenter,
  mapFitPoints,
  mapForcePanVersion,
  activityRoute,
  onActivityRouteInfo,
  hotels = [],
  possibleActivities = [],
  selectedPossibleId = null,
  onSelectPossible,
  onPoiAction,
  routeLegs = [],
  routeLegsLoaded = true,
  onRouteLegsChange,
  onRouteStatesChange,
  onCitySearch,
  onCityMapClick,
  cityTripMode = false,
  useCountryForState = false,
  tripDateFrom = null,
}: PlanningMapProps) {
  const [pendingStop, setPendingStop] = useState<PendingStop | null>(null)
  const [poiPlaceId, setPoiPlaceId] = useState<string | null>(null)
  const activeToolRef = useRef(false)

  const handleToolActive = useCallback((active: boolean) => {
    activeToolRef.current = active
  }, [])

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (disabled || activeToolRef.current) return

    // POI icon clicked – show info popup
    if (e.detail.placeId) {
      e.stop() // prevent Google's default info window
      setPoiPlaceId(e.detail.placeId)
      return
    }

    if (!e.detail.latLng) return
    setPoiPlaceId(null)

    if (readOnly) {
      if (onCityMapClick) onCityMapClick(e.detail.latLng.lat, e.detail.latLng.lng)
      return
    }
    setPendingStop({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng })
  }, [disabled, readOnly, onCityMapClick])

  const handleSearchSelect = useCallback(
    ({ lat, lng, city, state }: { lat: number; lng: number; city: string; state: string }) => {
      setPendingStop({ lat, lng, city, state, fromSearch: true })
    },
    []
  )

  function handleConfirmStop(city: string, state: string, nights: number) {
    if (!pendingStop) return
    const isFirst = stops.length === 0
    const newStop: Stop = {
      id: crypto.randomUUID(),
      trip_id: 'local',
      city,
      state,
      lat: pendingStop.lat,
      lng: pendingStop.lng,
      order: stops.length,
      arrival_date: isFirst && tripDateFrom ? tripDateFrom : null,
      nights,
      notes: null,
      created_at: new Date().toISOString(),
    }
    onAddStop(newStop)
    setPendingStop(null)
  }

  // Handlers for adding activity/dining/hotel/possible from map popup
  function handleMapAddActivity(stopId: string, name: string, lat: number, lng: number) {
    onPoiAction?.addActivity(stopId, { name, map_lat: lat, map_lng: lng })
    setPendingStop(null)
  }
  function handleMapAddDining(stopId: string, name: string, lat: number, lng: number) {
    onPoiAction?.addDining(stopId, { name, map_lat: lat, map_lng: lng })
    setPendingStop(null)
  }
  function handleMapAddHotel(stopId: string, name: string, lat: number, lng: number) {
    onPoiAction?.saveHotel(stopId, name, null, null, lat, lng)
    setPendingStop(null)
  }
  function handleMapAddPossible(stopId: string, description: string, lat: number, lng: number) {
    onPoiAction?.addPossible(stopId, { description, map_lat: lat, map_lng: lng })
    setPendingStop(null)
  }

  const pinnedActivities = activities.filter((a) => a.map_lat != null && a.map_lng != null)

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="relative w-full h-full">
        <Map
          defaultCenter={USA_CENTER}
          defaultZoom={4}
          onClick={handleMapClick}
          className="w-full h-full"
          gestureHandling="greedy"
          zoomControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={false}
        >
          {/* Programmatic pan + zoom */}
          <MapController center={mapCenter} stops={stops} fitPoints={mapFitPoints} forcePanVersion={mapForcePanVersion} />

          {/* Stoppesteder */}
          {stops.map((stop, index) => (
            <StopMarker
              key={stop.id}
              stop={stop}
              index={index}
              isSelected={stop.id === selectedStopId}
              onClick={() => onSelectStop(stop.id)}
              hotelName={hotels.find((h) => h.stop_id === stop.id)?.name || undefined}
              showHotelIcon={cityTripMode && index === 0}
            />
          ))}

          {/* Aktivitetsmarkører */}
          {pinnedActivities.map((activity) => (
            <ActivityMarker
              key={activity.id}
              activity={activity}
              isSelected={activity.id === selectedActivityId}
              onClick={onSelectActivity ? () => onSelectActivity(activity.id) : undefined}
            />
          ))}

          {/* Spisestedmarkører */}
          {dining.filter((d) => d.map_lat != null && d.map_lng != null).map((d) => (
            <DiningMarker
              key={d.id}
              dining={d}
              isSelected={d.id === selectedDiningId}
              onClick={onSelectDining ? () => onSelectDining(d.id) : undefined}
            />
          ))}

          {/* Mulige aktiviteter med kartpunkt */}
          {possibleActivities.filter((p) => p.map_lat != null && p.map_lng != null).map((p) => (
            <PossibleActivityMarker
              key={p.id}
              possible={p}
              isSelected={p.id === selectedPossibleId}
              onClick={onSelectPossible ? () => onSelectPossible(p.id) : undefined}
            />
          ))}

          {/* Reiserute fra aktivitet til hotell */}
          {activityRoute && (
            <ActivityRoutePolyline
              fromLat={activityRoute.fromLat}
              fromLng={activityRoute.fromLng}
              toAddress={activityRoute.toAddress}
              toLat={activityRoute.toLat}
              toLng={activityRoute.toLng}
              onRouteInfo={onActivityRouteInfo}
            />
          )}

          {/* Midlertidig markør ved klikk */}
          {pendingStop && !pendingStop.fromSearch && (
            <StopMarker
              stop={{
                id: 'pending',
                trip_id: '',
                city: '...',
                state: '',
                lat: pendingStop.lat,
                lng: pendingStop.lng,
                order: -1,
                arrival_date: null,
                nights: 0,
                notes: null,
                created_at: '',
              }}
              index={-1}
              isSelected={false}
              onClick={() => {}}
              isPending
            />
          )}

          {/* Rute mellom stopp */}
          {stops.length >= 2 && (
            <RoutePolyline
              stops={stops}
              routeLegs={routeLegs}
              routeLegsLoaded={routeLegsLoaded}
              onLegsChange={onRouteLegsChange}
              onRouteStatesChange={onRouteStatesChange}
            />
          )}

          {/* Søkeboks: always shown for road trips; also shown for city trips if onCitySearch provided */}
          {(!readOnly || onCitySearch) && (
            <MapSearchBox
              onPlaceSelect={readOnly && onCitySearch ? onCitySearch : handleSearchSelect}
            />
          )}
        </Map>

        {/* Egendefinerte kartkontroller */}
        <MapControls />

        {/* Kartverktøy */}
        <MapTools onActiveChange={handleToolActive} />

        {/* POI info popup */}
        {poiPlaceId && (
          <PoiInfoBox
            key={poiPlaceId}
            placeId={poiPlaceId}
            onClose={() => setPoiPlaceId(null)}
            stops={stops}
            activities={activities}
            dining={dining}
            possibleActivities={possibleActivities}
            hotels={hotels}
            onPoiAction={onPoiAction}
            activeStopId={selectedStopId}
          />
        )}

        {/* Popup for å bekrefte nytt stopp / legge til aktivitet, spisestad, hotell, mulig */}
        {pendingStop && !readOnly && (
          <AddStopPopup
            lat={pendingStop.lat}
            lng={pendingStop.lng}
            initialCity={pendingStop.city}
            initialState={pendingStop.state}
            fromSearch={pendingStop.fromSearch}
            stops={stops}
            activeStopId={selectedStopId}
            useCountry={useCountryForState}
            onConfirm={handleConfirmStop}
            onAddActivity={onPoiAction ? handleMapAddActivity : undefined}
            onAddDining={onPoiAction ? handleMapAddDining : undefined}
            onAddHotel={onPoiAction ? handleMapAddHotel : undefined}
            onAddPossible={onPoiAction ? handleMapAddPossible : undefined}
            onCancel={() => setPendingStop(null)}
          />
        )}

        {stops.length === 0 && !pendingStop && !disabled && !readOnly && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-lg text-sm text-slate-600 pointer-events-none whitespace-nowrap">
            🔍 Søk etter en by eller klikk på kartet for å starte
          </div>
        )}

        {disabled && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-center">
              <p className="text-slate-600 text-sm font-medium">Velg eller opprett en tur i sidepanelet for å komme i gang</p>
            </div>
          </div>
        )}
      </div>
    </APIProvider>
  )
}
