'use client'

import { useState, useMemo } from 'react'
import { Trash2, RotateCcw, Archive, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { useTrips } from '@/hooks/useTrips'
import { useArchivedNotes } from '@/hooks/useNotes'
import { useStops } from '@/hooks/useStops'
import TripManager from '@/components/planning/TripManager'
import { Note } from '@/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NotesArchivePage() {
  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { archivedNotes, deleteNotePermanently, restoreNote } = useArchivedNotes(
    currentTrip?.id ?? null
  )
  const { stops } = useStops(currentTrip?.id ?? null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const stopNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    stops.forEach((s) => { map[s.id] = s.city })
    return map
  }, [stops])

  const selectedNote = archivedNotes.find((n) => n.id === selectedNoteId) ?? null

  async function handleRestore(id: string) {
    await restoreNote(id)
    if (selectedNoteId === id) setSelectedNoteId(null)
  }

  async function handleDeletePermanently(id: string) {
    await deleteNotePermanently(id)
    if (selectedNoteId === id) setSelectedNoteId(null)
    setConfirmDeleteId(null)
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Permanent delete confirmation ────────────────────────────────── */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-slate-100 mb-1.5">Slett permanent?</h2>
            <p className="text-xs text-slate-400 mb-5">
              Dette kan ikke angres. Notatet vil bli slettet for godt.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleDeletePermanently(confirmDeleteId)}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Slett permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading} userId={userId}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />

        {/* Archive header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
          <Archive className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Arkiv</p>
        </div>

        {/* Archived note list */}
        <div className="flex-1 overflow-y-auto">
          {!currentTrip ? (
            <p className="px-4 py-6 text-xs text-slate-600 text-center">Velg en tur</p>
          ) : archivedNotes.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-600">Ingen arkiverte notater</p>
            </div>
          ) : (
            archivedNotes.map((note) => (
              <div
                key={note.id}
                className={[
                  'flex items-stretch border-b border-slate-800/50 group/note',
                  note.id === selectedNoteId
                    ? 'bg-slate-800 border-l-2 border-l-slate-500'
                    : 'hover:bg-slate-800/40',
                ].join(' ')}
              >
                <button
                  onClick={() => setSelectedNoteId(note.id === selectedNoteId ? null : note.id)}
                  className="flex-1 min-w-0 text-left px-4 py-3 transition-colors"
                >
                  <p className="text-xs font-medium text-slate-400 truncate">
                    {note.title || 'Uten tittel'}
                  </p>
                  {note.stop_id ? (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">
                      {stopNameMap[note.stop_id] ?? ''}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5 italic">Turnotat</p>
                  )}
                  {note.archived_at && (
                    <p className="text-[10px] text-slate-700 mt-0.5">
                      Arkivert {formatDate(note.archived_at)}
                    </p>
                  )}
                </button>

                {/* Action buttons (visible on hover) */}
                <div className="opacity-0 group-hover/note:opacity-100 transition-opacity flex flex-col justify-center gap-0.5 pr-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(note.id)}
                    className="p-1 text-slate-600 hover:text-emerald-400 transition-colors"
                    title="Gjenopprett notat"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(note.id)}
                    className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                    title="Slett permanent"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Back to notes */}
        <div className="border-t border-slate-800 p-3 flex-shrink-0">
          <Link
            href="/notes"
            className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tilbake til notater
          </Link>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {!currentTrip ? (
          <CenteredMessage icon={<Archive className="w-10 h-10 text-slate-600" />} message="Velg en tur for å se arkiverte notater" />
        ) : !selectedNote ? (
          <CenteredMessage icon={<Archive className="w-10 h-10 text-slate-600" />} message="Velg et arkivert notat for å se innholdet" />
        ) : (
          <ArchivedNoteView
            note={selectedNote}
            onRestore={() => handleRestore(selectedNote.id)}
            onDelete={() => setConfirmDeleteId(selectedNote.id)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Archived Note View ───────────────────────────────────────────────────────

function ArchivedNoteView({
  note,
  onRestore,
  onDelete,
}: {
  note: Note
  onRestore: () => void
  onDelete: () => void
}) {
  const archivedLabel = note.archived_at
    ? formatDate(note.archived_at)
    : '—'

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-slate-400 truncate">
            {note.title || 'Uten tittel'}
          </h1>
          <p className="text-[11px] text-slate-600 mt-0.5">Arkivert {archivedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 text-xs font-medium rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Gjenopprett
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 border border-red-800/40 text-red-400 hover:bg-red-950/60 text-xs font-medium rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Slett permanent
          </button>
        </div>
      </div>

      {/* Content (read-only) */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {note.content ? (
          <pre className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {note.content}
          </pre>
        ) : (
          <p className="text-slate-600 italic text-sm">Tomt notat</p>
        )}
      </div>
    </div>
  )
}

// ─── Centered message ─────────────────────────────────────────────────────────

function CenteredMessage({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
      <div className="bg-slate-800 rounded-full p-5 mb-4">{icon}</div>
      <p className="text-slate-400 text-sm max-w-xs">{message}</p>
    </div>
  )
}
