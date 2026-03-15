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

      const [shareRes, tripRes, profileRes] = await Promise.all([
        supabase
          .from('trip_shares')
          .insert({ trip_id: tripId, owner_id: user.id, shared_with_email: email, access_level: accessLevel })
          .select()
          .single(),
        supabase.from('trips').select('name').eq('id', tripId).single(),
        supabase.from('user_profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
      ])

      const { data, error } = shareRes

      const tripName = (tripRes.data as { name: string } | null)?.name ?? 'turen'
      const senderName = (profileRes.data as { display_name: string | null } | null)?.display_name
        || user.email?.split('@')[0]
        || 'En venn'

      if (error) {
        setShares((prev) => prev.filter((s) => s.id !== optimistic.id))
        if (error.code === '23505') {
          // Del allerede eksisterer – send e-posten på nytt likevel
          fetch('/api/share-trip-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientEmail: email, tripName, senderName, accessLevel }),
          }).catch(() => { /* ignore email errors */ })
          toast.success(`Invitasjon sendt på nytt til ${email}`)
        } else {
          toast.error('Kunne ikke dele turen')
        }
        return false
      }

      setShares((prev) => prev.map((s) => (s.id === optimistic.id ? (data as TripShare) : s)))

      // Send e-post til mottaker (feiler stille om RESEND_API_KEY ikke er satt)
      fetch('/api/share-trip-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: email, tripName, senderName, accessLevel }),
      }).catch(() => { /* ignore email errors */ })

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
