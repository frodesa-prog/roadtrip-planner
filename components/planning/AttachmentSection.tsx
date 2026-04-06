'use client'

import { useRef, useState } from 'react'
import { Paperclip, Loader2, FileText, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Attachment, AttachmentEntityType } from '@/types'
import AttachmentViewer from './AttachmentViewer'

interface AttachmentSectionProps {
  entityType:      AttachmentEntityType
  entityId:        string
  attachments:     Attachment[]
  onAdd:           (entityType: AttachmentEntityType, entityId: string, file: File) => Promise<boolean>
  onRemove:        (id: string) => Promise<void>
}

const ACCEPTED = 'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf'
const MAX_MB   = 20

export default function AttachmentSection({
  entityType,
  entityId,
  attachments,
  onAdd,
  onRemove,
}: AttachmentSectionProps) {
  const inputRef             = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewer, setViewer]  = useState<Attachment | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    let ok = 0; let fail = 0
    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name} er for stor (maks ${MAX_MB} MB)`)
        fail++
        continue
      }
      const success = await onAdd(entityType, entityId, file)
      if (success) ok++; else { toast.error(`Kunne ikke laste opp ${file.name}`); fail++ }
    }
    if (ok > 0) toast.success(ok === 1 ? 'Vedlegg lastet opp' : `${ok} vedlegg lastet opp`)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      {/* ── Attachment chips row ─────────────────────────────────────────── */}
      {(attachments.length > 0 || uploading) && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-center gap-1 rounded-md overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
              style={{ maxWidth: 140 }}
              onClick={() => setViewer(att)}
              title={att.file_name}
            >
              {att.file_type === 'pdf' ? (
                /* PDF chip */
                <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-800 w-full">
                  <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-[10px] text-slate-300 truncate">{att.file_name}</span>
                </div>
              ) : (
                /* Image thumbnail */
                <div className="relative w-10 h-10 flex-shrink-0 bg-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.cloudinary_url.replace('/upload/', '/upload/c_fill,w_80,h_80,q_auto,f_auto/')}
                    alt={att.file_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Delete button (shown on hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(att.id)
                }}
                title="Fjern vedlegg"
                className="absolute top-0 right-0 bg-black/70 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          {uploading && (
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded-md border border-slate-700">
              <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
              <span className="text-[10px] text-slate-400">Laster opp…</span>
            </div>
          )}
        </div>
      )}

      {/* ── Upload button ────────────────────────────────────────────────── */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Legg til vedlegg (bilde eller PDF)"
        className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
      >
        {uploading
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <><Paperclip className="w-3 h-3" /><Plus className="w-2 h-2 -ml-0.5" /></>
        }
        <span>Vedlegg</span>
        {attachments.length > 0 && (
          <span className="text-slate-600">({attachments.length})</span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* ── Full-screen viewer ───────────────────────────────────────────── */}
      {viewer && (
        <AttachmentViewer
          attachment={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )
}
