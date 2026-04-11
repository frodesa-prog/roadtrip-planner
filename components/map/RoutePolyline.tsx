'use client'

// ─── Multi-leg route container ────────────────────────────────────────────────
// Splits a trip's stop list into adjacent pairs and renders one
// RouteLegPolyline per pair.  This keeps drag / via-point interactions
// completely isolated to a single leg — no more waypoint cross-contamination.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { Stop, RouteLeg } from '@/types'
import RouteLegPolyline, { LegWaypoint } from './RouteLegPolyline'

// ─── Exported type (used by PlanningMap / plan/page.tsx) ─────────────────────

export interface LegWaypoints {
  fromStopId: string
  toStopId:   string
  waypoints:  Array<{ lat: number; lng: number }>
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoutePolylineProps {
  stops: Stop[]
  /** Via-punkter lastet fra Supabase */
  routeLegs?: RouteLeg[]
  /** true når DB-hentingen er ferdig (hindrer dobbel-rendering) */
  routeLegsLoaded?: boolean
  /** Sett for å aktivere redigering; utelatt = kun visning */
  onLegsChange?: (legs: LegWaypoints[]) => void
  /** Kalles med liste over stater/land ruten passerer gjennom */
  onRouteStatesChange?: (states: string[]) => void
  /** Kalles per stoppested med geocodet land */
  onStopCountryResolved?: (stopId: string, country: string) => void
  /** Bruk land i stedet for delstat ved geocoding (internasjonale turer) */
  useCountry?: boolean
  /** Kalles med Set av fromStopId-er der ruten ikke kunne beregnes */
  onFailedLegs?: (failedFromIds: Set<string>) => void
  /** Turdato – brukes til å sette departureTime slik at stengte vinterveier ignoreres */
  tripDateFrom?: string | null
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
  onFailedLegs,
  tripDateFrom,
}: RoutePolylineProps) {

  // ── Build per-leg data ──────────────────────────────────────────────────────
  const legs = useMemo(() => {
    if (stops.length < 2) return []
    return stops.slice(0, -1).map((fromStop, i) => {
      const toStop = stops[i + 1]
      const saved  = routeLegs.find(
        (l) => l.from_stop_id === fromStop.id && l.to_stop_id === toStop.id
      )
      return {
        key:       `${fromStop.id}-${toStop.id}`,
        fromStop,
        toStop,
        waypoints: (saved?.waypoints ?? []) as LegWaypoint[],
      }
    })
  }, [stops, routeLegs])

  // ── Track failed legs ──────────────────────────────────────────────────────
  const [failedLegs, setFailedLegs] = useState<Set<string>>(new Set())
  const onFailedLegsRef = useRef(onFailedLegs)
  onFailedLegsRef.current = onFailedLegs

  const handleRouteError = useCallback((fromStopId: string, _toStopId: string) => {
    setFailedLegs((prev) => {
      const next = new Set(prev)
      next.add(fromStopId)
      return next
    })
  }, [])

  useEffect(() => {
    onFailedLegsRef.current?.(failedLegs)
  }, [failedLegs])

  // ── Aggregate states reported by each leg ──────────────────────────────────
  const [legStatesMap, setLegStatesMap] = useState<Map<string, string[]>>(new Map())

  const handleStatesResolved = useCallback((key: string, codes: string[]) => {
    setLegStatesMap((prev) => {
      const next = new Map(prev)
      next.set(key, codes)
      return next
    })
  }, [])

  useEffect(() => {
    if (!onRouteStatesChange) return
    const all = [...new Set([...legStatesMap.values()].flat())]
    onRouteStatesChange(all)
  }, [legStatesMap, onRouteStatesChange])

  // ── Waypoint change handler ─────────────────────────────────────────────────
  const handleChange = useCallback(
    (fromStopId: string, toStopId: string, waypoints: LegWaypoint[]) => {
      onLegsChange?.([{ fromStopId, toStopId, waypoints }])
    },
    [onLegsChange]
  )

  // ── Don't render until DB data is ready (avoids double Directions API call) ─
  if (!routeLegsLoaded || stops.length < 2) return null

  return (
    <>
      {legs.map(({ key, fromStop, toStop, waypoints }, i) => (
        <RouteLegPolyline
          key={key}
          fromStop={fromStop}
          toStop={toStop}
          waypoints={waypoints}
          editable={!!onLegsChange}
          onChange={(wps) => handleChange(fromStop.id, toStop.id, wps)}
          onStatesResolved={(codes) => handleStatesResolved(key, codes)}
          useCountry={useCountry}
          onStopCountryResolved={onStopCountryResolved}
          onRouteError={handleRouteError}
          legIndex={i}
          tripDateFrom={tripDateFrom}
        />
      ))}
    </>
  )
}
