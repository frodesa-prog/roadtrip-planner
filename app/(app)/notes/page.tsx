'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Trash2, FileText, ImageIcon, Loader2, X, Archive, ArrowLeft, Camera, SwitchCamera } from 'lucide-react'
import Link from 'next/link'
import { useTrips } from '@/hooks/useTrips'
import { useNotes } from '@/hooks/useNotes'
import { useStops } from '@/hooks/useStops'
import { useNoteImages } from '@/hooks/useNoteImages'
import TripManager from '@/components/planning/TripManager'
import { Note, Stop } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStopDateRange(stop: Stop): string[] {
  if (!stop.arrival_date) return []
  const dates: string[] = []
  const base = new Date(stop.arrival_date + 'T12:00:00')
  for (let i = 0; i <= stop.nights; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function formatShortDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { notes, addNote, updateNote, archiveNote } = useNotes(
    currentTrip?.id ?? null
  )
  const { stops } = useStops(currentTrip?.id ?? null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [showDraft, setShowDraft] = useState(false)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  // Fil som skal lastes opp etter at et nytt notat er opprettet
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Mobil: 'list' viser notat-lista, 'editor' viser editoren
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

  // Stop order map for sorting
  const stopOrderMap = useMemo(() => {
    const map: Record<string, number> = {}
    stops.forEach((s) => { map[s.id] = s.order })
    return map
  }, [stops])

  // Stop name map for sidebar display
  const stopNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    stops.forEach((s) => { map[s.id] = s.city })
    return map
  }, [stops])

  // Sort notes: by stop order (attached first), then created_at; unattached last
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const orderA = a.stop_id != null ? (stopOrderMap[a.stop_id] ?? 998) : 999
      const orderB = b.stop_id != null ? (stopOrderMap[b.stop_id] ?? 998) : 999
      if (orderA !== orderB) return orderA - orderB
      return a.created_at.localeCompare(b.created_at)
    })
  }, [notes, stopOrderMap])

  // Auto-show draft when entering page with a trip (or when trip changes)
  useEffect(() => {
    setSelectedNoteId(null)
    setConfirmArchiveId(null)
    setShowDraft(!!currentTrip)
    setMobileView('list')
  }, [currentTrip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Draft handlers ---

  async function handleDraftSave(title: string, content: string, file?: File) {
    const note = await addNote({
      content,
      title: title.trim() || null,
      stop_id: null,
      note_date: null,
    })
    if (note) {
      if (file) setPendingFile(file)
      setShowDraft(false)
      setSelectedNoteId(note.id)
    }
  }

  function handleDraftDiscard() {
    setShowDraft(false)
    setMobileView('list')
    if (sortedNotes.length > 0) setSelectedNoteId(sortedNotes[0].id)
  }

  // Select an existing note
  function handleSelectNote(id: string) {
    setShowDraft(false)
    setSelectedNoteId(id)
    setMobileView('editor')
  }

  // "+" button: show new draft
  function handleAddNote() {
    setShowDraft(true)
    setSelectedNoteId(null)
    setMobileView('editor')
  }

  async function handleArchiveNote(id: string) {
    await archiveNote(id)
    if (selectedNoteId === id) {
      const remaining = sortedNotes.filter((n) => n.id !== id)
      setSelectedNoteId(remaining.length > 0 ? remaining[0].id : null)
    }
    setMobileView('list')
  }

  function handleBackToList() {
    setMobileView('list')
  }

  const selectedNote = showDraft
    ? null
    : (notes.find((n) => n.id === selectedNoteId) ?? null)

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Confirmation modal ──────────────────────────────────────────── */}
      {confirmArchiveId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setConfirmArchiveId(null)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-slate-100 mb-1.5">Flytt til arkiv?</h2>
            <p className="text-xs text-slate-400 mb-5">
              Notatet flyttes til arkivet. Du kan finne det igjen der og slette det permanent.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmArchiveId(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => {
                  handleArchiveNote(confirmArchiveId)
                  setConfirmArchiveId(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Flytt til arkiv
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left sidebar / notat-liste ───────────────────────────────────
          Desktop: alltid synlig (w-[240px])
          Mobil:   full bredde når mobileView === 'list', skjult ellers    */}
      <div className={[
        'h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0',
        // Desktop: fast bredde, alltid synlig
        'md:w-[240px] md:min-w-[200px] md:flex',
        // Mobil: full bredde når vi er i list-view, skjult ellers
        mobileView === 'list' ? 'flex w-full' : 'hidden',
      ].join(' ')}>
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading} userId={userId}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />

        {/* Note list header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notater</p>
          {currentTrip && (
            <button
              onClick={handleAddNote}
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Nytt notat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {!currentTrip ? (
            <p className="px-4 py-6 text-xs text-slate-600 text-center">Velg en tur</p>
          ) : (
            <>
              {/* Draft indicator in list */}
              {showDraft && (
                <div className="flex items-stretch border-b border-slate-800/50 bg-slate-800 border-l-2 border-l-blue-500">
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <p className="text-xs font-medium text-slate-400 italic">Nytt notat…</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">Ikke lagret ennå</p>
                  </div>
                </div>
              )}

              {sortedNotes.length === 0 && !showDraft && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-slate-600">Ingen notater ennå</p>
                </div>
              )}

              {sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className={[
                    'flex items-stretch border-b border-slate-800/50 group/note',
                    !showDraft && note.id === selectedNoteId
                      ? 'bg-slate-800 border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-800/40',
                  ].join(' ')}
                >
                  <button
                    onClick={() => handleSelectNote(note.id)}
                    className="flex-1 min-w-0 text-left px-4 py-3 transition-colors"
                  >
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {note.title || 'Uten tittel'}
                    </p>
                    {note.stop_id ? (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {stopNameMap[note.stop_id] ?? ''}
                        {note.note_date ? ` · ${formatShortDate(note.note_date)}` : ''}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-600 truncate mt-0.5 italic">Turnotat</p>
                    )}
                  </button>

                  {/* Slett → arkiv med bekreftelse */}
                  <button
                    onClick={() => setConfirmArchiveId(note.id)}
                    className="opacity-0 group-hover/note:opacity-100 transition-opacity px-2 text-slate-600 hover:text-red-400 flex-shrink-0"
                    title="Flytt til arkiv"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Archive link at bottom */}
        {currentTrip && (
          <div className="border-t border-slate-800 p-3 flex-shrink-0">
            <Link
              href="/notes/archive"
              className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Arkiv
            </Link>
          </div>
        )}
      </div>

      {/* ── Editor area ──────────────────────────────────────────────────
          Desktop: alltid synlig (flex-1)
          Mobil:   full bredde når mobileView === 'editor', skjult ellers */}
      <div className={[
        'flex overflow-hidden',
        // Desktop: alltid synlig, tar resterende plass
        'md:flex md:flex-1',
        // Mobil: full bredde i editor-view, skjult ellers
        mobileView === 'editor' ? 'flex flex-1' : 'hidden',
      ].join(' ')}>
        {!currentTrip ? (
          <EmptyState message="Velg en tur til venstre for å se notater" />
        ) : showDraft ? (
          <DraftEditor
            onSave={handleDraftSave}
            onDiscard={handleDraftDiscard}
            onBack={handleBackToList}
          />
        ) : !selectedNote ? (
          <EmptyState
            message="Velg et notat eller opprett et nytt"
            action={{ label: '+ Nytt notat', onClick: handleAddNote }}
            onBack={handleBackToList}
          />
        ) : (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onUpdate={updateNote}
            onRequestDelete={(id) => setConfirmArchiveId(id)}
            stops={stops}
            onBack={handleBackToList}
            pendingFile={pendingFile}
            onPendingFileConsumed={() => setPendingFile(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Camera Modal ─────────────────────────────────────────────────────────────

function CameraModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Koble stream til video-elementet og sett ready
  function attachStream(stream: MediaStream) {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    const markReady = () => setReady(true)
    video.addEventListener('canplay', markReady, { once: true })
    video.addEventListener('playing', markReady, { once: true })
    video.play().then(markReady).catch(() => { /* håndteres av events over */ })
  }

  // Eneste effect: start kamera én gang og enumerer enheter
  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera er ikke tilgjengelig. Sjekk at siden bruker HTTPS og at nettleseren har tillatelse.')
        return
      }
      try {
        // Start kamera direkte – behold strømmen (ikke stopp den!)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        attachStream(stream)

        // Enumerer kameraer i bakgrunnen – kun til dropdown-visning
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        setCameras(videoDevices)

        // Finn aktiv deviceId – kun for å markere riktig valg i dropdown
        const activeDeviceId =
          (stream.getVideoTracks()[0]?.getSettings() as { deviceId?: string })?.deviceId
          ?? videoDevices[0]?.deviceId
          ?? null
        setSelectedDeviceId(activeDeviceId)
      } catch (err: unknown) {
        if (cancelled) return
        const name = err instanceof Error ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Kameratilgang er blokkert. Gi tillatelse i nettleserens adresselinje og prøv igjen.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('Ingen kamera funnet. Koble til et kamera eller aktiver iPhone Continuity Camera.')
        } else {
          setError('Kunne ikke starte kamera. Sjekk at ingen andre apper bruker det, og prøv igjen.')
        }
      }
    }
    init()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Brukertriggert kamerabytte – kalles kun fra dropdown/flip-knapp
  async function switchToCamera(deviceId: string) {
    setSelectedDeviceId(deviceId)
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      })
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      attachStream(stream)
    } catch {
      setError('Kunne ikke bytte til det valgte kameraet. Prøv et annet.')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' })
          onCapture(file)
          onClose()
        }
      },
      'image/jpeg',
      0.9
    )
  }

  function flipCamera() {
    if (cameras.length < 2) return
    const idx = cameras.findIndex((c) => c.deviceId === selectedDeviceId)
    const next = cameras[(idx + 1) % cameras.length]
    switchToCamera(next.deviceId)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-black/60 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"
          title="Avbryt"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Kameravelger – synlig når flere kameraer finnes */}
        {cameras.length > 1 ? (
          <select
            value={selectedDeviceId ?? ''}
            onChange={(e) => switchToCamera(e.target.value)}
            className="bg-black/40 text-white text-xs rounded px-2 py-1 border border-white/20 max-w-[180px] truncate"
          >
            {cameras.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Kamera ${i + 1}`}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-white text-sm font-medium">Ta bilde</span>
        )}

        <button
          onClick={flipCamera}
          disabled={cameras.length < 2}
          className="p-2 rounded-full text-white hover:bg-white/10 transition-colors disabled:opacity-30"
          title="Bytt kamera"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>
      </div>

      {/* Video preview */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
            <Camera className="w-12 h-12 text-slate-600" />
            <p className="text-slate-300 text-sm text-center">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 transition-colors"
            >
              Lukk
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Shutter button */}
      <div className="flex items-center justify-center py-8 flex-shrink-0 bg-black/60 backdrop-blur-sm">
        <button
          onClick={capture}
          disabled={!ready}
          className="rounded-full bg-white border-[5px] border-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40"
          style={{ width: '72px', height: '72px' }}
          title="Ta bilde"
        />
      </div>
    </div>
  )
}

// ─── Draft Editor (new note, not yet saved to DB) ─────────────────────────────

function DraftEditor({
  onSave,
  onDiscard,
  onBack,
}: {
  onSave: (title: string, content: string, file?: File) => Promise<void>
  onDiscard: () => void
  onBack: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef = useRef(false)

  useEffect(() => { titleRef.current?.focus() }, [])

  function scheduleAutoSave(t: string, c: string) {
    if (savedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (!t.trim() && !c.trim()) return
    saveTimerRef.current = setTimeout(() => {
      if (!savedRef.current) {
        savedRef.current = true
        onSave(t, c)
      }
    }, 700)
  }

  function handleTitleChange(val: string) {
    setTitle(val)
    scheduleAutoSave(val, content)
  }

  function handleContentChange(val: string) {
    setContent(val)
    scheduleAutoSave(title, val)
  }

  async function handleFileSelect(file: File) {
    // Lagre notatet umiddelbart, med filen som skal lastes opp etter overgang
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (!savedRef.current) {
      savedRef.current = true
      await onSave(title, content, file)
    }
  }

  return (
    <>
      {showCamera && (
        <CameraModal
          onCapture={(file) => handleFileSelect(file)}
          onClose={() => setShowCamera(false)}
        />
      )}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Title row */}
        <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-slate-800 flex-shrink-0">
          {/* Tilbake-pil kun på mobil */}
          <button
            onClick={onBack}
            className="md:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Tilbake til listen"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Tittel"
            className="flex-1 bg-transparent text-lg font-semibold text-slate-100 placeholder:text-slate-600 outline-none"
          />
          <button
            onClick={onDiscard}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Forkast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={'Skriv notater her…\n\nBruk dette til å notere mulige aktiviteter, steder du vil besøke, restauranter, tips eller andre ting du vurderer å legge inn i turen.\n\nLim inn bilder med ⌘V eller last opp via ikonet nedenfor.'}
          className="flex-1 bg-transparent text-slate-300 text-sm px-4 md:px-6 py-4 resize-none outline-none placeholder:text-slate-700 leading-relaxed min-h-0"
        />

        {/* Footer – bildeopplasting + kamera */}
        <div className="px-4 md:px-6 py-2 border-t border-slate-800 flex-shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-slate-600 italic">Lagres automatisk når du begynner å skrive</p>
          <div className="flex items-center gap-1">
            {/* Kamera – åpner live kamera-modal */}
            <button
              onClick={() => setShowCamera(true)}
              title="Ta bilde med kamera"
              className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            {/* Galleri / fil */}
            <label
              title="Last opp bilde fra galleri"
              className="cursor-pointer p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
              />
              <ImageIcon className="w-4 h-4" />
            </label>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Note Editor ─────────────────────────────────────────────────────────────

type NoteUpdates = Partial<Pick<Note, 'title' | 'content' | 'stop_id' | 'note_date'>>

function NoteEditor({
  note,
  onUpdate,
  onRequestDelete,
  stops,
  onBack,
  pendingFile,
  onPendingFileConsumed,
}: {
  note: Note
  onUpdate: (id: string, updates: NoteUpdates) => void
  onRequestDelete: (id: string) => void
  stops: Stop[]
  onBack: () => void
  pendingFile?: File | null
  onPendingFileConsumed?: () => void
}) {
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content)
  const [stopId, setStopId] = useState<string | null>(note.stop_id)
  const [noteDate, setNoteDate] = useState<string | null>(note.note_date)
  const [showCamera, setShowCamera] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { images, isUploading, uploadImage, removeImage } = useNoteImages(note.id)

  // Last opp fil som ble valgt mens notatet ennå var et ulagret draft
  useEffect(() => {
    if (pendingFile) {
      uploadImage(pendingFile)
      onPendingFileConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedStop = stops.find((s) => s.id === stopId) ?? null
  const stopDates = selectedStop ? getStopDateRange(selectedStop) : []

  const scheduleSave = useCallback(
    (updates: NoteUpdates) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        onUpdate(note.id, updates)
      }, 700)
    },
    [note.id, onUpdate]
  )

  function handleTitleChange(val: string) {
    setTitle(val)
    scheduleSave({ title: val.trim() || null, content })
  }

  function handleContentChange(val: string) {
    setContent(val)
    scheduleSave({ title: title.trim() || null, content: val })
  }

  function handleStopChange(newStopId: string | null) {
    setStopId(newStopId)
    setNoteDate(null)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onUpdate(note.id, { stop_id: newStopId, note_date: null })
  }

  function handleDateToggle(date: string) {
    const newDate = noteDate === date ? null : date
    setNoteDate(newDate)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onUpdate(note.id, { note_date: newDate })
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) {
        const namedFile = new File([file], `paste-${Date.now()}.png`, { type: file.type })
        uploadImage(namedFile)
      }
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      uploadImage(file)
      e.target.value = ''
    }
  }

  const updatedLabel = new Date(note.updated_at).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      {showCamera && (
        <CameraModal
          onCapture={(file) => uploadImage(file)}
          onClose={() => setShowCamera(false)}
        />
      )}
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* Title row */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-slate-800 flex-shrink-0">
        {/* Tilbake-pil kun på mobil */}
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
          title="Tilbake til listen"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Tittel"
          className="flex-1 bg-transparent text-lg font-semibold text-slate-100 placeholder:text-slate-600 outline-none"
        />
        <button
          onClick={() => onRequestDelete(note.id)}
          className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors flex-shrink-0"
          title="Flytt til arkiv"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* City + date linking */}
      <div className="px-4 md:px-6 py-3 border-b border-slate-800 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 w-12 flex-shrink-0">By</span>
          <select
            value={stopId ?? ''}
            onChange={(e) => handleStopChange(e.target.value || null)}
            className="w-36 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-2 py-1.5 outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">— Ingen —</option>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>{s.city}</option>
            ))}
          </select>
        </div>

        {stopId && stopDates.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-slate-500 w-12 flex-shrink-0 pt-0.5">Dato</span>
            <div className="flex flex-wrap gap-1">
              {stopDates.map((date) => (
                <button
                  key={date}
                  onClick={() => handleDateToggle(date)}
                  className={[
                    'px-2 py-0.5 rounded text-[11px] transition-colors',
                    noteDate === date
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                  ].join(' ')}
                >
                  {formatShortDate(date)}
                </button>
              ))}
            </div>
          </div>
        )}

        {stopId && stopDates.length === 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 w-12 flex-shrink-0">Dato</span>
            <span className="text-[11px] text-slate-600 italic">Stopp har ingen dato satt</span>
          </div>
        )}
      </div>

      {/* Textarea + image gallery */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={'Skriv notater her…\n\nBruk dette til å notere mulige aktiviteter, steder du vil besøke, restauranter, tips eller andre ting du vurderer å legge inn i turen.\n\nLim inn bilder med ⌘V eller last opp via ikonet nedenfor.'}
          className="flex-1 bg-transparent text-slate-300 text-sm px-4 md:px-6 py-4 resize-none outline-none placeholder:text-slate-700 leading-relaxed min-h-0"
        />

        {images.length > 0 && (
          <div className="border-t border-slate-800 px-4 py-3 grid grid-cols-3 gap-2 max-h-52 overflow-y-auto flex-shrink-0">
            {images.map((img) => (
              <div key={img.id} className="relative group/img aspect-square">
                <img src={img.publicUrl} alt="" className="w-full h-full object-cover rounded-md" />
                <button
                  onClick={() => removeImage(img.id, img.storage_path)}
                  className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                  title="Slett bilde"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 md:px-6 py-2 border-t border-slate-800 flex-shrink-0 flex items-center justify-between">
        <p className="text-[11px] text-slate-600">Sist oppdatert {updatedLabel}</p>
        <div className="flex items-center gap-1">
          {/* Kamera – åpner live kamera-modal */}
          <button
            onClick={() => setShowCamera(true)}
            title="Ta bilde med kamera"
            className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          {/* Galleri / fil – lim inn med ⌘V støttes også */}
          <label
            title="Last opp bilde fra galleri (eller lim inn med ⌘V)"
            className="cursor-pointer p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            {isUploading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ImageIcon className="w-4 h-4" />
            }
          </label>
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  message,
  action,
  onBack,
}: {
  message: string
  action?: { label: string; onClick: () => void }
  onBack?: () => void
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tilbake-pil på mobil */}
      {onBack && (
        <div className="md:hidden px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake
          </button>
        </div>
      )}
      <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
        <div className="bg-slate-800 rounded-full p-5 mb-4">
          <FileText className="w-10 h-10 text-slate-600" />
        </div>
        <p className="text-slate-400 text-sm max-w-xs">{message}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
