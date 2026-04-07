'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Attachment, AttachmentEntityType, AttachmentFileType } from '@/types'

// ─── Cloudinary upload helpers ────────────────────────────────────────────────

async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
): Promise<{ public_id: string; secure_url: string } | null> {
  const isImage = file.type.startsWith('image/')
  const endpoint = isImage ? 'image' : 'raw'

  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}/upload`,
      { method: 'POST', body: fd },
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Loads all attachments for an array of entity IDs (one DB query for the whole
 * panel) and exposes add / remove helpers.
 */
export function useAttachments(tripId: string | null, entityIds: string[]) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const supabase = useMemo(() => createClient(), [])

  const entityIdsKey = entityIds.slice().sort().join(',')

  useEffect(() => {
    if (!tripId || !entityIds.length) {
      setAttachments([])
      return
    }

    supabase
      .from('attachments')
      .select('*')
      .eq('trip_id', tripId)
      .in('entity_id', entityIds)
      .order('created_at', { ascending: true })
      .then(({ data }) => setAttachments((data as Attachment[]) ?? []))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, entityIdsKey, supabase])

  /** Map: entityId → Attachment[] */
  const byEntityId = useMemo(() => {
    const map = new Map<string, Attachment[]>()
    for (const a of attachments) {
      const list = map.get(a.entity_id) ?? []
      list.push(a)
      map.set(a.entity_id, list)
    }
    return map
  }, [attachments])

  /** Upload a file to Cloudinary then save the record to Supabase */
  const addAttachment = useCallback(
    async (
      entityType: AttachmentEntityType,
      entityId:   string,
      file:       File,
    ): Promise<boolean> => {
      if (!tripId) return false

      const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME    ?? ''
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''
      if (!cloudName || !uploadPreset) {
        console.error('[useAttachments] Missing Cloudinary env vars')
        return false
      }

      const uploaded = await uploadToCloudinary(file, cloudName, uploadPreset)
      if (!uploaded) return false

      const fileType: AttachmentFileType = file.type === 'application/pdf' ? 'pdf' : 'image'

      const { data, error } = await supabase
        .from('attachments')
        .insert({
          trip_id:              tripId,
          entity_type:          entityType,
          entity_id:            entityId,
          cloudinary_public_id: uploaded.public_id,
          cloudinary_url:       uploaded.secure_url,
          file_type:            fileType,
          file_name:            file.name,
          uploaded_by:          (await supabase.auth.getUser()).data.user?.id ?? '',
        })
        .select()
        .single()

      if (error || !data) return false

      setAttachments((prev) => [...prev, data as Attachment])
      return true
    },
    [tripId, supabase],
  )

  const removeAttachment = useCallback(
    async (id: string) => {
      // Kall server-side API som sletter fra Cloudinary + Supabase
      const res = await fetch(`/api/attachments/delete?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id))
      } else {
        console.error('[useAttachments] Kunne ikke slette vedlegg:', await res.text())
      }
    },
    [],
  )

  return { attachments, byEntityId, addAttachment, removeAttachment }
}
