'use client'

// ─── Single-leg route renderer with draggable via-point pins ─────────────────
// Each instance manages one DirectionsRenderer (non-draggable) + a clickable
// transparent overlay so the user can click the route to insert via-points,
// plus a custom draggable Marker for each saved via-point.
//
// Interactions:
//   Click route      → insert new via-point at clicked position
//   Drag pin         → reposition via-point; route re-requests on drop
//   Right-click pin  → remove via-point
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { toast } from 'sonner'
import { Stop } from '@/types'

export interface LegWaypoint { lat: number; lng: number }

interface RouteLegPolylineProps {
  fromStop: Stop
  toStop: Stop
  /** Saved via-points for this leg (from DB) */
  waypoints: LegWaypoint[]
  /** Enabled in edit mode; omit for read-only display */
  editable?: boolean
  /** Called whenever the waypoints array changes (add / move / remove) */
  onChange?: (waypoints: LegWaypoint[]) => void
  /** Called with the list of state/country codes along this leg's route */
  onStatesResolved?: (codes: string[]) => void
  useCountry?: boolean
  onStopCountryResolved?: (stopId: string, country: string) => void
  /** Called when Directions API fails for this leg */
  onRouteError?: (fromStopId: string, toStopId: string) => void
}

// ─── SVG icon for via-point markers ─────────────────────────────────────────

function viaPointIconUrl(hovered = false): string {
  const fill   = hovered ? '#1d4ed8' : '#2563eb'
  const border = hovered ? '#93c5fd' : 'white'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="10" fill="${fill}" stroke="${border}" stroke-width="2.5"/>` +
    `<circle cx="12" cy="12" r="4"  fill="white"/>` +
    `</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// ─── Geometry helper: squared distance from point to segment (in lng/lat) ───

function sqDistToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax; const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}

/**
 * Given a clicked point and the ordered list of anchor points for this leg
 * (fromStop, ...waypoints, toStop), return the 0-based index in the waypoints
 * array where the new point should be inserted.
 */
function insertionIndex(
  pt: google.maps.LatLng,
  anchors: LegWaypoint[],
): number {
  const px = pt.lng(); const py = pt.lat()
  let minDist = Infinity; let bestI = 0
  for (let i = 0; i < anchors.length - 1; i++) {
    const d = sqDistToSegment(px, py, anchors[i].lng, anchors[i].lat, anchors[i + 1].lng, anchors[i + 1].lat)
    if (d < minDist) { minDist = d; bestI = i }
  }
  // bestI is the segment index: insert after anchor[bestI], before anchor[bestI+1]
  // anchors[0] = fromStop, so anchors[1..n-1] = waypoints → insert at waypoints position bestI
  return bestI
}

// ─── Geocoding helpers ───────────────────────────────────────────────────────

async function resolveStates(
  result: google.maps.DirectionsResult,
  cb: (codes: string[]) => void,
) {
  const path = result.routes[0]?.overview_path
  if (!path?.length) return
  const step     = Math.max(1, Math.floor(path.length / Math.min(10, path.length)))
  const sampled  = path.filter((_, i) => i % step === 0)
  const geocoder = new google.maps.Geocoder()
  const codes    = await Promise.all(
    sampled.map((pt) =>
      geocoder
        .geocode({ location: pt })
        .then(({ results }) =>
          results[0]?.address_components.find((c) =>
            c.types.includes('administrative_area_level_1')
          )?.short_name ?? null
        )
        .catch(() => null)
    )
  )
  cb([...new Set(codes.filter((c): c is string => !!c))])
}

async function resolveCountries(
  stops: Stop[],
  cb: (codes: string[]) => void,
  perStopCb?: (stopId: string, country: string) => void,
) {
  const geocoder = new google.maps.Geocoder()
  const results  = await Promise.all(
    stops.map((s) =>
      geocoder
        .geocode({ location: { lat: s.lat, lng: s.lng } })
        .then(({ results }) => ({
          stopId:  s.id,
          country: results[0]?.address_components.find((c) => c.types.includes('country'))?.long_name ?? null,
        }))
        .catch(() => ({ stopId: s.id, country: null }))
    )
  )
  results.forEach(({ stopId, country }) => { if (country && perStopCb) perStopCb(stopId, country) })
  cb([...new Set(results.map((r) => r.country).filter((c): c is string => !!c))])
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RouteLegPolyline({
  fromStop,
  toStop,
  waypoints,
  editable = false,
  onChange,
  onStatesResolved,
  useCountry = false,
  onStopCountryResolved,
  onRouteError,
}: RouteLegPolylineProps) {
  const map       = useMap()
  const routesLib = useMapsLibrary('routes')

  const rendererRef  = useRef<google.maps.DirectionsRenderer | null>(null)
  const overlayRef   = useRef<google.maps.Polyline | null>(null)
  const failLineRef  = useRef<google.maps.Polyline | null>(null)
  const markersRef   = useRef<google.maps.Marker[]>([])

  // Stable refs for callbacks — avoids stale closures in event handlers
  const onChangeRef          = useRef(onChange)
  const onStatesRef          = useRef(onStatesResolved)
  const onStopCountryRef     = useRef(onStopCountryResolved)
  onChangeRef.current        = onChange
  onStatesRef.current        = onStatesResolved
  onStopCountryRef.current   = onStopCountryResolved

  // Keep latest waypoints accessible from event handlers without being in deps
  const waypointsRef = useRef(waypoints)
  waypointsRef.current = waypoints

  useEffect(() => {
    if (!map || !routesLib) return

    // ── Tear down previous instances ──────────────────────────────────────
    rendererRef.current?.setMap(null)
    overlayRef.current?.setMap(null)
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    // ── DirectionsRenderer (display only, not draggable) ─────────────────
    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      draggable:       false,
      polylineOptions: {
        strokeColor:   '#2563eb',
        strokeWeight:  4,
        strokeOpacity: 0.85,
        zIndex:        2,
      },
    })
    rendererRef.current = renderer

    // ── Via-point markers ─────────────────────────────────────────────────
    if (editable) {
      const normalIcon  = { url: viaPointIconUrl(false), scaledSize: new google.maps.Size(24, 24), anchor: new google.maps.Point(12, 12) }
      const hoverIcon   = { url: viaPointIconUrl(true),  scaledSize: new google.maps.Size(24, 24), anchor: new google.maps.Point(12, 12) }

      waypoints.forEach((wp, i) => {
        const marker = new google.maps.Marker({
          map,
          position: { lat: wp.lat, lng: wp.lng },
          draggable: true,
          cursor:    'grab',
          icon:      normalIcon,
          zIndex:    10,
          title:     'Dra for å flytte  •  Høyreklikk for å fjerne',
        })

        marker.addListener('mouseover', () => marker.setIcon(hoverIcon))
        marker.addListener('mouseout',  () => marker.setIcon(normalIcon))
        marker.addListener('mousedown', () => marker.setCursor('grabbing'))
        marker.addListener('mouseup',   () => marker.setCursor('grab'))

        marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return
          const next = [...waypointsRef.current]
          next[i] = { lat: e.latLng.lat(), lng: e.latLng.lng() }
          onChangeRef.current?.(next)
        })

        marker.addListener('rightclick', () => {
          const next = waypointsRef.current.filter((_, idx) => idx !== i)
          onChangeRef.current?.(next)
        })

        markersRef.current.push(marker)
      })
    }

    // ── Directions API request ────────────────────────────────────────────
    const service = new routesLib.DirectionsService()
    service.route(
      {
        origin:            { lat: fromStop.lat, lng: fromStop.lng },
        destination:       { lat: toStop.lat,   lng: toStop.lng   },
        waypoints:         waypoints.map((wp) => ({
          location: new google.maps.LatLng(wp.lat, wp.lng),
          stopover: false,
        })),
        travelMode:        google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status !== 'OK' || !result) {
          console.warn('[RouteLegPolyline] Directions failed:', status, `${fromStop.city} → ${toStop.city}`)

          // Draw a red dashed straight line so the missing segment is visible on the map
          failLineRef.current?.setMap(null)
          failLineRef.current = new google.maps.Polyline({
            map,
            path: [
              { lat: fromStop.lat, lng: fromStop.lng },
              { lat: toStop.lat,   lng: toStop.lng   },
            ],
            strokeColor:   '#ef4444',
            strokeWeight:  2,
            strokeOpacity: 0,
            icons: [{
              icon: {
                path:           'M 0,-1 0,1',
                strokeOpacity:  0.8,
                strokeColor:    '#ef4444',
                strokeWeight:   2,
                scale:          3,
              },
              offset: '0',
              repeat: '12px',
            }],
            zIndex: 1,
          })

          // Notify parent and show a toast so the user knows which leg failed
          onRouteError?.(fromStop.id, toStop.id)
          toast.error(
            `Ruten mellom ${fromStop.city} og ${toStop.city} kunne ikke beregnes.`,
            {
              description: 'Koordinatene kan være unøyaktige. Klikk på stoppestedet i sidepanelet for å endre stedet.',
              duration: 8000,
              id: `route-err-${fromStop.id}-${toStop.id}`,
            }
          )
          return
        }

        renderer.setDirections(result)

        // ── Geocode states / countries ──────────────────────────────────
        const statesCb = onStatesRef.current
        if (statesCb) {
          if (useCountry) resolveCountries([fromStop, toStop], statesCb, onStopCountryRef.current)
          else            resolveStates(result, statesCb)
        }

        // ── Clickable overlay for inserting via-points ──────────────────
        if (editable) {
          overlayRef.current?.setMap(null)

          const path = result.routes[0]?.overview_path ?? []

          const overlay = new google.maps.Polyline({
            map,
            path,
            strokeOpacity: 0,    // invisible – only here to capture clicks
            strokeWeight:  18,   // wide hit area
            clickable:     true,
            zIndex:        3,
          })

          overlay.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return
            const cur = waypointsRef.current
            const anchors: LegWaypoint[] = [
              { lat: fromStop.lat, lng: fromStop.lng },
              ...cur,
              { lat: toStop.lat, lng: toStop.lng },
            ]
            const idx  = insertionIndex(e.latLng, anchors)
            const next = [...cur]
            next.splice(idx, 0, { lat: e.latLng.lat(), lng: e.latLng.lng() })
            onChangeRef.current?.(next)
          })

          overlayRef.current = overlay
        }
      }
    )

    return () => {
      renderer.setMap(null)
      overlayRef.current?.setMap(null)
      overlayRef.current = null
      failLineRef.current?.setMap(null)
      failLineRef.current = null
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  // waypoints er med – ny via-punkt → ny rute-request. Callbacks leses via refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, fromStop, toStop, waypoints, editable])

  return null
}
