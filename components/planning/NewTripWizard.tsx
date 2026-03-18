'use client'

import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react'
import { Trip, NewTripData, TripType } from '@/types'

interface NewTripWizardProps {
  open: boolean
  onClose: () => void
  onCreateTrip: (data: NewTripData) => Promise<Trip | null>
}

const TRIP_TYPES: { type: TripType; emoji: string; label: string; desc: string }[] = [
  { type: 'road_trip', emoji: '🚗', label: 'Road trip', desc: 'Kjøretur med stoppesteder langs veien' },
  { type: 'storbytur', emoji: '🏙️', label: 'Storbytur', desc: 'Én by utforsket dag for dag' },
  { type: 'resort', emoji: '🌴', label: 'Resort ferie', desc: 'Avslapping og aktiviteter på ett sted' },
]

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? 'w-4 h-2 bg-blue-500'
              : i < current
              ? 'w-2 h-2 bg-blue-400/60'
              : 'w-2 h-2 bg-slate-600'
          }`}
        />
      ))}
    </div>
  )
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
      <span className="text-sm text-slate-200">{label}</span>
      <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
            value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Ja
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
            !value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Nei
        </button>
      </div>
    </div>
  )
}

export default function NewTripWizard({ open, onClose, onCreateTrip }: NewTripWizardProps) {
  const [step, setStep] = useState(0)
  const [tripType, setTripType] = useState<TripType>('road_trip')
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [hasFlight, setHasFlight] = useState(true)
  const [hasCarRental, setHasCarRental] = useState(true)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')

  const isCityTrip = tripType !== 'road_trip'
  // Steps: 0=type, 1=grunninfo, 2=destinasjon(city only), 3=reisevalg, 4=beskrivelse
  const steps = isCityTrip ? 5 : 4
  const STEP_LABELS = isCityTrip
    ? ['Ferietype', 'Grunninfo', 'Destinasjon', 'Reisevalg', 'Beskrivelse']
    : ['Ferietype', 'Grunninfo', 'Reisevalg', 'Beskrivelse']

  // Map logical step index (accounting for skipped destinasjon step for road_trip)
  function getActualStep(logical: number) {
    if (!isCityTrip && logical >= 2) return logical + 1
    return logical
  }

  function reset() {
    setStep(0)
    setTripType('road_trip')
    setName('')
    setDateFrom('')
    setDateTo('')
    setCity('')
    setCountry('')
    setHasFlight(true)
    setHasCarRental(true)
    setDescription('')
    setGeocodeError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleTripTypeSelect(type: TripType) {
    setTripType(type)
    // Default car rental: off for city/resort trips
    if (type !== 'road_trip') setHasCarRental(false)
    else setHasCarRental(true)
  }

  function canNext(): boolean {
    const actual = getActualStep(step)
    if (actual === 0) return true // type always selected
    if (actual === 1) return name.trim().length > 0
    if (actual === 2) return city.trim().length > 0 && country.trim().length > 0
    return true
  }

  function next() {
    if (!canNext()) return
    if (step < steps - 1) setStep((s) => s + 1)
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  async function handleCreate() {
    setGeocodeError('')
    setCreating(true)

    let cityLat: number | null = null
    let cityLng: number | null = null

    if (isCityTrip && city && country) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        const query = encodeURIComponent(`${city}, ${country}`)
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`
        )
        const json = await res.json()
        if (json.results?.[0]?.geometry?.location) {
          cityLat = json.results[0].geometry.location.lat
          cityLng = json.results[0].geometry.location.lng
        } else {
          setGeocodeError(`Fant ikke koordinater for «${city}, ${country}». Sjekk stavemåten og prøv igjen.`)
          setCreating(false)
          return
        }
      } catch {
        setGeocodeError('Feil ved geocoding. Sjekk internettforbindelsen og prøv igjen.')
        setCreating(false)
        return
      }
    }

    const data: NewTripData = {
      name: name.trim(),
      year: dateFrom ? new Date(dateFrom).getFullYear() : new Date().getFullYear(),
      trip_type: tripType,
      has_flight: hasFlight,
      has_car_rental: hasCarRental,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      destination_city: isCityTrip ? city.trim() : null,
      destination_country: isCityTrip ? country.trim() : null,
      description: description.trim() || null,
      city_lat: cityLat,
      city_lng: cityLng,
    }

    const result = await onCreateTrip(data)
    setCreating(false)
    if (result) {
      reset()
      onClose()
    }
  }

  if (!open) return null

  const actualStep = getActualStep(step)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div>
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">
              Ny ferie
            </p>
            <h2 className="text-lg font-bold text-slate-100">{STEP_LABELS[step]}</h2>
          </div>
          <div className="flex items-center gap-3">
            <StepDots current={step} total={steps} />
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 overflow-y-auto min-h-[280px]">

          {/* Step 0: Ferietype */}
          {actualStep === 0 && (
            <div className="grid gap-3">
              {TRIP_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleTripTypeSelect(t.type)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    tripType === t.type
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                  }`}
                >
                  <span className="text-3xl">{t.emoji}</span>
                  <div>
                    <p className="font-bold text-slate-100 text-sm">{t.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                  </div>
                  {tripType === t.type && (
                    <Check className="w-4 h-4 text-blue-400 ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Grunninfo */}
          {actualStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Navn på turen *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    tripType === 'road_trip'
                      ? 'F.eks. Route 66 2026'
                      : tripType === 'storbytur'
                      ? 'F.eks. Paris 2026'
                      : 'F.eks. Syden 2026'
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && canNext() && next()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Dato fra
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      if (dateTo && e.target.value > dateTo) setDateTo('')
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Dato til
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              {dateFrom && dateTo && (
                <p className="text-xs text-slate-500">
                  {Math.max(0, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000))} netter
                </p>
              )}
            </div>
          )}

          {/* Step 2: Destinasjon (city trips only) */}
          {actualStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Angi destinasjonen for turen. Kartet vil automatisk zoome inn hit.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  By *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="F.eks. Paris"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Land *
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="F.eks. Frankrike"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && canNext() && next()}
                />
              </div>
              {geocodeError && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  {geocodeError}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Reisevalg */}
          {actualStep === 3 && (
            <div className="space-y-1">
              <p className="text-sm text-slate-400 mb-4">
                Disse valgene tilpasser funksjonaliteten i appen.
              </p>
              <ToggleField
                label="✈️  Skal du benytte fly på denne reisen?"
                value={hasFlight}
                onChange={setHasFlight}
              />
              <ToggleField
                label="🚗  Skal du leie bil på denne ferien?"
                value={hasCarRental}
                onChange={setHasCarRental}
              />
              {!hasCarRental && (
                <p className="text-xs text-slate-500 pt-2">
                  Uten leiebil vises en felles «Transport»-post i kostnadsoversikten i stedet for leiebil, bensin og parkering.
                </p>
              )}
            </div>
          )}

          {/* Step 4: Beskrivelse */}
          {actualStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                En kort beskrivelse av turen hjelper ferietips-assistenten gi deg bedre forslag. Dette feltet er valgfritt.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Beskrivelse (valgfritt)
                </label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    tripType === 'road_trip'
                      ? 'F.eks. Familie på 4, kjører Route 66 fra Chicago til Santa Monica i juli 2026...'
                      : tripType === 'storbytur'
                      ? 'F.eks. Par på ferie i Paris, interessert i kunst, mat og arkitektur...'
                      : 'F.eks. Familie med barn på resort i Spania, fokus på badeliv og avslapning...'
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              {geocodeError && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  {geocodeError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 bg-slate-800/30">
          <button
            type="button"
            onClick={step === 0 ? handleClose : prev}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Avbryt' : 'Tilbake'}
          </button>

          {step < steps - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Neste
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Oppretter…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Opprett tur
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
