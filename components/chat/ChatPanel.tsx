'use client'

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react'
import { X, MessageSquare, Send } from 'lucide-react'
import { useChat } from '@/components/chat/ChatContext'
import { TripGroupMessage } from '@/types'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

// Gjør URL-er klikkbare og bevarer linjeskift.
// Gjenkjenner: https?://, www., og bare domener med kjente TLD-er.
const TLDS = 'no|com|org|net|io|app|dev|ai|co|uk|de|fr|se|dk|fi|eu|gov|edu|info|biz|store|shop|online|site|web|tech|digital|media|cloud|tv|as|me|nu|pro|name|blog|club|life|film|land|world|space'

// En "URL-del" er tegn som ikke er whitespace, men siste tegn må ikke være typisk avsluttende tegn.
const URL_BODY  = `[^\\s<>"']*[^\\s<>"'.,:;!?()\\[\\]]`
const BARE_BODY = `(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)+(?:${TLDS})(?:[/\\?#]${URL_BODY})?`

const URL_REGEX = new RegExp(
  `(https?://${URL_BODY}|www\\.${URL_BODY}|${BARE_BODY})`,
  'gi'
)

const BARE_DOMAIN_RE = new RegExp(`^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)+(?:${TLDS})`, 'i')

function toHref(s: string): string {
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

function isUrlPart(s: string): boolean {
  return /^https?:\/\//i.test(s) || /^www\./i.test(s) || BARE_DOMAIN_RE.test(s)
}

function renderContent(text: string) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) => {
    if (isUrlPart(part)) {
      return (
        <a
          key={i}
          href={toHref(part)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline break-all opacity-90 hover:opacity-100"
        >
          {part}
        </a>
      )
    }
    // Bevar linjeskift i vanlig tekst
    return part.split('\n').flatMap((line, j, arr) =>
      j < arr.length - 1 ? [line, <br key={`br-${i}-${j}`} />] : [line]
    )
  })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'I dag'
  if (d.toDateString() === yesterday.toDateString()) return 'I går'
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
}

export default function ChatPanel() {
  const {
    isOpen,
    close,
    messages,
    sendMessage,
    markAsRead,
    readReceipts,
    loading,
    currentTripName,
    userId,
  } = useChat()

  // For each own message: find the LAST one that each other user has read.
  // Returns a map: messageId → { count, latestReadAt }
  const readReceiptMap = useMemo(() => {
    const result: Record<string, { count: number; latestReadAt: string }> = {}
    const ownMessages = messages.filter((m: TripGroupMessage) => m.user_id === userId)
    if (!ownMessages.length) return result

    for (const [readerId, readAt] of Object.entries(readReceipts)) {
      if (readerId === userId) continue // skip own receipt
      const readTime = new Date(readAt)
      // Find the last own message sent before readAt
      let lastRead: TripGroupMessage | null = null
      for (const msg of ownMessages) {
        if (new Date(msg.created_at) <= readTime) lastRead = msg
      }
      if (!lastRead) continue
      const prev = result[lastRead.id]
      result[lastRead.id] = {
        count: (prev?.count ?? 0) + 1,
        latestReadAt: !prev || readAt > prev.latestReadAt ? readAt : prev.latestReadAt,
      }
    }
    return result
  }, [messages, readReceipts, userId])

  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive or panel opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Mark as read when panel is open
  useEffect(() => {
    if (isOpen) {
      markAsRead()
      // Focus textarea when opening
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [isOpen, markAsRead])

  // Mark as read when new messages arrive while panel is open
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      markAsRead()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isOpen])

  async function handleSend() {
    const trimmed = inputValue.trim()
    if (!trimmed || sending) return
    setSending(true)
    setInputValue('')
    await sendMessage(trimmed)
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date for date separators
  const grouped: Array<{ date: string; msgs: typeof messages }> = []
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString()
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== dateKey) {
      grouped.push({ date: dateKey, msgs: [msg] })
    } else {
      last.msgs.push(msg)
    }
  }

  return (
    <div
      ref={panelRef}
      className={`fixed right-0 top-11 bottom-0 z-30 flex flex-col w-full md:w-[370px]
        bg-slate-900 border-l border-slate-800 shadow-2xl
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      aria-hidden={!isOpen}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 leading-tight">Chat</p>
            {currentTripName && (
              <p className="text-xs text-slate-400 truncate">{currentTripName}</p>
            )}
          </div>
        </div>
        <button
          onClick={close}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
          title="Lukk chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {loading && (
          <p className="text-center text-xs text-slate-500 mt-8">Laster meldinger…</p>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <span className="text-3xl">💬</span>
            <p className="text-sm text-slate-400">Ingen meldinger ennå. Si hei! 👋</p>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] text-slate-500 font-medium flex-shrink-0">
                {formatDate(msgs[0].created_at)}
              </span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {msgs.map((msg, i) => {
              const isOwn = msg.user_id === userId
              const prevMsg = i > 0 ? msgs[i - 1] : null
              const showSender = !isOwn && (
                !prevMsg || prevMsg.user_id !== msg.user_id
              )

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col mb-1 ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  {showSender && (
                    <span className="text-[10px] text-slate-500 mb-0.5 px-1">
                      {msg.sender_name}
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isOwn
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                  <span className="text-[10px] text-slate-600 mt-0.5 px-1">
                    {formatTime(msg.created_at)}
                  </span>
                  {isOwn && readReceiptMap[msg.id] && (
                    <span className="text-[10px] text-blue-400 px-1 -mt-0.5">
                      ✓ Lest {readReceiptMap[msg.id].count > 1 ? `av ${readReceiptMap[msg.id].count} · ` : ''}{formatTime(readReceiptMap[msg.id].latestReadAt)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────────── */}
      <div className="border-t border-slate-800 p-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en melding… (Enter = send)"
            rows={1}
            className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100
              placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
              min-h-[38px] max-h-32 overflow-y-auto leading-relaxed"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
            disabled={!userId}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending || !userId}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
              disabled:text-slate-500 text-white transition-colors flex items-center justify-center"
            title="Send (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5 text-center">
          Shift+Enter for ny linje
        </p>
      </div>
    </div>
  )
}
