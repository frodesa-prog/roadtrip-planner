'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NoteImage } from '@/types'
import { toast } from 'sonner'

type StoredNoteImage = Omit<NoteImage, 'publicUrl'>

export function useNoteImages(noteId: string | null) {
  const [images, setImages] = useState<NoteImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!noteId) { setImages([]); return }
    supabase
      .from('note_images')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          const imgs = (data as StoredNoteImage[]).map((img) => ({
            ...img,
            publicUrl: supabase.storage
              .from('note-images')
              .getPublicUrl(img.storage_path).data.publicUrl,
          }))
          setImages(imgs)
        }
      })
  }, [noteId, supabase])

  const uploadImage = useCallback(
    async (file: File): Promise<void> => {
      if (!noteId) return
      setIsUploading(true)
      try {
        const ext = file.name.split('.').pop() ?? 'png'
        const path = `${noteId}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('note-images')
          .upload(path, file, { contentType: file.type })

        if (uploadError) {
          toast.error('Kunne ikke laste opp bilde')
          return
        }

        const publicUrl = supabase.storage
          .from('note-images')
          .getPublicUrl(path).data.publicUrl

        const { data: created, error } = await supabase
          .from('note_images')
          .insert({ note_id: noteId, storage_path: path })
          .select()
          .single()

        if (error) {
          toast.error('Kunne ikke lagre bildeinformasjon')
          return
        }

        setImages((prev) => [
          ...prev,
          { ...(created as StoredNoteImage), publicUrl },
        ])
      } finally {
        setIsUploading(false)
      }
    },
    [noteId, supabase]
  )

  const removeImage = useCallback(
    async (imageId: string, storagePath: string): Promise<void> => {
      setImages((prev) => prev.filter((i) => i.id !== imageId))
      await supabase.storage.from('note-images').remove([storagePath])
      const { error } = await supabase.from('note_images').delete().eq('id', imageId)
      if (error) toast.error('Kunne ikke slette bilde')
    },
    [supabase]
  )

  return { images, isUploading, uploadImage, removeImage }
}
