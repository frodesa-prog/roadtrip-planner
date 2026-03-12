'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Plus, Trash2, FileText } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useNotes } from '@/hooks/useNotes'
import TripManager from '@/components/planning/TripManager'
import { Note } from '@/types'

export default function NotesPage() {
  const {
    trips, currentTrip, loading: tripsLoading,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { notes, loading: notesLoading, addNote, updateNote, deleteNote } = useNotes(
    currentTrip?.id ?? null
  )
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  // Auto-select first note when notes load (and nothing is selected)
  useEffect(() => {
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id)
    }
  }, [notes, selectedNoteId])

  // Clear selected note when trip changes
  useEffect(() => {
    setSelectedNoteId(null)
  }, [currentTrip?.id])

  async function handleAddNote() {
    const note = await addNote()
    if (note) setSelectedNoteId(note.id)
  }

  async function handleDeleteNote(id: string) {
    await deleteNote(id)
    if (selectedNoteId === id) {
      const remaining = notes.filter((n) => n.id !== id)
      setSelectedNoteId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading}
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
          {notesLoading ? (
            <div className="flex items-center justify-center h-24 gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : !currentTrip ? (
            <p className="px-4 py-6 text-xs text-slate-600 text-center">Velg en tur</p>
          ) : notes.length === 0 ? (
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
            notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={[
                  'w-full text-left px-4 py-3 border-b border-slate-800/50 transition-colors',
                  note.id === selectedNoteId
                    ? 'bg-slate-800 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-800/50',
                ].join(' ')}
              >
                <p className="text-xs font-medium text-slate-200 truncate">
                  {note.title || 'Uten tittel'}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5 leading-relaxed">
                  {note.content || '…'}
                </p>
              </button>
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
          />
        )}
      </div>
    </div>
  )
}

// ─── Note Editor ─────────────────────────────────────────────────────────────

function NoteEditor({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note
  onUpdate: (id: string, updates: Partial<Pick<Note, 'title' | 'content'>>) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (updates: Partial<Pick<Note, 'title' | 'content'>>) => {
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

  const updatedLabel = new Date(note.updated_at).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
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

      {/* Content area */}
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder="Skriv notater her…&#10;&#10;Bruk dette til å notere mulige aktiviteter, steder du vil besøke, restauranter, tips eller andre ting du vurderer å legge inn i turen."
        className="flex-1 bg-transparent text-slate-300 text-sm px-6 py-4 resize-none outline-none placeholder:text-slate-700 leading-relaxed"
      />

      {/* Footer */}
      <div className="px-6 py-2 border-t border-slate-800 flex-shrink-0">
        <p className="text-[11px] text-slate-600">Sist oppdatert {updatedLabel}</p>
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
