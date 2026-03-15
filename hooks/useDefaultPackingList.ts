'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DefaultPackingItem, PackingCategory } from '@/types'
import { toast } from 'sonner'

export function useDefaultPackingList() {
  const [items, setItems] = useState<DefaultPackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }
      const { data } = await supabase
        .from('default_packing_items')
        .select('*')
        .eq('user_id', user.id)
        .order('category')
        .order('created_at')
      if (!cancelled) {
        setItems(data ? (data as DefaultPackingItem[]) : [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const addItem = useCallback(
    async (item: string, category: PackingCategory): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const optimistic: DefaultPackingItem = {
        id: crypto.randomUUID(),
        user_id: user.id,
        item,
        category,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [...prev, optimistic])

      const { data, error } = await supabase
        .from('default_packing_items')
        .insert({ user_id: user.id, item, category })
        .select()
        .single()

      if (error) {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        toast.error('Kunne ikke lagre pakkelistepunkt')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as DefaultPackingItem) : i)))
    },
    [supabase],
  )

  const deleteItem = useCallback(
    async (id: string): Promise<void> => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('default_packing_items').delete().eq('id', id)
      if (error) toast.error('Kunne ikke slette pakkelistepunkt')
    },
    [supabase],
  )

  return { items, loading, addItem, deleteItem }
}
