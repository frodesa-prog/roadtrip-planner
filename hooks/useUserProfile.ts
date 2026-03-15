'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'

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

  const saveDisplayName = useCallback(
    async (displayName: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const trimmed = displayName.trim()
      setProfile((prev) => prev ? { ...prev, display_name: trimmed || null, updated_at: new Date().toISOString() } : null)

      await supabase
        .from('user_profiles')
        .update({ display_name: trimmed || null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    },
    [supabase],
  )

  return { profile, loading, saveDisplayName }
}
