'use client'

import {
  useEffect, useMemo, useRef, useState,
  KeyboardEvent, ClipboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  X, MessageSquare, MessageSquarePlus, Send, Paperclip, FileText,
  Trash2, Archive, FolderOpen, ChevronLeft,
  AlertTriangle, Loader2, ImageIcon, Download, NotebookPen,
} from 'lucide-react'
import { useChat } from '@/components/chat/ChatContext'
import { createClient } from '@/lib/supabase/client'
import { TripGroupMessage, ChatArchive, ChatArchiveMessage } from '@/types'

// ─── URL helpers ──────────────────────────────────────────────────────────────

const TLDS = 'no|com|org|net|io|app|dev|ai|co|uk|de|fr|se|dk|fi|eu|gov|edu|info|biz|store|shop|online|site|web|tech|digital|media|cloud|tv|as|me|nu|pro|name|blog|club|life|film|land|world|space'
const URL_BODY  = `[^\\s<>"']*[^\\s<>"'.,:;!?()\\[\\]]`
const BARE_BODY = `(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)+(?:${TLDS})(?:[/\\?#]${URL_BODY})?`
const URL_REGEX = new RegExp(`(https?://${URL_BODY}|www\\.${URL_BODY}|${BARE_BODY})`, 'gi')
const BARE_DOMAIN_RE = new RegExp(`^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)+(?:${TLDS})`, 'i')

function toHref(s: string) { return /^https?:\/\//i.test(s) ? s : `https://${s}` }
function isUrlPart(s: string) { return /^https?:\/\//i.test(s) || /^www\./i.test(s) || BARE_DOMAIN_RE.test(s) }

function renderContent(text: string) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) => {
    if (isUrlPart(part)) {
      return (
        <a key={i} href={toHref(part)} target="_blank" rel="noopener noreferrer"
          className="underline break-all opacity-90 hover:opacity-100">{part}</a>
      )
    }
    return part.split('\n').flatMap((line, j, arr) =>
      j < arr.length - 1 ? [line, <br key={`br-${i}-${j}`} />] : [line]
    )
  })
}

// ─── Date/time helpers ────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'I dag'
  if (d.toDateString() === yesterday.toDateString()) return 'I går'
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatArchiveDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── File upload constants ────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

// ─── Lightbox item type ───────────────────────────────────────────────────────

interface LightboxItem { url: string; name: string | null; type: string | null }

// ─── Attachment renderer (shared between live and archived messages) ──────────

function AttachmentBubble({
  url, name, type, isOwn, onOpen,
}: { url: string; name: string | null; type: string | null; isOwn: boolean; onOpen: (item: LightboxItem) => void }) {
  if (type === 'image') {
    return (
      <button
        onClick={() => onOpen({ url, name, type })}
        className="block mt-1 w-full text-left"
        title="Vis bilde"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name ?? 'Bilde'}
          className="max-w-full rounded-lg max-h-56 object-contain hover:opacity-90 transition-opacity cursor-zoom-in" />
      </button>
    )
  }
  return (
    <button
      onClick={() => onOpen({ url, name, type })}
      className={`flex items-center gap-2 mt-1 w-full px-2.5 py-1.5 rounded-lg border transition-colors text-left
        ${isOwn ? 'bg-blue-700/50 border-blue-500/30 hover:bg-blue-700/80' : 'bg-slate-800/60 border-slate-600/40 hover:bg-slate-700/60'}`}
    >
      <FileText className="w-4 h-4 text-blue-300 flex-shrink-0" />
      <span className="text-xs truncate max-w-[180px]">{name ?? 'Dokument'}</span>
    </button>
  )
}

// ─── Group messages by date ───────────────────────────────────────────────────

function groupByDate<T extends { created_at?: string; original_created_at?: string }>(
  msgs: T[]
): Array<{ date: string; msgs: T[] }> {
  const grouped: Array<{ date: string; msgs: T[] }> = []
  for (const msg of msgs) {
    const iso = msg.created_at ?? msg.original_created_at ?? ''
    const dateKey = new Date(iso).toDateString()
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== dateKey) grouped.push({ date: dateKey, msgs: [msg] })
    else last.msgs.push(msg)
  }
  return grouped
}

// ─── Panel view type ──────────────────────────────────────────────────────────

type PanelView = 'chat' | 'archives' | 'archiveDetail'

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel() {
  const {
    isOpen, close,
    messages, sendMessage, deleteMessage, clearChat, archiveAndClear,
    markAsRead, readReceipts,
    loading, currentTripName, currentTripId, userId,
  } = useChat()

  const supabase = useMemo(() => createClient(), [])

  // ── View state ──────────────────────────────────────────────────────────
  const [view, setView] = useState<PanelView>('chat')

  // ── New chat dialog ─────────────────────────────────────────────────────
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [clearingChat, setClearingChat] = useState(false)

  // ── Archive dialog ──────────────────────────────────────────────────────
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [archiveName, setArchiveName] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  // ── Save as note dialog ─────────────────────────────────────────────────
  const [showSaveNoteDialog, setShowSaveNoteDialog] = useState(false)
  const [noteDescription, setNoteDescription] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [saveNoteError, setSaveNoteError] = useState<string | null>(null)

  // ── Delete archive confirm ──────────────────────────────────────────────
  const [showDeleteArchiveConfirm, setShowDeleteArchiveConfirm] = useState(false)
  const [deletingArchive, setDeletingArchive] = useState(false)

  // ── Archive list ────────────────────────────────────────────────────────
  const [archives, setArchives] = useState<ChatArchive[]>([])
  const [archivesLoading, setArchivesLoading] = useState(false)

  // ── Archive detail ──────────────────────────────────────────────────────
  const [selectedArchive, setSelectedArchive] = useState<ChatArchive | null>(null)
  const [archiveMsgs, setArchiveMsgs] = useState<ChatArchiveMessage[]>([])
  const [archiveMsgsLoading, setArchiveMsgsLoading] = useState(false)

  // ── Lightbox ────────────────────────────────────────────────────────────
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null)

  // ── Message delete ──────────────────────────────────────────────────────
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // ── Input / file upload ─────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const messagesEndRef    = useRef<HTMLDivElement>(null)
  const textareaRef       = useRef<HTMLTextAreaElement>(null)
  const fileInputRef      = useRef<HTMLInputElement>(null)
  const archiveNameRef    = useRef<HTMLInputElement>(null)
  const noteDescriptionRef = useRef<HTMLInputElement>(null)

  // Read-receipt map (last own message each other user has read)
  const readReceiptMap = useMemo(() => {
    const result: Record<string, { count: number; latestReadAt: string }> = {}
    const ownMsgs = messages.filter((m: TripGroupMessage) => m.user_id === userId)
    if (!ownMsgs.length) return result
    for (const [readerId, readAt] of Object.entries(readReceipts)) {
      if (readerId === userId) continue
      const readTime = new Date(readAt)
      let lastRead: TripGroupMessage | null = null
      for (const msg of ownMsgs) {
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

  // ── Scroll to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && view === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen, view])

  // ── Mark as read ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) { markAsRead(); setTimeout(() => textareaRef.current?.focus(), 150) }
  }, [isOpen, markAsRead])
  useEffect(() => {
    if (isOpen && view === 'chat' && messages.length > 0) markAsRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isOpen, view])

  // ── Reset view when panel closes ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) { setView('chat'); setShowArchiveDialog(false) }
  }, [isOpen])

  // ── Revoke object URL on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => { if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl) }
  }, [pendingPreviewUrl])

  // ── Close lightbox on Escape ─────────────────────────────────────────────
  useEffect(() => {
    if (!lightbox) return
    function onKey(e: globalThis.KeyboardEvent) { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // ── Archive list loader ─────────────────────────────────────────────────
  async function openArchiveList() {
    setView('archives')
    if (!currentTripId) return
    setArchivesLoading(true)
    const { data } = await supabase
      .from('trip_chat_archives')
      .select('*')
      .eq('trip_id', currentTripId)
      .order('archived_at', { ascending: false })
    setArchives((data as ChatArchive[]) ?? [])
    setArchivesLoading(false)
  }

  // ── Archive detail loader ───────────────────────────────────────────────
  async function openArchiveDetail(archive: ChatArchive) {
    setSelectedArchive(archive)
    setView('archiveDetail')
    setArchiveMsgsLoading(true)
    const { data } = await supabase
      .from('trip_chat_archive_messages')
      .select('*')
      .eq('archive_id', archive.id)
      .order('original_created_at', { ascending: true })
    setArchiveMsgs((data as ChatArchiveMessage[]) ?? [])
    setArchiveMsgsLoading(false)
  }

  // ── Clear chat permanently (from new-chat dialog) ───────────────────────
  async function handleClearChatConfirm() {
    setClearingChat(true)
    await clearChat()
    setClearingChat(false)
    setShowNewChatDialog(false)
  }

  // ── Open archive dialog from new-chat dialog ─────────────────────────────
  function handleNewChatGoToArchive() {
    setShowNewChatDialog(false)
    setArchiveName('')
    setArchiveError(null)
    setShowArchiveDialog(true)
  }

  // ── Archive current chat ────────────────────────────────────────────────
  async function handleArchiveConfirm() {
    if (!archiveName.trim()) { archiveNameRef.current?.focus(); return }
    setArchiving(true)
    setArchiveError(null)
    const ok = await archiveAndClear(archiveName)
    setArchiving(false)
    if (ok) {
      setShowArchiveDialog(false)
      setArchiveName('')
      setView('chat')
    } else {
      setArchiveError('Noe gikk galt. Prøv igjen.')
    }
  }

  // ── Delete message ──────────────────────────────────────────────────────
  async function handleDeleteMessage(msg: TripGroupMessage) {
    setPendingDeleteId(null)
    await deleteMessage(msg.id, msg.attachment_url)
  }

  // ── Delete archived chat permanently ────────────────────────────────────
  async function handleDeleteArchive() {
    if (!selectedArchive) return
    setDeletingArchive(true)
    await supabase.from('trip_chat_archives').delete().eq('id', selectedArchive.id)
    setDeletingArchive(false)
    setShowDeleteArchiveConfirm(false)
    setArchives((prev) => prev.filter((a) => a.id !== selectedArchive.id))
    setSelectedArchive(null)
    setArchiveMsgs([])
    setView('archives')
  }

  // ── Save active chat as a note ───────────────────────────────────────────
  async function handleSaveAsNote() {
    if (!currentTripId || !noteDescription.trim()) {
      noteDescriptionRef.current?.focus()
      return
    }
    setSavingNote(true)
    setSaveNoteError(null)

    const now = new Date()
    const dateStr = now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
    const title = `Chat ${dateStr} – ${noteDescription.trim()}`

    // Build note content as readable markdown
    const lines: string[] = []
    for (const { date, msgs } of groupByDate(messages)) {
      const dayLabel = new Date(date).toLocaleDateString('nb-NO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
      lines.push(`## ${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}`)
      lines.push('')
      for (const msg of msgs as TripGroupMessage[]) {
        const time = formatTime(msg.created_at)
        lines.push(`**${msg.sender_name}** · ${time}`)
        if (msg.content) lines.push(msg.content)
        if (msg.attachment_url) {
          const name = msg.attachment_name ?? 'Vedlegg'
          lines.push(
            msg.attachment_type === 'image'
              ? `![${name}](${msg.attachment_url})`
              : `📎 [${name}](${msg.attachment_url})`
          )
        }
        lines.push('')
      }
    }

    const { error } = await supabase
      .from('notes')
      .insert({ trip_id: currentTripId, title, content: lines.join('\n'), stop_id: null, note_date: null })

    setSavingNote(false)
    if (error) {
      setSaveNoteError('Noe gikk galt. Prøv igjen.')
    } else {
      setShowSaveNoteDialog(false)
      setNoteDescription('')
    }
  }

  // ── Download attachment (cross-origin safe) ──────────────────────────────
  async function downloadAttachment(url: string, name: string | null) {
    const filename = name ?? url.split('/').pop() ?? 'fil'
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  // ── File helpers ────────────────────────────────────────────────────────
  function validateAndSetFile(file: File) {
    setFileError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Filtype ikke støttet. Tillatte typer: bilder, PDF, Word, tekstfiler.')
      return
    }
    if (file.size > MAX_FILE_SIZE) { setFileError('Filen er for stor. Maks 10 MB.'); return }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(file)
    setPendingPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  function removePendingFile() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null); setPendingPreviewUrl(null); setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files)
    if (!files.length) return
    e.preventDefault()
    validateAndSetFile(files[0])
  }

  // ── Send ────────────────────────────────────────────────────────────────
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Group live messages ─────────────────────────────────────────────────
  const grouped = groupByDate(messages)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
    <div
      className={`fixed right-0 top-11 bottom-0 z-30 flex flex-col w-full md:w-[370px]
        bg-slate-900 border-l border-slate-800 shadow-2xl
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      aria-hidden={!isOpen}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0 min-h-[52px]">
        {view === 'chat' && (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 leading-tight">Chat</p>
                {currentTripName && <p className="text-xs text-slate-400 truncate">{currentTripName}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowNewChatDialog(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Start ny chat"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Ny chat
              </button>
              <button
                onClick={openArchiveList}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                Arkiv
              </button>
              <button onClick={close}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title="Lukk chat">
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {view === 'archives' && (
          <>
            <div className="flex items-center gap-2">
              <button onClick={() => setView('chat')}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-semibold text-slate-100">Arkiverte chatter</p>
            </div>
            <button onClick={close}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </>
        )}

        {view === 'archiveDetail' && (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setView('archives')}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {selectedArchive?.name}
                </p>
                {selectedArchive && (
                  <p className="text-xs text-slate-500">
                    {formatArchiveDate(selectedArchive.archived_at)} · {selectedArchive.message_count} meldinger
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView('chat')}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors flex-shrink-0"
                title="Gå til aktiv chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteArchiveConfirm(true)}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors flex-shrink-0"
                title="Slett arkiv permanent"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={close}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Body: CHAT VIEW ─────────────────────────────────────────── */}
      {view === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {loading && <p className="text-center text-xs text-slate-500 mt-8">Laster meldinger…</p>}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                <span className="text-3xl">💬</span>
                <p className="text-sm text-slate-400">Ingen meldinger ennå. Si hei! 👋</p>
              </div>
            )}

            {grouped.map(({ date, msgs }) => (
              <div key={date}>
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
                  const showSender = !isOwn && (!prevMsg || prevMsg.user_id !== msg.user_id)
                  const isPendingDelete = pendingDeleteId === msg.id

                  return (
                    <div key={msg.id} className={`flex flex-col mb-1 ${isOwn ? 'items-end' : 'items-start'}`}
                      onMouseLeave={() => { if (pendingDeleteId === msg.id) setPendingDeleteId(null) }}
                    >
                      {showSender && (
                        <span className="text-[10px] text-slate-500 mb-0.5 px-1">{msg.sender_name}</span>
                      )}

                      <div className={`flex items-start gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Message bubble */}
                        <div className={`w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                          isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                        }`}>
                          {msg.content && renderContent(msg.content)}
                          {msg.attachment_url && (
                            <AttachmentBubble
                              url={msg.attachment_url}
                              name={msg.attachment_name ?? null}
                              type={msg.attachment_type ?? null}
                              isOwn={isOwn}
                              onOpen={setLightbox}
                            />
                          )}
                          {!msg.content && !msg.attachment_url && (
                            <span className="italic text-xs opacity-60">Slettet melding</span>
                          )}
                        </div>

                        {/* Delete control (own messages only) */}
                        {isOwn && (
                          isPendingDelete ? (
                            <button
                              onClick={() => handleDeleteMessage(msg)}
                              className="flex-shrink-0 px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium transition-colors mt-0.5"
                              title="Bekreft sletting"
                            >
                              Slett?
                            </button>
                          ) : (
                            <button
                              onClick={() => setPendingDeleteId(msg.id)}
                              className="flex-shrink-0 w-6 h-6 rounded-full text-slate-700 hover:text-red-400 hover:bg-red-900/20
                                flex items-center justify-center transition-colors opacity-0 hover:opacity-100 focus:opacity-100 mt-0.5
                                group-hover:opacity-100"
                              title="Slett melding"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>

                      <span className="text-[10px] text-slate-600 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
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

          {/* Input area */}
          <div className="border-t border-slate-800 p-3 flex-shrink-0">
            {/* Pending file preview */}
            {(pendingFile || fileError) && (
              <div className="mb-2">
                {fileError ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/40 text-xs text-red-300">
                    <span className="flex-1">{fileError}</span>
                    <button onClick={() => setFileError(null)}><X className="w-3 h-3" /></button>
                  </div>
                ) : pendingFile && (
                  <div className="relative inline-flex items-center gap-2 px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl max-w-full">
                    {pendingPreviewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pendingPreviewUrl} alt="Forhåndsvisning"
                          className="h-14 w-14 object-cover rounded-lg flex-shrink-0" />
                        <span className="text-xs text-slate-400 truncate max-w-[160px]">{pendingFile.name}</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <span className="text-xs text-slate-300 truncate max-w-[200px]">{pendingFile.name}</span>
                      </>
                    )}
                    <button onClick={removePendingFile}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-600 hover:bg-slate-500
                        border border-slate-700 flex items-center justify-center transition-colors"
                      title="Fjern vedlegg">
                      <X className="w-3 h-3 text-slate-200" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')}
              className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f) }} />

            <div className="flex items-end gap-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={!userId || sending}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700
                  disabled:opacity-40 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                title="Last opp bilde eller dokument">
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea ref={textareaRef} value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown} onPaste={handlePaste}
                placeholder="Skriv en melding… (Enter = send)"
                rows={1} disabled={!userId}
                className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100
                  placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                  min-h-[38px] max-h-32 overflow-y-auto leading-relaxed"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const el = e.currentTarget; el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
                }}
              />

              <button onClick={handleSend}
                disabled={(!inputValue.trim() && !pendingFile) || sending || !userId}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                  disabled:text-slate-500 text-white transition-colors flex items-center justify-center"
                title="Send (Enter)">
                {sending ? <ImageIcon className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-slate-600">Shift+Enter for ny linje · Lim inn bilde direkte</p>
              {messages.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setNoteDescription(''); setSaveNoteError(null); setShowSaveNoteDialog(true) }}
                    className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-blue-400 transition-colors"
                    title="Lagre chat som notat"
                  >
                    <NotebookPen className="w-3 h-3" />
                    Lagre som notat
                  </button>
                  <button
                    onClick={() => { setArchiveName(''); setArchiveError(null); setShowArchiveDialog(true) }}
                    className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-amber-400 transition-colors"
                    title="Arkiver og nullstill chatdialogen"
                  >
                    <Archive className="w-3 h-3" />
                    Arkiver chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Body: ARCHIVE LIST VIEW ──────────────────────────────────── */}
      {view === 'archives' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Archive current chat button */}
          {messages.length > 0 && (
            <div className="px-3 pt-3 pb-2 border-b border-slate-800 flex-shrink-0">
              <button
                onClick={() => { setArchiveName(''); setArchiveError(null); setShowArchiveDialog(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-600/10 border border-amber-600/30
                  text-amber-400 hover:bg-amber-600/20 transition-colors text-sm font-medium"
              >
                <Archive className="w-4 h-4 flex-shrink-0" />
                Arkiver nåværende chat ({messages.length} meldinger)
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {archivesLoading && (
              <div className="flex items-center justify-center gap-2 mt-8 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Laster arkiver…</span>
              </div>
            )}

            {!archivesLoading && archives.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 mt-12 text-center px-4">
                <FolderOpen className="w-10 h-10 text-slate-700" />
                <p className="text-sm text-slate-500">Ingen arkiverte chatter ennå</p>
              </div>
            )}

            {archives.map((archive) => (
              <button
                key={archive.id}
                onClick={() => openArchiveDetail(archive)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-slate-800 transition-colors text-left mb-1"
              >
                <Archive className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{archive.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatArchiveDate(archive.archived_at)} · {archive.message_count} meldinger
                  </p>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-600 flex-shrink-0 rotate-180 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Body: ARCHIVE DETAIL VIEW ────────────────────────────────── */}
      {view === 'archiveDetail' && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {archiveMsgsLoading && (
            <div className="flex items-center justify-center gap-2 mt-8 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Laster meldinger…</span>
            </div>
          )}

          {!archiveMsgsLoading && archiveMsgs.length === 0 && (
            <p className="text-center text-xs text-slate-600 mt-8">Ingen meldinger i dette arkivet</p>
          )}

          {groupByDate(archiveMsgs.map(m => ({ ...m, created_at: m.original_created_at }))).map(({ date, msgs }) => (
            <div key={date}>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-500 font-medium flex-shrink-0">
                  {formatDate(date)}
                </span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {(msgs as unknown as Array<ChatArchiveMessage & { created_at: string }>).map((msg, i) => {
                const isOwn = msg.user_id === userId
                const prev = i > 0 ? msgs[i - 1] as unknown as ChatArchiveMessage : null
                const showSender = !isOwn && (!prev || prev.user_id !== msg.user_id)

                return (
                  <div key={msg.id} className={`flex flex-col mb-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                    {showSender && (
                      <span className="text-[10px] text-slate-500 mb-0.5 px-1">{msg.sender_name}</span>
                    )}
                    <div className={`w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isOwn ? 'bg-blue-600/70 text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                    }`}>
                      {msg.content && renderContent(msg.content)}
                      {msg.attachment_url && (
                        <AttachmentBubble
                          url={msg.attachment_url}
                          name={msg.attachment_name}
                          type={msg.attachment_type}
                          isOwn={isOwn}
                          onOpen={setLightbox}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 mt-0.5 px-1">
                      {formatTime(msg.original_created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── New chat dialog overlay ──────────────────────────────────── */}
      {showNewChatDialog && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10 flex items-center justify-center p-5">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquarePlus className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <h3 className="text-base font-semibold text-slate-100">Start ny chat</h3>
            </div>

            {messages.length === 0 ? (
              <>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  Det er ingen aktiv chat. Chatvinduet er allerede tomt.
                </p>
                <button
                  onClick={() => setShowNewChatDialog(false)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                  Lukk
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                  Det er {messages.length} meldinger i den aktive chatten. Hva vil du gjøre med dem?
                </p>

                {/* Archive option */}
                <button
                  onClick={handleNewChatGoToArchive}
                  disabled={clearingChat}
                  className="w-full flex items-start gap-3 px-3.5 py-3 rounded-xl bg-amber-600/10 border border-amber-600/30
                    text-left hover:bg-amber-600/20 transition-colors disabled:opacity-50 mb-2"
                >
                  <Archive className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Arkiver chatten</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Lagres i arkivet og kan alltid leses igjen senere.
                    </p>
                  </div>
                </button>

                {/* Delete option */}
                <button
                  onClick={handleClearChatConfirm}
                  disabled={clearingChat}
                  className="w-full flex items-start gap-3 px-3.5 py-3 rounded-xl bg-red-900/10 border border-red-700/30
                    text-left hover:bg-red-900/20 transition-colors disabled:opacity-50 mb-4"
                >
                  {clearingChat
                    ? <Loader2 className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 animate-spin" />
                    : <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="text-sm font-medium text-red-300">
                      {clearingChat ? 'Sletter…' : 'Slett permanent'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Alle meldinger slettes og kan <strong className="text-slate-300">ikke</strong> gjenopprettes.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setShowNewChatDialog(false)}
                  disabled={clearingChat}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm
                    hover:bg-slate-700 hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                  Avbryt
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Delete archive confirmation overlay ─────────────────────── */}
      {showDeleteArchiveConfirm && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10 flex items-center justify-center p-5">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="w-5 h-5 text-red-400 flex-shrink-0" />
              <h3 className="text-base font-semibold text-slate-100">Slett arkiv permanent</h3>
            </div>

            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Er du sikker på at du vil slette arkivet{' '}
              <span className="font-semibold text-slate-100">«{selectedArchive?.name}»</span>?
            </p>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-900/20 border border-red-700/30 mb-5">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 leading-relaxed">
                Dette kan <strong>ikke</strong> angres. Alle meldinger i dette arkivet slettes permanent.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteArchiveConfirm(false)}
                disabled={deletingArchive}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm
                  hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleDeleteArchive}
                disabled={deletingArchive}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-700
                  hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm
                  font-medium transition-colors"
              >
                {deletingArchive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deletingArchive ? 'Sletter…' : 'Slett permanent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as note dialog overlay ──────────────────────────────── */}
      {showSaveNoteDialog && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10 flex items-center justify-center p-5">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <NotebookPen className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <h3 className="text-base font-semibold text-slate-100">Lagre chat som notat</h3>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Hele chatdialogen ({messages.length} meldinger) lagres som et notat på turen, inkludert bilder og dokumentlenker.
            </p>

            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Kort beskrivelse
            </label>
            <input
              ref={noteDescriptionRef}
              type="text"
              value={noteDescription}
              onChange={(e) => setNoteDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsNote() }}
              placeholder='F.eks. "Planlegging av aktiviteter"'
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100
                placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-1"
            />
            <p className="text-[10px] text-slate-600 mb-4">
              Notattittel: «Chat {new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })} – {noteDescription.trim() || '…'}»
            </p>

            {saveNoteError && (
              <p className="text-xs text-red-400 mb-3">{saveNoteError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowSaveNoteDialog(false); setNoteDescription(''); setSaveNoteError(null) }}
                disabled={savingNote}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm
                  hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveAsNote}
                disabled={savingNote || !noteDescription.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600
                  hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm
                  font-medium transition-colors"
              >
                {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <NotebookPen className="w-3.5 h-3.5" />}
                {savingNote ? 'Lagrer…' : 'Lagre notat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archive dialog overlay ───────────────────────────────────── */}
      {showArchiveDialog && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10 flex items-center justify-center p-5">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Archive className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <h3 className="text-base font-semibold text-slate-100">Arkiver chatdialogen</h3>
            </div>

            {/* Name input */}
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Gi arkivet et navn
            </label>
            <input
              ref={archiveNameRef}
              type="text"
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleArchiveConfirm() }}
              placeholder={`f.eks. "Sommer ${new Date().getFullYear()}"`}
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100
                placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 mb-4"
            />

            {/* Warning */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200 leading-relaxed">
                Chatdialogen arkiveres og chatvinduet nullstilles. Du kan <strong>ikke</strong> angre denne handlingen,
                men du vil alltid kunne lese den arkiverte chatten i arkivlisten.
              </p>
            </div>

            {archiveError && (
              <p className="text-xs text-red-400 mb-3">{archiveError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowArchiveDialog(false); setArchiveName(''); setArchiveError(null) }}
                disabled={archiving}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm
                  hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={archiving || !archiveName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600
                  hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm
                  font-medium transition-colors"
              >
                {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                {archiving ? 'Arkiverer…' : 'Arkiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ── Lightbox portal (renders over the entire app) ─────────────── */}
    {lightbox && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col"
        onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null) }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <span className="text-sm text-slate-200 truncate min-w-0 pr-3 font-medium">
            {lightbox.name ?? 'Vedlegg'}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => downloadAttachment(lightbox.url, lightbox.name)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white text-sm font-medium transition-colors"
              title="Last ned"
            >
              <Download className="w-4 h-4" />
              Last ned
            </button>
            <button
              onClick={() => setLightbox(null)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Lukk (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className={`flex-1 overflow-auto ${lightbox.name?.toLowerCase().endsWith('.pdf') ? 'p-3' : 'flex items-center justify-center p-6'}`}
          onClick={() => setLightbox(null)}
        >
          {lightbox.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt={lightbox.name ?? 'Bilde'}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : lightbox.name?.toLowerCase().endsWith('.pdf') ? (
            <iframe
              src={lightbox.url}
              title={lightbox.name ?? 'PDF'}
              className="w-full h-full rounded-xl border-0 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="flex flex-col items-center gap-6 text-center p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText className="w-20 h-20 text-blue-400" />
              <p className="text-slate-100 text-base font-semibold break-all leading-relaxed">
                {lightbox.name ?? 'Dokument'}
              </p>
              <button
                onClick={() => downloadAttachment(lightbox.url, lightbox.name)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                  text-white text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Last ned
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
