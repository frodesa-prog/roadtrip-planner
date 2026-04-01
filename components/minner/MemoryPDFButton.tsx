'use client'

import { TripMemory } from '@/types'
import { FileDown, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface Props {
  memory: TripMemory
}

export default function MemoryPDFButton({ memory }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch('/api/minner/pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memoryId: memory.id }),
      })

      if (!res.ok) throw new Error('PDF-generering feilet')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${memory.title ?? 'Minnebok'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Genererer PDF…</>
        : <><FileDown className="w-4 h-4" /> Last ned PDF</>
      }
    </button>
  )
}
