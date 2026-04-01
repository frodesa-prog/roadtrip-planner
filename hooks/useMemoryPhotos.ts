'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MemoryPhoto } from '@/types'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewPhotoData {
  cloudinary_public_id: string
  cloudinary_url: string
  thumbnail_url?: string
  stop_id?: string | null
  caption?: string
  taken_at?: string | null
  exif_lat?: number | null
  exif_lng?: number | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMemoryPhotos(memoryId: string | null) {
  const [photos, setPhotos]   = useState<MemoryPhoto[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!memoryId) { setPhotos([]); return }

    setLoading(true)
    supabase
      .from('memory_photos')
      .select('*')
      .eq('memory_id', memoryId)
      .order('stop_id', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setPhotos((data ?? []) as MemoryPhoto[])
        setLoading(false)
      })
  }, [memoryId, supabase])

  // ── Add photo ─────────────────────────────────────────────────────────────

  const addPhoto = useCallback(async (data: NewPhotoData): Promise<MemoryPhoto | null> => {
    if (!memoryId) return null

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Determine sort order (next in sequence for this stop)
    const maxOrder = photos
      .filter((p) => p.stop_id === (data.stop_id ?? null))
      .reduce((max, p) => Math.max(max, p.sort_order), -1)

    const { data: created, error } = await supabase
      .from('memory_photos')
      .insert({
        memory_id:            memoryId,
        stop_id:              data.stop_id ?? null,
        uploaded_by:          user.id,
        cloudinary_public_id: data.cloudinary_public_id,
        cloudinary_url:       data.cloudinary_url,
        thumbnail_url:        data.thumbnail_url ?? null,
        caption:              data.caption ?? null,
        taken_at:             data.taken_at ?? null,
        exif_lat:             data.exif_lat ?? null,
        exif_lng:             data.exif_lng ?? null,
        sort_order:           maxOrder + 1,
      })
      .select()
      .single()

    if (error) { toast.error('Kunne ikke lagre bilde'); return null }

    const photo = created as MemoryPhoto
    setPhotos((prev) => [...prev, photo])
    return photo
  }, [memoryId, photos, supabase])

  // ── Toggle favorite ───────────────────────────────────────────────────────

  const toggleFavorite = useCallback(async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId)
    if (!photo) return

    const newValue = !photo.is_favorite
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, is_favorite: newValue } : p))

    const { error } = await supabase
      .from('memory_photos')
      .update({ is_favorite: newValue })
      .eq('id', photoId)

    if (error) {
      setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, is_favorite: !newValue } : p))
      toast.error('Kunne ikke oppdatere favoritt')
    }
  }, [photos, supabase])

  // ── Update caption ────────────────────────────────────────────────────────

  const updateCaption = useCallback(async (photoId: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, caption } : p))

    const { error } = await supabase
      .from('memory_photos')
      .update({ caption })
      .eq('id', photoId)

    if (error) toast.error('Kunne ikke lagre bildetekst')
  }, [supabase])

  // ── Assign photo (stop / activity / dining) ───────────────────────────────

  type AssignUpdates = { stop_id?: string | null; activity_id?: string | null; dining_id?: string | null }

  const assignPhoto = useCallback(async (photoId: string, updates: AssignUpdates) => {
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, ...updates } : p))
    const { error } = await supabase.from('memory_photos').update(updates).eq('id', photoId)
    if (error) toast.error('Kunne ikke oppdatere bilde')
  }, [supabase])

  const bulkAssignPhotos = useCallback(async (photoIds: string[], updates: AssignUpdates) => {
    if (!photoIds.length) return
    setPhotos((prev) => prev.map((p) => photoIds.includes(p.id) ? { ...p, ...updates } : p))
    const { error } = await supabase.from('memory_photos').update(updates).in('id', photoIds)
    if (error) toast.error('Kunne ikke oppdatere bilder')
  }, [supabase])

  // Kept for backward compatibility
  const assignToStop = useCallback(async (photoId: string, stopId: string | null) => {
    return assignPhoto(photoId, { stop_id: stopId, activity_id: null, dining_id: null })
  }, [assignPhoto])

  // ── Bulk delete photos ────────────────────────────────────────────────────

  const bulkDeletePhotos = useCallback(async (photoIds: string[]) => {
    if (!photoIds.length) return
    const targets = photos.filter(p => photoIds.includes(p.id))
    setPhotos(prev => prev.filter(p => !photoIds.includes(p.id)))
    await Promise.all(targets.map(async photo => {
      try {
        await fetch(`/api/minner/delete-photo?publicId=${encodeURIComponent(photo.cloudinary_public_id)}&id=${photo.id}`, { method: 'DELETE' })
      } catch { /* ignore cloudinary errors */ }
      await supabase.from('memory_photos').delete().eq('id', photo.id)
    }))
  }, [photos, supabase])

  // ── Delete photo ──────────────────────────────────────────────────────────

  const deletePhoto = useCallback(async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId)
    if (!photo) return

    // Remove from state optimistically
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))

    // Delete from Cloudinary via server API, then from DB
    try {
      await fetch(`/api/minner/delete-photo?publicId=${encodeURIComponent(photo.cloudinary_public_id)}&id=${photoId}`, {
        method: 'DELETE',
      })
    } catch {
      // Even if Cloudinary delete fails, we remove from DB
    }

    const { error } = await supabase.from('memory_photos').delete().eq('id', photoId)
    if (error) {
      // Restore on failure
      setPhotos((prev) => [...prev, photo].sort((a, b) => a.sort_order - b.sort_order))
      toast.error('Kunne ikke slette bilde')
    }
  }, [photos, supabase])

  // ── Photos grouped by stop ────────────────────────────────────────────────

  const photosByStop = useMemo(() => {
    const map = new Map<string | null, MemoryPhoto[]>()
    for (const photo of photos) {
      const key = photo.stop_id ?? null
      const list = map.get(key) ?? []
      list.push(photo)
      map.set(key, list)
    }
    return map
  }, [photos])

  const favoritePhotos = useMemo(
    () => photos.filter((p) => p.is_favorite),
    [photos]
  )

  return {
    photos,
    photosByStop,
    favoritePhotos,
    loading,
    addPhoto,
    toggleFavorite,
    updateCaption,
    assignPhoto,
    bulkAssignPhotos,
    assignToStop,
    deletePhoto,
    bulkDeletePhotos,
  }
}
