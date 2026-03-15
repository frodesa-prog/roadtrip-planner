'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripShare } from '@/types'
import { toast } from 'sonner'

export function useTripShares(tripId: string | null) {
  const [shares, setShares] = useState<TripShare[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setShares([]); return }
    setLoading(true)
    supabase
      .from('trip_shares')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setShares(data ? (data as TripShare[]) : [])
        setLoading(false)
      })
  }, [tripId, supabase])

  const shareTrip = useCallback(
    async (email: string, accessLevel: 'read' | 'write'): Promise<boolean> => {
      if (!tripId) return false
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const optimistic: TripShare = {
        id: crypto.randomUUID(),
        trip_id: tripId,
        owner_id: user.id,
        shared_with_email: email,
        access_level: accessLevel,
        status: 'pending',
        created_at: new Date().toISOString(),
      }
      setShares((prev) => [optimistic, ...prev])

      const { data, error } = await supabase
        .from('trip_shares')
        .insert({ trip_id: tripId, owner_id: user.id, shared_with_email: email, access_level: accessLevel })
        .select()
        .single()

      if (error) {
        setShares((prev) => prev.filter((s) => s.id !== optimistic.id))
        if (error.code === '23505') {
          toast.error('Denne e-postadressen har allerede tilgang til turen')
        } else {
          toast.error('Kunne ikke dele turen')
        }
        return false
      }

      setShares((prev) => prev.map((s) => (s.id === optimistic.id ? (data as TripShare) : s)))
      toast.success(`Invitasjon sendt til ${email}`)
      return true
    },
    [tripId, supabase],
  )

  const removeShare = useCallback(
    async (shareId: string): Promise<void> => {
      setShares((prev) => prev.filter((s) => s.id !== shareId))
      const { error } = await supabase.from('trip_shares').delete().eq('id', shareId)
      if (error) toast.error('Kunne ikke fjerne deling')
    },
    [supabase],
  )

  return { shares, loading, shareTrip, removeShare }
}
