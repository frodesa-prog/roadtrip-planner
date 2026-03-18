'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPreferences } from '@/types'

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) {
        setPreferences(data as UserPreferences | null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const savePreferences = useCallback(
    async (updates: Partial<Pick<UserPreferences, 'interests' | 'interests_extra' | 'food_preferences' | 'mobility_notes' | 'other_info'>>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date().toISOString()
      const payload = { ...updates, user_id: user.id, updated_at: now }

      // Optimistic
      setPreferences((prev) =>
        prev ? { ...prev, ...updates, updated_at: now } : { id: '', user_id: user.id, interests: null, interests_extra: null, food_preferences: null, mobility_notes: null, other_info: null, created_at: now, updated_at: now, ...updates }
      )

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single()

      if (!error && data) {
        const prefs = data as UserPreferences
        setPreferences(prefs)

        // ── Synkroniser til reisedeltaker-rader der brukeren er registrert ──
        // Bygg ai_context fra mat-, mobilitets- og annen informasjon
        const aiParts: string[] = []
        if (prefs.food_preferences) aiParts.push(`Mat: ${prefs.food_preferences}`)
        if (prefs.mobility_notes) aiParts.push(`Mobilitet: ${prefs.mobility_notes}`)
        if (prefs.other_info) aiParts.push(prefs.other_info)

        await supabase
          .from('travelers')
          .update({
            interests:   prefs.interests ?? null,
            description: prefs.interests_extra ?? null,
            ai_context:  aiParts.length > 0 ? aiParts.join('\n') : null,
          })
          .eq('linked_user_id', user.id)
      }
    },
    [supabase],
  )

  return { preferences, loading, savePreferences }
}
