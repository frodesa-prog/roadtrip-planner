'use client'

import { MemoryPhoto, Stop, Activity, Dining } from '@/types'
import {
  Star, Trash2, Pencil, Check, X,
  ChevronLeft, ChevronRight, CheckSquare, Square, Tag, ArrowUpDown,
} from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

type AssignUpdates = { stop_id?: string | null; activity_id?: string | null; dining_id?: string | null }

interface Props {
  photos:         MemoryPhoto[]
  stops:          Stop[]
  activities:     Activity[]
  dining:         Dining[]
  onToggleFavorite: (id: string) => void
  onUpdateCaption:  (id: string, caption: string) => void
  onDelete:         (id: string) => void
  onBulkDelete:     (ids: string[]) => void
  onAssignPhoto:    (id: string, updates: AssignUpdates) => void
  onBulkAssign:     (ids: string[], updates: AssignUpdates) => void
}

type SortMode = 'stop' | 'taken' | 'newest' | 'favorites'

// ── Encode / decode assignment value for <select> ─────────────────────────────

function encodeAssign(type: 'none' | 'stop' | 'activity' | 'dining', id?: string): string {
  return type === 'none' ? '' : `${type}:${id}`
}

function decodeAssign(val: string, activities: Activity[], dining: Dining[]): AssignUpdates {
  if (!val) return { stop_id: null, activity_id: null, dining_id: null }
  const [type, id] = val.split(':')
  if (type === 'stop')     return { stop_id: id,   activity_id: null, dining_id: null }
  if (type === 'activity') {
    const act = activities.find(a => a.id === id)
    return { stop_id: act?.stop_id ?? null, activity_id: id, dining_id: null }
  }
  if (type === 'dining') {
    const d = dining.find(d => d.id === id)
    return { stop_id: d?.stop_id ?? null, activity_id: null, dining_id: id }
  }
  return { stop_id: null, activity_id: null, dining_id: null }
}

// ── Label helpers for badges ──────────────────────────────────────────────────

function photoLabel(
  photo: MemoryPhoto,
  stopMap: Map<string, Stop>,
  actMap: Map<string, Activity>,
  dinMap: Map<string, Dining>,
): string | null {
  if (photo.activity_id) return actMap.get(photo.activity_id)?.name ?? null
  if (photo.dining_id)   return dinMap.get(photo.dining_id)?.name ?? null
  if (photo.stop_id)     return stopMap.get(photo.stop_id)?.city ?? null
  return null
}

// ── Date formatter ────────────────────────────────────────────────────────────

function shortDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhotoManageGrid({
  photos, stops, activities, dining,
  onToggleFavorite, onUpdateCaption, onDelete, onBulkDelete, onAssignPhoto, onBulkAssign,
}: Props) {

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const stopMap = new Map(stops.map(s => [s.id, s]))
  const actMap  = new Map(activities.map(a => [a.id, a]))
  const dinMap  = new Map(dining.map(d => [d.id, d]))

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortMode, setSortMode] = useState<SortMode>('stop')

  function sortedPhotos(list: MemoryPhoto[]): MemoryPhoto[] {
    const copy = [...list]
    if (sortMode === 'taken')     return copy.sort((a, b) => (a.taken_at ?? a.created_at) < (b.taken_at ?? b.created_at) ? -1 : 1)
    if (sortMode === 'newest')    return copy.sort((a, b) => a.created_at < b.created_at ? 1 : -1)
    if (sortMode === 'favorites') return copy.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
    return copy // 'stop' — keep existing order (grouped by stop below)
  }

  // ── Select mode ───────────────────────────────────────────────────────────
  const [selectMode, setSelectMode]     = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [assignValue, setAssignValue]   = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll    = () => setSelectedIds(new Set(photos.map(p => p.id)))
  const exitSelect   = () => { setSelectMode(false); setSelectedIds(new Set()); setAssignValue(''); setConfirmDelete(false) }

  function handleBulkAssign() {
    if (!selectedIds.size) return
    onBulkAssign([...selectedIds], decodeAssign(assignValue, activities, dining))
    exitSelect()
  }

  function handleBulkDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onBulkDelete([...selectedIds])
    exitSelect()
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

  // ── Build <select> option value for a given photo ─────────────────────────
  function currentAssignValue(photo: MemoryPhoto): string {
    if (photo.activity_id) return encodeAssign('activity', photo.activity_id)
    if (photo.dining_id)   return encodeAssign('dining',   photo.dining_id)
    if (photo.stop_id)     return encodeAssign('stop',     photo.stop_id)
    return ''
  }

  // ── Apply sort then group ─────────────────────────────────────────────────
  const sorted = sortedPhotos(photos)

  const groups: Array<{ stop: Stop | null; photos: MemoryPhoto[] }> = []
  if (sortMode === 'stop') {
    for (const stop of stops) {
      const sp = sorted.filter(p => p.stop_id === stop.id)
      if (sp.length > 0) groups.push({ stop, photos: sp })
    }
    const unassigned = sorted.filter(p => !p.stop_id)
    if (unassigned.length > 0) groups.push({ stop: null, photos: unassigned })
  } else {
    // Flat list for non-stop sort modes
    groups.push({ stop: null, photos: sorted })
  }

  if (photos.length === 0) return null

  // ── Photo card ────────────────────────────────────────────────────────────
  function PhotoCard({ photo }: { photo: MemoryPhoto }) {
    const isSelected = selectedIds.has(photo.id)
    const badge      = photoLabel(photo, stopMap, actMap, dinMap)
    const showBadge  = !!photo.activity_id || !!photo.dining_id

    return (
      <div
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

        {/* Select overlay */}
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

        {/* Normal hover actions */}
        {!selectMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
            <div className="flex justify-between items-start">
              <button onClick={e => { e.stopPropagation(); onToggleFavorite(photo.id) }}
                className={`p-1.5 rounded-lg transition-colors ${photo.is_favorite ? 'bg-amber-500 text-white' : 'bg-black/40 hover:bg-amber-500/70 text-white'}`}>
                <Star className="w-3 h-3" fill={photo.is_favorite ? 'currentColor' : 'none'} />
              </button>
              {/* Per-photo quick assign */}
              <select
                value={currentAssignValue(photo)}
                onChange={e => { e.stopPropagation(); onAssignPhoto(photo.id, decodeAssign(e.target.value, activities, dining)) }}
                onClick={e => e.stopPropagation()}
                className="text-[10px] bg-black/70 text-amber-200 rounded px-1 py-0.5 border border-amber-700/40 focus:outline-none max-w-[110px] truncate"
              >
                <option value="">Uten tilknytning</option>
                <optgroup label="─ Stoppesteder ─">
                  {stops.map((s, i) => (
                    <option key={s.id} value={encodeAssign('stop', s.id)}>
                      {i + 1}. {s.city}
                    </option>
                  ))}
                </optgroup>
                {activities.length > 0 && (
                  <optgroup label="─ Aktiviteter ─">
                    {activities.map(a => {
                      const sIdx = stops.findIndex(s => s.id === a.stop_id)
                      return (
                        <option key={a.id} value={encodeAssign('activity', a.id)}>
                          {a.name}{a.activity_date ? ` (${shortDate(a.activity_date)})` : ''}{sIdx >= 0 ? ` · ${stops[sIdx].city}` : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                )}
                {dining.length > 0 && (
                  <optgroup label="─ Spisesteder ─">
                    {dining.map(d => {
                      const sIdx = stops.findIndex(s => s.id === d.stop_id)
                      return (
                        <option key={d.id} value={encodeAssign('dining', d.id)}>
                          {d.name}{d.booking_date ? ` (${shortDate(d.booking_date)})` : ''}{sIdx >= 0 ? ` · ${stops[sIdx].city}` : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                )}
              </select>
              <button onClick={e => { e.stopPropagation(); onDelete(photo.id) }}
                className="p-1.5 rounded-lg bg-black/40 hover:bg-red-500/80 text-white transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <div onClick={e => e.stopPropagation()}>
              {editingId === photo.id ? (
                <div className="flex gap-1">
                  <input value={captionDraft} onChange={e => setCaptionDraft(e.target.value)}
                    className="flex-1 text-xs bg-black/60 text-white rounded px-2 py-1 outline-none"
                    placeholder="Bildetekst…" autoFocus />
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

        {/* Activity / dining badge */}
        {!selectMode && showBadge && badge && (
          <div className="absolute bottom-1.5 left-1.5 pointer-events-none">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full truncate max-w-[80px] ${
              photo.activity_id ? 'bg-blue-900/80 text-blue-200' : 'bg-purple-900/80 text-purple-200'
            }`}>
              {badge}
            </span>
          </div>
        )}

        {/* Favourite indicator */}
        {photo.is_favorite && (
          <div className="absolute top-1.5 left-1.5 pointer-events-none">
            <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-[40px] z-10 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/60 -mx-4 px-4 pb-2 pt-2 mb-4">

        {/* Toolbar row */}
        <div className="flex items-center justify-between gap-2">
          {selectMode ? (
            <>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" /> Velg alle
                </button>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-400">{selectedIds.size} valgt</span>
              </div>
              <button onClick={exitSelect} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 ml-auto">
                <X className="w-3.5 h-3.5" /> Avbryt
              </button>
            </>
          ) : (
            <>
              {/* Sort dropdown */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                  className="text-xs bg-slate-800 text-slate-300 rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-600"
                >
                  <option value="stop">Gruppert per stopp</option>
                  <option value="taken">Dato tatt (eldst først)</option>
                  <option value="newest">Opplastingsdato (nyest først)</option>
                  <option value="favorites">Favoritter først</option>
                </select>
              </div>
              <button onClick={() => setSelectMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                <Square className="w-3.5 h-3.5" /> Velg bilder
              </button>
            </>
          )}
        </div>

        {/* Actions bar – shown when photos are selected */}
        {selectMode && selectedIds.size > 0 && (
          <div className="mt-2 space-y-2">
            {/* Bulk assign */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800/80 rounded-xl border border-amber-700/30">
              <Tag className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 flex-shrink-0">
                Koble <span className="font-semibold text-amber-300">{selectedIds.size}</span> bilde{selectedIds.size !== 1 ? 'r' : ''} til:
              </span>
              <select
                value={assignValue}
                onChange={e => setAssignValue(e.target.value)}
                className="flex-1 min-w-[180px] text-xs bg-slate-700 text-slate-200 rounded-lg px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-amber-600"
              >
                <option value="">Uten tilknytning</option>
                <optgroup label="─ Stoppesteder ─">
                  {stops.map((s, i) => (
                    <option key={s.id} value={encodeAssign('stop', s.id)}>
                      {i + 1}. {s.city}{s.state ? `, ${s.state}` : ''}
                    </option>
                  ))}
                </optgroup>
                {activities.length > 0 && (
                  <optgroup label="─ Aktiviteter ─">
                    {activities.map(a => {
                      const sIdx = stops.findIndex(s => s.id === a.stop_id)
                      return (
                        <option key={a.id} value={encodeAssign('activity', a.id)}>
                          {a.name}{a.activity_date ? ` (${shortDate(a.activity_date)})` : ''}{sIdx >= 0 ? ` · ${stops[sIdx].city}` : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                )}
                {dining.length > 0 && (
                  <optgroup label="─ Spisesteder ─">
                    {dining.map(d => {
                      const sIdx = stops.findIndex(s => s.id === d.stop_id)
                      return (
                        <option key={d.id} value={encodeAssign('dining', d.id)}>
                          {d.name}{d.booking_date ? ` (${shortDate(d.booking_date)})` : ''}{sIdx >= 0 ? ` · ${stops[sIdx].city}` : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                )}
              </select>
              <button onClick={handleBulkAssign}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors">
                Koble til
              </button>
            </div>

            {/* Bulk delete */}
            <div className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl border border-red-900/40">
              <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 flex-1">
                {confirmDelete
                  ? <span className="text-red-300 font-medium">Er du sikker? Dette kan ikke angres.</span>
                  : <>Slett <span className="font-semibold text-red-300">{selectedIds.size}</span> valgte bilde{selectedIds.size !== 1 ? 'r' : ''}</>
                }
              </span>
              {confirmDelete && (
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
                  Avbryt
                </button>
              )}
              <button onClick={handleBulkDelete}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors ${
                  confirmDelete ? 'bg-red-600 hover:bg-red-500' : 'bg-red-900/60 hover:bg-red-800'
                }`}>
                {confirmDelete ? 'Ja, slett' : 'Slett valgte'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Photo groups ── */}
      <div className="space-y-8">
        {groups.map(({ stop, photos: gp }, gi) => {
          // Flat mode (non-stop sort): just a simple grid, no sub-grouping
          if (sortMode !== 'stop') {
            return (
              <div key={gi}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gp.map(p => <PhotoCard key={p.id} photo={p} />)}
                </div>
              </div>
            )
          }

          // Stop-grouped mode with activity/dining sub-sections
          const actGroups = activities
            .filter(a => a.stop_id === stop?.id)
            .map(a => ({ act: a, photos: gp.filter(p => p.activity_id === a.id) }))
            .filter(g => g.photos.length > 0)
          const dinGroups = dining
            .filter(d => d.stop_id === stop?.id)
            .map(d => ({ din: d, photos: gp.filter(p => p.dining_id === d.id) }))
            .filter(g => g.photos.length > 0)
          const stopOnlyPhotos = gp.filter(p => !p.activity_id && !p.dining_id)

          return (
            <div key={stop?.id ?? '__none__'}>
              {/* Stop header */}
              <div className="flex items-center gap-2 mb-3">
                {stop ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-amber-900/70 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-amber-300">{stops.findIndex(s => s.id === stop.id) + 1}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{stop.city}{stop.state ? `, ${stop.state}` : ''}</span>
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

              <div className="space-y-4 pl-2 border-l border-slate-800">
                {actGroups.map(({ act, photos: ap }) => (
                  <div key={act.id}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-blue-300">{act.name}</span>
                      {act.activity_date && <span className="text-xs text-slate-500">· {shortDate(act.activity_date)}</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ap.map(p => <PhotoCard key={p.id} photo={p} />)}
                    </div>
                  </div>
                ))}
                {dinGroups.map(({ din, photos: dp }) => (
                  <div key={din.id}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-purple-300">{din.name}</span>
                      {din.booking_date && <span className="text-xs text-slate-500">· {shortDate(din.booking_date)}</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {dp.map(p => <PhotoCard key={p.id} photo={p} />)}
                    </div>
                  </div>
                ))}
                {stopOnlyPhotos.length > 0 && (
                  <div>
                    {(actGroups.length > 0 || dinGroups.length > 0) && (
                      <p className="text-xs text-slate-500 mb-2">Øvrige bilder fra stedet</p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {stopOnlyPhotos.map(p => <PhotoCard key={p.id} photo={p} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

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
