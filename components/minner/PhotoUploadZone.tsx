'use client'

import { CldUploadWidget } from 'next-cloudinary'
import { ImagePlus } from 'lucide-react'
import { NewPhotoData } from '@/hooks/useMemoryPhotos'

interface Props {
  memoryId: string
  stopId?: string | null
  onUploaded?: () => void
  addPhoto: (data: NewPhotoData) => Promise<unknown>
}

export default function PhotoUploadZone({ stopId, onUploaded, addPhoto }: Props) {

  const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    return (
      <div className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-700 rounded-lg">
        Cloudinary ikke konfigurert (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME mangler).
      </div>
    )
  }

  async function handleSuccess(result: unknown) {
    const info = (result as { info?: { public_id?: string; secure_url?: string; created_at?: string } }).info
    if (!info?.public_id || !info?.secure_url) return

    // EXIF-data leses ikke fra allerede opplastede bilder via widget.
    // Vi bruker Cloudinary's created_at som taken_at-fallback.
    const exif_lat: number | null = null
    const exif_lng: number | null = null
    const taken_at: string | null = (info as { created_at?: string }).created_at ?? null

    // Lag thumbnail via Cloudinary transform
    const thumbnail_url = info.secure_url.replace('/upload/', '/upload/c_fill,w_400,h_400,q_auto/')

    const photoData: NewPhotoData = {
      cloudinary_public_id: info.public_id,
      cloudinary_url:       info.secure_url,
      thumbnail_url,
      stop_id:              stopId ?? null,
      taken_at,
      exif_lat,
      exif_lng,
    }

    await addPhoto(photoData)
    onUploaded?.()
  }

  return (
    <CldUploadWidget
      uploadPreset={uploadPreset}
      options={{
        cloudName,
        multiple: true,
        maxFiles: 20,
        resourceType: 'image',
        sources: ['local', 'camera'],
        styles: {
          palette: {
            window: '#1e293b',
            windowBorder: '#334155',
            tabIcon: '#f59e0b',
            menuIcons: '#94a3b8',
            textDark: '#f1f5f9',
            textLight: '#1e293b',
            link: '#f59e0b',
            action: '#f59e0b',
            inactiveTabIcon: '#475569',
            error: '#ef4444',
            inProgress: '#f59e0b',
            complete: '#22c55e',
            sourceBg: '#0f172a',
          },
        },
      }}
      onSuccess={handleSuccess}
    >
      {({ open }) => (
        <button
          onClick={() => open()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-600 hover:border-amber-500/60 bg-slate-800/40 hover:bg-slate-800/70 text-slate-400 hover:text-amber-400 text-sm transition-all"
        >
          <ImagePlus className="w-4 h-4" />
          Last opp bilder
        </button>
      )}
    </CldUploadWidget>
  )
}
