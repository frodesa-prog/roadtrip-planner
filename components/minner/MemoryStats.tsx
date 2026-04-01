'use client'

import { TripMemory } from '@/types'
import { MapPin, Moon, Route, Calendar } from 'lucide-react'

interface Props {
  memory: TripMemory
}

export default function MemoryStats({ memory }: Props) {
  const stats = [
    {
      icon: <MapPin className="w-5 h-5 text-amber-400" />,
      label: 'Stoppesteder',
      value: memory.total_stops != null ? `${memory.total_stops}` : '–',
    },
    {
      icon: <Moon className="w-5 h-5 text-indigo-400" />,
      label: 'Netter',
      value: memory.total_nights != null ? `${memory.total_nights}` : '–',
    },
    {
      icon: <Route className="w-5 h-5 text-emerald-400" />,
      label: 'Kjørt',
      value: memory.total_km != null
        ? `${Math.round(memory.total_km).toLocaleString('nb-NO')} km`
        : '–',
    },
    {
      icon: <Calendar className="w-5 h-5 text-sky-400" />,
      label: 'Sist generert',
      value: memory.generated_at
        ? new Date(memory.generated_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Ikke generert',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40"
        >
          {s.icon}
          <span className="text-xl font-bold text-slate-100">{s.value}</span>
          <span className="text-xs text-slate-500">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
