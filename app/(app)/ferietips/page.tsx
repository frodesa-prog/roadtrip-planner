'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useActivities } from '@/hooks/useActivities'
import { useNotes } from '@/hooks/useNotes'
import { useTravelers } from '@/hooks/useTravelers'
import { useChatSessions } from '@/hooks/useChatSessions'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { ChatDbMessage, ChatSession } from '@/types'
import {
  Lightbulb,
  Send,
  Loader2,
  BookmarkPlus,
  Check,
  Plus,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'I dag'
  if (diffDays === 1) return 'I går'
  if (diffDays < 7) return `${diffDays} d. siden`
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

// ─── Session list item ────────────────────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
        isActive
          ? 'bg-slate-800 text-white'
          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
      }`}
    >
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-60" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-snug">{session.title}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">
          {formatSessionDate(session.updated_at)}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all"
        title="Slett samtale"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Quick-suggestion chips ───────────────────────────────────────────────────

function Suggestions({
  firstCity,
  onSelect,
}: {
  firstCity: string
  onSelect: (text: string) => void
}) {
  const suggestions = [
    `Hva bør vi ikke gå glipp av i ${firstCity}?`,
    'Kan du anbefale gode restauranter?',
    'Hva bør vi pakke til reisen?',
    'Tips for å spare penger underveis?',
    'Beste tidspunkt å besøke attraksjonene?',
    'Finnes det skjulte perler vi bør se?',
  ]

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isSaved,
  onSave,
}: {
  msg: ChatDbMessage
  isSaved: boolean
  onSave: () => void
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-blue-600/80 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="group space-y-1.5">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 min-w-0">
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </p>
        </div>
      </div>
      {msg.content && (
        <div className="pl-8">
          <button
            onClick={onSave}
            disabled={isSaved}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-amber-400 disabled:text-emerald-500 transition-colors"
          >
            {isSaved ? (
              <>
                <Check className="w-3 h-3" />
                Lagret som notat
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3 h-3" />
                Lagre som notat
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1 py-0.5">
          <div
            className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FerietipsPage() {
  const { currentTrip } = useTrips()
  const { stops } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { activities } = useActivities(stopIds)
  const { addNote } = useNotes(currentTrip?.id ?? null)
  const { travelers } = useTravelers(currentTrip?.id ?? null)
  const { preferences } = useUserPreferences()

  const {
    sessions,
    activeSessionId,
    messages,
    loadingMessages,
    createSession,
    deleteSession,
    selectSession,
    startNewChat,
    addMessage,
  } = useChatSessions(currentTrip?.id ?? null)

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set())
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll when messages or typing indicator changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Build trip context for the API
  const tripContext = useMemo(() => {
    const sortedStops = [...stops].sort((a, b) => a.order - b.order)
    return {
      tripName: currentTrip?.name ?? '',
      stops: sortedStops.map((s) => ({
        city: s.city,
        state: s.state,
        arrival_date: s.arrival_date,
        nights: s.nights,
      })),
      activities: activities.map((a) => ({
        name: a.name,
        activity_type: a.activity_type,
        stop_city: stops.find((s) => s.id === a.stop_id)?.city ?? '',
      })),
      travelers: travelers.map((t) => ({
        name: t.name,
        age: t.age,
        gender: t.gender,
        interests: t.interests,
        description: t.description,
        aiContext: t.ai_context ?? null,
      })),
      groupDescription: currentTrip?.group_description ?? null,
      userPreferences: preferences
        ? {
            interests: preferences.interests,
            interestsExtra: preferences.interests_extra ?? null,
            foodPreferences: preferences.food_preferences,
            mobilityNotes: preferences.mobility_notes,
            otherInfo: preferences.other_info,
          }
        : null,
    }
  }, [currentTrip, stops, activities, travelers, preferences])

  const firstCity =
    [...stops].sort((a, b) => a.order - b.order)[0]?.city ?? 'første stopp'

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      // Get or create a session
      let sid = activeSessionId
      if (!sid) {
        const session = await createSession()
        if (!session) return
        sid = session.id
      }

      // Snapshot before any state mutations
      const isFirstUserMsg = messages.filter((m) => m.role === 'user').length === 0
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ]

      setInput('')
      setIsLoading(true)

      // Persist user message (optimistic update shows it immediately)
      addMessage(sid, 'user', trimmed, { isFirstUserMessage: isFirstUserMsg })

      try {
        const res = await fetch('/api/ferietips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, tripContext }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Noe gikk galt')

        await addMessage(sid, 'assistant', data.text ?? '')
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Beklager, noe gikk galt. Prøv igjen.'
        toast.error(msg)
      } finally {
        setIsLoading(false)
      }
    },
    [activeSessionId, isLoading, messages, tripContext, createSession, addMessage],
  )

  // ── Save assistant message as note ───────────────────────────────────────────

  async function handleSave(msgId: string, content: string) {
    if (!currentTrip) {
      toast.error('Ingen tur valgt')
      return
    }
    try {
      await addNote({
        title: 'Tips fra Ferieplanlegger',
        content,
        stop_id: null,
        note_date: null,
      })
      setSavedMessageIds((prev) => new Set([...prev, msgId]))
      toast.success('Lagret som notat')
    } catch {
      toast.error('Kunne ikke lagre notat')
    }
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex bg-slate-950">
      {/* ── Mobil overlay-backdrop ── */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-11 bottom-16 left-0 z-50 w-[280px]
        md:relative md:top-auto md:bottom-auto md:z-auto md:w-56 md:translate-x-0
        flex-shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col
        transition-transform duration-200
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* New chat button */}
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ny chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-700 text-center py-8">
              Ingen samtaler ennå
            </p>
          ) : (
            sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onSelect={() => selectSession(s.id)}
                onDelete={() => deleteSession(s.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex-shrink-0 border-b border-slate-800 px-3 md:px-5 py-3 flex items-center gap-3">
          {/* Mobil: samtaler-knapp */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs flex-shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Samtaler</span>
          </button>
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-1.5 flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none truncate">
              {activeSession ? activeSession.title : 'Ferietips'}
            </p>
            {!activeSession && (
              <p className="text-xs text-slate-500 mt-0.5">
                Start en ny samtale for å få reiseråd
              </p>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {loadingMessages ? (
            /* Loading messages for selected session */
            <div className="min-h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
            </div>
          ) : !activeSessionId || messages.length === 0 ? (
            /* No active session or empty session: welcome + suggestions */
            <div className="max-w-2xl mx-auto space-y-6 pt-6">
              <div className="text-center space-y-2">
                <p className="text-3xl">💡</p>
                <p className="text-slate-200 text-sm font-medium">
                  Hei! Jeg hjelper deg med tips til ferieturen.
                </p>
                {currentTrip ? (
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Jeg kjenner til reisen din{' '}
                    <span className="text-slate-400 font-medium">{currentTrip.name}</span>
                    {stops.filter((s) => s.arrival_date).length > 0 &&
                      ` med ${stops.filter((s) => s.arrival_date).length} destinasjoner`}
                    , og bruker den informasjonen for å gi deg relevante tips.
                  </p>
                ) : (
                  <p className="text-slate-500 text-xs">
                    Gå til Planlegg for å velge en tur, så kan jeg gi deg mer personlige tips.
                  </p>
                )}
              </div>
              <Suggestions firstCity={firstCity} onSelect={sendMessage} />
            </div>
          ) : (
            /* Chat messages */
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isSaved={savedMessageIds.has(msg.id)}
                  onSave={() => handleSave(msg.id, msg.content)}
                />
              ))}
              {isLoading && <TypingIndicator />}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-slate-800 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-amber-500/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Spør om tips til reisen… (Enter for å sende)"
                rows={1}
                disabled={isLoading || loadingMessages}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none min-h-[24px] disabled:opacity-60"
                style={{ overflowY: 'hidden' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading || loadingMessages}
                className="flex-shrink-0 p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-700 text-center mt-1.5">
              Shift+Enter for ny linje
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
