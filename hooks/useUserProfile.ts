'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'

type ProfileUpdate = Partial<Pick<UserProfile, 'display_name' | 'birth_date' | 'gender'>>

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }

      // Upsert profil ved innlasting (synkroniserer e-post)
      const { data } = await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, email: user.email ?? '' }, { onConflict: 'user_id', ignoreDuplicates: false })
        .select()
        .single()

      if (!cancelled) {
        setProfile(data as UserProfile | null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const saveProfile = useCallback(
    async (updates: ProfileUpdate) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date().toISOString()
      // Optimistic update
      setProfile((prev) => prev ? { ...prev, ...updates, updated_at: now } : null)

      await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: now })
        .eq('user_id', user.id)
    },
    [supabase],
  )

  // Convenience alias kept for backward compat
  const saveDisplayName = useCallback(
    (displayName: string) => saveProfile({ display_name: displayName.trim() || null }),
    [saveProfile],
  )

  return { profile, loading, saveProfile, saveDisplayName }
}
