'use client'

import { useEffect, useMemo, useRef, useState, KeyboardEvent, ClipboardEvent } from 'react'
import { X, MessageSquare, Send, Paperclip, FileText, ImageIcon, AlertCircle } from 'lucide-react'
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

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

function AttachmentMessage({ msg, isOwn }: { msg: TripGroupMessage; isOwn: boolean }) {
  if (!msg.attachment_url) return null

  if (msg.attachment_type === 'image') {
    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-1"
        title="Åpne bilde"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={msg.attachment_url}
          alt={msg.attachment_name ?? 'Bilde'}
          className="max-w-full rounded-lg max-h-56 object-contain hover:opacity-90 transition-opacity"
        />
      </a>
    )
  }

  if (msg.attachment_type === 'document') {
    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        download={msg.attachment_name ?? true}
        className={`flex items-center gap-2 mt-1 px-2.5 py-1.5 rounded-lg border transition-colors
          ${isOwn
            ? 'bg-blue-700/50 border-blue-500/30 hover:bg-blue-700/80'
            : 'bg-slate-800/60 border-slate-600/40 hover:bg-slate-700/60'
          }`}
      >
        <FileText className="w-4 h-4 text-blue-300 flex-shrink-0" />
        <span className="text-xs truncate max-w-[180px]">
          {msg.attachment_name ?? 'Dokument'}
        </span>
      </a>
    )
  }

  return null
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
  const readReceiptMap = useMemo(() => {
    const result: Record<string, { count: number; latestReadAt: string }> = {}
    const ownMessages = messages.filter((m: TripGroupMessage) => m.user_id === userId)
    if (!ownMessages.length) return result

    for (const [readerId, readAt] of Object.entries(readReceipts)) {
      if (readerId === userId) continue
      const readTime = new Date(readAt)
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
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke preview URL on unmount
  useEffect(() => {
    return () => { if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl) }
  }, [pendingPreviewUrl])

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) {
      markAsRead()
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [isOpen, markAsRead])

  useEffect(() => {
    if (isOpen && messages.length > 0) markAsRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isOpen])

  function validateAndSetFile(file: File) {
    setFileError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Filtype ikke støttet. Tillatte typer: bilder, PDF, Word, tekstfiler.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('Filen er for stor. Maks 10 MB.')
      return
    }
    // Revoke old preview
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)

    setPendingFile(file)
    if (file.type.startsWith('image/')) {
      setPendingPreviewUrl(URL.createObjectURL(file))
    } else {
      setPendingPreviewUrl(null)
    }
  }

  function removePendingFile() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null)
    setPendingPreviewUrl(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) validateAndSetFile(file)
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files)
    if (files.length === 0) return
    const file = files[0]
    // Only intercept if it's a file (image paste or file copy)
    e.preventDefault()
    validateAndSetFile(file)
  }

  async function handleSend() {
    const trimmed = inputValue.trim()
    if ((!trimmed && !pendingFile) || sending) return
    setSending(true)

    const fileToSend = pendingFile
    removePendingFile()
    setInputValue('')

    await sendMessage(trimmed, fileToSend ?? undefined)
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date
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
              const hasAttachment = !!(msg.attachment_url)
              const textOnly = !hasAttachment

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

                  {/* Message bubble — only shown when there's text content */}
                  {(msg.content || textOnly) && (
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        isOwn
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                      }`}
                    >
                      {msg.content && renderContent(msg.content)}
                      <AttachmentMessage msg={msg} isOwn={isOwn} />
                    </div>
                  )}

                  {/* Attachment without text — no bubble wrapper */}
                  {!msg.content && hasAttachment && (
                    <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <AttachmentMessage msg={msg} isOwn={isOwn} />
                    </div>
                  )}

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

        {/* Pending file preview */}
        {(pendingFile || fileError) && (
          <div className="mb-2">
            {fileError ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/40 text-xs text-red-300">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{fileError}</span>
                <button
                  onClick={() => setFileError(null)}
                  className="hover:text-red-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : pendingFile && (
              <div className="relative inline-flex items-center gap-2 px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl max-w-full">
                {pendingPreviewUrl ? (
                  /* Image preview */
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingPreviewUrl}
                      alt="Forhåndsvisning"
                      className="h-14 w-14 object-cover rounded-lg flex-shrink-0"
                    />
                    <span className="text-xs text-slate-400 truncate max-w-[160px]">
                      {pendingFile.name}
                    </span>
                  </>
                ) : (
                  /* Document preview */
                  <>
                    <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-slate-300 truncate max-w-[200px]">
                      {pendingFile.name}
                    </span>
                  </>
                )}
                <button
                  onClick={removePendingFile}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-600
                    hover:bg-slate-500 border border-slate-700 flex items-center justify-center transition-colors"
                  title="Fjern vedlegg"
                >
                  <X className="w-3 h-3 text-slate-200" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileSelected}
        />

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!userId || sending}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700
              disabled:opacity-40 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
            title="Last opp bilde eller dokument"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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
            disabled={(!inputValue.trim() && !pendingFile) || sending || !userId}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
              disabled:text-slate-500 text-white transition-colors flex items-center justify-center"
            title="Send (Enter)"
          >
            {sending ? (
              <ImageIcon className="w-4 h-4 animate-pulse" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <p className="text-[10px] text-slate-600 mt-1.5 text-center">
          Shift+Enter for ny linje · Lim inn bilde direkte
        </p>
      </div>
    </div>
  )
}
