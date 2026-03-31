'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export type NewsletterType = 'weekly_reminder' | 'ai_destination_tips'

export interface NewsletterSubscription {
  id: string
  user_id: string
  trip_id: string
  newsletter_type: NewsletterType
  enabled: boolean
  frequency_days: number
  last_sent_at: string | null
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
   * Returns the frequency in days for a newsletter type on a trip.
   * Default = 3 days.
   */
  function getFrequency(tripId: string, type: NewsletterType): number {
    const sub = subs.find((s) => s.trip_id === tripId && s.newsletter_type === type)
    return sub?.frequency_days ?? 3
  }

  /**
   * Toggles (upserts) a subscription record. Optionally update frequency_days at the same time.
   */
  const setSubscription = useCallback(
    async (tripId: string, type: NewsletterType, enabled: boolean, frequencyDays?: number) => {
      if (!userId) return

      const newFrequency = frequencyDays ?? getFrequency(tripId, type)

      // Optimistic update
      setSubs((prev) => {
        const exists = prev.find((s) => s.trip_id === tripId && s.newsletter_type === type)
        if (exists) {
          return prev.map((s) =>
            s.trip_id === tripId && s.newsletter_type === type
              ? { ...s, enabled, frequency_days: newFrequency }
              : s
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
            frequency_days: newFrequency,
            last_sent_at: null,
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
            frequency_days: newFrequency,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, supabase, subs]
  )

  /**
   * Updates only the frequency_days for an existing subscription.
   */
  const setFrequency = useCallback(
    async (tripId: string, type: NewsletterType, frequencyDays: number) => {
      if (!userId) return

      const currentEnabled = isEnabled(tripId, type)

      // Optimistic update
      setSubs((prev) => {
        const exists = prev.find((s) => s.trip_id === tripId && s.newsletter_type === type)
        if (exists) {
          return prev.map((s) =>
            s.trip_id === tripId && s.newsletter_type === type
              ? { ...s, frequency_days: frequencyDays }
              : s
          )
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            user_id: userId,
            trip_id: tripId,
            newsletter_type: type,
            enabled: currentEnabled,
            frequency_days: frequencyDays,
            last_sent_at: null,
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
            enabled: currentEnabled,
            frequency_days: frequencyDays,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,trip_id,newsletter_type' }
        )

      if (error) {
        setSubs((prev) =>
          prev.map((s) =>
            s.trip_id === tripId && s.newsletter_type === type
              ? { ...s, frequency_days: getFrequency(tripId, type) }
              : s
          )
        )
        toast.error('Kunne ikke lagre frekvensinnstillingen')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, supabase, subs]
  )

  return { subs, loading, isEnabled, getFrequency, setSubscription, setFrequency }
}
