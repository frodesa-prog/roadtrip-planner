'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip } from '@/types'
import { toast } from 'sonner'

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
      return newTrip
    },
    [supabase]
  )

  const deleteTrip = useCallback(
    async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId)
      if (error) {
        toast.error('Kunne ikke slette tur')
        return
      }
      setTrips((prev) => prev.filter((t) => t.id !== tripId))
      setCurrentTrip((prev) => {
        if (prev?.id === tripId) return null
        return prev
      })
      toast.success('Tur slettet')
    },
    [supabase]
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
    deleteTrip,
  }
}
