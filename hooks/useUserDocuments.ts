'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserDocument, DocumentType } from '@/types'
import { toast } from 'sonner'

const BUCKET = 'user-documents'

export function useUserDocuments() {
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }
      const { data } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!cancelled && data) {
        const docs = (data as UserDocument[]).map((doc) => ({
          ...doc,
          publicUrl: supabase.storage.from(BUCKET).getPublicUrl(doc.storage_path).data.publicUrl,
        }))
        setDocuments(docs)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const uploadDocument = useCallback(
    async (file: File, name: string, documentType: DocumentType): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setIsUploading(true)
      try {
        const ext = file.name.split('.').pop() ?? 'pdf'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type })

        if (uploadError) {
          toast.error('Kunne ikke laste opp dokument')
          return
        }

        const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

        const { data: created, error } = await supabase
          .from('user_documents')
          .insert({ user_id: user.id, name, document_type: documentType, storage_path: path, file_type: file.type })
          .select()
          .single()

        if (error) {
          toast.error('Kunne ikke lagre dokumentinformasjon')
          await supabase.storage.from(BUCKET).remove([path])
          return
        }

        setDocuments((prev) => [{ ...(created as UserDocument), publicUrl }, ...prev])
        toast.success('Dokument lastet opp')
      } finally {
        setIsUploading(false)
      }
    },
    [supabase],
  )

  const deleteDocument = useCallback(
    async (id: string, storagePath: string): Promise<void> => {
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      await supabase.storage.from(BUCKET).remove([storagePath])
      const { error } = await supabase.from('user_documents').delete().eq('id', id)
      if (error) toast.error('Kunne ikke slette dokument')
      else toast.success('Dokument slettet')
    },
    [supabase],
  )

  return { documents, loading, isUploading, uploadDocument, deleteDocument }
}
