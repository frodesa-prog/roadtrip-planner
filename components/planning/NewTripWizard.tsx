'use client'

import { useState, useMemo } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Loader2, UserCheck, UserX, Mail, Users, Search, MapPin } from 'lucide-react'
import { Trip, NewTripData, TripType, TransportType, RoadTripRegion, GeoResult } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface NewTripWizardProps {
  open: boolean
  onClose: () => void
  onCreateTrip: (data: NewTripData) => Promise<Trip | null>
}

interface InviteEntry {
  email: string
  status: 'checking' | 'found' | 'not_found'
  userId?: string
  displayName?: string
  wantToInvite: boolean
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
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState(0)
  const [tripType, setTripType] = useState<TripType>('road_trip')
  const [roadTripRegion, setRoadTripRegion] = useState<RoadTripRegion>('usa')
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [transportType, setTransportType] = useState<TransportType>('fly')
  const [hasCarRental, setHasCarRental] = useState(true)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')

  // ── Road trip home stop state ──────────────────────────────────────────────
  const [startQuery, setStartQuery]         = useState('')
  const [startResult, setStartResult]       = useState<GeoResult | null>(null)
  const [startSearching, setStartSearching] = useState(false)
  const [startError, setStartError]         = useState('')
  const [differentEnd, setDifferentEnd]     = useState(false)
  const [endQuery, setEndQuery]             = useState('')
  const [endResult, setEndResult]           = useState<GeoResult | null>(null)
  const [endSearching, setEndSearching]     = useState(false)
  const [endError, setEndError]             = useState('')

  // ── Invite step state ──────────────────────────────────────────────────────
  const [inviteEntries, setInviteEntries] = useState<InviteEntry[]>([])
  const [inviteInput, setInviteInput] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)

  const isCityTrip = tripType !== 'road_trip'
  // Both flows: 6 steps total
  // Rendering slots: 0=Ferietype, 1=Region(road only), 2=Grunninfo, 3=Destinasjon(city only), 4=Reisevalg, 5=Beskrivelse, 6=Deltakere
  const steps = 6
  const STEP_LABELS = isCityTrip
    ? ['Ferietype', 'Grunninfo', 'Destinasjon', 'Reisevalg', 'Beskrivelse', 'Deltakere']
    : ['Ferietype', 'Region', 'Grunninfo', 'Reisevalg', 'Beskrivelse', 'Deltakere']

  // Map logical step (0-5) → rendering slot
  function getActualStep(logical: number): number {
    if (isCityTrip) {
      // City trips skip Region (slot 1): 0→0, 1→2, 2→3, 3→4, 4→5, 5→6
      if (logical === 0) return 0
      if (logical === 1) return 2
      if (logical === 2) return 3
      if (logical === 3) return 4
      if (logical === 4) return 5
      return 6
    } else {
      // Road trips skip Destinasjon (slot 3): 0→0, 1→1, 2→2, 3→4, 4→5, 5→6
      if (logical === 0) return 0
      if (logical === 1) return 1
      if (logical === 2) return 2
      if (logical === 3) return 4
      if (logical === 4) return 5
      return 6
    }
  }

  // ── Geocode a free-text address for road trip home stops ───────────────────
  async function searchHomeStop(
    query: string,
    isIntl: boolean,
    setResult: (r: GeoResult | null) => void,
    setSearching: (v: boolean) => void,
    setError: (s: string) => void,
  ) {
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
      )
      const json = await res.json()
      const r    = json.results?.[0]
      if (!r?.geometry?.location) {
        setError(`Fant ikke «${query}». Prøv å skrive litt mer spesifikt.`)
        setResult(null)
      } else {
        const comps = r.address_components as { long_name: string; short_name: string; types: string[] }[]
        const cityComp  = comps.find((c) => c.types.includes('locality') || c.types.includes('postal_town'))
        const stateComp = isIntl
          ? comps.find((c) => c.types.includes('country'))
          : comps.find((c) => c.types.includes('administrative_area_level_1'))
        setResult({
          city:  cityComp?.long_name ?? r.formatted_address.split(',')[0],
          state: isIntl ? (stateComp?.long_name ?? '') : (stateComp?.short_name ?? ''),
          lat:   r.geometry.location.lat,
          lng:   r.geometry.location.lng,
        })
      }
    } catch {
      setError('Feil ved søk. Sjekk internettforbindelsen.')
      setResult(null)
    }
    setSearching(false)
  }

  function reset() {
    setStep(0)
    setTripType('road_trip')
    setRoadTripRegion('usa')
    setName('')
    setDateFrom('')
    setDateTo('')
    setCity('')
    setCountry('')
    setTransportType('fly')
    setHasCarRental(true)
    setDescription('')
    setGeocodeError('')
    setStartQuery('')
    setStartResult(null)
    setStartSearching(false)
    setStartError('')
    setDifferentEnd(false)
    setEndQuery('')
    setEndResult(null)
    setEndSearching(false)
    setEndError('')
    setInviteEntries([])
    setInviteInput('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleTripTypeSelect(type: TripType) {
    setTripType(type)
    if (type !== 'road_trip') setHasCarRental(false)
    else setHasCarRental(true)
  }

  function canNext(): boolean {
    const actual = getActualStep(step)
    if (actual === 0) return true   // Ferietype
    if (actual === 1) return true   // Region – always a default selected
    if (actual === 2) {             // Grunninfo
      if (name.trim().length === 0) return false
      if (tripType === 'road_trip' && !startResult) return false
      return true
    }
    if (actual === 3) return city.trim().length > 0 && country.trim().length > 0  // Destinasjon
    return true
  }

  function next() {
    if (!canNext()) return
    if (step < steps - 1) setStep((s) => s + 1)
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  // ── Invite helpers ───────────────────────────────────────────────────────────
  async function handleAddInvite() {
    const email = inviteInput.trim().toLowerCase()
    if (!email || inviteEntries.some((e) => e.email === email)) return
    setInviteInput('')
    setCheckingEmail(true)

    setInviteEntries((prev) => [...prev, { email, status: 'checking', wantToInvite: false }])

    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, display_name')
      .eq('email', email)
      .maybeSingle()

    setInviteEntries((prev) =>
      prev.map((e) =>
        e.email === email
          ? error || !data
            ? { ...e, status: 'not_found' }
            : { ...e, status: 'found', userId: (data as { user_id: string; display_name: string | null }).user_id, displayName: (data as { user_id: string; display_name: string | null }).display_name ?? undefined }
          : e
      )
    )
    setCheckingEmail(false)
  }

  function removeInviteEntry(email: string) {
    setInviteEntries((prev) => prev.filter((e) => e.email !== email))
  }

  function toggleWantToInvite(email: string) {
    setInviteEntries((prev) =>
      prev.map((e) => (e.email === email ? { ...e, wantToInvite: !e.wantToInvite } : e))
    )
  }

  // ── Create trip + process invites ──────────────────────────────────────────
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
      transport_type: transportType,
      has_flight: transportType !== 'ingen',
      has_car_rental: hasCarRental,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      destination_city: isCityTrip ? city.trim() : null,
      destination_country: isCityTrip ? country.trim() : null,
      description: description.trim() || null,
      city_lat: cityLat,
      city_lng: cityLng,
      road_trip_region: tripType === 'road_trip' ? roadTripRegion : null,
      different_end_location: tripType === 'road_trip' ? differentEnd : false,
      start_stop: tripType === 'road_trip' ? startResult : null,
      end_stop:   tripType === 'road_trip' && differentEnd ? endResult : null,
    }

    const result = await onCreateTrip(data)

    if (result) {
      const tripId = result.id
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Get sender display name (for email)
        const { data: myProfile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle()
        const senderName = (myProfile as { display_name: string | null } | null)?.display_name
          || user.email?.split('@')[0]
          || 'En venn'

        for (const entry of inviteEntries) {
          // ── Found user: add as traveler + grant trip access + send email ─
          if (entry.status === 'found' && entry.userId) {
            const { data: profileFull } = await supabase
              .from('user_profiles')
              .select('display_name, birth_date, gender')
              .eq('user_id', entry.userId)
              .maybeSingle()

            const pf = profileFull as { display_name: string | null; birth_date: string | null; gender: string | null } | null

            // Calculate age
            let age: number | null = null
            if (pf?.birth_date) {
              const today = new Date()
              const dob = new Date(pf.birth_date)
              let a = today.getFullYear() - dob.getFullYear()
              if (today.getMonth() < dob.getMonth() ||
                (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) a--
              age = a
            }

            // Check preference access
            const { data: accessData } = await supabase
              .from('preference_access')
              .select('id')
              .eq('user_id', entry.userId)
              .eq('granted_to_email', user.email ?? '')
              .maybeSingle()

            let interests: string | null = null
            let travelerDescription: string | null = null
            let aiContext: string | null = null

            if (accessData) {
              const { data: prefData } = await supabase
                .from('user_preferences')
                .select('interests, interests_extra, food_preferences, mobility_notes, other_info')
                .eq('user_id', entry.userId)
                .maybeSingle()
              const prefs = prefData as {
                interests: string | null
                interests_extra: string | null
                food_preferences: string | null
                mobility_notes: string | null
                other_info: string | null
              } | null
              if (prefs) {
                interests = prefs.interests
                travelerDescription = prefs.interests_extra
                const parts: string[] = []
                if (prefs.food_preferences) parts.push(`Mat: ${prefs.food_preferences}`)
                if (prefs.mobility_notes) parts.push(`Mobilitet: ${prefs.mobility_notes}`)
                if (prefs.other_info) parts.push(prefs.other_info)
                aiContext = parts.length > 0 ? parts.join('\n') : null
              }
            }

            // Add as traveler
            await supabase.from('travelers').insert({
              trip_id: tripId,
              name: entry.displayName || entry.email.split('@')[0],
              age,
              gender: pf?.gender ?? null,
              interests,
              description: travelerDescription,
              ai_context: aiContext,
              linked_user_id: entry.userId,
            })

            // Grant trip access via trip_shares so the trip shows up on their account
            await supabase.from('trip_shares').insert({
              trip_id: tripId,
              owner_id: user.id,
              shared_with_email: entry.email,
              access_level: 'write',
              status: 'accepted',
            })

            // Notify by email that they've been added to the trip
            fetch('/api/share-trip-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientEmail: entry.email,
                tripName: result.name,
                senderName,
                accessLevel: 'write',
                alreadyMember: true,
              }),
            }).catch(() => {})
          }

          // ── Not found, user chose to invite ─────────────────────────────
          if (entry.status === 'not_found' && entry.wantToInvite) {
            // Create trip_shares record (ignore duplicate errors)
            await supabase.from('trip_shares').insert({
              trip_id: tripId,
              owner_id: user.id,
              shared_with_email: entry.email,
              access_level: 'write',
              status: 'pending',
            })

            // Send invitation email
            fetch('/api/share-trip-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientEmail: entry.email,
                tripName: result.name,
                senderName,
                accessLevel: 'write',
              }),
            }).catch(() => {})
          }
        }
      }

      reset()
      onClose()
    }

    setCreating(false)
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

          {/* Slot 0: Ferietype */}
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

          {/* Slot 1: Region (road trip only) */}
          {actualStep === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'usa',           emoji: '🇺🇸', label: 'USA',        desc: 'Teller antall stater' },
                { value: 'international', emoji: '🌍', label: 'Andre land', desc: 'Teller antall land'   },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoadTripRegion(opt.value)}
                  className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 text-center transition-all ${
                    roadTripRegion === opt.value
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                  }`}
                >
                  <span className="text-4xl">{opt.emoji}</span>
                  <p className="font-bold text-slate-100 text-sm">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                  {roadTripRegion === opt.value && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Slot 2: Grunninfo */}
          {actualStep === 2 && (
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

              {/* ── Road trip: home stop address fields ── */}
              {tripType === 'road_trip' && (
                <div className="space-y-3 pt-1">
                  <div className="border-t border-slate-700/60 pt-3">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Startsted *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={startQuery}
                        onChange={(e) => { setStartQuery(e.target.value); setStartResult(null); setStartError('') }}
                        placeholder="F.eks. Oslo, Oslo sentrum"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            searchHomeStop(startQuery, roadTripRegion === 'international', setStartResult, setStartSearching, setStartError)
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => searchHomeStop(startQuery, roadTripRegion === 'international', setStartResult, setStartSearching, setStartError)}
                        disabled={!startQuery.trim() || startSearching}
                        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 transition-colors"
                      >
                        {startSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                    {startError && <p className="mt-1 text-xs text-red-400">{startError}</p>}
                    {startResult && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-400">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{startResult.city}{startResult.state ? `, ${startResult.state}` : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Different end location checkbox */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={differentEnd}
                      onChange={(e) => { setDifferentEnd(e.target.checked); setEndResult(null); setEndError('') }}
                      className="mt-0.5 accent-blue-500 w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300">Sluttstedet er et annet sted enn startstedet</span>
                  </label>

                  {differentEnd && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                        Sluttsted
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={endQuery}
                          onChange={(e) => { setEndQuery(e.target.value); setEndResult(null); setEndError('') }}
                          placeholder="F.eks. Bergen, Bergen sentrum"
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              searchHomeStop(endQuery, roadTripRegion === 'international', setEndResult, setEndSearching, setEndError)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => searchHomeStop(endQuery, roadTripRegion === 'international', setEndResult, setEndSearching, setEndError)}
                          disabled={!endQuery.trim() || endSearching}
                          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 transition-colors"
                        >
                          {endSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                      {endError && <p className="mt-1 text-xs text-red-400">{endError}</p>}
                      {endResult && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-teal-400">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{endResult.city}{endResult.state ? `, ${endResult.state}` : ''}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Slot 3: Destinasjon (city trips only) */}
          {actualStep === 3 && (
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

          {/* Slot 4: Reisevalg */}
          {actualStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Disse valgene tilpasser funksjonaliteten i appen.
              </p>

              {/* Transport til reisemål */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Transport til reisemål
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'fly',   emoji: '✈️',  label: 'Fly' },
                    { value: 'tog',   emoji: '🚂',  label: 'Tog' },
                    { value: 'ingen', emoji: '🚫',  label: 'Ingen' },
                  ] as { value: TransportType; emoji: string; label: string }[]).map(({ value, emoji, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransportType(value)}
                      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border transition-colors ${
                        transportType === value
                          ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                          : 'border-slate-700 hover:border-slate-600 text-slate-400'
                      }`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <ToggleField
                label="🚗  Skal du leie bil på denne ferien?"
                value={hasCarRental}
                onChange={setHasCarRental}
              />
              {!hasCarRental && (
                <p className="text-xs text-slate-500">
                  Uten leiebil vises en felles «Transport»-post i kostnadsoversikten i stedet for leiebil, bensin og parkering.
                </p>
              )}
            </div>
          )}

          {/* Slot 5: Beskrivelse */}
          {actualStep === 5 && (
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
            </div>
          )}

          {/* Slot 6: Deltakere */}
          {actualStep === 6 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-400 leading-relaxed">
                  Inviter andre til ferien. Finnes de som brukere legges de automatisk til i turfølget.
                  Finnes de ikke får du mulighet til å sende en invitasjon på e-post.
                  <span className="block mt-1 text-slate-500">Du kan også legge til deltakere etter at turen er opprettet.</span>
                </p>
              </div>

              {/* Email input row */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddInvite() }
                  }}
                  placeholder="e-postadresse"
                  disabled={checkingEmail}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm
                    placeholder:text-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleAddInvite}
                  disabled={!inviteInput.trim() || checkingEmail}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
                    text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  {checkingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Legg til'}
                </button>
              </div>

              {/* Invite entries list */}
              <div className="space-y-2">
                {inviteEntries.map((entry) => (
                  <div
                    key={entry.email}
                    className={`rounded-xl border p-3 ${
                      entry.status === 'found'
                        ? 'bg-green-900/10 border-green-700/30'
                        : entry.status === 'not_found'
                        ? 'bg-amber-900/10 border-amber-700/30'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {entry.status === 'checking' && (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0 mt-0.5" />
                      )}
                      {entry.status === 'found' && (
                        <UserCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      )}
                      {entry.status === 'not_found' && (
                        <UserX className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{entry.email}</p>

                        {entry.status === 'found' && (
                          <p className="text-xs text-green-400 mt-0.5">
                            {entry.displayName
                              ? `${entry.displayName} er bruker – legges til i turfølget`
                              : 'Bruker funnet – legges til i turfølget'}
                          </p>
                        )}

                        {entry.status === 'not_found' && (
                          <div className="mt-1.5">
                            <p className="text-xs text-amber-300 mb-2">
                              Ingen bruker funnet med denne e-postadressen.
                            </p>
                            {!entry.wantToInvite ? (
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-400">Send invitasjon til å opprette konto?</p>
                                <button
                                  type="button"
                                  onClick={() => toggleWantToInvite(entry.email)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/20 border border-amber-600/40
                                    text-amber-300 text-xs font-medium hover:bg-amber-600/30 transition-colors"
                                >
                                  <Mail className="w-3 h-3" />
                                  Ja, send invitasjon
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-amber-300">
                                <Check className="w-3.5 h-3.5" />
                                Invitasjon sendes når turen opprettes
                                <button
                                  type="button"
                                  onClick={() => toggleWantToInvite(entry.email)}
                                  className="ml-1 text-slate-500 hover:text-slate-300 underline"
                                >
                                  Angre
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {entry.status === 'checking' && (
                          <p className="text-xs text-slate-500 mt-0.5">Søker etter bruker…</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeInviteEntry(entry.email)}
                        className="p-1 rounded-md text-slate-600 hover:text-slate-400 hover:bg-slate-700 transition-colors flex-shrink-0"
                        title="Fjern"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {inviteEntries.length === 0 && (
                <p className="text-xs text-slate-600 text-center pt-2">
                  Ingen deltakere lagt til ennå
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
              disabled={creating || !name.trim() || checkingEmail}
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
