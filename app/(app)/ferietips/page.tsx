'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useActivities } from '@/hooks/useActivities'
import { useNotes } from '@/hooks/useNotes'
import { useTravelers } from '@/hooks/useTravelers'
import { Lightbulb, Send, Loader2, BookmarkPlus, Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  saved?: boolean
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
  onSave,
}: {
  msg: ChatMessage
  onSave: (msg: ChatMessage) => void
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
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        </div>
        {/* Bubble */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 min-w-0">
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </p>
        </div>
      </div>

      {/* Save button */}
      {msg.content && (
        <div className="pl-8">
          <button
            onClick={() => onSave(msg)}
            disabled={msg.saved}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-amber-400 disabled:text-emerald-500 transition-colors"
          >
            {msg.saved ? (
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FerietipsPage() {
  const { currentTrip } = useTrips()
  const { stops } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { activities } = useActivities(stopIds)
  const { addNote } = useNotes(currentTrip?.id ?? null)
  const { travelers } = useTravelers(currentTrip?.id ?? null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Build trip context sent to the API
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
      })),
    }
  }, [currentTrip, stops, activities, travelers])

  const firstCity =
    [...stops].sort((a, b) => a.order - b.order)[0]?.city ?? 'første stopp'

  // ── Send message ────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/ferietips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          tripContext,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Noe gikk galt')
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text ?? '',
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : 'Beklager, noe gikk galt. Prøv igjen.'
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorText,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Save assistant message as note ─────────────────────────────────────────

  async function handleSave(msg: ChatMessage) {
    if (!currentTrip) {
      toast.error('Ingen tur valgt')
      return
    }
    try {
      await addNote({
        title: 'Tips fra Ferieplanlegger',
        content: msg.content,
        stop_id: null,
        note_date: null,
      })
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, saved: true } : m)),
      )
      toast.success('Lagret som notat')
    } catch {
      toast.error('Kunne ikke lagre notat')
    }
  }

  // ── Clear conversation ──────────────────────────────────────────────────────

  function clearChat() {
    setMessages([])
  }

  // ── Keyboard handler ────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const destinations = [...stops]
    .sort((a, b) => a.order - b.order)
    .filter((s) => s.arrival_date)
    .map((s) => s.city)
    .join(' → ')

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 border-b border-slate-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-1.5">
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Ferietips</p>
            {destinations && (
              <p className="text-xs text-slate-500 mt-0.5">{destinations}</p>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Ny chat
          </button>
        )}
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Welcome / empty state */}
        {messages.length === 0 && (
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
        )}

        {/* Chat messages */}
        {/* Typing indicator while waiting */}
        {isLoading && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1 py-0.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onSave={handleSave}
            />
          ))}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
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
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none min-h-[24px] disabled:opacity-60"
              style={{ overflowY: 'hidden' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
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
  )
}
