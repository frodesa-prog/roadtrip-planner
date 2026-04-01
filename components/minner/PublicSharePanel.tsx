'use client'

import { TripMemory } from '@/types'
import { Globe, Lock, Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface Props {
  memory: TripMemory
  onTogglePublic: () => Promise<void>
}

export default function PublicSharePanel({ memory, onTogglePublic }: Props) {
  const [toggling, setToggling] = useState(false)
  const [copied, setCopied]     = useState(false)

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/public/minner/${memory.public_slug}`
    : `/public/minner/${memory.public_slug}`

  async function handleToggle() {
    setToggling(true)
    await onTogglePublic()
    setToggling(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Toggle offentlig */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40">
        <div className="flex-shrink-0 mt-0.5">
          {memory.is_public
            ? <Globe className="w-5 h-5 text-emerald-400" />
            : <Lock className="w-5 h-5 text-slate-400" />
          }
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-200">
            {memory.is_public ? 'Minneboken er offentlig' : 'Minneboken er privat'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {memory.is_public
              ? 'Hvem som helst med lenken kan se minneboken din.'
              : 'Bare du og turdeltakere kan se minneboken.'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
            memory.is_public
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {toggling ? '…' : memory.is_public ? 'Gjør privat' : 'Del offentlig'}
        </button>
      </div>

      {/* Del-lenke */}
      {memory.is_public && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Offentlig lenke</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-700">
            <span className="flex-1 text-xs text-slate-300 truncate font-mono">{publicUrl}</span>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              {copied ? <><Check className="w-3 h-3" /> Kopiert!</> : <><Copy className="w-3 h-3" /> Kopier</>}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
