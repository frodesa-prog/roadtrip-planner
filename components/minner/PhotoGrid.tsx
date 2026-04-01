'use client'

import { MemoryPhoto } from '@/types'
import { Star, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  photos: MemoryPhoto[]
  onToggleFavorite: (id: string) => void
  onUpdateCaption:  (id: string, caption: string) => void
  onDelete:         (id: string) => void
}

export default function PhotoGrid({ photos, onToggleFavorite, onUpdateCaption, onDelete }: Props) {
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionDraft, setCaptionDraft]     = useState('')
  const [lightboxIndex, setLightboxIndex]   = useState<number | null>(null)

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null

  const openLightbox = (photo: MemoryPhoto) => {
    const idx = photos.findIndex((p) => p.id === photo.id)
    setLightboxIndex(idx)
  }

  const closeLightbox = () => setLightboxIndex(null)

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null))
  }, [photos.length])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i + 1) % photos.length : null))
  }, [photos.length])

  // Tastaturnavigering
  useEffect(() => {
    if (lightboxIndex === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'Escape')     closeLightbox()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, goPrev, goNext])

  if (photos.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative group rounded-xl overflow-hidden aspect-square bg-slate-800 cursor-pointer"
            onClick={() => openLightbox(photo)}
          >
            {/* Bilde */}
            <Image
              src={photo.thumbnail_url ?? photo.cloudinary_url}
              alt={photo.caption ?? 'Reisebilde'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
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

      {/* Lightbox – rendret på document.body via portal for å unngå z-index-konflikter */}
      {lightboxPhoto && lightboxIndex !== null && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
          onClick={closeLightbox}
        >
          {/* Lukk-knapp */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Teller */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs text-white/50">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Forrige */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              className="absolute left-3 sm:left-6 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Bilde */}
          <div
            className="relative flex items-center justify-center px-16 sm:px-24 w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto.cloudinary_url}
              alt={lightboxPhoto.caption ?? ''}
              className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
            />
            {lightboxPhoto.caption && (
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/70 bg-black/50 px-4 py-1.5 rounded-full whitespace-nowrap">
                {lightboxPhoto.caption}
              </p>
            )}
          </div>

          {/* Neste */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext() }}
              className="absolute right-3 sm:right-6 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Miniatyrstripe */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
                  className={`flex-shrink-0 w-10 h-10 rounded-md overflow-hidden border-2 transition-all ${
                    i === lightboxIndex ? 'border-amber-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img
                    src={p.thumbnail_url ?? p.cloudinary_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
