'use client'

import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Stop, RouteLeg } from '@/types'

// ─── Exported type used by PlanningMap / plan/page.tsx ───────────────────────

export interface LegWaypoints {
  fromStopId: string
  toStopId: string
  waypoints: Array<{ lat: number; lng: number }>
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoutePolylineProps {
  stops: Stop[]
  /** Via-punkter lastet fra Supabase */
  routeLegs?: RouteLeg[]
  /** true når DB-hentingen er ferdig (hindrer dobbel-rendering) */
  routeLegsLoaded?: boolean
  /** Sett for å aktivere dra-støtte; utelatt = kun visning */
  onLegsChange?: (legs: LegWaypoints[]) => void
  /** Kalles med liste over stater/land ruten passerer gjennom */
  onRouteStatesChange?: (states: string[]) => void
  /** Kalles per stoppested med geocodet land – for å oppdatere DB-feltet state */
  onStopCountryResolved?: (stopId: string, country: string) => void
  /** Bruk land (country) i stedet for delstat ved geocoding – for internasjonale turer */
  useCountry?: boolean
}

// ─── Geocode states along the route overview path (USA) ─────────────────────

async function geocodeRouteStates(
  result: google.maps.DirectionsResult,
  cb: (states: string[]) => void,
): Promise<void> {
  const path = result.routes[0]?.overview_path
  if (!path?.length) return

  // Sample opptil 15 punkter jevnt fordelt langs ruten
  const sampleCount = Math.min(15, path.length)
  const step        = Math.max(1, Math.floor(path.length / sampleCount))
  const sampled     = path.filter((_, i) => i % step === 0)

  const geocoder = new google.maps.Geocoder()

  const states = await Promise.all(
    sampled.map((point) =>
      geocoder
        .geocode({ location: point })
        .then(({ results }) => {
          const comp = results[0]?.address_components.find((c) =>
            c.types.includes('administrative_area_level_1')
          )
          return comp?.short_name ?? null
        })
        .catch(() => null)
    )
  )

  const unique = [...new Set(states.filter((s): s is string => s !== null))]
  cb(unique)
}

// ─── Geocode country at each actual stop (internasjonale turer) ──────────────

async function geocodeStopCountries(
  stops: Stop[],
  cb: (countries: string[]) => void,
  perStopCb?: (stopId: string, country: string) => void,
): Promise<void> {
  const geocoder = new google.maps.Geocoder()

  const results = await Promise.all(
    stops.map((stop) =>
      geocoder
        .geocode({ location: { lat: stop.lat, lng: stop.lng } })
        .then(({ results }) => {
          const comp = results[0]?.address_components.find((c) =>
            c.types.includes('country')
          )
          return { stopId: stop.id, country: comp?.long_name ?? null }
        })
        .catch(() => ({ stopId: stop.id, country: null }))
    )
  )

  if (perStopCb) {
    results.forEach(({ stopId, country }) => {
      if (country) perStopCb(stopId, country)
    })
  }

  const unique = [...new Set(results.map((r) => r.country).filter((s): s is string => s !== null))]
  cb(unique)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutePolyline({
  stops,
  routeLegs = [],
  routeLegsLoaded = true,
  onLegsChange,
  onRouteStatesChange,
  onStopCountryResolved,
  useCountry = false,
}: RoutePolylineProps) {
  const map        = useMap()
  const routesLib  = useMapsLibrary('routes')

  const polylineRef    = useRef<google.maps.Polyline | null>(null)
  const rendererRef    = useRef<google.maps.DirectionsRenderer | null>(null)
  const listenerRef    = useRef<google.maps.MapsEventListener | null>(null)
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs so the effects don't need these in their dependency arrays
  const routeLegsRef          = useRef(routeLegs)
  routeLegsRef.current        = routeLegs
  const onLegsChangeRef       = useRef(onLegsChange)
  onLegsChangeRef.current     = onLegsChange
  const onRouteStatesRef      = useRef(onRouteStatesChange)
  onRouteStatesRef.current    = onRouteStatesChange

  // ── 1. Enkel fallback-polyline (vises umiddelbart) ───────────────────────
  useEffect(() => {
    if (!map || stops.length < 2) {
      polylineRef.current?.setMap(null)
      return
    }

    polylineRef.current?.setMap(null)

    polylineRef.current = new google.maps.Polyline({
      path:          stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      geodesic:      true,
      strokeColor:   '#3b82f6',
      strokeOpacity: 0.6,
      strokeWeight:  3,
      map,
    })

    return () => { polylineRef.current?.setMap(null) }
  }, [map, stops])

  // ── 2. Vegbasert rute via Directions API (valgfritt draggable) ───────────
  // Kjøres når kartet/bibliotek er klart, stopp endres ELLER legs-data er lastet.
  // routeLegs leses via ref for å unngå at lagring trigger en ny request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!map || !routesLib || stops.length < 2 || !routeLegsLoaded) return

    const draggable = !!onLegsChangeRef.current

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      draggable,
      polylineOptions: {
        strokeColor:   '#2563eb',
        strokeWeight:  4,
        strokeOpacity: 0.85,
      },
    })
    rendererRef.current = renderer

    // ── Bygg waypoints-array med lagrede via-punkter ──────────────────────
    // Mønster: [via0..., stop1(stopover), via1..., stop2(stopover), via2...]
    const allWaypoints: google.maps.DirectionsWaypoint[] = []
    const savedLegs = routeLegsRef.current

    for (let i = 1; i < stops.length - 1; i++) {
      const fromId = stops[i - 1].id
      const toId   = stops[i].id
      const saved  = savedLegs.find(
        (l) => l.from_stop_id === fromId && l.to_stop_id === toId
      )
      if (saved?.waypoints?.length) {
        for (const wp of saved.waypoints) {
          allWaypoints.push({
            location: new google.maps.LatLng(wp.lat, wp.lng),
            stopover: false,
          })
        }
      }
      allWaypoints.push({
        location: new google.maps.LatLng(stops[i].lat, stops[i].lng),
        stopover: true,
      })
    }

    // Via-punkter for siste etappe (fra nest siste stopp til destinasjon)
    if (stops.length >= 2) {
      const lastFromId = stops[stops.length - 2].id
      const lastToId   = stops[stops.length - 1].id
      const lastSaved  = savedLegs.find(
        (l) => l.from_stop_id === lastFromId && l.to_stop_id === lastToId
      )
      if (lastSaved?.waypoints?.length) {
        for (const wp of lastSaved.waypoints) {
          allWaypoints.push({
            location: new google.maps.LatLng(wp.lat, wp.lng),
            stopover: false,
          })
        }
      }
    }

    // ── Kall Directions API ───────────────────────────────────────────────
    // Ignorer første directions_changed (utløst av setDirections, ikke drag)
    let ignoreNextChange = false

    const service = new routesLib.DirectionsService()
    service.route(
      {
        origin:            { lat: stops[0].lat, lng: stops[0].lng },
        destination:       { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng },
        waypoints:         allWaypoints,
        travelMode:        google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          ignoreNextChange = true   // setDirections utløser directions_changed synkront
          renderer.setDirections(result)
          // ignoreNextChange settes til false i lytteren

          polylineRef.current?.setMap(null)

          // Geocode ruten umiddelbart ved første lasting
          const cb = onRouteStatesRef.current
          if (cb) {
            if (useCountry) geocodeStopCountries(stops, cb, onStopCountryResolved)
            else geocodeRouteStates(result, cb)
          }
        } else {
          console.warn('Directions API ikke tilgjengelig. Status:', status)
        }
      }
    )

    // ── Legg til drag-lytter (kun planleggingssiden) ──────────────────────
    if (draggable) {
      listenerRef.current = renderer.addListener('directions_changed', () => {
        const res = renderer.getDirections()

        if (ignoreNextChange) {
          ignoreNextChange = false
          return
        }

        if (!res?.routes?.[0]) return

        const route = res.routes[0]

        // ── Lagre via-punkter (debounced 1,5 sek) ──
        const legsCb = onLegsChangeRef.current
        if (legsCb) {
          const newLegs: LegWaypoints[] = stops.slice(0, -1).map((fromStop, i) => {
            const toStop    = stops[i + 1]
            const leg       = route.legs[i]
            const waypoints = (leg?.via_waypoints ?? []).map((wp: google.maps.LatLng) => ({
              lat: wp.lat(),
              lng: wp.lng(),
            }))
            return { fromStopId: fromStop.id, toStopId: toStop.id, waypoints }
          })

          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => legsCb(newLegs), 1500)
        }

        // ── Geocode nye stater (debounced 800 ms) ──
        const statesCb = onRouteStatesRef.current
        if (statesCb && res) {
          if (statesTimerRef.current) clearTimeout(statesTimerRef.current)
          if (useCountry) {
            statesTimerRef.current = setTimeout(
              () => geocodeStopCountries(stops, statesCb, onStopCountryResolved),
              800
            )
          } else {
            statesTimerRef.current = setTimeout(
              () => geocodeRouteStates(res, statesCb),
              800
            )
          }
        }
      })
    }

    return () => {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current)
        listenerRef.current = null
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (statesTimerRef.current) {
        clearTimeout(statesTimerRef.current)
        statesTimerRef.current = null
      }
      renderer.setMap(null)
    }
  // routeLegsLoaded er med for å re-kjøre når DB-data er lastet første gang.
  // routeLegs og onLegsChange leses via ref – de er bevisst utelatt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, stops, routeLegsLoaded])

  return null
}
