'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RouteLeg } from '@/types'

export function useRouteWaypoints(tripId: string | null) {
  const [legs, setLegs] = useState<RouteLeg[]>([])
  const [loaded, setLoaded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) {
      setLegs([])
      setLoaded(true)
      return
    }

    setLoaded(false)
    supabase
      .from('route_legs')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data }) => {
        setLegs((data as RouteLeg[]) ?? [])
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
        setLegs((prev) => {
          const filtered = prev.filter(
            (l) => !(l.from_stop_id === fromStopId && l.to_stop_id === toStopId)
          )
          return [...filtered, data as RouteLeg]
        })
      }
    },
    [tripId, supabase]
  )

  return { legs, loaded, saveLeg }
}
