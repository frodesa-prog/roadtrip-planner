'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActivityLogEntry, LogType } from '@/types'

const PAGE_SIZE = 25

export function useActivityLog(logType?: LogType) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(
    async (pageIndex: number) => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)

      if (logType) query = query.eq('log_type', logType)

      const { data } = await query
      if (data) {
        setEntries((prev) => (pageIndex === 0 ? (data as ActivityLogEntry[]) : [...prev, ...(data as ActivityLogEntry[])]))
        setHasMore(data.length === PAGE_SIZE + 1)
      }
      setLoading(false)
    },
    [supabase, logType],
  )

  useEffect(() => {
    setPage(0)
    load(0)
  }, [load])

  const loadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    load(next)
  }, [page, load])

  return { entries, loading, hasMore, loadMore }
}

// ── Standalone log utility (brukes fra hooks) ──────────────────────────────────

export async function logActivity(params: {
  log_type: LogType
  action: string
  entity_type?: string
  entity_name?: string
  trip_id?: string | null
  details?: Record<string, unknown>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('activity_log').insert({ user_id: user.id, ...params })
}
