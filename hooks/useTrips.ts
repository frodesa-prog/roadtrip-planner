'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip } from '@/types'
import { toast } from 'sonner'
import { logActivity } from '@/hooks/useActivityLog'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  const loadTrips = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTrips(data as Trip[])
      // Auto-velg nyeste tur om ingen er valgt
      setCurrentTrip((prev) => prev ?? (data[0] as Trip) ?? null)
    }
    setLoading(false)
  }, [supabase])

  const createTrip = useCallback(
    async (name: string, year: number): Promise<Trip | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('trips')
        .insert({ name, year, status: 'planning', owner_id: user.id })
        .select()
        .single()

      if (error) {
        toast.error('Kunne ikke opprette tur')
        return null
      }

      const newTrip = data as Trip
      setTrips((prev) => [newTrip, ...prev])
      setCurrentTrip(newTrip)
      toast.success(`"${name}" er opprettet! 🗺️`)
      logActivity({ log_type: 'database', action: 'INSERT', entity_type: 'trip', entity_name: name, trip_id: newTrip.id })

      // Auto-legg til tureier som første reisedeltaker
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
      const displayName =
        (profileData as { display_name: string | null } | null)?.display_name ||
        user.email?.split('@')[0] ||
        'Meg'
      await supabase.from('travelers').insert({
        trip_id: newTrip.id,
        name: displayName,
        linked_user_id: user.id,
      })

      return newTrip
    },
    [supabase]
  )

  const updateTrip = useCallback(
    async (tripId: string, data: Partial<Pick<Trip, 'group_description'>>) => {
      setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...data } : t)))
      setCurrentTrip((prev) => (prev?.id === tripId ? { ...prev, ...data } : prev))
      const { error } = await supabase.from('trips').update(data).eq('id', tripId)
      if (error) toast.error('Kunne ikke lagre endringen')
    },
    [supabase],
  )

  const deleteTrip = useCallback(
    async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId)
      if (error) {
        toast.error('Kunne ikke slette tur')
        return
      }
      const deletedTrip = trips.find((t) => t.id === tripId)
      setTrips((prev) => prev.filter((t) => t.id !== tripId))
      setCurrentTrip((prev) => {
        if (prev?.id === tripId) return null
        return prev
      })
      toast.success('Tur slettet')
      logActivity({ log_type: 'database', action: 'DELETE', entity_type: 'trip', entity_name: deletedTrip?.name, trip_id: tripId })
    },
    [supabase, trips]
  )

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  return {
    trips,
    currentTrip,
    loading,
    setCurrentTrip,
    createTrip,
    updateTrip,
    deleteTrip,
  }
}
