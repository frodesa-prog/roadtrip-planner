'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RouteLeg } from '@/types'

// Module-level cache – keyed by tripId
const routeLegsCache = new Map<string, RouteLeg[]>()

export function useRouteWaypoints(tripId: string | null) {
  const cached = tripId ? (routeLegsCache.get(tripId) ?? null) : null
  const [legs, setLegs] = useState<RouteLeg[]>(cached ?? [])
  const [loaded, setLoaded] = useState(cached !== null || !tripId)
  const supabase = useMemo(() => createClient(), [])

  const setAndCache = useCallback((updater: RouteLeg[] | ((prev: RouteLeg[]) => RouteLeg[])) => {
    setLegs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (tripId) routeLegsCache.set(tripId, next)
      return next
    })
  }, [tripId])

  useEffect(() => {
    if (!tripId) {
      setLegs([])
      setLoaded(true)
      return
    }
    supabase
      .from('route_legs')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data }) => {
        const result = (data as RouteLeg[]) ?? []
        routeLegsCache.set(tripId, result)
        setLegs(result)
        setLoaded(true)
      })
  }, [tripId, supabase])

  const saveLeg = useCallback(
    async (
      fromStopId: string,
      toStopId: string,
      waypoints: Array<{ lat: number; lng: number }>
    ) => {
      if (!tripId) return

      const { data } = await supabase
        .from('route_legs')
        .upsert(
          {
            trip_id: tripId,
            from_stop_id: fromStopId,
            to_stop_id: toStopId,
            waypoints,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'from_stop_id,to_stop_id' }
        )
        .select()
        .single()

      if (data) {
        setAndCache((prev) => {
          const filtered = prev.filter(
            (l) => !(l.from_stop_id === fromStopId && l.to_stop_id === toStopId)
          )
          return [...filtered, data as RouteLeg]
        })
      }
    },
    [tripId, supabase, setAndCache]
  )

  return { legs, loaded, saveLeg }
}
