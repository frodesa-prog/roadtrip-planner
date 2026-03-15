'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PreferenceAccess } from '@/types'
import { toast } from 'sonner'

export function usePreferenceAccess() {
  const [grants, setGrants] = useState<PreferenceAccess[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }

      const { data } = await supabase
        .from('preference_access')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!cancelled) {
        setGrants(data ? (data as PreferenceAccess[]) : [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const grantAccess = useCallback(
    async (email: string): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const trimmed = email.trim().toLowerCase()
      if (trimmed === (await supabase.auth.getUser()).data.user?.email) {
        toast.error('Du kan ikke gi deg selv tilgang')
        return false
      }

      const optimistic: PreferenceAccess = {
        id: crypto.randomUUID(),
        user_id: user.id,
        granted_to_email: trimmed,
        created_at: new Date().toISOString(),
      }
      setGrants((prev) => [optimistic, ...prev])

      const { data, error } = await supabase
        .from('preference_access')
        .insert({ user_id: user.id, granted_to_email: trimmed })
        .select()
        .single()

      if (error) {
        setGrants((prev) => prev.filter((g) => g.id !== optimistic.id))
        if (error.code === '23505') {
          toast.error(`${trimmed} har allerede tilgang`)
        } else {
          toast.error('Kunne ikke gi tilgang')
        }
        return false
      }

      setGrants((prev) => prev.map((g) => (g.id === optimistic.id ? (data as PreferenceAccess) : g)))
      toast.success(`${trimmed} kan nå se dine preferanser`)
      return true
    },
    [supabase],
  )

  const revokeAccess = useCallback(
    async (id: string): Promise<void> => {
      setGrants((prev) => prev.filter((g) => g.id !== id))
      const { error } = await supabase.from('preference_access').delete().eq('id', id)
      if (error) toast.error('Kunne ikke fjerne tilgang')
    },
    [supabase],
  )

  return { grants, loading, grantAccess, revokeAccess }
}
