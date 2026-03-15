'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Trash2, FileText, ImageIcon, Loader2, X } from 'lucide-react'
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
  const { notes, addNote, updateNote, deleteNote } = useNotes(
    currentTrip?.id ?? null
  )
  const { stops } = useStops(currentTrip?.id ?? null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

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

  // Auto-select first note when notes load (and nothing is selected)
  useEffect(() => {
    if (sortedNotes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(sortedNotes[0].id)
    }
  }, [sortedNotes, selectedNoteId])

  // Clear selected note when trip changes
  useEffect(() => {
    setSelectedNoteId(null)
  }, [currentTrip?.id])

  async function handleAddNote() {
    const note = await addNote({ content: '', title: null, stop_id: null, note_date: null })
    if (note) setSelectedNoteId(note.id)
  }

  async function handleDeleteNote(id: string) {
    await deleteNote(id)
    if (selectedNoteId === id) {
      const remaining = sortedNotes.filter((n) => n.id !== id)
      setSelectedNoteId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
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
          ) : sortedNotes.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-600">Ingen notater ennå</p>
              <button
                onClick={handleAddNote}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Opprett notat
              </button>
            </div>
          ) : (
            sortedNotes.map((note) => (
              <div
                key={note.id}
                className={[
                  'flex items-stretch border-b border-slate-800/50 group/note',
                  note.id === selectedNoteId
                    ? 'bg-slate-800 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-800/40',
                ].join(' ')}
              >
                {/* Main click area */}
                <button
                  onClick={() => setSelectedNoteId(note.id)}
                  className="flex-1 min-w-0 text-left px-4 py-3 transition-colors"
                >
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {note.title || 'Uten tittel'}
                  </p>
                  {/* City + date info (no content preview) */}
                  {note.stop_id ? (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {stopNameMap[note.stop_id] ?? ''}
                      {note.note_date ? ` · ${formatShortDate(note.note_date)}` : ''}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5 italic">Turnotat</p>
                  )}
                </button>

                {/* Delete button (visible on hover) */}
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="opacity-0 group-hover/note:opacity-100 transition-opacity px-2 text-slate-600 hover:text-red-400 flex-shrink-0"
                  title="Slett notat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Editor area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {!currentTrip ? (
          <EmptyState message="Velg en tur til venstre for å se notater" />
        ) : !selectedNote ? (
          <EmptyState
            message="Velg et notat eller opprett et nytt"
            action={{ label: '+ Nytt notat', onClick: handleAddNote }}
          />
        ) : (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onUpdate={updateNote}
            onDelete={handleDeleteNote}
            stops={stops}
          />
        )}
      </div>
    </div>
  )
}

// ─── Note Editor ─────────────────────────────────────────────────────────────

type NoteUpdates = Partial<Pick<Note, 'title' | 'content' | 'stop_id' | 'note_date'>>

function NoteEditor({
  note,
  onUpdate,
  onDelete,
  stops,
}: {
  note: Note
  onUpdate: (id: string, updates: NoteUpdates) => void
  onDelete: (id: string) => void
  stops: Stop[]
}) {
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content)
  const [stopId, setStopId] = useState<string | null>(note.stop_id)
  const [noteDate, setNoteDate] = useState<string | null>(note.note_date)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { images, isUploading, uploadImage, removeImage } = useNoteImages(note.id)

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

  // Handle image paste (Cmd+V with image in clipboard)
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
    // Non-image paste falls through to textarea natively
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      uploadImage(file)
      e.target.value = '' // allow re-uploading the same file
    }
  }

  const updatedLabel = new Date(note.updated_at).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* Title row */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Tittel"
          className="flex-1 bg-transparent text-lg font-semibold text-slate-100 placeholder:text-slate-600 outline-none"
        />
        <button
          onClick={() => onDelete(note.id)}
          className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors flex-shrink-0"
          title="Slett notat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* City + date linking */}
      <div className="px-6 py-3 border-b border-slate-800 flex-shrink-0 space-y-2">
        {/* City selector */}
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

        {/* Date picker — shown when stop with dates is selected */}
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
          className="flex-1 bg-transparent text-slate-300 text-sm px-6 py-4 resize-none outline-none placeholder:text-slate-700 leading-relaxed min-h-0"
        />

        {/* Image gallery (shown when images exist) */}
        {images.length > 0 && (
          <div className="border-t border-slate-800 px-4 py-3 grid grid-cols-3 gap-2 max-h-52 overflow-y-auto flex-shrink-0">
            {images.map((img) => (
              <div key={img.id} className="relative group/img aspect-square">
                <img
                  src={img.publicUrl}
                  alt=""
                  className="w-full h-full object-cover rounded-md"
                />
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
      <div className="px-6 py-2 border-t border-slate-800 flex-shrink-0 flex items-center justify-between">
        <p className="text-[11px] text-slate-600">Sist oppdatert {updatedLabel}</p>
        <label
          title="Last opp bilde (eller lim inn med ⌘V)"
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
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  message,
  action,
}: {
  message: string
  action?: { label: string; onClick: () => void }
}) {
  return (
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
  )
}
