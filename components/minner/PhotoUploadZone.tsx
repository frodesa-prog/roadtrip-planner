'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { gps as exifrGps, parse as exifrParse } from 'exifr'
import { NewPhotoData } from '@/hooks/useMemoryPhotos'
import type { Stop, Activity, Dining } from '@/types'

// ── Haversine distance (km) ───────────────────────────────────────────────────

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R   = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Auto-assign: find nearest stop / activity / dining ────────────────────────

interface AutoAssign {
  stop_id:     string | null
  activity_id: string | null
  dining_id:   string | null
}

function findNearest(
  photoLat: number,
  photoLng: number,
  stops:      Stop[],
  activities: Activity[],
  dining:     Dining[],
): AutoAssign {
  const MAX_KM = 80   // ignore anything further away than this

  let bestDist = MAX_KM
  let best: AutoAssign = { stop_id: null, activity_id: null, dining_id: null }

  const stopById = new Map(stops.map(s => [s.id, s]))

  // Activities (use own pin if set, else parent stop coords)
  activities.forEach(a => {
    const lat = a.map_lat ?? stopById.get(a.stop_id)?.lat ?? null
    const lng = a.map_lng ?? stopById.get(a.stop_id)?.lng ?? null
    if (lat == null || lng == null) return
    const d = haversineKm(photoLat, photoLng, lat, lng)
    if (d < bestDist) {
      bestDist = d
      best = {
        stop_id:     stopById.get(a.stop_id)?.id ?? null,
        activity_id: a.id,
        dining_id:   null,
      }
    }
  })

  // Dining (use own pin if set, else parent stop coords)
  dining.forEach(d => {
    const lat = d.map_lat ?? stopById.get(d.stop_id)?.lat ?? null
    const lng = d.map_lng ?? stopById.get(d.stop_id)?.lng ?? null
    if (lat == null || lng == null) return
    const dist = haversineKm(photoLat, photoLng, lat, lng)
    if (dist < bestDist) {
      bestDist = dist
      best = {
        stop_id:     stopById.get(d.stop_id)?.id ?? null,
        activity_id: null,
        dining_id:   d.id,
      }
    }
  })

  // Stops
  stops.forEach(s => {
    if (!s.lat || !s.lng) return
    const dist = haversineKm(photoLat, photoLng, s.lat, s.lng)
    if (dist < bestDist) {
      bestDist = dist
      best = { stop_id: s.id, activity_id: null, dining_id: null }
    }
  })

  return best
}

// ── Upload a single file to Cloudinary (unsigned) ────────────────────────────

async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
): Promise<{ public_id: string; secure_url: string; created_at: string } | null> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: fd },
  )
  if (!res.ok) return null
  return res.json()
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  memoryId:    string
  stops?:      Stop[]
  activities?: Activity[]
  dining?:     Dining[]
  onUploaded?: () => void
  addPhoto:    (data: NewPhotoData) => Promise<unknown>
}

export default function PhotoUploadZone({
  stops      = [],
  activities = [],
  dining     = [],
  onUploaded,
  addPhoto,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState({ done: 0, total: 0 })

  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    return (
      <div className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-700 rounded-lg">
        Cloudinary ikke konfigurert (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME mangler).
      </div>
    )
  }

  async function processFile(file: File): Promise<void> {
    // 1. Read EXIF GPS + timestamp in parallel
    const [gps, exifMeta] = await Promise.all([
      exifrGps(file).catch(() => null),
      exifrParse(file, ['DateTimeOriginal']).catch(() => null),
    ])

    const exif_lat: number | null = gps?.latitude  ?? null
    const exif_lng: number | null = gps?.longitude ?? null

    const taken_at: string | null = (() => {
      const raw = (exifMeta as Record<string, unknown> | null)?.DateTimeOriginal
      if (!raw) return null
      if (raw instanceof Date) return raw.toISOString()
      return String(raw)
    })()

    // 2. Auto-assign to nearest entity
    const autoAssign: AutoAssign =
      exif_lat != null && exif_lng != null && stops.length > 0
        ? findNearest(exif_lat, exif_lng, stops, activities, dining)
        : { stop_id: null, activity_id: null, dining_id: null }

    // 3. Upload to Cloudinary
    const info = await uploadToCloudinary(file, cloudName!, uploadPreset!)
    if (!info) throw new Error('Cloudinary-opplasting mislyktes')

    const thumbnail_url = info.secure_url.replace(
      '/upload/',
      '/upload/c_fill,w_400,h_400,q_auto,f_auto/',
    )

    // 4. Persist to DB
    await addPhoto({
      cloudinary_public_id: info.public_id,
      cloudinary_url:       info.secure_url,
      thumbnail_url,
      taken_at:             taken_at ?? info.created_at ?? null,
      exif_lat,
      exif_lng,
      ...autoAssign,
    })
  }

  async function handleFiles(files: FileList) {
    if (!files.length) return

    setUploading(true)
    setProgress({ done: 0, total: files.length })

    let assigned = 0
    let failed   = 0

    await Promise.all(
      Array.from(files).map(async (file) => {
        try {
          // Check if this file will get an assignment (peek at GPS before upload)
          const gps = await exifrGps(file).catch(() => null)
          if (gps?.latitude != null && stops.length > 0) {
            const a = findNearest(gps.latitude, gps.longitude, stops, activities, dining)
            if (a.stop_id || a.activity_id || a.dining_id) assigned++
          }
          await processFile(file)
        } catch (err) {
          console.error('Upload failed:', file.name, err)
          failed++
        } finally {
          setProgress(p => ({ ...p, done: p.done + 1 }))
        }
      }),
    )

    const n = files.length - failed
    if (failed > 0) toast.error(`${failed} bilde${failed !== 1 ? 'r' : ''} mislyktes`)
    if (n > 0) {
      toast.success(
        assigned > 0
          ? `${n} bilde${n !== 1 ? 'r' : ''} lastet opp · ${assigned} automatisk knyttet til sted`
          : `${n} bilde${n !== 1 ? 'r' : ''} lastet opp`,
      )
    }

    setUploading(false)
    setProgress({ done: 0, total: 0 })
    if (inputRef.current) inputRef.current.value = ''
    onUploaded?.()
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files) }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-600 hover:border-amber-500/60 bg-slate-800/40 hover:bg-slate-800/70 text-slate-400 hover:text-amber-400 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{progress.done} / {progress.total} bilder…</span>
          </>
        ) : (
          <>
            <ImagePlus className="w-4 h-4" />
            Last opp bilder
          </>
        )}
      </button>
    </div>
  )
}
