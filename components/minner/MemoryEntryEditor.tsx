'use client'

import { MemoryEntry } from '@/types'
import { useTripMemories } from '@/hooks/useTripMemories'
import { useState } from 'react'
import { Pencil, Check, Smile } from 'lucide-react'

const MOOD_EMOJIS = ['🌟', '🥳', '🌄', '😄', '🏕️', '🎉', '🤩', '🥰', '🌊', '🏔️']

interface Props {
  entry: MemoryEntry
  onUpdate: (entryId: string, patch: { diary_text?: string; highlight?: string; mood_emoji?: string }) => void
}

export default function MemoryEntryEditor({ entry, onUpdate }: Props) {
  const [editing, setEditing]       = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [localText, setLocalText]   = useState(entry.diary_text ?? '')

  function handleTextChange(val: string) {
    setLocalText(val)
    onUpdate(entry.id, { diary_text: val })
  }

  return (
    <div className="relative">
      {/* Dagboktekst */}
      <div className="relative group">
        {editing ? (
          <div className="relative">
            <textarea
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full min-h-[140px] bg-slate-800/60 border border-amber-700/40 rounded-xl p-4 text-sm text-slate-200 leading-relaxed resize-none focus:outline-none focus:border-amber-500/60 transition-colors"
              placeholder="Skriv dine minner fra dette stedet…"
            />
            <button
              onClick={() => setEditing(false)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => setEditing(true)}
            className="relative cursor-pointer p-4 rounded-xl bg-slate-800/40 border border-transparent hover:border-amber-700/30 transition-all group"
          >
            {localText ? (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{localText}</p>
            ) : (
              <p className="text-sm text-slate-500 italic">Ingen dagbokinnføring ennå. Klikk for å skrive eller generer med AI.</p>
            )}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="w-3.5 h-3.5 text-amber-500/70" />
            </div>
          </div>
        )}
      </div>

      {/* Høydepunkt */}
      {entry.highlight && (
        <div className="mt-2 px-4 py-2 rounded-lg bg-amber-900/30 border border-amber-700/30">
          <p className="text-xs text-amber-300/90">
            ✨ <span className="font-medium">Høydepunkt:</span> {entry.highlight}
          </p>
        </div>
      )}

      {/* Humørvelger */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setShowEmojis(!showEmojis)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
        >
          {entry.mood_emoji ?? <Smile className="w-3.5 h-3.5" />}
          <span className="text-slate-400">Stemning</span>
        </button>

        {showEmojis && (
          <div className="flex flex-wrap gap-1">
            {MOOD_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { onUpdate(entry.id, { mood_emoji: e }); setShowEmojis(false) }}
                className={`w-7 h-7 rounded-lg hover:bg-slate-700 text-base flex items-center justify-center transition-colors ${
                  entry.mood_emoji === e ? 'bg-amber-700/40' : ''
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
