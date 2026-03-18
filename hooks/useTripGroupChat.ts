'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripGroupMessage } from '@/types'

// userId → ISO-tidsstempel for siste lesing
export type ReadReceipts = Record<string, string>

export function useTripGroupChat(tripId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<TripGroupMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [readReceipts, setReadReceipts] = useState<ReadReceipts>({})
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

  // ── Real-time: nye og slettede meldinger ────────────────────────────────
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
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'trip_group_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setMessages((prev) => prev.filter((m) => m.id !== deletedId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, supabase])

  // ── Last lesekvitteringer (for alle turmedlemmer) ────────────────────────
  useEffect(() => {
    if (!tripId || !userId) {
      setReadReceipts({})
      return
    }
    supabase
      .from('trip_chat_read_receipts')
      .select('user_id, last_read_at')
      .eq('trip_id', tripId)
      .then(({ data }) => {
        if (!data) return
        const map: ReadReceipts = {}
        for (const r of data as { user_id: string; last_read_at: string }[]) {
          map[r.user_id] = r.last_read_at
        }
        setReadReceipts(map)
      })
  }, [tripId, userId, supabase])

  // ── Real-time: lesekvitteringer ──────────────────────────────────────────
  useEffect(() => {
    if (!tripId || !userId) return
    const channel = supabase
      .channel(`trip-read-receipts-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_chat_read_receipts',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const rec = (payload.new ?? payload.old) as {
            user_id: string
            last_read_at: string
          } | null
          if (rec?.user_id) {
            setReadReceipts((prev) => ({ ...prev, [rec.user_id]: rec.last_read_at }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, userId, supabase])

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
    const now = new Date().toISOString()
    localStorage.setItem(`chat_last_read_${tripId}_${userId}`, now)
    setLastReadVersion((v) => v + 1)
    // Sync til server slik at e-postvarsler og "Lest"-indikator fungerer
    supabase
      .from('trip_chat_read_receipts')
      .upsert({ user_id: userId, trip_id: tripId, last_read_at: now })
      .then(() => {})
  }, [tripId, userId, supabase])

  // ── Send message (with optional file attachment) ─────────────────────────
  const sendMessage = useCallback(
    async (content: string, file?: File) => {
      if (!tripId || !userId) return
      const trimmed = content.trim()
      if (!trimmed && !file) return

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

      // ── Upload file if provided ──────────────────────────────────────────
      let attachmentUrl: string | null = null
      let attachmentName: string | null = null
      let attachmentType: 'image' | 'document' | null = null

      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${tripId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await sb.storage
          .from('chat-attachments')
          .upload(path, file, { contentType: file.type })

        if (!uploadError) {
          const { data: urlData } = sb.storage
            .from('chat-attachments')
            .getPublicUrl(path)
          attachmentUrl = urlData.publicUrl
          attachmentName = file.name
          attachmentType = file.type.startsWith('image/') ? 'image' : 'document'
        }
      }

      // ── Optimistic insert (text-only; file messages wait for real ID) ────
      let optimisticId: string | null = null
      if (!file) {
        optimisticId = `optimistic-${Date.now()}`
        const optimistic: TripGroupMessage = {
          id: optimisticId,
          trip_id: tripId,
          user_id: userId,
          sender_name: senderName,
          content: trimmed,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, optimistic])
      }

      const { data, error } = await sb
        .from('trip_group_messages')
        .insert({
          trip_id: tripId,
          user_id: userId,
          sender_name: senderName,
          content: trimmed,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        })
        .select()
        .single()

      if (error) {
        if (optimisticId) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        }
        return
      }

      const real = data as TripGroupMessage
      if (optimisticId) {
        // Replace optimistic with real record
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? real : m)))
      } else {
        // File message: real-time subscription may not fire for own inserts → add directly
        setMessages((prev) => {
          if (prev.some((m) => m.id === real.id)) return prev
          return [...prev, real]
        })
      }
    },
    [tripId, userId]
  )

  // ── Delete a single message (own only) ───────────────────────────────────
  const deleteMessage = useCallback(
    async (messageId: string, attachmentUrl?: string | null) => {
      if (!userId) return
      // Optimistic removal
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      // Delete attachment from storage
      if (attachmentUrl) {
        const match = attachmentUrl.match(/\/storage\/v1\/object\/public\/chat-attachments\/(.+)$/)
        if (match) {
          supabaseRef.current.storage
            .from('chat-attachments')
            .remove([decodeURIComponent(match[1])])
            .then(() => {})
        }
      }
      // Delete from DB (only own messages via RLS)
      await supabaseRef.current
        .from('trip_group_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', userId)
    },
    [userId]
  )

  // ── Archive all messages and clear current chat ───────────────────────────
  const archiveAndClear = useCallback(
    async (name: string): Promise<boolean> => {
      if (!tripId || !userId) return false
      const sb = supabaseRef.current
      // Only archive persisted messages (skip optimistic)
      const realMessages = messages.filter((m) => !m.id.startsWith('optimistic-'))
      if (realMessages.length === 0) return false

      // 1. Create archive record
      const { data: archive, error: archiveErr } = await sb
        .from('trip_chat_archives')
        .insert({
          trip_id: tripId,
          archived_by: userId,
          name: name.trim(),
          message_count: realMessages.length,
        })
        .select()
        .single()

      if (archiveErr || !archive) return false

      // 2. Copy messages to archive
      const archiveMsgs = realMessages.map((m) => ({
        archive_id: archive.id,
        original_message_id: m.id,
        user_id: m.user_id,
        sender_name: m.sender_name,
        content: m.content,
        attachment_url: m.attachment_url ?? null,
        attachment_name: m.attachment_name ?? null,
        attachment_type: m.attachment_type ?? null,
        original_created_at: m.created_at,
      }))

      const { error: msgErr } = await sb
        .from('trip_chat_archive_messages')
        .insert(archiveMsgs)

      if (msgErr) return false

      // 3. Delete all live messages for this trip
      await sb.from('trip_group_messages').delete().eq('trip_id', tripId)

      // 4. Clear local state
      setMessages([])
      return true
    },
    [tripId, userId, messages]
  )

  return { messages, sendMessage, deleteMessage, archiveAndClear, unreadCount, markAsRead, readReceipts, loading }
}
