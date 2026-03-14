'use client'

import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { Stop, Note } from '@/types'

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
  onSave: (data: NoteModalSaveData) => void
  onDelete?: () => void
  onClose: () => void
}

export default function NoteModal({
  mode, note, stopId, initialDate, stops, onSave, onDelete, onClose,
}: NoteModalProps) {
  const [title, setTitle]     = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    note?.stop_id ?? stopId ?? null
  )
  const [noteDate, setNoteDate] = useState<string | null>(
    note?.note_date ?? initialDate ?? null
  )

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-100">
              {mode === 'new' ? 'Nytt notat' : 'Rediger notat'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tittel (valgfritt)"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Skriv notat her…"
            rows={5}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors resize-none"
          />

          {/* City selector – only shown when there are multiple stops to choose from */}
          {stops.length > 1 && (
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

          {/* Date picker – only shown when a stop with dates is selected */}
          {stopDates.length > 0 && (
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
        </div>
      </div>
    </div>
  )
}
