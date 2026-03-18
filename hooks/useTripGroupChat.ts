'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripGroupMessage } from '@/types'

export function useTripGroupChat(tripId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<TripGroupMessage[]>([])
  const [loading, setLoading] = useState(false)
  // Bump this to force unreadCount to recompute after markAsRead()
  const [lastReadVersion, setLastReadVersion] = useState(0)
  const supabase = useMemo(() => createClient(), [])
  // Keep a stable ref to supabase to avoid re-subscribing
  const supabaseRef = useRef(supabase)
  supabaseRef.current = supabase

  // ── Load message history ─────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) {
      setMessages([])
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('trip_group_messages')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) setMessages(data as TripGroupMessage[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [tripId, supabase])

  // ── Real-time subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) return
    const channel = supabase
      .channel(`trip-chat-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_group_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const newMsg = payload.new as TripGroupMessage
          setMessages((prev) => {
            // Avoid duplicates (optimistic insert already added it)
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, supabase])

  // ── Unread count ─────────────────────────────────────────────────────────
  const unreadCount = useMemo(() => {
    if (!tripId || !userId || typeof window === 'undefined') return 0
    const key = `chat_last_read_${tripId}_${userId}`
    const lastRead = localStorage.getItem(key)
    const since = lastRead ? new Date(lastRead) : new Date(0)
    return messages.filter(
      (m) => m.user_id !== userId && new Date(m.created_at) > since
    ).length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, tripId, userId, lastReadVersion])

  // ── Mark all as read ─────────────────────────────────────────────────────
  const markAsRead = useCallback(() => {
    if (!tripId || !userId || typeof window === 'undefined') return
    localStorage.setItem(
      `chat_last_read_${tripId}_${userId}`,
      new Date().toISOString()
    )
    setLastReadVersion((v) => v + 1)
  }, [tripId, userId])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!tripId || !userId || !content.trim()) return

      // Resolve sender name: user_profiles.display_name → traveler name → email
      let senderName = 'Ukjent'
      const sb = supabaseRef.current

      const [profileRes, travelerRes, userRes] = await Promise.all([
        sb
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', userId)
          .maybeSingle(),
        sb
          .from('travelers')
          .select('name')
          .eq('trip_id', tripId)
          .eq('linked_user_id', userId)
          .maybeSingle(),
        sb.auth.getUser(),
      ])

      if (profileRes.data?.display_name) {
        senderName = profileRes.data.display_name
      } else if (travelerRes.data?.name) {
        senderName = travelerRes.data.name
      } else if (userRes.data?.user?.email) {
        senderName = userRes.data.user.email.split('@')[0]
      }

      // Optimistic insert
      const optimisticId = `optimistic-${Date.now()}`
      const optimistic: TripGroupMessage = {
        id: optimisticId,
        trip_id: tripId,
        user_id: userId,
        sender_name: senderName,
        content: content.trim(),
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])

      const { data, error } = await sb
        .from('trip_group_messages')
        .insert({
          trip_id: tripId,
          user_id: userId,
          sender_name: senderName,
          content: content.trim(),
        })
        .select()
        .single()

      if (error) {
        // Roll back optimistic insert on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        return
      }

      // Replace optimistic with real record
      const real = data as TripGroupMessage
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? real : m))
      )
    },
    [tripId, userId]
  )

  return { messages, sendMessage, unreadCount, markAsRead, loading }
}
