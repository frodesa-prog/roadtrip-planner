'use client'

import { MemoryPhoto, Stop } from '@/types'
import {
  Star, Trash2, Pencil, Check, X,
  ChevronLeft, ChevronRight, CheckSquare, Square, Tag,
} from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  photos:           MemoryPhoto[]
  stops:            Stop[]
  onToggleFavorite: (id: string) => void
  onUpdateCaption:  (id: string, caption: string) => void
  onDelete:         (id: string) => void
  onAssignToStop:   (id: string, stopId: string | null) => void
}

export default function PhotoManageGrid({
  photos, stops, onToggleFavorite, onUpdateCaption, onDelete, onAssignToStop,
}: Props) {
  // ── Select mode ───────────────────────────────────────────────────────────
  const [selectMode, setSelectMode]     = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<string>('__none__')

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = () => setSelectedIds(new Set(photos.map(p => p.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const exitSelectMode = () => {
    setSelectMode(false)
    clearSelection()
    setAssignTarget('__none__')
  }

  function handleBulkAssign() {
    if (selectedIds.size === 0) return
    const stopId = assignTarget === '__none__' ? null : assignTarget
    selectedIds.forEach(id => onAssignToStop(id, stopId))
    exitSelectMode()
  }

  // ── Caption editing ───────────────────────────────────────────────────────
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')

  // ── Lightbox ──────────────────────────────────────────────────────────────
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null

  const openLightbox = (photo: MemoryPhoto) => {
    if (selectMode) return
    setLightboxIndex(photos.findIndex(p => p.id === photo.id))
  }
  const closeLightbox = () => setLightboxIndex(null)
  const goPrev = useCallback(() =>
    setLightboxIndex(i => i !== null ? (i - 1 + photos.length) % photos.length : null),
    [photos.length])
  const goNext = useCallback(() =>
    setLightboxIndex(i => i !== null ? (i + 1) % photos.length : null),
    [photos.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'Escape')     closeLightbox()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [lightboxIndex, goPrev, goNext])

  // ── Group photos by stop ──────────────────────────────────────────────────
  const stopMap = new Map(stops.map(s => [s.id, s]))

  const groups: Array<{ stop: Stop | null; photos: MemoryPhoto[] }> = []

  // Ordered stops first
  for (const stop of stops) {
    const sp = photos.filter(p => p.stop_id === stop.id)
    if (sp.length > 0) groups.push({ stop, photos: sp })
  }

  // Unassigned last
  const unassigned = photos.filter(p => !p.stop_id)
  if (unassigned.length > 0) groups.push({ stop: null, photos: unassigned })

  // If no groups at all, show flat grid
  const flat = groups.length === 0

  if (photos.length === 0) return null

  // ── Photo card renderer ───────────────────────────────────────────────────
  function PhotoCard({ photo }: { photo: MemoryPhoto }) {
    const isSelected = selectedIds.has(photo.id)
    const stopName   = photo.stop_id ? (stopMap.get(photo.stop_id)?.city ?? null) : null

    return (
      <div
        key={photo.id}
        onClick={() => selectMode ? toggleSelect(photo.id) : openLightbox(photo)}
        className={`relative group rounded-xl overflow-hidden aspect-square bg-slate-800 cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''
        }`}
      >
        <Image
          src={photo.thumbnail_url ?? photo.cloudinary_url}
          alt={photo.caption ?? 'Reisebilde'}
          fill
          className={`object-cover transition-transform duration-300 ${selectMode ? '' : 'group-hover:scale-105'}`}
          sizes="(max-width: 640px) 50vw, 33vw"
        />

        {/* Select mode: checkbox overlay */}
        {selectMode && (
          <div className={`absolute inset-0 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-amber-500/30' : 'bg-black/20 group-hover:bg-black/40'
          }`}>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
              isSelected ? 'bg-amber-500 border-amber-400' : 'border-white/70 bg-black/40'
            }`}>
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}

        {/* Normal mode: hover actions */}
        {!selectMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
            <div className="flex justify-between items-start">
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorite(photo.id) }}
                className={`p-1.5 rounded-lg transition-colors ${
                  photo.is_favorite ? 'bg-amber-500 text-white' : 'bg-black/40 hover:bg-amber-500/70 text-white'
                }`}
              >
                <Star className="w-3 h-3" fill={photo.is_favorite ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(photo.id) }}
                className="p-1.5 rounded-lg bg-black/40 hover:bg-red-500/80 text-white transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <div onClick={e => e.stopPropagation()}>
              {editingId === photo.id ? (
                <div className="flex gap-1">
                  <input
                    value={captionDraft}
                    onChange={e => setCaptionDraft(e.target.value)}
                    className="flex-1 text-xs bg-black/60 text-white rounded px-2 py-1 outline-none"
                    placeholder="Bildetekst…"
                    autoFocus
                  />
                  <button onClick={() => { onUpdateCaption(photo.id, captionDraft); setEditingId(null) }}
                    className="p-1 rounded bg-amber-600 text-white"><Check className="w-3 h-3" /></button>
                  <button onClick={() => setEditingId(null)}
                    className="p-1 rounded bg-slate-600 text-white"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <button onClick={() => { setCaptionDraft(photo.caption ?? ''); setEditingId(photo.id) }}
                  className="flex items-center gap-1 text-xs text-white/80 hover:text-white">
                  <Pencil className="w-2.5 h-2.5" />
                  {photo.caption ?? 'Legg til tekst'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stop badge (normal mode, unassigned photos or when shown in flat view) */}
        {!selectMode && stopName && groups.length > 1 && (
          <div className="absolute bottom-1.5 left-1.5 pointer-events-none">
            <span className="text-[10px] bg-black/60 text-amber-300 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
              {stopName}
            </span>
          </div>
        )}

        {/* Favorite indicator */}
        {photo.is_favorite && (
          <div className="absolute top-1.5 left-1.5 pointer-events-none">
            <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-4">
        {selectMode ? (
          <>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5" /> Velg alle
              </button>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400">{selectedIds.size} valgt</span>
            </div>
            <button onClick={exitSelectMode}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Avbryt
            </button>
          </>
        ) : (
          <button
            onClick={() => setSelectMode(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <Square className="w-3.5 h-3.5" /> Velg bilder
          </button>
        )}
      </div>

      {/* ── Bulk assign bar (shown when photos are selected) ── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 p-3 bg-slate-800/80 rounded-xl border border-amber-700/30">
          <Tag className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-slate-300 flex-shrink-0">
            Koble <span className="font-semibold text-amber-300">{selectedIds.size}</span> bilde{selectedIds.size !== 1 ? 'r' : ''} til:
          </span>
          <select
            value={assignTarget}
            onChange={e => setAssignTarget(e.target.value)}
            className="flex-1 min-w-[160px] text-xs bg-slate-700 text-slate-200 rounded-lg px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-amber-600"
          >
            <option value="__none__">Uten stoppested</option>
            {stops.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.city}{s.state ? `, ${s.state}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleBulkAssign}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
          >
            Koble til
          </button>
        </div>
      )}

      {/* ── Photo groups ── */}
      {flat ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map(p => <PhotoCard key={p.id} photo={p} />)}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ stop, photos: gp }) => (
            <div key={stop?.id ?? '__none__'}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                {stop ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-amber-900/70 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-amber-300">
                        {stops.findIndex(s => s.id === stop.id) + 1}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-200">
                      {stop.city}{stop.state ? `, ${stop.state}` : ''}
                    </span>
                    <span className="text-xs text-slate-500">· {gp.length} bilde{gp.length !== 1 ? 'r' : ''}</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-slate-400">?</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-400">Uten stoppested</span>
                    <span className="text-xs text-slate-500">· {gp.length} bilde{gp.length !== 1 ? 'r' : ''}</span>
                  </>
                )}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {gp.map(p => <PhotoCard key={p.id} photo={p} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxPhoto && lightboxIndex !== null && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95" onClick={closeLightbox}>
          <button onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs text-white/50">
            {lightboxIndex + 1} / {photos.length}
          </div>
          {photos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); goPrev() }}
              className="absolute left-3 sm:left-6 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative flex items-center justify-center px-16 sm:px-24 w-full h-full"
            onClick={e => e.stopPropagation()}>
            <img src={lightboxPhoto.cloudinary_url} alt={lightboxPhoto.caption ?? ''}
              className="max-w-full max-h-[85vh] object-contain rounded-lg select-none" />
            {lightboxPhoto.caption && (
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/70 bg-black/50 px-4 py-1.5 rounded-full whitespace-nowrap">
                {lightboxPhoto.caption}
              </p>
            )}
          </div>
          {photos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); goNext() }}
              className="absolute right-3 sm:right-6 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white">
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button key={p.id} onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                  className={`flex-shrink-0 w-10 h-10 rounded-md overflow-hidden border-2 transition-all ${
                    i === lightboxIndex ? 'border-amber-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}>
                  <img src={p.thumbnail_url ?? p.cloudinary_url} alt="" className="w-full h-full object-cover" />
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
