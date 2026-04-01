'use client'

import { TripMemory, Trip } from '@/types'
import { BookHeart, Globe, Lock, Sparkles, Trash2, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

interface Props {
  memory: TripMemory | null
  trip: Trip
  onGenerate: () => Promise<void>
  onDelete?: () => Promise<void>
  generating?: boolean
}

export default function MemoryBookCard({ memory, trip, onGenerate, onDelete, generating }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hasMemory = !!memory
  const nights    = memory?.total_nights
  const stops     = memory?.total_stops
  const km        = memory?.total_km

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/80 flex flex-col"
      style={{ minHeight: 260 }}
    >
      {/* Forsidebilde / gradient-bakgrunn */}
      <div
        className="h-36 relative flex-shrink-0"
        style={{
          background: memory?.cover_image_url
            ? `url(${memory.cover_image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #1e3a2f 0%, #2d1b4e 50%, #1a2744 100%)',
        }}
      >
        {/* Gradientoverlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />

        {/* Offentlig/privat badge */}
        {hasMemory && (
          <div className="absolute top-3 right-3">
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                memory!.is_public
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-slate-700/80 text-slate-300'
              }`}
            >
              {memory!.is_public ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
              {memory!.is_public ? 'Offentlig' : 'Privat'}
            </span>
          </div>
        )}

        {/* Turens navn */}
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-white font-bold text-base leading-tight line-clamp-2 drop-shadow-md">
            {memory?.title ?? trip.name}
          </p>
          {(trip.date_from || trip.date_to) && (
            <p className="text-white/70 text-xs mt-0.5">
              {trip.date_from?.slice(0, 7).replace('-', '/')} – {trip.date_to?.slice(0, 7).replace('-', '/')}
            </p>
          )}
        </div>
      </div>

      {/* Innhold */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Statistikk */}
        {hasMemory && (nights || stops || km) ? (
          <div className="flex gap-3 text-xs text-slate-400">
            {stops  != null && <span>📍 {stops} stopp</span>}
            {nights != null && <span>🌙 {nights} netter</span>}
            {km     != null && <span>🚗 {Math.round(km).toLocaleString('nb-NO')} km</span>}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            {hasMemory ? 'Trykk Generer for å lage innhold' : 'Ingen minnebok ennå'}
          </p>
        )}

        {/* Sammendrag-preview */}
        {memory?.summary && (
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
            {memory.summary}
          </p>
        )}

        {/* Handlingsknapper */}
        <div className="flex gap-2 mt-auto pt-1 flex-wrap">
          {hasMemory ? (
            <>
              <Link
                href={`/minner/${memory!.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
              >
                Åpne minnebok <ArrowRight className="w-3 h-3" />
              </Link>
              <button
                onClick={onGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Genererer…
                  </span>
                ) : (
                  <><Sparkles className="w-3 h-3" /> Regenerer</>
                )}
              </button>
              {onDelete && (
                confirmDelete ? (
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-red-400">Sikker?</span>
                    <button onClick={onDelete} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs">Ja</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs">Nei</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </>
          ) : (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Oppretter og genererer…
                </span>
              ) : (
                <><BookHeart className="w-3 h-3" /> Opprett minnebok</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
