'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Stop } from '@/types'
import { toast } from 'sonner'
import { logActivity } from '@/hooks/useActivityLog'

// Module-level cache – survives page navigation, keyed by tripId
const stopsCache = new Map<string, Stop[]>()

export function invalidateStopsCache(tripId: string) {
  stopsCache.delete(tripId)
}

export function useStops(tripId: string | null) {
  const cached = tripId ? (stopsCache.get(tripId) ?? null) : null
  const [stops, setStops] = useState<Stop[]>(cached ?? [])
  const [loading, setLoading] = useState(tripId ? cached === null : false)

  const supabase = useMemo(() => createClient(), [])

  // Setter that also keeps cache in sync
  const setAndCache = useCallback((updater: Stop[] | ((prev: Stop[]) => Stop[])) => {
    setStops((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (tripId) stopsCache.set(tripId, next)
      return next
    })
  }, [tripId])

  const loadStops = useCallback(async () => {
    if (!tripId) {
      setStops([])
      return
    }
    // Only show loading spinner on first fetch (no cache yet)
    if (!stopsCache.has(tripId)) setLoading(true)
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('trip_id', tripId)
      .order('order', { ascending: true })

    if (!error && data) {
      stopsCache.set(tripId, data as Stop[])
      setStops(data as Stop[])
    }
    setLoading(false)
  }, [tripId, supabase])

  const addStop = useCallback(
    async (stop: Stop) => {
      setAndCache((prev) => [...prev, stop])
      const { error } = await supabase.from('stops').insert({
        id: stop.id,
        trip_id: stop.trip_id,
        city: stop.city,
        state: stop.state,
        lat: stop.lat,
        lng: stop.lng,
        order: stop.order,
        arrival_date: stop.arrival_date,
        nights: stop.nights,
        notes: stop.notes,
        stop_type: stop.stop_type ?? 'stop',
      })
      if (error) {
        setAndCache((prev) => prev.filter((s) => s.id !== stop.id))
        toast.error('Kunne ikke lagre stoppested')
      } else {
        logActivity({ log_type: 'database', action: 'INSERT', entity_type: 'stop', entity_name: stop.city, trip_id: stop.trip_id })
      }
    },
    [supabase, setAndCache]
  )

  const removeStop = useCallback(
    async (id: string) => {
      const snapshot = stopsCache.get(tripId ?? '') ?? stops
      const removing = stops.find((s) => s.id === id)
      setAndCache((prev) => prev.filter((s) => s.id !== id))
      const { error } = await supabase.from('stops').delete().eq('id', id)
      if (error) {
        setAndCache(snapshot)
        toast.error('Kunne ikke slette stoppested')
      } else if (removing) {
        logActivity({ log_type: 'database', action: 'DELETE', entity_type: 'stop', entity_name: removing.city, trip_id: removing.trip_id })
      }
    },
    [stops, supabase, setAndCache, tripId]
  )

  const reorderStops = useCallback(
    async (reordered: Stop[]) => {
      const regularOnly = reordered.filter((s) => s.stop_type === 'stop')
      setAndCache((prev) => {
        const homeStops = prev.filter((s) => s.stop_type !== 'stop')
        return [...homeStops, ...regularOnly].sort((a, b) => a.order - b.order)
      })
      await Promise.all(
        regularOnly.map((s, i) =>
          supabase.from('stops').update({ order: i }).eq('id', s.id)
        )
      )
    },
    [supabase, setAndCache]
  )

  const updateStop = useCallback(
    async (id: string, updates: Partial<Stop>) => {
      setAndCache((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
      const { error } = await supabase.from('stops').update(updates).eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere stoppested')
    },
    [supabase, setAndCache]
  )

  const homeStart    = useMemo(() => stops.find((s) => s.stop_type === 'home_start') ?? null, [stops])
  const homeEnd      = useMemo(() => stops.find((s) => s.stop_type === 'home_end')   ?? null, [stops])
  const regularStops = useMemo(() => stops.filter((s) => s.stop_type === 'stop'),              [stops])

  useEffect(() => {
    loadStops()
  }, [loadStops])

  return { stops, loading, addStop, removeStop, reorderStops, updateStop, homeStart, homeEnd, regularStops }
}
