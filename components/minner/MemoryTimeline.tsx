'use client'

import { TripMemory, MemoryEntry, Stop } from '@/types'
import { useMemoryPhotos } from '@/hooks/useMemoryPhotos'
import MemoryEntryEditor from './MemoryEntryEditor'
import PhotoGrid from './PhotoGrid'
import PhotoUploadZone from './PhotoUploadZone'
import { MapPin, Moon } from 'lucide-react'

interface Props {
  memory: TripMemory
  entries: MemoryEntry[]
  stops: Stop[]
  onUpdateEntry: (entryId: string, patch: { diary_text?: string; highlight?: string; mood_emoji?: string }) => void
}

export default function MemoryTimeline({ memory, entries, stops, onUpdateEntry }: Props) {
  const { photosByStop, addPhoto, toggleFavorite, updateCaption, deletePhoto } = useMemoryPhotos(memory.id)

  // Sorter stopp etter rekkefølge
  const sortedStops = [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className="space-y-10">
      {/* Helhetsoversikt */}
      {memory.summary && (
        <div className="relative px-6 py-5 rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-950/40 to-slate-900/60">
          <div className="absolute -top-3 left-5">
            <span className="px-3 py-0.5 text-xs font-semibold text-amber-400 bg-slate-950 rounded-full border border-amber-700/40">
              ✈️ Reiseoversikt
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap mt-1">
            {memory.summary}
          </p>
        </div>
      )}

      {/* Stopp */}
      {sortedStops.map((stop, i) => {
        const entry = entries.find((e) => e.stop_id === stop.id)
        const stopPhotos = photosByStop.get(stop.id) ?? []

        return (
          <div key={stop.id} className="relative">
            {/* Vertikal tidslinje */}
            {i < sortedStops.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-px bg-gradient-to-b from-amber-700/40 to-transparent" />
            )}

            {/* Stoppindikator */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-900/60 border-2 border-amber-600/60 flex items-center justify-center z-10 relative">
                <span className="text-amber-300 font-bold text-sm">{i + 1}</span>
              </div>

              {/* Innhold */}
              <div className="flex-1 pb-2">
                {/* By-header */}
                <div className="flex items-center gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      {stop.city}{stop.state ? `, ${stop.state}` : ''}
                      {entry?.mood_emoji && <span className="ml-2">{entry.mood_emoji}</span>}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      {stop.arrival_date && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {new Date(stop.arrival_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        {stop.nights} {stop.nights === 1 ? 'natt' : 'netter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dagbok */}
                {entry ? (
                  <MemoryEntryEditor entry={entry} onUpdate={onUpdateEntry} />
                ) : (
                  <p className="text-sm text-slate-500 italic p-4 rounded-xl bg-slate-800/30">
                    Ingen dagbokinnføring for dette stoppet. Generer minnebok for å lage innhold.
                  </p>
                )}

                {/* Bildegalleri */}
                {stopPhotos.length > 0 && (
                  <div className="mt-4">
                    <PhotoGrid
                      photos={stopPhotos}
                      onToggleFavorite={toggleFavorite}
                      onUpdateCaption={updateCaption}
                      onDelete={deletePhoto}
                    />
                  </div>
                )}

                {/* Last opp bilder */}
                <div className="mt-3">
                  <PhotoUploadZone memoryId={memory.id} stopId={stop.id} addPhoto={addPhoto} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
