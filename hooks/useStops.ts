'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Stop } from '@/types'
import { toast } from 'sonner'

export function useStops(tripId: string | null) {
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  const loadStops = useCallback(async () => {
    if (!tripId) {
      setStops([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('trip_id', tripId)
      .order('order', { ascending: true })

    if (!error && data) setStops(data as Stop[])
    setLoading(false)
  }, [tripId, supabase])

  const addStop = useCallback(
    async (stop: Stop) => {
      // Optimistisk oppdatering – UI reagerer umiddelbart
      setStops((prev) => [...prev, stop])

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
      })

      if (error) {
        setStops((prev) => prev.filter((s) => s.id !== stop.id))
        toast.error('Kunne ikke lagre stoppested')
      }
    },
    [supabase]
  )

  const removeStop = useCallback(
    async (id: string) => {
      const snapshot = stops
      setStops((prev) => prev.filter((s) => s.id !== id))

      const { error } = await supabase.from('stops').delete().eq('id', id)
      if (error) {
        setStops(snapshot)
        toast.error('Kunne ikke slette stoppested')
      }
    },
    [stops, supabase]
  )

  const reorderStops = useCallback(
    async (reordered: Stop[]) => {
      setStops(reordered)
      // Oppdater order-felt for alle berørte stopp
      await Promise.all(
        reordered.map((s, i) =>
          supabase.from('stops').update({ order: i }).eq('id', s.id)
        )
      )
    },
    [supabase]
  )

  const updateStop = useCallback(
    async (id: string, updates: Partial<Stop>) => {
      setStops((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      )
      const { error } = await supabase.from('stops').update(updates).eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere stoppested')
    },
    [supabase]
  )

  // Last inn stopp når tripId endres
  useEffect(() => {
    loadStops()
  }, [loadStops])

  return { stops, loading, addStop, removeStop, reorderStops, updateStop }
}
