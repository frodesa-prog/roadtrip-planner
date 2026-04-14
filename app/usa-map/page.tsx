'use client'

import { APIProvider, Map as GoogleMap, useMapsLibrary, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StopData {
  id: string
  trip_id: string
  city: string
  state: string | null
  lat: number
  lng: number
  order: number
  nights: number
  arrival_date: string | null
}

interface RouteLegData {
  from_stop_id: string
  to_stop_id: string
  waypoints: Array<{ lat: number; lng: number }>
}

interface TripData {
  id: string
  name: string
}

interface TripWithStops extends TripData {
  stops: StopData[]
  routeLegs: RouteLegData[]
  color: string
}

interface ActivityData {
  id: string
  stop_id: string
  name: string
  activity_type: string | null
  activity_time: string | null
  activity_date: string | null
  map_lat: number | null
  map_lng: number | null
}

interface ActivityPin {
  id: string
  name: string
  activity_type: string | null
  activity_time: string | null
  lat: number
  lng: number
  tripName: string
  date: string | null
  location: string
}

interface DiningPin {
  id: string
  name: string
  booking_time: string | null
  lat: number
  lng: number
  tripName: string
  date: string | null
  location: string
}

interface DiningData {
  id: string
  stop_id: string
  name: string
  booking_time: string | null
  booking_date: string | null
  map_lat: number | null
  map_lng: number | null
}

interface InfoState {
  lat: number
  lng: number
  label: string
  tripName?: string
  date?: string | null
  location?: string | null
}

// ── US state helpers (same logic as VacationStats) ───────────────────────────

const US_STATE_FULL: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas',
  CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware',
  FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho',
  IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas',
  KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi',
  MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma',
  OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah',
  VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'Washington D.C.',
}
const US_STATES_SET = new Set([
  ...Object.keys(US_STATE_FULL).map(k => k.toLowerCase()),
  ...Object.values(US_STATE_FULL).map(v => v.toLowerCase()),
])
const expandStateName = (s: string): string =>
  US_STATE_FULL[s.trim().toUpperCase()] ?? s.trim()
const isUSState = (s: string) => US_STATES_SET.has(s.toLowerCase().trim())

// All US state full names sorted — used for "not visited" calculation
const ALL_US_STATE_NAMES: string[] = Object.values(US_STATE_FULL).sort()

// ── Constants ─────────────────────────────────────────────────────────────────

const USA_CENTER = { lat: 39.8, lng: -98.5 }
// GeoJSON for US state boundaries (PublicaMundi, MIT license)
const US_STATES_GEOJSON_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json'

const ROUTE_COLORS = [
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#eab308',
  '#14b8a6',
  '#f43f5e',
  '#84cc16',
]

// ── Geometry helpers: perpendicular polyline offset ──────────────────────────

const DEG = Math.PI / 180

function bearingRad(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLng = (b.lng - a.lng) * DEG
  const lat1 = a.lat * DEG, lat2 = b.lat * DEG
  return Math.atan2(
    Math.sin(dLng) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng),
  )
}

function movePoint(
  p: { lat: number; lng: number },
  bearing: number,
  meters: number,
): { lat: number; lng: number } {
  const R = 6_371_000
  const d = meters / R
  const lat1 = p.lat * DEG, lng1 = p.lng * DEG
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  )
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
  )
  return { lat: lat2 / DEG, lng: lng2 / DEG }
}

/** Forskyver en polyline vinkelrett på retningen med `offsetM` meter (+ = høyre, − = venstre). */
function shiftPolyline(
  path: google.maps.LatLng[],
  offsetM: number,
): google.maps.LatLng[] {
  if (offsetM === 0 || path.length < 2) return path
  return path.map((pt, i) => {
    const prev = path[Math.max(0, i - 1)]
    const next = path[Math.min(path.length - 1, i + 1)]
    const bear = bearingRad(
      { lat: prev.lat(), lng: prev.lng() },
      { lat: next.lat(), lng: next.lng() },
    )
    const shifted = movePoint({ lat: pt.lat(), lng: pt.lng() }, bear + Math.PI / 2, offsetM)
    return new google.maps.LatLng(shifted.lat, shifted.lng)
  })
}

// ── TripRoute: draws directions + markers for one trip ────────────────────────

// Avstand mellom parallelle ruter i meter (synlig på delstatsnivå, knapt merkbar på USA-nivå)
const LANE_SPACING = 80

function TripRoute({
  trip,
  visible,
  offsetIndex,
  totalTrips,
  onMarkerClick,
  onDistanceReady,
}: {
  trip: TripWithStops
  visible: boolean
  offsetIndex: number
  totalTrips: number
  onMarkerClick: (info: InfoState) => void
  onDistanceReady: (tripId: string, km: number) => void
}) {
  const map       = useMap()
  const routesLib = useMapsLibrary('routes')

  const polylineRef        = useRef<google.maps.Polyline | null>(null)
  const roadPolylineRef    = useRef<google.maps.Polyline | null>(null)
  const markersRef         = useRef<google.maps.Marker[]>([])
  const directionsLoadedRef = useRef(false)

  // Nullstill når stoppesteder endres så ny rute hentes og fallback-polyline vises midlertidig
  useEffect(() => {
    directionsLoadedRef.current = false
    roadPolylineRef.current?.setMap(null)
    roadPolylineRef.current = null
  }, [trip.stops])

  // Toggle visibility without re-fetching routes
  useEffect(() => {
    const targetMap = visible ? map ?? null : null
    // Only restore fallback polyline if real directions haven't loaded yet
    if (!directionsLoadedRef.current) {
      polylineRef.current?.setMap(targetMap)
    }
    roadPolylineRef.current?.setMap(targetMap)
    markersRef.current.forEach((m) => m.setMap(targetMap))
  }, [visible, map])

  // 1. Fallback straight-line polyline (shown immediately while Directions loads)
  useEffect(() => {
    if (!map || trip.stops.length < 2) return

    polylineRef.current?.setMap(null)
    polylineRef.current = new google.maps.Polyline({
      path:          trip.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      geodesic:      true,
      strokeColor:   trip.color,
      strokeOpacity: 0.45,
      strokeWeight:  3,
      map,
    })

    return () => { polylineRef.current?.setMap(null) }
  }, [map, trip.stops, trip.color])

  // 2. Road-based route via Directions API – tegnes som offset Polyline
  useEffect(() => {
    if (!map || !routesLib || trip.stops.length < 2) return

    // Beregn forskyvning i meter: symmetrisk rundt null for alle turer
    const offsetM = (offsetIndex - (totalTrips - 1) / 2) * LANE_SPACING

    // Bygg waypoints-array med lagrede via-punkter (samme mønster som RoutePolyline.tsx):
    // [via0..., stopp1(stopover), via1..., stopp2(stopover), ..., viaN...]
    const allWaypoints: google.maps.DirectionsWaypoint[] = []
    for (let i = 1; i < trip.stops.length - 1; i++) {
      const fromId = trip.stops[i - 1].id
      const toId   = trip.stops[i].id
      const saved  = trip.routeLegs.find(
        (l) => l.from_stop_id === fromId && l.to_stop_id === toId
      )
      if (saved?.waypoints?.length) {
        for (const wp of saved.waypoints) {
          allWaypoints.push({ location: new google.maps.LatLng(wp.lat, wp.lng), stopover: false })
        }
      }
      allWaypoints.push({ location: new google.maps.LatLng(trip.stops[i].lat, trip.stops[i].lng), stopover: true })
    }
    // Via-punkter for siste etappe
    if (trip.stops.length >= 2) {
      const lastFromId = trip.stops[trip.stops.length - 2].id
      const lastToId   = trip.stops[trip.stops.length - 1].id
      const lastSaved  = trip.routeLegs.find(
        (l) => l.from_stop_id === lastFromId && l.to_stop_id === lastToId
      )
      if (lastSaved?.waypoints?.length) {
        for (const wp of lastSaved.waypoints) {
          allWaypoints.push({ location: new google.maps.LatLng(wp.lat, wp.lng), stopover: false })
        }
      }
    }

    const service = new routesLib.DirectionsService()
    service.route(
      {
        origin:            { lat: trip.stops[0].lat, lng: trip.stops[0].lng },
        destination:       { lat: trip.stops[trip.stops.length - 1].lat, lng: trip.stops[trip.stops.length - 1].lng },
        waypoints:         allWaypoints,
        travelMode:        google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          // Trekk ut detaljert sti fra alle etapper/steg
          const rawPath: google.maps.LatLng[] = []
          for (const leg of result.routes[0].legs) {
            for (const step of leg.steps) {
              rawPath.push(...step.path)
            }
          }
          // Forskyv stien vinkelrett og tegn som vanlig Polyline
          const shiftedPath = shiftPolyline(rawPath, offsetM)
          roadPolylineRef.current?.setMap(null)
          roadPolylineRef.current = new google.maps.Polyline({
            path:          shiftedPath,
            strokeColor:   trip.color,
            strokeWeight:  5,
            strokeOpacity: 0.88,
            map,
          })
          directionsLoadedRef.current = true
          polylineRef.current?.setMap(null)
          // Summer kjøreavstand
          const totalMeters = result.routes[0].legs.reduce(
            (sum, leg) => sum + (leg.distance?.value ?? 0), 0
          )
          onDistanceReady(trip.id, Math.round(totalMeters / 1000))
        }
      }
    )

    return () => {
      roadPolylineRef.current?.setMap(null)
      roadPolylineRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, trip.stops, trip.routeLegs, trip.color, offsetIndex, totalTrips])

  // 3. Stop markers
  useEffect(() => {
    if (!map) return

    // Clean up previous markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    trip.stops.forEach((stop, i) => {
      const label = String(i + 1)
      const city  = stop.state ? `${stop.city}, ${stop.state}` : stop.city

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="20" viewBox="0 0 32 40">
          <circle cx="16" cy="16" r="14" fill="${trip.color}" stroke="white" stroke-width="2.5"/>
          <text x="16" y="21" text-anchor="middle" fill="white"
                font-size="${label.length > 2 ? '9' : '11'}" font-weight="700"
                font-family="system-ui, sans-serif">${label}</text>
          <polygon points="16,38 10,26 22,26" fill="${trip.color}"/>
        </svg>
      `

      const marker = new google.maps.Marker({
        position:  { lat: stop.lat, lng: stop.lng },
        map,
        title:     city,
        zIndex:    i + 1,
        icon: {
          url:         `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize:  new google.maps.Size(16, 20),
          anchor:      new google.maps.Point(8, 20),
        },
      })

      marker.addListener('click', () => {
        onMarkerClick({ lat: stop.lat, lng: stop.lng, label: `${trip.name} · Stopp ${i + 1}: ${city}` })
      })

      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, trip.stops, trip.color, trip.name, onMarkerClick])

  return null
}

// ── StateHighlight: shades visited US states via Google Maps Data layer ───────

function StateHighlight({
  visitedStates,
  allVisitedStates,
  showVisited,
  showUnvisited,
}: {
  visitedStates: Set<string>      // from visible trips (blue)
  allVisitedStates: Set<string>   // from ALL trips (determines red = never visited)
  showVisited: boolean
  showUnvisited: boolean
}) {
  const map = useMap()
  const layerRef = useRef<google.maps.Data | null>(null)
  const [geoLoaded, setGeoLoaded] = useState(false)

  // Create the Data layer and load GeoJSON once
  useEffect(() => {
    if (!map) return
    const layer = new google.maps.Data()
    layerRef.current = layer

    fetch(US_STATES_GEOJSON_URL)
      .then((r) => r.json())
      .then((geo) => {
        layer.addGeoJson(geo)
        setGeoLoaded(true)
      })
      .catch(() => {/* silent fail */})

    return () => {
      layer.setMap(null)
      layerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Apply style and visibility whenever inputs change
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !geoLoaded) return

    const needsMap = showVisited || showUnvisited
    layer.setMap(needsMap ? map ?? null : null)

    layer.setStyle((feature) => {
      const name = feature.getProperty('name') as string
      const isVisitedVisible  = showVisited  && visitedStates.has(name)
      const isNeverVisited    = showUnvisited && !allVisitedStates.has(name)

      if (isVisitedVisible) {
        return { fillColor: '#3b82f6', fillOpacity: 0.28, strokeColor: '#60a5fa', strokeOpacity: 0.7,  strokeWeight: 1.5, zIndex: 1 }
      }
      if (isNeverVisited) {
        return { fillColor: '#ef4444', fillOpacity: 0.18, strokeColor: '#f87171', strokeOpacity: 0.55, strokeWeight: 1,   zIndex: 1 }
      }
      return   { fillColor: '#1e293b', fillOpacity: 0.05, strokeColor: '#334155', strokeOpacity: 0.25, strokeWeight: 0.5, zIndex: 1 }
    })
  }, [map, visitedStates, allVisitedStates, showVisited, showUnvisited, geoLoaded])

  return null
}

// ── InfoPopup: floating label on marker click ─────────────────────────────────

function InfoPopup({ info, onClose }: { info: InfoState; onClose: () => void }) {
  const formattedDate = info.date
    ? new Date(info.date + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.97)',
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: 500,
        padding: '10px 14px',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        zIndex: 20,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {info.label}
        </span>
        {info.location && (
          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            📍 {info.location}
          </span>
        )}
        {info.tripName && (
          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            🧳 {info.tripName}
          </span>
        )}
        {formattedDate && (
          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            📅 {formattedDate}
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', color: '#64748b',
          cursor: 'pointer', fontSize: 15, lineHeight: 1,
          padding: 0, flexShrink: 0, marginTop: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ── CityPinsLayer: one pin per unique visited city in USA ─────────────────────

interface CityPin {
  key: string
  city: string
  state: string
  lat: number
  lng: number
  tripName: string
  date: string | null
}

function CityPinsLayer({
  cities,
  show,
  onMarkerClick,
}: {
  cities: CityPin[]
  show: boolean
  onMarkerClick: (info: InfoState) => void
}) {
  const map = useMap()
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!map) return

    // Clean up existing pins
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (!show) return

    const pinSvg = (fill: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="19" viewBox="0 0 28 38">
        <circle cx="14" cy="13" r="11" fill="${fill}" stroke="white" stroke-width="2.5"/>
        <circle cx="14" cy="13" r="4" fill="white" opacity="0.85"/>
        <polygon points="14,36 8,22 20,22" fill="${fill}"/>
      </svg>
    `

    cities.forEach(({ city, state, lat, lng, tripName, date }) => {
      const label = state ? `${city}, ${state}` : city
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: label,
        zIndex: 2,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg('#f59e0b'))}`,
          scaledSize: new google.maps.Size(14, 19),
          anchor:     new google.maps.Point(7, 19),
        },
      })
      marker.addListener('click', () => {
        onMarkerClick({ lat, lng, label: `📍 ${label}`, tripName, date })
      })
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, show, cities.map((c) => c.key).join('|'), onMarkerClick])

  return null
}

// ── DiningPinsLayer: one pin per dining entry ─────────────────────────────────

function DiningPinsLayer({
  pins,
  show,
  onMarkerClick,
}: {
  pins: DiningPin[]
  show: boolean
  onMarkerClick: (info: InfoState) => void
}) {
  const map = useMap()
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!map) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (!show) return

    const pinSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="19" viewBox="0 0 28 38">
        <circle cx="14" cy="13" r="11" fill="#ef4444" stroke="white" stroke-width="2.5"/>
        <text x="14" y="17" text-anchor="middle" font-size="11" fill="white">🍽</text>
        <polygon points="14,36 8,22 20,22" fill="#ef4444"/>
      </svg>
    `
    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg)}`

    pins.forEach(({ name, booking_time, lat, lng, tripName, date, location }) => {
      const label = booking_time ? `${name} · ${booking_time.slice(0, 5)}` : name
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: label,
        zIndex: 3,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(14, 19),
          anchor:     new google.maps.Point(7, 19),
        },
      })
      marker.addListener('click', () => {
        onMarkerClick({ lat, lng, label: `🍽️ ${name}`, tripName, date, location })
      })
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, show, pins.map((p) => p.id).join('|'), onMarkerClick])

  return null
}

// ── ActivityPinsLayer: one pin per activity ───────────────────────────────────

function ActivityPinsLayer({
  pins,
  show,
  onMarkerClick,
}: {
  pins: ActivityPin[]
  show: boolean
  onMarkerClick: (info: InfoState) => void
}) {
  const map = useMap()
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!map) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (!show) return

    const pinSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="19" viewBox="0 0 28 38">
        <circle cx="14" cy="13" r="11" fill="#a855f7" stroke="white" stroke-width="2.5"/>
        <text x="14" y="17" text-anchor="middle" font-size="11" fill="white">⭐</text>
        <polygon points="14,36 8,22 20,22" fill="#a855f7"/>
      </svg>
    `
    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg)}`

    pins.forEach(({ name, activity_time, lat, lng, tripName, date, location }) => {
      const label = activity_time ? `${name} · ${activity_time.slice(0, 5)}` : name
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: label,
        zIndex: 3,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(14, 19),
          anchor:     new google.maps.Point(7, 19),
        },
      })
      marker.addListener('click', () => {
        onMarkerClick({ lat, lng, label: `⭐ ${name}`, tripName, date, location })
      })
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, show, pins.map((p) => p.id).join('|'), onMarkerClick])

  return null
}

// ── StateListPanel: floating panel listing visited/unvisited states ───────────

function StateListPanel({
  title,
  emoji,
  states,
  accentColor,
  onClose,
}: {
  title: string
  emoji: string
  states: string[]
  accentColor: string
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        right: 12,
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid rgba(51,65,85,0.7)',
        borderRadius: 12,
        color: 'white',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        zIndex: 11,
        width: 220,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
        >
          ✕
        </button>
      </div>
      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
        {states.length === 0
          ? <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '16px 0' }}>Ingen stater</p>
          : states.map((s) => (
              <div key={s} style={{
                fontSize: 12, color: '#e2e8f0',
                padding: '4px 14px',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span style={{ color: accentColor, fontSize: 10 }}>●</span>
                {s}
              </div>
            ))
        }
      </div>
      {/* Footer */}
      <div style={{
        padding: '6px 14px 10px',
        borderTop: '1px solid rgba(51,65,85,0.4)',
        flexShrink: 0,
        fontSize: 10,
        color: '#475569',
        textAlign: 'center',
      }}>
        {states.length} stater
      </div>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Checkbox({ checked, color }: { checked: boolean; color: string }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
      border: `2px solid ${color}`,
      background: checked ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

function Legend({
  trips,
  distances,
  hidden,
  onToggle,
  onToggleAll,
  showStates,
  onToggleStates,
  onClickVisitedList,
  visitedStateCount,
  showUnvisited,
  onToggleUnvisited,
  onClickUnvisitedList,
  unvisitedStateCount,
  showCityPins,
  onToggleCityPins,
  cityPinCount,
  showDiningPins,
  onToggleDiningPins,
  diningPinCount,
  showActivityPins,
  onToggleActivityPins,
  activityPinCount,
}: {
  trips: TripWithStops[]
  distances: Record<string, number>
  hidden: Set<string>
  onToggle: (tripId: string) => void
  onToggleAll: () => void
  showStates: boolean
  onToggleStates: () => void
  onClickVisitedList: () => void
  visitedStateCount: number
  showUnvisited: boolean
  onToggleUnvisited: () => void
  onClickUnvisitedList: () => void
  unvisitedStateCount: number
  showCityPins: boolean
  onToggleCityPins: () => void
  cityPinCount: number
  showDiningPins: boolean
  onToggleDiningPins: () => void
  diningPinCount: number
  showActivityPins: boolean
  onToggleActivityPins: () => void
  activityPinCount: number
}) {
  const [open, setOpen] = useState(true)
  const allVisible = hidden.size === 0

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: 12,
        background: 'rgba(15,23,42,0.93)',
        border: '1px solid rgba(51,65,85,0.7)',
        borderRadius: 12,
        padding: open ? '12px 16px' : '10px 14px',
        color: 'white',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        zIndex: 10,
        minWidth: open ? 420 : 'auto',
        maxWidth: 520,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: 0, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span>🗺️ Reiser</span>
        <span style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {/* ── Select all / Deselect all ── */}
          <div
            onClick={onToggleAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              paddingBottom: 8, borderBottom: '1px solid rgba(51,65,85,0.5)',
              cursor: 'pointer',
            }}
          >
            <Checkbox checked={allVisible} color="#94a3b8" />
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>
              {allVisible ? 'Fjern alle' : 'Velg alle'}
            </span>
          </div>

          {/* ── Trip rows ── */}
          {trips.map((t) => {
            const isVisible = !hidden.has(t.id)
            return (
              <div
                key={t.id}
                onClick={() => onToggle(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7,
                  cursor: 'pointer', opacity: isVisible ? 1 : 0.4,
                  transition: 'opacity 0.15s',
                }}
              >
                <Checkbox checked={isVisible} color={t.color} />
                <div style={{ width: 22, height: 4, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#e2e8f0', flex: 1, minWidth: 0, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.name}
                </span>
                {(() => {
                  const km     = distances[t.id]
                  const nights = t.stops.reduce((s, st) => s + (st.nights ?? 0), 0)
                  const avgKm  = km != null && nights > 0 ? Math.round(km / nights) : null
                  return (
                    <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {t.stops.length} stopp
                      {nights > 0 && ` · ${nights} netter`}
                      {km    != null && ` · ${km.toLocaleString('nb-NO')} km`}
                      {avgKm != null && ` · ⌀ ${avgKm} km/dag`}
                    </span>
                  )
                })()}
              </div>
            )
          })}

          {/* ── State toggles ── */}
          <div style={{ borderTop: '1px solid rgba(51,65,85,0.6)', marginTop: 4, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* Besøkte stater */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={(e) => { e.stopPropagation(); onToggleStates() }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Checkbox checked={showStates} color="#3b82f6" />
              </div>
              <div style={{
                width: 22, height: 14, borderRadius: 3, flexShrink: 0,
                background: 'rgba(59,130,246,0.3)',
                border: '1.5px solid rgba(96,165,250,0.6)',
              }} />
              <span
                onClick={onClickVisitedList}
                style={{ fontSize: 12, color: '#e2e8f0', flex: 1, cursor: 'pointer' }}
                title="Vis liste over besøkte stater"
              >
                Besøkte stater
              </span>
              <span
                onClick={onClickVisitedList}
                style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, cursor: 'pointer' }}
              >
                {visitedStateCount} stater →
              </span>
            </div>

            {/* Ikke besøkte stater */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={(e) => { e.stopPropagation(); onToggleUnvisited() }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Checkbox checked={showUnvisited} color="#ef4444" />
              </div>
              <div style={{
                width: 22, height: 14, borderRadius: 3, flexShrink: 0,
                background: 'rgba(239,68,68,0.2)',
                border: '1.5px solid rgba(248,113,113,0.5)',
              }} />
              <span
                onClick={onClickUnvisitedList}
                style={{ fontSize: 12, color: '#e2e8f0', flex: 1, cursor: 'pointer' }}
                title="Vis liste over ikke-besøkte stater"
              >
                Ikke besøkte stater
              </span>
              <span
                onClick={onClickUnvisitedList}
                style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, cursor: 'pointer' }}
              >
                {unvisitedStateCount} stater →
              </span>
            </div>

            {/* Besøkte steder (pins) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={(e) => { e.stopPropagation(); onToggleCityPins() }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Checkbox checked={showCityPins} color="#f59e0b" />
              </div>
              <div style={{
                width: 22, height: 14, borderRadius: 3, flexShrink: 0,
                background: 'rgba(245,158,11,0.18)',
                border: '1.5px solid rgba(251,191,36,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                📍
              </div>
              <span
                onClick={onToggleCityPins}
                style={{ fontSize: 12, color: '#e2e8f0', flex: 1, cursor: 'pointer' }}
                title="Vis én pin per besøkte by"
              >
                Besøkte steder
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                {cityPinCount} steder
              </span>
            </div>

            {/* Spisesteder (dining pins) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={(e) => { e.stopPropagation(); onToggleDiningPins() }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Checkbox checked={showDiningPins} color="#ef4444" />
              </div>
              <div style={{
                width: 22, height: 14, borderRadius: 3, flexShrink: 0,
                background: 'rgba(239,68,68,0.15)',
                border: '1.5px solid rgba(248,113,113,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                🍽️
              </div>
              <span
                onClick={onToggleDiningPins}
                style={{ fontSize: 12, color: '#e2e8f0', flex: 1, cursor: 'pointer' }}
                title="Vis én pin per spisested"
              >
                Spisesteder
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                {diningPinCount} steder
              </span>
            </div>

            {/* Aktiviteter (activity pins) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={(e) => { e.stopPropagation(); onToggleActivityPins() }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Checkbox checked={showActivityPins} color="#a855f7" />
              </div>
              <div style={{
                width: 22, height: 14, borderRadius: 3, flexShrink: 0,
                background: 'rgba(168,85,247,0.15)',
                border: '1.5px solid rgba(192,132,252,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                ⭐
              </div>
              <span
                onClick={onToggleActivityPins}
                style={{ fontSize: 12, color: '#e2e8f0', flex: 1, cursor: 'pointer' }}
                title="Vis én pin per aktivitet"
              >
                Aktiviteter
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                {activityPinCount} steder
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// ── Point-in-polygon state detection (replaces reverse geocoding) ─────────────

type GeoFeature = {
  properties: { name: string }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

/** Ray-casting algorithm: is (lng, lat) inside a ring of [lng, lat] pairs? */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Which US state (full name) contains the point (lng, lat)? */
function stateForPoint(lng: number, lat: number, features: GeoFeature[]): string | null {
  for (const f of features) {
    const { type, coordinates } = f.geometry
    let hit = false
    if (type === 'Polygon') {
      hit = pointInRing(lng, lat, (coordinates as number[][][])[0])
    } else if (type === 'MultiPolygon') {
      hit = (coordinates as number[][][][]).some((poly) => pointInRing(lng, lat, poly[0]))
    }
    if (hit) return f.properties.name
  }
  return null
}

// Cached GeoJSON features (loaded once, reused on realtime re-loads)
let cachedGeoFeatures: GeoFeature[] | null = null

/** Detect US states for a batch of entries using GeoJSON polygon boundaries.
 *  Falls back to null city (city detection not needed for state map highlights). */
async function detectStatesFromGeoJSON(
  entries: { id: string; lat: number; lng: number }[]
): Promise<Record<string, { state: string | null; city: string | null }>> {
  if (!entries.length) return {}

  // Load GeoJSON once and cache it
  if (!cachedGeoFeatures) {
    try {
      const res = await fetch(US_STATES_GEOJSON_URL)
      const geo = await res.json()
      cachedGeoFeatures = (geo.features ?? []) as GeoFeature[]
    } catch {
      cachedGeoFeatures = []
    }
  }

  const features = cachedGeoFeatures
  const m: Record<string, { state: string | null; city: string | null }> = {}
  for (const { id, lat, lng } of entries) {
    // stateForPoint returns full name e.g. "Nebraska" — isUSState + expandStateName both handle this
    m[id] = { state: stateForPoint(lng, lat, features), city: null }
  }
  return m
}

// ── Map content (inside APIProvider + Map) ────────────────────────────────────

type StateListOpen = 'visited' | 'unvisited' | null

function MapContent({
  trips,
  activities,
  dining,
  entryStateMap,
}: {
  trips: TripWithStops[]
  activities: ActivityData[]
  dining: DiningData[]
  entryStateMap: Record<string, { state: string | null; city: string | null }>
}) {
  const [activeInfo, setActiveInfo]     = useState<InfoState | null>(null)
  const [distances, setDistances]       = useState<Record<string, number>>({})
  const [hidden, setHidden]             = useState<Set<string>>(new Set())
  const [showStates, setShowStates]       = useState(true)
  const [showUnvisited, setShowUnvisited] = useState(false)
  const [showCityPins, setShowCityPins]       = useState(false)
  const [showDiningPins, setShowDiningPins]   = useState(false)
  const [showActivityPins, setShowActivityPins] = useState(false)
  const [stateListOpen, setStateListOpen] = useState<StateListOpen>(null)

  // Helper: build stopById, stopToTripId, and tripById maps
  const { stopById, stopToTripId, tripById } = useMemo(() => {
    const stopById     = new Map<string, StopData>()
    const stopToTripId = new Map<string, string>()
    const tripById     = new Map<string, TripWithStops>()
    trips.forEach((trip) => {
      tripById.set(trip.id, trip)
      trip.stops.forEach((stop) => {
        stopById.set(stop.id, stop)
        stopToTripId.set(stop.id, trip.id)
      })
    })
    return { stopById, stopToTripId, tripById }
  }, [trips])

  // Compute visited states for a given set of tripIds
  const computeVisited = useCallback((allowedTripIds: Set<string> | null): Set<string> => {
    const set = new Set<string>()
    trips.forEach((trip) => {
      if (allowedTripIds && !allowedTripIds.has(trip.id)) return
      trip.stops.forEach((stop) => {
        if (stop.state?.trim() && isUSState(stop.state)) set.add(expandStateName(stop.state))
      })
    })
    const addEntry = (entryId: string, stopId: string) => {
      const tripId = stopToTripId.get(stopId)
      if (allowedTripIds && (!tripId || !allowedTripIds.has(tripId))) return
      const geoState = entryStateMap[entryId]?.state
      if (geoState && isUSState(geoState)) { set.add(expandStateName(geoState)); return }
      const parentStop = stopById.get(stopId)
      if (parentStop?.state?.trim() && isUSState(parentStop.state)) set.add(expandStateName(parentStop.state))
    }
    activities.forEach((a) => addEntry(a.id, a.stop_id))
    dining.forEach((d) => addEntry(d.id, d.stop_id))
    return set
  }, [trips, activities, dining, entryStateMap, stopById, stopToTripId])

  // Visited for currently VISIBLE trips (drives blue highlights + list #3)
  const visibleTripIds = useMemo(
    () => new Set(trips.filter((t) => !hidden.has(t.id)).map((t) => t.id)),
    [trips, hidden]
  )
  const visitedStates = useMemo(
    () => computeVisited(visibleTripIds),
    [computeVisited, visibleTripIds]
  )

  // Visited across ALL trips (drives red "never visited" highlights + list #4)
  const allVisitedStates = useMemo(
    () => computeVisited(null),
    [computeVisited]
  )

  const unvisitedStates = useMemo(
    () => ALL_US_STATE_NAMES.filter((s) => !allVisitedStates.has(s)),
    [allVisitedStates]
  )

  // One pin per unique city (same logic as "Steder i USA" in VacationStats)
  const usaCities = useMemo<CityPin[]>(() => {
    const seen = new Map<string, CityPin>()
    trips.forEach((trip) => {
      trip.stops.forEach((stop) => {
        if (!stop.city?.trim() || !stop.state?.trim() || !isUSState(stop.state)) return
        const key = `${stop.city.trim().toLowerCase()}__${stop.state.trim().toLowerCase()}`
        if (!seen.has(key)) {
          seen.set(key, {
            key,
            city:     stop.city.trim(),
            state:    expandStateName(stop.state.trim()),
            lat:      stop.lat,
            lng:      stop.lng,
            tripName: trip.name,
            date:     stop.arrival_date,
          })
        }
      })
    })
    // Also include activities/dining that have their own coordinates and were
    // reverse-geocoded to a US city (e.g. Baxter Springs, KS)
    const addEntryCity = (entryId: string, lat: number | null, lng: number | null) => {
      if (lat == null || lng == null) return
      const geo = entryStateMap[entryId]
      if (!geo?.state || !isUSState(geo.state) || !geo.city?.trim()) return
      const key = `${geo.city.trim().toLowerCase()}__${geo.state.trim().toLowerCase()}`
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          city:     geo.city.trim(),
          state:    expandStateName(geo.state.trim()),
          lat,
          lng,
          tripName: '',
          date:     null,
        })
      }
    }
    activities.forEach((a) => addEntryCity(a.id, a.map_lat, a.map_lng))
    dining.forEach((d) => addEntryCity(d.id, d.map_lat, d.map_lng))
    return Array.from(seen.values())
  }, [trips, activities, dining, entryStateMap])

  // One pin per activity (own coordinates if set, otherwise parent stop's coordinates)
  const activityPins = useMemo<ActivityPin[]>(() => {
    const pins: ActivityPin[] = []
    activities.forEach((a) => {
      const stop = stopById.get(a.stop_id)
      if (!stop || !isUSState(stop.state ?? '')) return
      const trip = tripById.get(stop.trip_id)
      const lat = a.map_lat ?? stop.lat
      const lng = a.map_lng ?? stop.lng
      const location = [stop.city, stop.state ? expandStateName(stop.state) : null].filter(Boolean).join(', ')
      pins.push({
        id: a.id, name: a.name, activity_type: a.activity_type,
        activity_time: a.activity_time, lat, lng,
        tripName: trip?.name ?? '',
        date: a.activity_date ?? stop.arrival_date,
        location,
      })
    })
    return pins
  }, [activities, stopById, tripById])

  // One pin per dining entry (own coordinates if set, otherwise parent stop's coordinates)
  const diningPins = useMemo<DiningPin[]>(() => {
    const pins: DiningPin[] = []
    dining.forEach((d) => {
      const stop = stopById.get(d.stop_id)
      if (!stop || !isUSState(stop.state ?? '')) return
      const trip = tripById.get(stop.trip_id)
      const lat = d.map_lat ?? stop.lat
      const lng = d.map_lng ?? stop.lng
      const location = [stop.city, stop.state ? expandStateName(stop.state) : null].filter(Boolean).join(', ')
      pins.push({
        id: d.id, name: d.name, booking_time: d.booking_time, lat, lng,
        tripName: trip?.name ?? '',
        date: d.booking_date ?? stop.arrival_date,
        location,
      })
    })
    return pins
  }, [dining, stopById, tripById])

  const handleDistance = useCallback((tripId: string, km: number) => {
    setDistances((prev) => ({ ...prev, [tripId]: km }))
  }, [])

  const toggleTrip = useCallback((tripId: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(tripId)) next.delete(tripId)
      else next.add(tripId)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setHidden((prev) => prev.size === 0 ? new Set(trips.map((t) => t.id)) : new Set())
  }, [trips])

  return (
    <>
      <StateHighlight
        visitedStates={visitedStates}
        allVisitedStates={allVisitedStates}
        showVisited={showStates}
        showUnvisited={showUnvisited}
      />
      <CityPinsLayer
        cities={usaCities}
        show={showCityPins}
        onMarkerClick={setActiveInfo}
      />
      <DiningPinsLayer
        pins={diningPins}
        show={showDiningPins}
        onMarkerClick={setActiveInfo}
      />
      <ActivityPinsLayer
        pins={activityPins}
        show={showActivityPins}
        onMarkerClick={setActiveInfo}
      />
      {trips.map((trip, index) => (
        <TripRoute
          key={trip.id}
          trip={trip}
          visible={!hidden.has(trip.id)}
          offsetIndex={index}
          totalTrips={trips.length}
          onMarkerClick={setActiveInfo}
          onDistanceReady={handleDistance}
        />
      ))}
      {trips.length > 0 && (
        <Legend
          trips={trips}
          distances={distances}
          hidden={hidden}
          onToggle={toggleTrip}
          onToggleAll={toggleAll}
          showStates={showStates}
          onToggleStates={() => setShowStates((v) => !v)}
          onClickVisitedList={() => setStateListOpen((v) => v === 'visited' ? null : 'visited')}
          visitedStateCount={visitedStates.size}
          showUnvisited={showUnvisited}
          onToggleUnvisited={() => setShowUnvisited((v) => !v)}
          onClickUnvisitedList={() => setStateListOpen((v) => v === 'unvisited' ? null : 'unvisited')}
          unvisitedStateCount={unvisitedStates.length}
          showCityPins={showCityPins}
          onToggleCityPins={() => setShowCityPins((v) => !v)}
          cityPinCount={usaCities.length}
          showDiningPins={showDiningPins}
          onToggleDiningPins={() => setShowDiningPins((v) => !v)}
          diningPinCount={diningPins.length}
          showActivityPins={showActivityPins}
          onToggleActivityPins={() => setShowActivityPins((v) => !v)}
          activityPinCount={activityPins.length}
        />
      )}
      {stateListOpen === 'visited' && (
        <StateListPanel
          title="Besøkte stater"
          emoji="🇺🇸"
          states={Array.from(visitedStates).sort()}
          accentColor="#60a5fa"
          onClose={() => setStateListOpen(null)}
        />
      )}
      {stateListOpen === 'unvisited' && (
        <StateListPanel
          title="Ikke besøkte stater"
          emoji="📍"
          states={unvisitedStates}
          accentColor="#f87171"
          onClose={() => setStateListOpen(null)}
        />
      )}
      {activeInfo && (
        <InfoPopup info={activeInfo} onClose={() => setActiveInfo(null)} />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsaMapPage() {
  const [trips, setTrips]         = useState<TripWithStops[]>([])
  const [activities, setActivities] = useState<ActivityData[]>([])
  const [dining, setDining]       = useState<DiningData[]>([])
  const [entryStateMap, setEntryStateMap] = useState<Record<string, { state: string | null; city: string | null }>>({})
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Fetch all non-archived trips
      const { data: allTrips, error: tripsErr } = await supabase
        .from('trips')
        .select('id, name')
        .neq('status', 'archived')
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (tripsErr) { setError('Kunne ikke laste reiser'); setLoading(false); return }
      if (!allTrips?.length) { setTrips([]); setLoading(false); return }

      // Fetch ALL stops across all trips
      const { data: stops, error: stopsErr } = await supabase
        .from('stops')
        .select('id, trip_id, city, state, lat, lng, order, nights, arrival_date')
        .in('trip_id', allTrips.map((t) => t.id))
        .order('order', { ascending: true })

      if (cancelled) return
      if (stopsErr) { setError('Kunne ikke laste stoppesteder'); setLoading(false); return }

      // Group stops by trip
      const stopsByTrip = new Map<string, StopData[]>()
      for (const s of stops ?? []) {
        const list = stopsByTrip.get(s.trip_id) ?? []
        list.push(s as StopData)
        stopsByTrip.set(s.trip_id, list)
      }

      // Fetch custom route waypoints (dragged routes) for all trips
      const tripIds = allTrips.map((t) => t.id)
      const { data: routeLegsRaw } = await supabase
        .from('route_legs')
        .select('trip_id, from_stop_id, to_stop_id, waypoints')
        .in('trip_id', tripIds)

      if (cancelled) return

      // Fetch activities and dining (for visited-state computation)
      const [{ data: activitiesRaw }, { data: diningRaw }] = await Promise.all([
        supabase.from('activities').select('id, stop_id, name, activity_type, activity_time, activity_date, map_lat, map_lng').in('stop_id',
          (stops ?? []).map((s) => s.id)
        ),
        supabase.from('dining').select('id, stop_id, name, booking_time, booking_date, map_lat, map_lng').in('stop_id',
          (stops ?? []).map((s) => s.id)
        ),
      ])

      if (cancelled) return

      // Detect which US state each pinned activity/dining entry is in (point-in-polygon with GeoJSON)
      const toDetect: { id: string; lat: number; lng: number }[] = []
      for (const a of activitiesRaw ?? []) {
        if (a.map_lat != null && a.map_lng != null) toDetect.push({ id: a.id, lat: a.map_lat, lng: a.map_lng })
      }
      for (const d of diningRaw ?? []) {
        if (d.map_lat != null && d.map_lng != null) toDetect.push({ id: d.id, lat: d.map_lat, lng: d.map_lng })
      }
      const geocoded = await detectStatesFromGeoJSON(toDetect)

      if (cancelled) return

      setActivities((activitiesRaw ?? []) as ActivityData[])
      setDining((diningRaw ?? []) as DiningData[])
      setEntryStateMap(geocoded)

      // Group route legs by trip
      const routeLegsByTrip = new Map<string, RouteLegData[]>()
      for (const leg of routeLegsRaw ?? []) {
        const list = routeLegsByTrip.get(leg.trip_id) ?? []
        list.push(leg as RouteLegData)
        routeLegsByTrip.set(leg.trip_id, list)
      }

      // Keep only trips where the majority of stops fall within US bounding box
      // Continental US + Alaska + Hawaii: lat 18–72, lng –180 to –65
      function isInUSA(lat: number, lng: number): boolean {
        return lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65
      }

      // Preserve color assignment so trips keep the same color after re-load
      const result: TripWithStops[] = []
      let colorIdx = 0

      for (const trip of allTrips) {
        const tripStops = stopsByTrip.get(trip.id) ?? []
        if (tripStops.length === 0) continue
        const usaStops = tripStops.filter((s) => isInUSA(s.lat, s.lng))
        // Include if more than half the stops are in the USA
        if (usaStops.length === 0 || usaStops.length < tripStops.length / 2) continue
        result.push({
          id:        trip.id,
          name:      trip.name,
          stops:     tripStops,
          routeLegs: routeLegsByTrip.get(trip.id) ?? [],
          color:     ROUTE_COLORS[colorIdx % ROUTE_COLORS.length],
        })
        colorIdx++
      }

      setError(result.length === 0 ? 'Ingen reiser med stoppesteder i USA funnet.' : null)
      setTrips(result)
      setLoading(false)
    }

    load()

    // Re-load automatically when stops or trips change in the database
    const channel = supabase
      .channel('usa-map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => {
        if (!cancelled) load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        if (!cancelled) load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_legs' }, () => {
        if (!cancelled) load()
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0f172a' }}>
      {/* Header strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          background: 'rgba(15,23,42,0.88)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(51,65,85,0.5)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          zIndex: 15,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>🇺🇸</span>
        <span
          style={{
            color: '#e2e8f0',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          USA Roadtrip-kart
        </span>
        {!loading && trips.length > 0 && (
          <span
            style={{
              color: '#475569',
              fontSize: 11,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            · {trips.length} reise{trips.length !== 1 ? 'r' : ''},{' '}
            {trips.reduce((s, t) => s + t.stops.length, 0)} stopp totalt
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 15,
            fontFamily: 'system-ui, sans-serif',
            zIndex: 10,
          }}
        >
          Laster kart…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            color: '#94a3b8',
            fontSize: 14,
            fontFamily: 'system-ui, sans-serif',
            zIndex: 10,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 32 }}>🗺️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Map */}
      {!loading && (
        <div style={{ position: 'absolute', inset: 0, paddingTop: 44 }}>
          <APIProvider apiKey={apiKey}>
            <GoogleMap
              defaultCenter={USA_CENTER}
              defaultZoom={4}
              style={{ width: '100%', height: '100%' }}
              gestureHandling="greedy"
              zoomControl
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl
              rotateControl={false}
            >
              <MapContent trips={trips} activities={activities} dining={dining} entryStateMap={entryStateMap} />
            </GoogleMap>
          </APIProvider>
        </div>
      )}
    </div>
  )
}
