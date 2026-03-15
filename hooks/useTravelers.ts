'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Traveler } from '@/types'
import { toast } from 'sonner'

type TravelerInput = Partial<Pick<Traveler, 'name' | 'age' | 'gender' | 'interests' | 'description'>>

export function useTravelers(tripId: string | null) {
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setTravelers([]); return }
    supabase
      .from('travelers')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at')
      .then(({ data }) => { if (data) setTravelers(data as Traveler[]) })
  }, [tripId, supabase])

  const addTraveler = useCallback(async (data: TravelerInput): Promise<Traveler | null> => {
    if (!tripId) return null
    const optimistic: Traveler = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      name: data.name ?? '',
      age: data.age ?? null,
      gender: data.gender ?? null,
      interests: data.interests ?? null,
      description: data.description ?? null,
      created_at: new Date().toISOString(),
    }
    setTravelers((prev) => [...prev, optimistic])
    const { data: created, error } = await supabase
      .from('travelers')
      .insert({ trip_id: tripId, ...data })
      .select()
      .single()
    if (error) {
      setTravelers((prev) => prev.filter((t) => t.id !== optimistic.id))
      toast.error('Kunne ikke legge til person')
      return null
    }
    setTravelers((prev) =>
      prev.map((t) => (t.id === optimistic.id ? (created as Traveler) : t)),
    )
    return created as Traveler
  }, [tripId, supabase])

  const updateTraveler = useCallback(async (id: string, data: TravelerInput) => {
    setTravelers((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)))
    const { error } = await supabase.from('travelers').update(data).eq('id', id)
    if (error) toast.error('Kunne ikke oppdatere person')
  }, [supabase])

  const deleteTraveler = useCallback(async (id: string) => {
    setTravelers((prev) => prev.filter((t) => t.id !== id))
    const { error } = await supabase.from('travelers').delete().eq('id', id)
    if (error) toast.error('Kunne ikke slette person')
  }, [supabase])

  return { travelers, addTraveler, updateTraveler, deleteTraveler }
}
