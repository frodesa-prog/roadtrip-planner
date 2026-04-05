'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Check, Package, ChevronUp, ChevronDown, Pencil, Luggage, SlidersHorizontal, X } from 'lucide-react'
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
  const { currentTrip, loading: tripsLoading } = useTrips()
  const { items, loading, addItem, updateItem, togglePacked, moveItem, deleteItem } =
    useTripPackingList(currentTrip?.id ?? null)
  const { travelers, updateTraveler } = useTravelers(currentTrip?.id ?? null)

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeMobileCol, setActiveMobileCol] = useState(0)

  const mobileColumns = [
    { id: 'felles', title: 'Felles' },
    ...travelers.map((t) => ({ id: t.id, title: t.name })),
  ]

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Mobil sidebar-overlay backdrop ── */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className={`
        fixed top-11 bottom-16 left-0 z-50 w-[280px]
        md:relative md:top-auto md:bottom-auto md:z-auto md:w-[240px] md:min-w-[200px] md:translate-x-0
        h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 overflow-y-auto
        transition-transform duration-200
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <TripManager currentTrip={currentTrip} loading={tripsLoading} />
        {currentTrip && travelers.length > 0 && (
          <BaggageAllowancePanel travelers={travelers} onUpdate={updateTraveler} />
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobil: bagasje-knapp */}
        <div className="md:hidden flex items-center justify-end px-3 py-2 border-b border-slate-800 flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-xs"
            title="Bagasjeinfo"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {!currentTrip ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop header */}
            <div className="hidden md:block px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <h1 className="text-lg font-semibold text-slate-100">Pakkeliste</h1>
              <p className="text-xs text-slate-500">{currentTrip.name}</p>
            </div>

            {/* Mobil kolonnetabs */}
            {!loading && (
              <div className="md:hidden flex border-b border-slate-800 overflow-x-auto flex-shrink-0">
                {mobileColumns.map((col, idx) => (
                  <button
                    key={col.id}
                    onClick={() => setActiveMobileCol(idx)}
                    className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      activeMobileCol === idx
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    {col.title}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-600 text-sm">Laster pakkeliste…</p>
              </div>
            ) : (
              <>
                {/* Mobil: én kolonne av gangen */}
                <div className="md:hidden flex-1 overflow-hidden p-3">
                  {activeMobileCol === 0 && (
                    <PackingColumn
                      title="Felles"
                      items={items.filter((i) => i.traveler_id === null)}
                      travelerId={null}
                      onAdd={addItem} onUpdate={updateItem}
                      onToggle={togglePacked} onMove={moveItem} onDelete={deleteItem}
                      fullWidth
                    />
                  )}
                  {travelers.map((traveler, idx) =>
                    activeMobileCol === idx + 1 ? (
                      <PackingColumn
                        key={traveler.id}
                        title={traveler.name}
                        items={items.filter((i) => i.traveler_id === traveler.id)}
                        travelerId={traveler.id}
                        onAdd={addItem} onUpdate={updateItem}
                        onToggle={togglePacked} onMove={moveItem} onDelete={deleteItem}
                        fullWidth
                      />
                    ) : null
                  )}
                </div>

                {/* Desktop: alle kolonner side om side */}
                <div className="hidden md:block flex-1 overflow-x-auto overflow-y-hidden">
                  <div
                    className="flex gap-4 p-6 h-full"
                    style={{ minWidth: `${(travelers.length + 1) * 300}px` }}
                  >
                    <PackingColumn
                      title="Felles"
                      items={items.filter((i) => i.traveler_id === null)}
                      travelerId={null}
                      onAdd={addItem} onUpdate={updateItem}
                      onToggle={togglePacked} onMove={moveItem} onDelete={deleteItem}
                    />
                    {travelers.map((traveler) => (
                      <PackingColumn
                        key={traveler.id}
                        title={traveler.name}
                        items={items.filter((i) => i.traveler_id === traveler.id)}
                        travelerId={traveler.id}
                        onAdd={addItem} onUpdate={updateItem}
                        onToggle={togglePacked} onMove={moveItem} onDelete={deleteItem}
                      />
                    ))}
                  </div>
                </div>
              </>
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
  fullWidth = false,
}: {
  title: string
  items: TripPackingItem[]
  travelerId: string | null
  onAdd: (item: string, category: PackingCategory, travelerId: string | null) => Promise<void>
  onUpdate: (id: string, newText: string) => Promise<void>
  onToggle: (id: string, packed: boolean) => void
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>
  onDelete: (id: string) => Promise<void>
  fullWidth?: boolean
}) {
  const [newItem, setNewItem] = useState('')
  const [category, setCategory] = useState<PackingCategory>('other')

  // Quick-add at top
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickItem, setQuickItem] = useState('')
  const [quickCategory, setQuickCategory] = useState<PackingCategory>('other')
  const quickInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showQuickAdd) quickInputRef.current?.focus()
  }, [showQuickAdd])

  async function handleQuickAdd() {
    if (!quickItem.trim()) return
    await onAdd(quickItem.trim(), quickCategory, travelerId)
    setQuickItem('')
    quickInputRef.current?.focus()
  }

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
    <div className={`${fullWidth ? 'w-full' : 'w-[285px]'} flex-shrink-0 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden h-full`}>
      {/* Column header */}
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{unpacked.length} igjen</span>
          <button
            onClick={() => { setShowQuickAdd((v) => !v); setQuickItem('') }}
            title="Legg til"
            className={`p-1 rounded-md transition-colors ${
              showQuickAdd
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick-add form – fixed below header, never scrolls away */}
      {showQuickAdd && (
        <div className="px-2 pt-2 pb-2 border-b border-slate-800 flex-shrink-0 space-y-1.5 bg-slate-900">
          <div className="flex gap-1">
            <input
              ref={quickInputRef}
              value={quickItem}
              onChange={(e) => setQuickItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd()
                if (e.key === 'Escape') { setShowQuickAdd(false); setQuickItem('') }
              }}
              placeholder="Legg til..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-300 placeholder:text-slate-600 px-2.5 py-1.5 outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickItem.trim()}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex-shrink-0"
              title="Legg til"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setShowQuickAdd(false); setQuickItem('') }}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors flex-shrink-0"
              title="Avbryt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <select
            value={quickCategory}
            onChange={(e) => setQuickCategory(e.target.value as PackingCategory)}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded text-[11px] text-slate-500 px-2 py-1 outline-none focus:border-blue-500 transition-colors"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

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
      <div>
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
  // Start in edit mode if no values have been set yet
  const hasValues =
    traveler.cabin_bags != null || traveler.cabin_bag_weight != null ||
    traveler.checked_bags != null || traveler.checked_bag_weight != null ||
    traveler.cabin_bags_home != null || traveler.cabin_bag_weight_home != null ||
    traveler.checked_bags_home != null || traveler.checked_bag_weight_home != null
  const [editing, setEditing] = useState(!hasValues)

  function handleChange(field: keyof Traveler, raw: string) {
    const val = raw === '' ? null : parseFloat(raw)
    if (val !== null && isNaN(val)) return
    onUpdate(traveler.id, { [field]: val })
  }

  return (
    <div className="px-3 py-3 border-b border-slate-800/50 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-300 truncate">{traveler.name}</p>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <Pencil className="w-2.5 h-2.5" /> Rediger
          </button>
        ) : (
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-blue-400 hover:text-blue-300 hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <Check className="w-2.5 h-2.5" /> Ferdig
          </button>
        )}
      </div>

      {/* Utreise */}
      <p className="text-[10px] font-semibold text-blue-500/80 uppercase tracking-wide mb-1.5">Utreise</p>
      <BaggageRow
        label="Håndbagasje"
        bags={traveler.cabin_bags} bagWeight={traveler.cabin_bag_weight}
        onBags={(v) => handleChange('cabin_bags', v)}
        onWeight={(v) => handleChange('cabin_bag_weight', v)}
        editing={editing}
      />
      <BaggageRow
        label="Innsjekket"
        bags={traveler.checked_bags} bagWeight={traveler.checked_bag_weight}
        onBags={(v) => handleChange('checked_bags', v)}
        onWeight={(v) => handleChange('checked_bag_weight', v)}
        editing={editing}
        className="mb-3"
      />

      {/* Hjemreise */}
      <p className="text-[10px] font-semibold text-emerald-500/80 uppercase tracking-wide mb-1.5">Hjemreise</p>
      <BaggageRow
        label="Håndbagasje"
        bags={traveler.cabin_bags_home} bagWeight={traveler.cabin_bag_weight_home}
        onBags={(v) => handleChange('cabin_bags_home', v)}
        onWeight={(v) => handleChange('cabin_bag_weight_home', v)}
        editing={editing}
      />
      <BaggageRow
        label="Innsjekket"
        bags={traveler.checked_bags_home} bagWeight={traveler.checked_bag_weight_home}
        onBags={(v) => handleChange('checked_bags_home', v)}
        onWeight={(v) => handleChange('checked_bag_weight_home', v)}
        editing={editing}
      />
    </div>
  )
}

function BaggageRow({
  label, bags, bagWeight, onBags, onWeight, editing, className = '',
}: {
  label: string
  bags: number | null
  bagWeight: number | null
  onBags: (v: string) => void
  onWeight: (v: string) => void
  editing: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 mb-1 ${className}`}>
      <span className={`text-[10px] w-[68px] flex-shrink-0 ${editing ? 'text-slate-500' : 'text-slate-600'}`}>{label}</span>
      <BaggageInput value={bags} onChange={onBags} placeholder="1" step={1} min={0} editing={editing} />
      <span className={`text-[10px] ${editing ? 'text-slate-600' : 'text-slate-700'}`}>kolli</span>
      <BaggageInput value={bagWeight} onChange={onWeight} placeholder="—" step={0.5} min={0} editing={editing} />
      <span className={`text-[10px] ${editing ? 'text-slate-600' : 'text-slate-700'}`}>kg</span>
    </div>
  )
}

function BaggageInput({
  value,
  onChange,
  placeholder,
  step,
  min,
  editing,
}: {
  value: number | null
  onChange: (val: string) => void
  placeholder: string
  step: number
  min: number
  editing: boolean
}) {
  if (!editing) {
    return (
      <span className="w-8 text-[11px] text-slate-600 text-center tabular-nums border border-slate-800 rounded px-1 py-0.5">
        {value != null ? value : <span className="text-slate-700">—</span>}
      </span>
    )
  }
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      className="w-8 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300 text-center px-1 py-0.5 outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
