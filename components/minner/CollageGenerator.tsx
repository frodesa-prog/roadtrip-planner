'use client'

import { MemoryPhoto, TripMemory } from '@/types'
import { useRef, useState } from 'react'
import { Layers, Loader2, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { nanoid } from 'nanoid'

interface Props {
  memory: TripMemory
  favoritePhotos: MemoryPhoto[]
  onCoverUpdated: (url: string) => void
}

export default function CollageGenerator({ memory, favoritePhotos, onCoverUpdated }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview]       = useState<string | null>(null)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  async function generateCollage() {
    if (!canvasRef.current || favoritePhotos.length === 0) return
    setGenerating(true)
    setSaved(false)
    setError(null)

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    if (!ctx) { setGenerating(false); return }

    // Grid: opptil 9 bilder (3×3), eller 4 bilder (2×2), eller 1 bilde
    const photos  = favoritePhotos.slice(0, 9)
    const cols    = photos.length <= 1 ? 1 : photos.length <= 4 ? 2 : 3
    const rows    = Math.ceil(photos.length / cols)
    const SIZE    = 800   // høy oppløsning → skarp som headerbakgrunn
    const GAP     = 8
    const W       = cols * SIZE + (cols - 1) * GAP
    const H       = rows * SIZE + (rows - 1) * GAP

    canvas.width  = W
    canvas.height = H
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // Last inn bilder via crossOrigin
    const loadImage = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload  = () => resolve(img)
        img.onerror = reject
        // Bruk Cloudinary-transform for konsistent størrelse.
        // f_auto konverterer HEIC/HEIF (iPhone) til JPEG/WebP automatisk.
        img.src = url.replace('/upload/', `/upload/c_fill,w_${SIZE},h_${SIZE},q_auto,f_auto/`)
      })

    try {
      const imgs = await Promise.all(photos.map((p) => loadImage(p.cloudinary_url)))

      imgs.forEach((img, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x   = col * (SIZE + GAP)
        const y   = row * (SIZE + GAP)
        ctx.drawImage(img, x, y, SIZE, SIZE)
      })

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setPreview(dataUrl)
    } catch (err) {
      console.error('Kollasj feilet:', err)
      setError('Kunne ikke generere kollasj. Sjekk at bildene er lastet opp riktig og prøv igjen.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveAsCover() {
    if (!preview || !cloudName || !uploadPreset) return
    setGenerating(true)

    try {
      // Last opp til Cloudinary via unsigned upload
      const blob = await (await fetch(preview)).blob()
      const form = new FormData()
      form.append('file',         blob, 'collage.jpg')
      form.append('upload_preset', uploadPreset)
      form.append('public_id',    `minner/${memory.id}/collage-${nanoid(6)}`)

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body:   form,
      })
      const data = await res.json()

      if (data.secure_url) {
        // Lagre URL i trip_memories
        const supabase = createClient()
        await supabase
          .from('trip_memories')
          .update({ cover_image_url: data.secure_url })
          .eq('id', memory.id)

        onCoverUpdated(data.secure_url)
        setSaved(true)
      }
    } catch (err) {
      console.error('Kollasj-opplasting feilet:', err)
    } finally {
      setGenerating(false)
    }
  }

  if (favoritePhotos.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic p-4 rounded-xl bg-slate-800/30 border border-dashed border-slate-700">
        Merk bilder som favoritter (⭐) for å generere en kollasjforsidebilde.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Lager en kollasj av dine {Math.min(favoritePhotos.length, 9)} favorittbilder som forsidebilde.
      </p>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={generateCollage}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          Generer kollasj
        </button>

        {preview && (
          <button
            onClick={saveAsCover}
            disabled={generating || saved}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              saved
                ? 'bg-emerald-700 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {saved ? <><Check className="w-4 h-4" /> Lagret som forsidebilde!</> : 'Bruk som forsidebilde'}
          </button>
        )}
      </div>

      {/* Feilmelding */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Forhåndsvisning */}
      {preview && (
        <div className="rounded-xl overflow-hidden border border-slate-700 inline-block">
          <img src={preview} alt="Kollasj-forhåndsvisning" className="max-w-xs w-full" />
        </div>
      )}

      {/* Skjult canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
