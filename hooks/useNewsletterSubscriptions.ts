'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export type NewsletterType = 'weekly_reminder'

export interface NewsletterSubscription {
  id: string
  user_id: string
  trip_id: string
  newsletter_type: NewsletterType
  enabled: boolean
  created_at: string
  updated_at: string
}

export function useNewsletterSubscriptions(userId: string | null) {
  const [subs, setSubs] = useState<NewsletterSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!userId) { setSubs([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) setSubs(data as NewsletterSubscription[])
        setLoading(false)
      })
  }, [userId, supabase])

  /**
   * Returns whether the user is subscribed to a newsletter type for a trip.
   * Default (no record) = true (opted in).
   */
  function isEnabled(tripId: string, type: NewsletterType): boolean {
    const sub = subs.find((s) => s.trip_id === tripId && s.newsletter_type === type)
    return sub ? sub.enabled : true
  }

  /**
   * Toggles (upserts) a subscription record.
   */
  const setSubscription = useCallback(
    async (tripId: string, type: NewsletterType, enabled: boolean) => {
      if (!userId) return

      // Optimistic update
      setSubs((prev) => {
        const exists = prev.find((s) => s.trip_id === tripId && s.newsletter_type === type)
        if (exists) {
          return prev.map((s) =>
            s.trip_id === tripId && s.newsletter_type === type ? { ...s, enabled } : s
          )
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            user_id: userId,
            trip_id: tripId,
            newsletter_type: type,
            enabled,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      })

      const { error } = await supabase
        .from('newsletter_subscriptions')
        .upsert(
          {
            user_id: userId,
            trip_id: tripId,
            newsletter_type: type,
            enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,trip_id,newsletter_type' }
        )

      if (error) {
        // Revert optimistic update
        setSubs((prev) => {
          const exists = prev.find((s) => s.trip_id === tripId && s.newsletter_type === type)
          if (exists) {
            return prev.map((s) =>
              s.trip_id === tripId && s.newsletter_type === type ? { ...s, enabled: !enabled } : s
            )
          }
          return prev.filter(
            (s) => !(s.trip_id === tripId && s.newsletter_type === type)
          )
        })
        toast.error('Kunne ikke lagre innstillingen')
      }
    },
    [userId, supabase]
  )

  return { subs, loading, isEnabled, setSubscription }
}
