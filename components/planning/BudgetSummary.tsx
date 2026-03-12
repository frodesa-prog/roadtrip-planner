'use client'

import { useState } from 'react'
import { Plane, Car, Fuel, Hotel } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface BudgetLine {
  label: string
  icon: React.ReactNode
  key: string
}

const BUDGET_LINES: BudgetLine[] = [
  { label: 'Fly', icon: <Plane className="w-3.5 h-3.5 text-sky-400" />, key: 'flight' },
  { label: 'Leiebil', icon: <Car className="w-3.5 h-3.5 text-violet-400" />, key: 'car' },
  { label: 'Bensin (estimat)', icon: <Fuel className="w-3.5 h-3.5 text-amber-400" />, key: 'gas' },
  { label: 'Hoteller totalt', icon: <Hotel className="w-3.5 h-3.5 text-blue-400" />, key: 'hotel' },
]

export default function BudgetSummary() {
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  function setAmount(key: string, value: string) {
    setAmounts((prev) => ({ ...prev, [key]: value }))
  }

  const total = Object.values(amounts).reduce((sum, v) => {
    const n = parseFloat(v)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  return (
    <div className="space-y-2">
      {BUDGET_LINES.map((line) => (
        <div key={line.key} className="flex items-center gap-2">
          {line.icon}
          <span className="text-xs text-slate-400 w-28 flex-shrink-0">{line.label}</span>
          <div className="flex items-center gap-1.5 flex-1">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={amounts[line.key] ?? ''}
              onChange={(e) => setAmount(line.key, e.target.value)}
              className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100"
            />
            <span className="text-xs text-slate-500 flex-shrink-0">kr</span>
          </div>
        </div>
      ))}

      <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Total estimert</span>
        <span className="text-sm font-bold text-green-400">
          {total.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
        </span>
      </div>
    </div>
  )
}
