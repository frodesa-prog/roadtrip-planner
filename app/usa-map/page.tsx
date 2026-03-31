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
}

interface TripData {
  id: string
  name: string
}

interface TripWithStops extends TripData {
  stops: StopData[]
  color: string
}

interface InfoState {
  lat: number
  lng: number
  label: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const USA_CENTER = { lat: 39.8, lng: -98.5 }

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

// ── TripRoute: draws directions + markers for one trip ────────────────────────

function TripRoute({
  trip,
  visible,
  onMarkerClick,
  onDistanceReady,
}: {
  trip: TripWithStops
  visible: boolean
  onMarkerClick: (info: InfoState) => void
  onDistanceReady: (tripId: string, km: number) => void
}) {
  const map       = useMap()
  const routesLib = useMapsLibrary('routes')

  const polylineRef        = useRef<google.maps.Polyline | null>(null)
  const rendererRef        = useRef<google.maps.DirectionsRenderer | null>(null)
  const markersRef         = useRef<google.maps.Marker[]>([])
  const directionsLoadedRef = useRef(false)

  // Nullstill når stoppesteder endres så ny rute hentes og fallback-polyline vises midlertidig
  useEffect(() => {
    directionsLoadedRef.current = false
  }, [trip.stops])

  // Toggle visibility without re-fetching routes
  useEffect(() => {
    const targetMap = visible ? map ?? null : null
    // Only restore fallback polyline if real directions haven't loaded yet
    if (!directionsLoadedRef.current) {
      polylineRef.current?.setMap(targetMap)
    }
    rendererRef.current?.setMap(targetMap)
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

  // 2. Road-based route via Directions API (replaces fallback)
  useEffect(() => {
    if (!map || !routesLib || trip.stops.length < 2) return

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor:   trip.color,
        strokeWeight:  5,
        strokeOpacity: 0.88,
      },
    })
    rendererRef.current = renderer

    const allWaypoints: google.maps.DirectionsWaypoint[] = trip.stops
      .slice(1, -1)
      .map((s) => ({ location: { lat: s.lat, lng: s.lng }, stopover: true }))

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
          renderer.setDirections(result)
          directionsLoadedRef.current = true
          polylineRef.current?.setMap(null)
          // Sum distance across all legs
          const totalMeters = result.routes[0]?.legs.reduce(
            (sum, leg) => sum + (leg.distance?.value ?? 0), 0
          ) ?? 0
          onDistanceReady(trip.id, Math.round(totalMeters / 1000))
        }
      }
    )

    return () => { renderer.setMap(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, trip.stops, trip.color])

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

// ── InfoPopup: floating label on marker click ─────────────────────────────────

function InfoPopup({ info, onClose }: { info: InfoState; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.95)',
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: 500,
        padding: '8px 14px',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        zIndex: 20,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 'calc(100vw - 32px)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.label}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          fontSize: 15,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({
  trips,
  distances,
  hidden,
  onToggle,
}: {
  trips: TripWithStops[]
  distances: Record<string, number>
  hidden: Set<string>
  onToggle: (tripId: string) => void
}) {
  const [open, setOpen] = useState(true)

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
        minWidth: open ? 260 : 'auto',
        maxWidth: 340,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>🗺️ Reiser</span>
        <span style={{ fontSize: 10, color: '#475569' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
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
                {/* Checkbox */}
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${t.color}`,
                  background: isVisible ? t.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isVisible && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* Color bar */}
                <div style={{ width: 22, height: 4, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#e2e8f0', flex: 1, lineHeight: 1.3 }}>
                  {t.name}
                </span>
                <span style={{ fontSize: 10, color: '#475569', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t.stops.length} stopp
                  {distances[t.id] != null && ` · ${distances[t.id].toLocaleString('nb-NO')} km`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Map content (inside APIProvider + Map) ────────────────────────────────────

function MapContent({ trips }: { trips: TripWithStops[] }) {
  const [activeInfo, setActiveInfo] = useState<InfoState | null>(null)
  const [distances, setDistances]   = useState<Record<string, number>>({})
  const [hidden, setHidden]         = useState<Set<string>>(new Set())

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

  return (
    <>
      {trips.map((trip) => (
        <TripRoute
          key={trip.id}
          trip={trip}
          visible={!hidden.has(trip.id)}
          onMarkerClick={setActiveInfo}
          onDistanceReady={handleDistance}
        />
      ))}
      {trips.length > 0 && (
        <Legend trips={trips} distances={distances} hidden={hidden} onToggle={toggleTrip} />
      )}
      {activeInfo && (
        <InfoPopup info={activeInfo} onClose={() => setActiveInfo(null)} />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsaMapPage() {
  const [trips, setTrips]   = useState<TripWithStops[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
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
        .select('id, trip_id, city, state, lat, lng, order')
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
          id:    trip.id,
          name:  trip.name,
          stops: tripStops,
          color: ROUTE_COLORS[colorIdx % ROUTE_COLORS.length],
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
              <MapContent trips={trips} />
            </GoogleMap>
          </APIProvider>
        </div>
      )}
    </div>
  )
}
