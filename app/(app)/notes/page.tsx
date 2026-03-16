'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Trash2, FileText, ImageIcon, Loader2, X, Archive, ArrowLeft, Camera } from 'lucide-react'
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

// ─── Camera (getUserMedia, DOM-basert) ──────────────────────────────────────
//
// Bruker getUserMedia med { video: true } som standard (FaceTime/innebygd kamera).
// IKKE facingMode: 'environment' – det trigger Continuity Camera som feiler
// med "capture failure" på deployede HTTPS-sider.
// Brukeren kan manuelt bytte til Continuity Camera via dropdown.

let _cameraModal: HTMLDivElement | null = null
let _cameraVideo: HTMLVideoElement | null = null
let _cameraStream: MediaStream | null = null
let _resolveCapture: ((file: File | null) => void) | null = null

function ensureCameraModal(): { modal: HTMLDivElement; video: HTMLVideoElement } {
  if (_cameraModal && _cameraVideo) return { modal: _cameraModal, video: _cameraVideo }

  const modal = document.createElement('div')
  modal.id = 'camera-modal'
  modal.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:#000;display:none;flex-direction:column;'

  // Header med lukk + kameravelger
  const header = document.createElement('div')
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;flex-shrink:0;background:rgba(0,0,0,0.6);'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = 'background:none;border:none;color:#fff;font-size:20px;padding:8px;cursor:pointer;'
  closeBtn.onclick = () => closeCameraModal(null)

  const cameraSelect = document.createElement('select')
  cameraSelect.id = 'cam-select'
  cameraSelect.style.cssText =
    'background:rgba(0,0,0,0.4);color:#fff;font-size:12px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 8px;max-width:220px;outline:none;'
  cameraSelect.innerHTML = '<option value="">Laster...</option>'
  cameraSelect.onchange = () => {
    if (cameraSelect.value) switchToCamera(cameraSelect.value)
  }

  const spacer = document.createElement('div')
  spacer.style.width = '36px'
  header.append(closeBtn, cameraSelect, spacer)

  // Video
  const videoWrap = document.createElement('div')
  videoWrap.style.cssText = 'flex:1;position:relative;overflow:hidden;'

  const video = document.createElement('video')
  video.autoplay = true
  video.playsInline = true
  video.muted = true
  video.style.cssText = 'width:100%;height:100%;object-fit:cover;'

  const spinner = document.createElement('div')
  spinner.id = 'cam-spinner'
  spinner.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);'
  spinner.innerHTML =
    '<div style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:cam-spin 1s linear infinite;"></div>'

  if (!document.getElementById('cam-spin-style')) {
    const s = document.createElement('style')
    s.id = 'cam-spin-style'
    s.textContent = '@keyframes cam-spin{to{transform:rotate(360deg)}}'
    document.head.appendChild(s)
  }
  videoWrap.append(video, spinner)

  // Footer med shutter + iPhone-knapp
  const footer = document.createElement('div')
  footer.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:24px;padding:24px 16px;flex-shrink:0;background:rgba(0,0,0,0.6);'

  // iPhone-knapp (åpner filvelger med Continuity Camera i sidepanelet)
  const iphoneBtn = document.createElement('button')
  iphoneBtn.id = 'cam-iphone-btn'
  iphoneBtn.innerHTML = '<span style="font-size:20px;">📱</span><span style="font-size:11px;display:block;margin-top:2px;">iPhone</span>'
  iphoneBtn.style.cssText =
    'background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:12px;padding:10px 16px;cursor:pointer;text-align:center;transition:background 0.2s;'
  iphoneBtn.onmouseenter = () => { iphoneBtn.style.background = 'rgba(255,255,255,0.1)' }
  iphoneBtn.onmouseleave = () => { iphoneBtn.style.background = 'none' }
  iphoneBtn.onclick = () => {
    // Åpner filvelger – macOS sin Continuity Camera vises i sidepanelet
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.style.display = 'none'
    document.body.appendChild(inp)
    inp.onchange = () => {
      const f = inp.files?.[0]
      document.body.removeChild(inp)
      if (f) closeCameraModal(f)
    }
    // Håndter avbryt
    const onFocus = () => {
      setTimeout(() => { if (document.body.contains(inp)) document.body.removeChild(inp) }, 500)
      window.removeEventListener('focus', onFocus)
    }
    window.addEventListener('focus', onFocus)
    inp.click()
  }

  // Shutter-knapp (webkamera)
  const shutter = document.createElement('button')
  shutter.id = 'cam-shutter'
  shutter.disabled = true
  shutter.style.cssText =
    'width:72px;height:72px;border-radius:50%;background:#fff;border:5px solid #94a3b8;cursor:pointer;opacity:0.4;transition:opacity 0.2s;'
  shutter.onclick = () => takeSnapshot()

  footer.append(iphoneBtn, shutter)

  modal.append(header, videoWrap, footer)
  document.body.appendChild(modal)

  _cameraModal = modal
  _cameraVideo = video
  return { modal, video }
}

function closeCameraModal(file: File | null) {
  if (_cameraStream) {
    _cameraStream.getTracks().forEach((t) => t.stop())
    _cameraStream = null
  }
  if (_cameraModal) _cameraModal.style.display = 'none'
  if (_cameraVideo) _cameraVideo.srcObject = null
  if (_resolveCapture) {
    _resolveCapture(file)
    _resolveCapture = null
  }
}

function takeSnapshot() {
  if (!_cameraVideo || !_cameraVideo.videoWidth) return
  const c = document.createElement('canvas')
  c.width = _cameraVideo.videoWidth
  c.height = _cameraVideo.videoHeight
  c.getContext('2d')?.drawImage(_cameraVideo, 0, 0)
  c.toBlob((blob) => {
    if (blob) closeCameraModal(new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }, 'image/jpeg', 0.9)
}

// Start kamerastream – bruker FaceTime/innebygd kamera (ingen stabilitetsjekk nødvendig)
async function startStream(video: HTMLVideoElement, deviceId?: string) {
  if (_cameraStream) {
    _cameraStream.getTracks().forEach((t) => t.stop())
    _cameraStream = null
  }

  const constraints: MediaStreamConstraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : true,
    audio: false,
  }

  _cameraStream = await navigator.mediaDevices.getUserMedia(constraints)
  video.srcObject = _cameraStream
  await video.play()
}

async function switchToCamera(deviceId: string) {
  if (!_cameraVideo) return
  const spinner = document.getElementById('cam-spinner')
  const shutter = document.getElementById('cam-shutter') as HTMLButtonElement | null
  if (spinner) spinner.style.display = 'flex'
  if (shutter) { shutter.disabled = true; shutter.style.opacity = '0.4' }

  try {
    await startStream(_cameraVideo, deviceId)
  } catch (err) {
    console.error('[Camera] Switch failed:', err)
  }
}

async function populateCameras() {
  const sel = document.getElementById('cam-select') as HTMLSelectElement | null
  if (!sel) return
  try {
    const prevOnChange = sel.onchange
    sel.onchange = null

    const devices = await navigator.mediaDevices.enumerateDevices()
    // Filtrer bort Continuity Camera (feiler på deployede sider)
    const cams = devices.filter((d) =>
      d.kind === 'videoinput' &&
      !/(continuity|iphone|ipad|bordvisning|desk\s*view)/i.test(d.label)
    )
    sel.innerHTML = ''
    if (cams.length <= 1) {
      // Bare ett innebygd kamera – skjul dropdown
      sel.style.display = 'none'
    } else {
      sel.style.display = ''
      cams.forEach((cam, i) => {
        const opt = document.createElement('option')
        opt.value = cam.deviceId
        opt.textContent = cam.label || `Kamera ${i + 1}`
        sel.appendChild(opt)
      })
      if (_cameraStream) {
        const activeId = _cameraStream.getVideoTracks()[0]?.getSettings()?.deviceId
        if (activeId) sel.value = activeId
      }
    }

    sel.onchange = prevOnChange
  } catch { /* ignorer */ }
}

async function openCameraCapture(): Promise<File | null> {
  const { modal, video } = ensureCameraModal()

  // Vis modal
  modal.style.display = 'flex'
  const spinner = document.getElementById('cam-spinner')
  const shutter = document.getElementById('cam-shutter') as HTMLButtonElement | null
  if (spinner) {
    spinner.style.display = 'flex'
    spinner.innerHTML =
      '<div style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:cam-spin 1s linear infinite;"></div>'
  }
  if (shutter) { shutter.disabled = true; shutter.style.opacity = '0.4' }

  function onReady() {
    if (spinner) spinner.style.display = 'none'
    if (shutter) { shutter.disabled = false; shutter.style.opacity = '1' }
  }
  video.onloadeddata = onReady
  video.onplaying = onReady

  // Start FaceTime-kamera direkte (ingen fallback-loop)
  try {
    await startStream(video)
    populateCameras()
  } catch (err) {
    console.error('[Camera] Camera failed:', err)
    if (spinner) {
      spinner.style.display = 'flex'
      spinner.innerHTML = '<p style="color:#f87171;font-size:14px;text-align:center;padding:20px;">Kunne ikke starte webkamera.<br>Bruk 📱 iPhone-knappen for å ta bilde med telefonen.</p>'
    }
  }

  return new Promise<File | null>((resolve) => {
    _resolveCapture = resolve
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
      if (!savedRef.current) { savedRef.current = true; onSave(t, c) }
    }, 700)
  }

  function handleTitleChange(val: string) { setTitle(val); scheduleAutoSave(val, content) }
  function handleContentChange(val: string) { setContent(val); scheduleAutoSave(title, val) }

  async function handleFileSelect(file: File) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (!savedRef.current) { savedRef.current = true; await onSave(title, content, file) }
  }

  // Native kamera via capture="environment" – pålitelig med Continuity Camera
  async function handleOpenCamera() {
    const file = await openCameraCapture()
    if (file) handleFileSelect(file)
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Title row */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0" title="Tilbake til listen">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input ref={titleRef} value={title} onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Tittel" className="flex-1 bg-transparent text-lg font-semibold text-slate-100 placeholder:text-slate-600 outline-none" />
        <button onClick={onDiscard} className="p-1.5 rounded-md text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors flex-shrink-0" title="Forkast">
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea value={content} onChange={(e) => handleContentChange(e.target.value)}
        placeholder={'Skriv notater her…\n\nBruk dette til å notere mulige aktiviteter, steder du vil besøke, restauranter, tips eller andre ting du vurderer å legge inn i turen.\n\nLim inn bilder med ⌘V eller last opp via ikonet nedenfor.'}
        className="flex-1 bg-transparent text-slate-300 text-sm px-4 md:px-6 py-4 resize-none outline-none placeholder:text-slate-700 leading-relaxed min-h-0" />

      <div className="px-4 md:px-6 py-2 border-t border-slate-800 flex-shrink-0 flex items-center justify-between">
        <p className="text-[11px] text-slate-600 italic">Lagres automatisk når du begynner å skrive</p>
        <div className="flex items-center gap-1">
          <button onClick={handleOpenCamera} title="Ta bilde med kamera"
            className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors">
            <Camera className="w-4 h-4" />
          </button>
          <label title="Last opp bilde fra galleri" className="cursor-pointer p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }} />
            <ImageIcon className="w-4 h-4" />
          </label>
        </div>
      </div>
    </div>
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

  // Native kamera via capture="environment" – pålitelig med Continuity Camera
  async function handleOpenCamera() {
    const file = await openCameraCapture()
    if (file) uploadImage(file)
  }

  return (
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
            onClick={handleOpenCamera}
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
