'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, Package } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useTripPackingList } from '@/hooks/useTripPackingList'
import { useTravelers } from '@/hooks/useTravelers'
import TripManager from '@/components/planning/TripManager'
import { PackingCategory, TripPackingItem } from '@/types'

const CATEGORIES: { value: PackingCategory; label: string }[] = [
  { value: 'clothes', label: 'Klær' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'electronics', label: 'Elektronikk' },
  { value: 'documents', label: 'Dokumenter' },
  { value: 'handbaggage', label: 'Håndbagasje' },
  { value: 'other', label: 'Annet' },
]

export default function PakkelistePage() {
  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { items, loading, addItem, togglePacked, deleteItem } = useTripPackingList(currentTrip?.id ?? null)
  const { travelers } = useTravelers(currentTrip?.id ?? null)

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading} userId={userId}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!currentTrip ? (
          <EmptyState />
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <h1 className="text-lg font-semibold text-slate-100">Pakkeliste</h1>
              <p className="text-xs text-slate-500">{currentTrip.name}</p>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-600 text-sm">Laster pakkeliste…</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div
                  className="flex gap-4 p-6 h-full"
                  style={{ minWidth: `${(travelers.length + 1) * 290}px` }}
                >
                  {/* Felles-kolonne */}
                  <PackingColumn
                    title="Felles"
                    items={items.filter((i) => i.traveler_id === null)}
                    travelerId={null}
                    onAdd={addItem}
                    onToggle={togglePacked}
                    onDelete={deleteItem}
                  />

                  {/* Én kolonne per reisende */}
                  {travelers.map((traveler) => (
                    <PackingColumn
                      key={traveler.id}
                      title={traveler.name}
                      items={items.filter((i) => i.traveler_id === traveler.id)}
                      travelerId={traveler.id}
                      onAdd={addItem}
                      onToggle={togglePacked}
                      onDelete={deleteItem}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PackingColumn({
  title,
  items,
  travelerId,
  onAdd,
  onToggle,
  onDelete,
}: {
  title: string
  items: TripPackingItem[]
  travelerId: string | null
  onAdd: (item: string, category: PackingCategory, travelerId: string | null) => Promise<void>
  onToggle: (id: string, packed: boolean) => void
  onDelete: (id: string) => void
}) {
  const [newItem, setNewItem] = useState('')
  const [category, setCategory] = useState<PackingCategory>('other')

  const unpacked = items.filter((i) => !i.packed)
  const packed = items.filter((i) => i.packed)

  async function handleAdd() {
    if (!newItem.trim()) return
    await onAdd(newItem.trim(), category, travelerId)
    setNewItem('')
  }

  return (
    <div className="w-[270px] flex-shrink-0 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden h-full">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">
          {unpacked.length} igjen
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Unpacked items */}
        <div className="p-2 space-y-0.5">
          {unpacked.map((item) => (
            <PackingItem
              key={item.id}
              item={item}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}

          {unpacked.length === 0 && packed.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">Ingen elementer ennå</p>
          )}
        </div>

        {/* Packed section */}
        {packed.length > 0 && (
          <div className="border-t border-slate-800 mx-2 pt-2 pb-2">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide px-1 mb-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Pakket ({packed.length})
            </p>
            <div className="space-y-0.5">
              {packed.map((item) => (
                <PackingItem
                  key={item.id}
                  item={item}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add item input */}
      <div className="p-2 border-t border-slate-800 flex-shrink-0 space-y-1.5">
        <div className="flex gap-1">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Legg til..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-300 placeholder:text-slate-600 px-2.5 py-1.5 outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!newItem.trim()}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex-shrink-0"
            title="Legg til"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PackingCategory)}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded text-[11px] text-slate-500 px-2 py-1 outline-none focus:border-blue-500 transition-colors"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function PackingItem({
  item,
  onToggle,
  onDelete,
}: {
  item: TripPackingItem
  onToggle: (id: string, packed: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group/item flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/50 transition-colors">
      <button
        onClick={() => onToggle(item.id, !item.packed)}
        className="flex-shrink-0"
        title={item.packed ? 'Marker som upakket' : 'Marker som pakket'}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          item.packed
            ? 'bg-green-600 border-green-600'
            : 'border-slate-600 hover:border-blue-400'
        }`}>
          {item.packed && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
      </button>
      <span className={`flex-1 text-xs truncate ${
        item.packed ? 'text-slate-600 line-through' : 'text-slate-300'
      }`}>
        {item.item}
      </span>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover/item:opacity-100 flex-shrink-0 text-slate-600 hover:text-red-400 transition-all"
        title="Slett"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
      <div className="bg-slate-800 rounded-full p-5 mb-4">
        <Package className="w-10 h-10 text-slate-600" />
      </div>
      <p className="text-slate-400 text-sm max-w-xs">Velg en tur til venstre for å se pakkelisten</p>
    </div>
  )
}
