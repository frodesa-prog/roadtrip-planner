'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Check, Package, ChevronUp, ChevronDown, Pencil, Luggage } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useTripPackingList } from '@/hooks/useTripPackingList'
import { useTravelers } from '@/hooks/useTravelers'
import TripManager from '@/components/planning/TripManager'
import { PackingCategory, TripPackingItem, Traveler } from '@/types'

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
  const { items, loading, addItem, updateItem, togglePacked, moveItem, deleteItem } =
    useTripPackingList(currentTrip?.id ?? null)
  const { travelers, updateTraveler } = useTravelers(currentTrip?.id ?? null)

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading} userId={userId}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />
        {currentTrip && travelers.length > 0 && (
          <BaggageAllowancePanel travelers={travelers} onUpdate={updateTraveler} />
        )}
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
                  style={{ minWidth: `${(travelers.length + 1) * 300}px` }}
                >
                  {/* Felles-kolonne */}
                  <PackingColumn
                    title="Felles"
                    items={items.filter((i) => i.traveler_id === null)}
                    travelerId={null}
                    onAdd={addItem}
                    onUpdate={updateItem}
                    onToggle={togglePacked}
                    onMove={moveItem}
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
                      onUpdate={updateItem}
                      onToggle={togglePacked}
                      onMove={moveItem}
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

// ─── Column ───────────────────────────────────────────────────────────────────

function PackingColumn({
  title,
  items,
  travelerId,
  onAdd,
  onUpdate,
  onToggle,
  onMove,
  onDelete,
}: {
  title: string
  items: TripPackingItem[]
  travelerId: string | null
  onAdd: (item: string, category: PackingCategory, travelerId: string | null) => Promise<void>
  onUpdate: (id: string, newText: string) => Promise<void>
  onToggle: (id: string, packed: boolean) => void
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [newItem, setNewItem] = useState('')
  const [category, setCategory] = useState<PackingCategory>('other')

  const unpacked = items.filter((i) => !i.packed).sort((a, b) => a.sort_order - b.sort_order)
  const packed = items.filter((i) => i.packed).sort((a, b) => a.sort_order - b.sort_order)

  async function handleAdd() {
    if (!newItem.trim()) return
    await onAdd(newItem.trim(), category, travelerId)
    setNewItem('')
  }

  // Group unpacked items by category (only show categories that have items)
  const grouped = CATEGORIES
    .map((cat) => ({
      ...cat,
      items: unpacked.filter((i) => i.category === cat.value),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="w-[285px] flex-shrink-0 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden h-full">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">{unpacked.length} igjen</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Grouped unpacked items */}
        {grouped.length === 0 && packed.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-6">Ingen elementer ennå</p>
        )}

        {grouped.map((group) => (
          <div key={group.value} className="px-2 pt-3">
            {/* Category header */}
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item, idx) => (
                <PackingItem
                  key={item.id}
                  item={item}
                  isFirst={idx === 0}
                  isLast={idx === group.items.length - 1}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onMove={onMove}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Packed section */}
        {packed.length > 0 && (
          <div className="border-t border-slate-800 mx-2 mt-3 pt-2 pb-2">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide px-1 mb-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Pakket ({packed.length})
            </p>
            <div className="space-y-0.5">
              {packed.map((item) => (
                <PackingItem
                  key={item.id}
                  item={item}
                  isFirst={false}
                  isLast={false}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onMove={onMove}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}

        <div className="h-2" />
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

// ─── Item ─────────────────────────────────────────────────────────────────────

function PackingItem({
  item,
  isFirst,
  isLast,
  onToggle,
  onUpdate,
  onMove,
  onDelete,
}: {
  item: TripPackingItem
  isFirst: boolean
  isLast: boolean
  onToggle: (id: string, packed: boolean) => void
  onUpdate: (id: string, newText: string) => Promise<void>
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.item)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function handleEditStart() {
    setEditText(item.item)
    setEditing(true)
  }

  async function handleEditSave() {
    setEditing(false)
    if (editText.trim() && editText.trim() !== item.item) {
      await onUpdate(item.id, editText.trim())
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleEditSave()
    if (e.key === 'Escape') { setEditing(false); setEditText(item.item) }
  }

  return (
    <div className="group/item">
      {/* Confirm delete bar */}
      {confirmDelete && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-950/40 border border-red-800/40 mb-0.5">
          <span className="flex-1 text-xs text-red-300">Slette «{item.item}»?</span>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={() => { setConfirmDelete(false); onDelete(item.id) }}
            className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
          >
            Slett
          </button>
        </div>
      )}

      {!confirmDelete && (
        <div className="flex items-center gap-1 px-1 py-1 rounded-md hover:bg-slate-800/50 transition-colors">
          {/* Checkbox */}
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

          {/* Text / edit input */}
          {editing ? (
            <input
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleEditKeyDown}
              className="flex-1 bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-200 outline-none"
            />
          ) : (
            <span
              className={`flex-1 text-xs truncate cursor-pointer ${
                item.packed ? 'text-slate-600 line-through' : 'text-slate-300'
              }`}
              onDoubleClick={handleEditStart}
              title="Dobbeltklikk for å redigere"
            >
              {item.item}
            </span>
          )}

          {/* Action buttons (visible on hover) */}
          {!item.packed && !editing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={handleEditStart}
                className="p-0.5 text-slate-600 hover:text-blue-400 transition-colors"
                title="Rediger"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onMove(item.id, 'up')}
                disabled={isFirst}
                className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                title="Flytt opp"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onMove(item.id, 'down')}
                disabled={isLast}
                className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                title="Flytt ned"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-0.5 text-slate-600 hover:text-red-400 transition-colors"
                title="Slett"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Delete for packed items */}
          {item.packed && !editing && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-0.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 flex-shrink-0"
              title="Slett"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Baggage allowance panel ──────────────────────────────────────────────────

function BaggageAllowancePanel({
  travelers,
  onUpdate,
}: {
  travelers: Traveler[]
  onUpdate: (id: string, data: Partial<Traveler>) => Promise<void>
}) {
  return (
    <div className="border-t border-slate-800 flex flex-col flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
        <Luggage className="w-3.5 h-3.5 text-slate-500" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bagasjekvote</p>
      </div>
      <div className="overflow-y-auto max-h-[280px]">
        {travelers.map((traveler) => (
          <BaggageTravelerRow key={traveler.id} traveler={traveler} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  )
}

function BaggageTravelerRow({
  traveler,
  onUpdate,
}: {
  traveler: Traveler
  onUpdate: (id: string, data: Partial<Traveler>) => Promise<void>
}) {
  function handleChange(field: keyof Traveler, raw: string) {
    const val = raw === '' ? null : parseFloat(raw)
    if (val !== null && isNaN(val)) return
    onUpdate(traveler.id, { [field]: val })
  }

  return (
    <div className="px-3 py-2.5 border-b border-slate-800/50 last:border-b-0">
      <p className="text-xs font-medium text-slate-300 mb-1.5 truncate">{traveler.name}</p>

      {/* Håndbagasje */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] text-slate-500 w-[54px] flex-shrink-0">Hånd</span>
        <BaggageInput
          value={traveler.cabin_bags}
          onChange={(v) => handleChange('cabin_bags', v)}
          placeholder="1"
          step={1}
          min={0}
        />
        <span className="text-[10px] text-slate-600">kolli</span>
        <BaggageInput
          value={traveler.cabin_bag_weight}
          onChange={(v) => handleChange('cabin_bag_weight', v)}
          placeholder="8"
          step={0.5}
          min={0}
        />
        <span className="text-[10px] text-slate-600">kg</span>
      </div>

      {/* Innsjekket */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-500 w-[54px] flex-shrink-0">Sjekket</span>
        <BaggageInput
          value={traveler.checked_bags}
          onChange={(v) => handleChange('checked_bags', v)}
          placeholder="1"
          step={1}
          min={0}
        />
        <span className="text-[10px] text-slate-600">kolli</span>
        <BaggageInput
          value={traveler.checked_bag_weight}
          onChange={(v) => handleChange('checked_bag_weight', v)}
          placeholder="23"
          step={0.5}
          min={0}
        />
        <span className="text-[10px] text-slate-600">kg</span>
      </div>
    </div>
  )
}

function BaggageInput({
  value,
  onChange,
  placeholder,
  step,
  min,
}: {
  value: number | null
  onChange: (val: string) => void
  placeholder: string
  step: number
  min: number
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      className="w-10 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300 text-center px-1 py-0.5 outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

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
