'use client'

import { useState, useMemo } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useTravelers } from '@/hooks/useTravelers'
import { Traveler } from '@/types'
import { Users, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERESTS = [
  { label: 'Baseball',    emoji: '⚾' },
  { label: 'Friluftsliv', emoji: '🥾' },
  { label: 'Restauranter', emoji: '🍽' },
  { label: 'Shopping',   emoji: '🛍' },
  { label: 'Museer',     emoji: '🏛' },
  { label: 'Musikk',     emoji: '🎵' },
  { label: 'Parker',     emoji: '🎡' },
  { label: 'Natur',      emoji: '🌲' },
  { label: 'Fotografi',  emoji: '📸' },
  { label: 'Strand',     emoji: '🏖' },
  { label: 'Sport',      emoji: '🏅' },
  { label: 'Kino',       emoji: '🎬' },
]

const GENDERS = [
  { value: 'mann',   label: 'Mann' },
  { value: 'kvinne', label: 'Kvinne' },
  { value: 'annet',  label: 'Annet' },
]

function genderEmoji(gender: string | null) {
  if (gender === 'mann') return '👨'
  return '🧑'
}

function GenderIcon({ gender, size, emojiSize }: { gender: string | null; size: number; emojiSize?: number }) {
  if (gender === 'kvinne') {
    return <img src="/femailemoji.png" alt="Kvinne" width={size} height={size} className="object-contain" />
  }
  return <span className="leading-none" style={{ fontSize: emojiSize ?? size }}>{genderEmoji(gender)}</span>
}

function parseInterests(str: string | null): string[] {
  if (!str) return []
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

// ─── Blank form state ─────────────────────────────────────────────────────────

interface FormState {
  name: string
  age: string
  gender: string
  interests: string[]
  description: string
}

function blankForm(): FormState {
  return { name: '', age: '', gender: '', interests: [], description: '' }
}

function travelerToForm(t: Traveler): FormState {
  return {
    name: t.name,
    age: t.age != null ? String(t.age) : '',
    gender: t.gender ?? '',
    interests: parseInterests(t.interests),
    description: t.description ?? '',
  }
}

// ─── InterestTag ──────────────────────────────────────────────────────────────

function InterestTag({
  label,
  emoji,
  selected,
  onClick,
}: {
  label: string
  emoji: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
        selected
          ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      <span>{emoji}</span>
      {label}
    </button>
  )
}

// ─── TravelerForm ─────────────────────────────────────────────────────────────

function TravelerForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState
  onSave: (form: FormState) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)

  function toggleInterest(label: string) {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(label)
        ? prev.interests.filter((i) => i !== label)
        : [...prev.interests, label],
    }))
  }

  return (
    <div className="space-y-4">
      {/* Name + Age + Gender row */}
      <div className="grid grid-cols-[1fr_5rem_8rem] gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Navn *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Fornavn og etternavn"
            className="w-full h-8 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Alder</label>
          <input
            type="number"
            min={0}
            max={120}
            value={form.age}
            onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
            placeholder="–"
            className="w-full h-8 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Kjønn</label>
          <select
            value={form.gender}
            onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
            className="w-full h-8 rounded-md bg-slate-800 border border-slate-700 px-2 text-sm text-slate-100 outline-none focus:border-blue-500/60"
          >
            <option value="">–</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Interests */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500">Interesser</label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <InterestTag
              key={i.label}
              label={i.label}
              emoji={i.emoji}
              selected={form.interests.includes(i.label)}
              onClick={() => toggleInterest(i.label)}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">Beskrivelse</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Litt om personen, preferanser, behov…"
          rows={2}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Avbryt
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Lagre
        </button>
      </div>
    </div>
  )
}

// ─── TravelerCard ─────────────────────────────────────────────────────────────

function TravelerCard({
  traveler,
  onUpdate,
  onDelete,
}: {
  traveler: Traveler
  onUpdate: (id: string, form: FormState) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const interests = parseInterests(traveler.interests)

  async function handleSave(form: FormState) {
    setSaving(true)
    await onUpdate(traveler.id, form)
    setSaving(false)
    setEditing(false)
  }

  const interestItems = useMemo(
    () => INTERESTS.filter((i) => interests.includes(i.label)),
    [interests],
  )

  if (editing) {
    return (
      <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-4">
        <TravelerForm
          initial={travelerToForm(traveler)}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          isSaving={saving}
        />
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <GenderIcon gender={traveler.gender} size={80} emojiSize={32} />
          <div>
            <p className="text-sm font-semibold text-slate-100">{traveler.name}</p>
            <p className="text-xs text-slate-500">
              {[
                traveler.age != null && `${traveler.age} år`,
                GENDERS.find((g) => g.value === traveler.gender)?.label,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(traveler.id)}
            className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interests */}
      {interestItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {interestItems.map((i) => (
            <span
              key={i.label}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400 border border-slate-700"
            >
              {i.emoji} {i.label}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {traveler.description && (
        <p className="text-xs text-slate-500 leading-relaxed italic">
          &ldquo;{traveler.description}&rdquo;
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TurfolgelPage() {
  const { currentTrip } = useTrips()
  const { travelers, addTraveler, updateTraveler, deleteTraveler } = useTravelers(
    currentTrip?.id ?? null,
  )

  const [showAddForm, setShowAddForm] = useState(false)
  const [addSaving, setAddSaving] = useState(false)

  async function handleAdd(form: FormState) {
    setAddSaving(true)
    await addTraveler({
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      interests: form.interests.length > 0 ? form.interests.join(',') : null,
      description: form.description.trim() || null,
    })
    setAddSaving(false)
    setShowAddForm(false)
    toast.success(`${form.name} lagt til i turfølget`)
  }

  async function handleUpdate(id: string, form: FormState) {
    await updateTraveler(id, {
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      interests: form.interests.length > 0 ? form.interests.join(',') : null,
      description: form.description.trim() || null,
    })
  }

  async function handleDelete(id: string) {
    const t = travelers.find((x) => x.id === id)
    await deleteTraveler(id)
    if (t) toast.success(`${t.name} fjernet fra turfølget`)
  }

  if (!currentTrip) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <p className="text-slate-500 text-sm">
          Ingen tur valgt. Gå til Planlegg for å opprette en tur.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-1.5">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Turfølge</h1>
              <p className="text-xs text-slate-500">
                {travelers.length === 0
                  ? 'Ingen registrert ennå'
                  : `${travelers.length} ${travelers.length === 1 ? 'person' : 'personer'} på tur`}
              </p>
            </div>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Legg til person
            </button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
              Ny person
            </p>
            <TravelerForm
              initial={blankForm()}
              onSave={handleAdd}
              onCancel={() => setShowAddForm(false)}
              isSaving={addSaving}
            />
          </div>
        )}

        {/* Traveler cards */}
        <div className="space-y-3">
          {travelers.map((t) => (
            <TravelerCard
              key={t.id}
              traveler={t}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Empty state */}
        {travelers.length === 0 && !showAddForm && (
          <div className="text-center py-16 text-slate-600">
            <p className="text-4xl mb-4">👥</p>
            <p className="text-sm font-medium text-slate-500">Ingen i turfølget ennå.</p>
            <p className="text-xs mt-1">Legg til personene som skal være med på ferien.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Legg til første person
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
