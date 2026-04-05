'use client'

import { TripMemory, MemoryEntry, Stop, Activity, Dining, Hotel } from '@/types'
import { useMemoryPhotos } from '@/hooks/useMemoryPhotos'
import MemoryEntryEditor from './MemoryEntryEditor'
import StopActivityList from './StopActivityList'
import PhotoGrid from './PhotoGrid'
import PhotoUploadZone from './PhotoUploadZone'
import { MapPin, Moon, Images } from 'lucide-react'

interface Props {
  memory:     TripMemory
  entries:    MemoryEntry[]
  stops:      Stop[]
  activities: Activity[]
  dining:     Dining[]
  hotels:     Hotel[]
  onUpdateEntry: (entryId: string, patch: { diary_text?: string; highlight?: string; mood_emoji?: string }) => void
}

function shortDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export default function MemoryTimeline({ memory, entries, stops, activities, dining, hotels, onUpdateEntry }: Props) {
  const { photosByStop, addPhoto, toggleFavorite, updateCaption, deletePhoto } = useMemoryPhotos(memory.id)

  // Bilder uten tilknyttet stopp
  const unassignedPhotos = photosByStop.get(null) ?? []

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
        const entry      = entries.find((e) => e.stop_id === stop.id)
        const stopPhotos = photosByStop.get(stop.id) ?? []

        // ── Grupper bilder per aktivitet / spisestad / hotell ──────────────
        const actGroups = activities
          .filter(a => a.stop_id === stop.id)
          .map(a => ({ act: a, photos: stopPhotos.filter(p => p.activity_id === a.id) }))
          .filter(g => g.photos.length > 0)

        const dinGroups = dining
          .filter(d => d.stop_id === stop.id)
          .map(d => ({ din: d, photos: stopPhotos.filter(p => p.dining_id === d.id) }))
          .filter(g => g.photos.length > 0)

        const hotelGroups = hotels
          .filter(h => h.stop_id === stop.id)
          .map(h => ({ hotel: h, photos: stopPhotos.filter(p => p.hotel_id === h.id) }))
          .filter(g => g.photos.length > 0)

        const stopOnlyPhotos = stopPhotos.filter(
          p => !p.activity_id && !p.dining_id && !p.hotel_id
        )

        const hasSubGroups = actGroups.length > 0 || dinGroups.length > 0 || hotelGroups.length > 0

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

                {/* Aktiviteter og spisesteder (liste) */}
                <StopActivityList
                  stopId={stop.id}
                  activities={activities}
                  dining={dining}
                />

                {/* ── Bildegalleri gruppert ────────────────────────────────── */}
                {stopPhotos.length > 0 && (
                  <div className="mt-4 space-y-4">

                    {/* Aktivitet-bilder */}
                    {actGroups.map(({ act, photos }) => (
                      <div key={act.id}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-blue-300">{act.name}</span>
                          {act.activity_date && (
                            <span className="text-xs text-slate-500">· {shortDate(act.activity_date)}</span>
                          )}
                        </div>
                        <PhotoGrid
                          photos={photos}
                          onToggleFavorite={toggleFavorite}
                          onUpdateCaption={updateCaption}
                          onDelete={deletePhoto}
                        />
                      </div>
                    ))}

                    {/* Spisestad-bilder */}
                    {dinGroups.map(({ din, photos }) => (
                      <div key={din.id}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-purple-300">{din.name}</span>
                          {din.booking_date && (
                            <span className="text-xs text-slate-500">· {shortDate(din.booking_date)}</span>
                          )}
                        </div>
                        <PhotoGrid
                          photos={photos}
                          onToggleFavorite={toggleFavorite}
                          onUpdateCaption={updateCaption}
                          onDelete={deletePhoto}
                        />
                      </div>
                    ))}

                    {/* Hotell-bilder */}
                    {hotelGroups.map(({ hotel, photos }) => (
                      <div key={hotel.id}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-emerald-300">{hotel.name}</span>
                        </div>
                        <PhotoGrid
                          photos={photos}
                          onToggleFavorite={toggleFavorite}
                          onUpdateCaption={updateCaption}
                          onDelete={deletePhoto}
                        />
                      </div>
                    ))}

                    {/* Bilder kun knyttet til stoppestedet */}
                    {stopOnlyPhotos.length > 0 && (
                      <div>
                        {hasSubGroups && (
                          <p className="text-xs text-slate-500 mb-2">Øvrige bilder fra stedet</p>
                        )}
                        <PhotoGrid
                          photos={stopOnlyPhotos}
                          onToggleFavorite={toggleFavorite}
                          onUpdateCaption={updateCaption}
                          onDelete={deletePhoto}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Last opp bilder */}
                <div className="mt-3">
                  <PhotoUploadZone memoryId={memory.id} stops={stops} activities={activities} dining={dining} addPhoto={addPhoto} />
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Andre bilder fra turen (uten tilknyttet stopp) ────────────── */}
      {unassignedPhotos.length > 0 && (
        <div className="relative pt-4">
          {/* Skillelinje */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-800" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900">
              <Images className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-400">Andre bilder fra turen</span>
            </div>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <PhotoGrid
            photos={unassignedPhotos}
            onToggleFavorite={toggleFavorite}
            onUpdateCaption={updateCaption}
            onDelete={deletePhoto}
          />

          {/* Last opp bilder uten stopp */}
          <div className="mt-3">
            <PhotoUploadZone memoryId={memory.id} stops={stops} activities={activities} dining={dining} addPhoto={addPhoto} />
          </div>
        </div>
      )}
    </div>
  )
}
