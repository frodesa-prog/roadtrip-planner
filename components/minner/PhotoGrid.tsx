'use client'

import { MemoryPhoto } from '@/types'
import { Star, Trash2, Pencil, Check, X } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

interface Props {
  photos: MemoryPhoto[]
  onToggleFavorite: (id: string) => void
  onUpdateCaption:  (id: string, caption: string) => void
  onDelete:         (id: string) => void
}

export default function PhotoGrid({ photos, onToggleFavorite, onUpdateCaption, onDelete }: Props) {
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionDraft, setCaptionDraft]     = useState('')
  const [lightbox, setLightbox]             = useState<MemoryPhoto | null>(null)

  if (photos.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative group rounded-xl overflow-hidden aspect-square bg-slate-800 cursor-pointer"
          >
            {/* Bilde */}
            <Image
              src={photo.thumbnail_url ?? photo.cloudinary_url}
              alt={photo.caption ?? 'Reisebilde'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onClick={() => setLightbox(photo)}
              sizes="(max-width: 640px) 50vw, 33vw"
            />

            {/* Overlay med knapper */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
              {/* Topp: favoritt + slett */}
              <div className="flex justify-between items-start">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(photo.id) }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    photo.is_favorite
                      ? 'bg-amber-500 text-white'
                      : 'bg-black/40 hover:bg-amber-500/70 text-white'
                  }`}
                >
                  <Star className="w-3 h-3" fill={photo.is_favorite ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
                  className="p-1.5 rounded-lg bg-black/40 hover:bg-red-500/80 text-white transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Bunn: bildetekst */}
              <div onClick={(e) => e.stopPropagation()}>
                {editingCaption === photo.id ? (
                  <div className="flex gap-1">
                    <input
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      className="flex-1 text-xs bg-black/60 text-white rounded px-2 py-1 outline-none"
                      placeholder="Bildetekst…"
                      autoFocus
                    />
                    <button
                      onClick={() => { onUpdateCaption(photo.id, captionDraft); setEditingCaption(null) }}
                      className="p-1 rounded bg-amber-600 text-white"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingCaption(null)}
                      className="p-1 rounded bg-slate-600 text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCaptionDraft(photo.caption ?? ''); setEditingCaption(photo.id) }}
                    className="flex items-center gap-1 text-xs text-white/80 hover:text-white"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    {photo.caption ?? 'Legg til tekst'}
                  </button>
                )}
              </div>
            </div>

            {/* Favorittindikator */}
            {photo.is_favorite && (
              <div className="absolute top-1.5 left-1.5 pointer-events-none">
                <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.cloudinary_url}
              alt={lightbox.caption ?? ''}
              className="w-full h-full object-contain rounded-xl"
              style={{ maxHeight: '85vh' }}
            />
            {lightbox.caption && (
              <p className="text-center text-sm text-white/80 mt-2">{lightbox.caption}</p>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
