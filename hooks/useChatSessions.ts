'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatSession, ChatDbMessage } from '@/types'

export function useChatSessions(tripId: string | null) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatDbMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // ── Load session list ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) {
      setSessions([])
      return
    }
    supabase
      .from('chat_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSessions(data as ChatSession[])
      })
  }, [tripId, supabase])

  // ── Load messages when active session changes ───────────────────────────────
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', activeSessionId)
      .order('created_at')
      .then(({ data }) => {
        setMessages(data ? (data as ChatDbMessage[]) : [])
        setLoadingMessages(false)
      })
  }, [activeSessionId, supabase])

  // ── Create new session ──────────────────────────────────────────────────────
  const createSession = useCallback(async (): Promise<ChatSession | null> => {
    if (!tripId) return null
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ trip_id: tripId, title: 'Ny chat' })
      .select()
      .single()
    if (error || !data) return null
    const session = data as ChatSession
    setSessions((prev) => [session, ...prev])
    setActiveSessionId(session.id)
    setMessages([])
    return session
  }, [tripId, supabase])

  // ── Delete a session ────────────────────────────────────────────────────────
  const deleteSession = useCallback(
    async (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      // Use functional update to avoid stale activeSessionId closure
      setActiveSessionId((prev) => (prev === id ? null : prev))
      // messages are cleared automatically by the effect above when activeSessionId → null
      await supabase.from('chat_sessions').delete().eq('id', id)
    },
    [supabase],
  )

  // ── Select / switch session ─────────────────────────────────────────────────
  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  // ── Start a new chat without persisting to DB yet ───────────────────────────
  const startNewChat = useCallback(() => {
    setActiveSessionId(null)
    setMessages([])
  }, [])

  // ── Add a message to a session ──────────────────────────────────────────────
  const addMessage = useCallback(
    async (
      sessionId: string,
      role: 'user' | 'assistant',
      content: string,
      opts?: { isFirstUserMessage?: boolean },
    ): Promise<ChatDbMessage | null> => {
      // Optimistic insert
      const optimistic: ChatDbMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role,
        content,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, role, content })
        .select()
        .single()

      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return null
      }

      const saved = data as ChatDbMessage
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))

      // Update session: title (if first user message) + updated_at
      const now = new Date().toISOString()
      const sessionUpdates: { updated_at: string; title?: string } = { updated_at: now }
      if (opts?.isFirstUserMessage && role === 'user') {
        sessionUpdates.title =
          content.length > 60 ? content.slice(0, 60) + '…' : content
      }
      await supabase
        .from('chat_sessions')
        .update(sessionUpdates)
        .eq('id', sessionId)
      setSessions((prev) =>
        prev
          .map((s) => (s.id === sessionId ? { ...s, ...sessionUpdates } : s))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      )

      return saved
    },
    [supabase],
  )

  return {
    sessions,
    activeSessionId,
    messages,
    loadingMessages,
    createSession,
    deleteSession,
    selectSession,
    startNewChat,
    addMessage,
  }
}
