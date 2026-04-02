'use client'

import { useState, useRef } from 'react'
import { FileText, X, Loader2, ImagePlus, Trash2, Pencil, Check } from 'lucide-react'
import { Stop, Note } from '@/types'
import { useNoteImages } from '@/hooks/useNoteImages'
import RichTextEditor, { RichTextRenderer } from '@/components/notes/RichTextEditor'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStopDateRange(stop: Stop): string[] {
  if (!stop.arrival_date) return []
  const dates: string[] = []
  for (let n = 0; n < Math.max(1, stop.nights); n++) {
    const d = new Date(stop.arrival_date + 'T12:00:00')
    d.setDate(d.getDate() + n)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

export interface NoteModalSaveData {
  title: string | null
  content: string
  stop_id: string | null
  note_date: string | null
}

interface NoteModalProps {
  mode: 'new' | 'edit'
  note?: Note
  stopId?: string | null
  initialDate?: string | null
  stops: Stop[]
  /** When set, the note is linked to a specific entity (activity / dining / possible).
   *  The stop/date selector is hidden and a context label is shown instead. */
  entityTitle?: string
  entityType?: 'activity' | 'dining' | 'possible'
  onSave: (data: NoteModalSaveData) => void
  onDelete?: () => void
  onClose: () => void
}

export default function NoteModal({
  mode, note, stopId, initialDate, stops, entityTitle, entityType, onSave, onDelete, onClose,
}: NoteModalProps) {
  const [title, setTitle]     = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    note?.stop_id ?? stopId ?? null
  )
  const [noteDate, setNoteDate] = useState<string | null>(
    note?.note_date ?? initialDate ?? null
  )
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  // New notes start in edit mode; existing notes start in read mode
  const [isEditing, setIsEditing] = useState(mode === 'new')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { images, isUploading, uploadImage, removeImage } = useNoteImages(
    mode === 'edit' && note ? note.id : null
  )

  const showImagePanel = mode === 'edit' && note != null

  const stop = selectedStopId ? stops.find((s) => s.id === selectedStopId) ?? null : null
  const stopDates = stop ? getStopDateRange(stop) : []

  function handleStopChange(newStopId: string | null) {
    setSelectedStopId(newStopId)
    if (noteDate) {
      const newStop = newStopId ? stops.find((s) => s.id === newStopId) : null
      const newDates = newStop ? getStopDateRange(newStop) : []
      if (!newDates.includes(noteDate)) setNoteDate(null)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await uploadImage(file)
    e.target.value = ''
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full flex overflow-hidden ${
            showImagePanel ? 'max-w-2xl' : 'max-w-sm'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Left: Note form ────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-slate-100">
                    {mode === 'new' ? 'Nytt notat' : (isEditing ? 'Rediger notat' : 'Notat')}
                  </span>
                  {entityTitle && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {entityType === 'activity' ? '🎟 ' : entityType === 'dining' ? '🍽️ ' : '💡 '}
                      {entityTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle edit/read mode (only for existing notes) */}
                {mode === 'edit' && (
                  <button
                    onClick={() => setIsEditing((v) => !v)}
                    title={isEditing ? 'Bytt til lesemodus' : 'Rediger notat'}
                    className={`p-1.5 rounded-md transition-colors ${
                      isEditing
                        ? 'text-amber-400 bg-amber-900/30 hover:bg-amber-900/50'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
              {/* Title */}
              {isEditing ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tittel (valgfritt)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                />
              ) : (
                title && (
                  <p className="text-sm font-semibold text-slate-100">{title}</p>
                )
              )}

              {/* Content — read mode or edit mode */}
              {isEditing ? (
                <div className="rounded-lg border border-slate-700 overflow-hidden bg-slate-800 focus-within:border-amber-500/60 transition-colors min-h-[180px]">
                  <RichTextEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Skriv notat her…"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="min-h-[4rem]">
                  {content
                    ? <RichTextRenderer html={content} className="text-sm" />
                    : <span className="text-slate-600 italic text-sm">Ingen tekst</span>
                  }
                </div>
              )}

              {/* City selector — hidden when note is entity-linked */}
              {isEditing && stops.length > 1 && !entityTitle && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">By</p>
                  <select
                    value={selectedStopId ?? ''}
                    onChange={(e) => handleStopChange(e.target.value || null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                  >
                    <option value="">— Ingen by (turnotat) —</option>
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>{s.city}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date picker — hidden when note is entity-linked */}
              {isEditing && stopDates.length > 0 && !entityTitle && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Dato</p>
                  <div className="flex flex-wrap gap-1">
                    {stopDates.map((d) => {
                      const label = new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setNoteDate(d === noteDate ? null : d)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            d === noteDate
                              ? 'bg-amber-700 border-amber-600 text-white'
                              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {!noteDate && (
                    <p className="text-[10px] text-slate-600 mt-1">Vises på første dag i {stop?.city}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => onSave({ title: title.trim() || null, content, stop_id: selectedStopId, note_date: noteDate })}
                    disabled={!content.trim()}
                    className="flex-1 h-8 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    Lagre
                  </button>
                  {onDelete && (
                    <button
                      onClick={onDelete}
                      className="px-3 h-8 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-900/30 text-xs transition-colors"
                    >
                      Slett
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-3 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors"
                  >
                    Avbryt
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors"
                >
                  Lukk
                </button>
              )}
            </div>
          </div>

          {/* ── Right: Image panel (edit mode only) ────────────────────── */}
          {showImagePanel && (
            <div className="w-56 flex-shrink-0 border-l border-slate-800 flex flex-col">
              <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2">
                <ImagePlus className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400">Bilder</span>
                {images.length > 0 && (
                  <span className="text-slate-600 text-xs">({images.length})</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {images.length === 0 && !isUploading && (
                  <p className="text-[11px] text-slate-600 text-center mt-6 leading-relaxed">
                    Ingen bilder ennå.<br />Last opp et bilde nedenfor.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      <button
                        type="button"
                        onClick={() => setLightboxSrc(img.publicUrl)}
                        className="w-full h-full"
                      >
                        <img
                          src={img.publicUrl}
                          alt="Notatbilde"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(img.id, img.storage_path)}
                        title="Slett bilde"
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {isUploading && (
                    <div className="aspect-square rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 border-t border-slate-800">
                <label className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-colors cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Last opp
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="Forstørret bilde"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  )
}
