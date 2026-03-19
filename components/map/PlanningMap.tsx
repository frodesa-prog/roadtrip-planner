'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Ruler, Images, X, RotateCcw, RotateCw, Layers3 } from 'lucide-react'
import {
  APIProvider,
  Map,
  MapMouseEvent,
  useMap,
} from '@vis.gl/react-google-maps'
import { Activity, Dining, Hotel, RouteLeg, Stop } from '@/types'
import RoutePolyline, { LegWaypoints } from './RoutePolyline'
import StopMarker from './StopMarker'
import AddStopPopup from './AddStopPopup'
import MapSearchBox from './MapSearchBox'
import ActivityMarker from './ActivityMarker'
import DiningMarker from './DiningMarker'
import ActivityRoutePolyline, { RouteInfo } from './ActivityRoutePolyline'

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
  /** Trip ID used to persist layer-visibility preferences per trip */
  tripId?: string
}

// ─── POI layer definitions ─────────────────────────────────────────────────────

interface PoiLayer {
  id: string
  label: string
  sublabel: string
  icon: string
  featureType: string
}

const POI_LAYERS: PoiLayer[] = [
  {
    id: 'business',
    label: 'Forretninger',
    sublabel: 'Restauranter, hotell, bensinstasjoner m.m.',
    icon: '🍽️',
    featureType: 'poi.business',
  },
  {
    id: 'attraction',
    label: 'Severdigheter',
    sublabel: 'Turistattraksjoner og opplevelser',
    icon: '🏛️',
    featureType: 'poi.attraction',
  },
  {
    id: 'park',
    label: 'Parker & natur',
    sublabel: 'Parker, grøntområder og naturreservater',
    icon: '🌿',
    featureType: 'poi.park',
  },
  {
    id: 'transit',
    label: 'Kollektivtransport',
    sublabel: 'Bussholdeplasser, t-bane, jernbane',
    icon: '🚌',
    featureType: 'transit',
  },
  {
    id: 'medical',
    label: 'Helse',
    sublabel: 'Sykehus, apotek og klinikker',
    icon: '🏥',
    featureType: 'poi.medical',
  },
  {
    id: 'worship',
    label: 'Tros- og kultursteder',
    sublabel: 'Kirker, moskeer, templer m.m.',
    icon: '⛪',
    featureType: 'poi.place_of_worship',
  },
]

function lsKey(tripId: string | undefined) {
  return tripId ? `map-layers-${tripId}` : null
}

// ─── Layer toggle panel ────────────────────────────────────────────────────────

function MapLayerToggle({ tripId }: { tripId?: string }) {
  const map = useMap()
  const [open, setOpen] = useState(false)
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(() => {
    const key = lsKey(tripId)
    if (!key) return new Set()
    try {
      const saved = localStorage.getItem(key)
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch { return new Set() }
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // When tripId changes, load that trip's saved layers
  useEffect(() => {
    const key = lsKey(tripId)
    if (!key) { setHiddenLayers(new Set()); return }
    try {
      const saved = localStorage.getItem(key)
      setHiddenLayers(saved ? new Set(JSON.parse(saved) as string[]) : new Set())
    } catch { setHiddenLayers(new Set()) }
  }, [tripId])

  // Apply styles to map whenever hiddenLayers changes
  useEffect(() => {
    if (!map) return
    const styles: google.maps.MapTypeStyle[] = []
    hiddenLayers.forEach((id) => {
      const layer = POI_LAYERS.find((l) => l.id === id)
      if (layer) {
        styles.push({ featureType: layer.featureType, elementType: 'all', stylers: [{ visibility: 'off' }] })
      }
    })
    map.setOptions({ styles })
  }, [map, hiddenLayers])

  // Save to localStorage whenever hiddenLayers changes
  useEffect(() => {
    const key = lsKey(tripId)
    if (!key) return
    localStorage.setItem(key, JSON.stringify([...hiddenLayers]))
  }, [hiddenLayers, tripId])

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle(id: string) {
    setHiddenLayers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const panel = 'bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg'
  const hiddenCount = hiddenLayers.size

  return (
    <div ref={containerRef} className="absolute top-[46px] left-2.5 z-10 pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Kartlag"
        className={`${panel} flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
          hiddenCount > 0 ? 'text-amber-300' : 'text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Layers3 className="w-3.5 h-3.5 flex-shrink-0" />
        Lag
        {hiddenCount > 0 && (
          <span className="bg-amber-500 text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
            {hiddenCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`${panel} absolute top-full left-0 mt-1 w-64 overflow-hidden`}>
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Vis / skjul kartlag</p>
          </div>
          {POI_LAYERS.map((layer) => {
            const isVisible = !hiddenLayers.has(layer.id)
            return (
              <button
                key={layer.id}
                onClick={() => toggle(layer.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-800 transition-colors"
              >
                {/* Checkbox */}
                <span
                  className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                    isVisible ? 'border-blue-400 bg-blue-500' : 'border-slate-600 bg-transparent'
                  }`}
                >
                  {isVisible && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </span>
                <span className="text-base flex-shrink-0">{layer.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-200">{layer.label}</p>
                  <p className="text-[9px] text-slate-500 truncate">{layer.sublabel}</p>
                </div>
              </button>
            )
          })}
          {hiddenCount > 0 && (
            <>
              <div className="border-t border-slate-700/60 mx-0 mt-1" />
              <button
                onClick={() => setHiddenLayers(new Set())}
                className="w-full px-3 py-2 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-left"
              >
                Vis alle lag
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

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
  // 'satellite' base + showLabels=true → Google 'hybrid'; showLabels=false → 'satellite'
  const [baseType, setBaseType] = useState<BaseMapType>('satellite')
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
  routeLegs = [],
  routeLegsLoaded = true,
  onRouteLegsChange,
  onRouteStatesChange,
  onCitySearch,
  onCityMapClick,
  cityTripMode = false,
  tripId,
}: PlanningMapProps) {
  const [pendingStop, setPendingStop] = useState<PendingStop | null>(null)
  const activeToolRef = useRef(false)

  const handleToolActive = useCallback((active: boolean) => {
    activeToolRef.current = active
  }, [])

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (disabled || !e.detail.latLng || activeToolRef.current) return
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

  function handleConfirmStop(city: string, state: string) {
    if (!pendingStop) return
    const newStop: Stop = {
      id: crypto.randomUUID(),
      trip_id: 'local',
      city,
      state,
      lat: pendingStop.lat,
      lng: pendingStop.lng,
      order: stops.length,
      arrival_date: null,
      nights: 1,
      notes: null,
      created_at: new Date().toISOString(),
    }
    onAddStop(newStop)
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

        {/* Kartlag-toggle */}
        <MapLayerToggle tripId={tripId} />

        {/* Kartverktøy */}
        <MapTools onActiveChange={handleToolActive} />

        {/* Popup for å bekrefte nytt stopp */}
        {pendingStop && !readOnly && (
          <AddStopPopup
            lat={pendingStop.lat}
            lng={pendingStop.lng}
            initialCity={pendingStop.city}
            initialState={pendingStop.state}
            fromSearch={pendingStop.fromSearch}
            onConfirm={handleConfirmStop}
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
