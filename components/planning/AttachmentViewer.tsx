'use client'

import { useEffect } from 'react'
import { X, ExternalLink, Download, FileText } from 'lucide-react'
import { Attachment } from '@/types'

interface AttachmentViewerProps {
  attachment: Attachment
  onClose: () => void
}

export default function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 flex-shrink-0">
          {attachment.file_type === 'pdf'
            ? <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
            : <span className="text-base leading-none flex-shrink-0">🖼️</span>
          }
          <span className="flex-1 text-sm text-slate-200 truncate font-medium">
            {attachment.file_name}
          </span>
          <a
            href={attachment.cloudinary_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Åpne i ny fane"
            className="text-slate-400 hover:text-blue-400 transition-colors p-1 rounded"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={attachment.cloudinary_url}
            download={attachment.file_name}
            title="Last ned"
            className="text-slate-400 hover:text-green-400 transition-colors p-1 rounded"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden min-h-0">
          {attachment.file_type === 'image' ? (
            /* Image viewer */
            <div className="w-full h-full flex items-center justify-center bg-slate-950 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.cloudinary_url}
                alt={attachment.file_name}
                className="max-w-full max-h-full object-contain rounded"
                style={{ maxHeight: 'calc(90vh - 56px)' }}
              />
            </div>
          ) : (
            /* PDF viewer */
            <div className="w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
              <iframe
                src={attachment.cloudinary_url}
                title={attachment.file_name}
                className="flex-1 w-full border-0"
                style={{ minHeight: '60vh' }}
              />
              {/* Fallback for browsers that block iframe PDF */}
              <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-700 flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-500">Vises ikke riktig?</span>
                <a
                  href={attachment.cloudinary_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Åpne PDF i ny fane →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
