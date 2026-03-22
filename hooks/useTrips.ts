'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, NewTripData } from '@/types'
import { toast } from 'sonner'
import { logActivity } from '@/hooks/useActivityLog'

const SELECTED_TRIP_KEY = 'selected_trip_id'

function getSavedTripId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SELECTED_TRIP_KEY)
}

function saveSelectedTripId(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) {
    localStorage.setItem(SELECTED_TRIP_KEY, id)
  } else {
    localStorage.removeItem(SELECTED_TRIP_KEY)
  }
}

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTrip, setCurrentTripState] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // Wrapper: updates state, persists to localStorage og varsler andre instanser
  const setCurrentTrip = useCallback((trip: Trip | null) => {
    saveSelectedTripId(trip?.id ?? null)
    setCurrentTripState(trip)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trip-changed', { detail: { trip } }))
    }
  }, [])

  const loadTrips = useCallback(async () => {
    setLoading(true)
    const [{ data: { user } }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
    ])

    if (user) setUserId(user.id)

    if (!error && data) {
      setTrips(data as Trip[])

      // Auto-velg tur: bruk lagret valg fra localStorage, ellers nyeste tur
      setCurrentTripState((prev) => {
        if (prev) return prev  // allerede satt (f.eks. av ChatContext)
        const savedId = getSavedTripId()
        if (savedId) {
          const saved = (data as Trip[]).find((t) => t.id === savedId) ?? null
          if (saved) return saved
        }
        return (data[0] as Trip) ?? null
      })

      // Oppdater status til 'accepted' for delte turer mottaker har sett
      if (user) {
        const sharedTripIds = (data as Trip[])
          .filter((t) => t.owner_id !== user.id)
          .map((t) => t.id)
        if (sharedTripIds.length > 0) {
          supabase
            .from('trip_shares')
            .update({ status: 'accepted' })
            .eq('shared_with_email', user.email ?? '')
            .eq('status', 'pending')
            .in('trip_id', sharedTripIds)
            .then(() => {})
        }
      }
    }
    setLoading(false)
  }, [supabase])

  const createTrip = useCallback(
    async (tripData: NewTripData): Promise<Trip | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { name, year, trip_type, has_flight, has_car_rental, transport_type,
              date_from, date_to, destination_city, destination_country,
              description, city_lat, city_lng } = tripData

      const { data, error } = await supabase
        .from('trips')
        .insert({
          name, year, status: 'planning', owner_id: user.id,
          trip_type: trip_type ?? 'road_trip',
          has_flight: has_flight ?? true,
          has_car_rental: has_car_rental ?? true,
          transport_type: transport_type ?? 'fly',
          date_from: date_from ?? null,
          date_to: date_to ?? null,
          destination_city: destination_city ?? null,
          destination_country: destination_country ?? null,
          description: description ?? null,
          group_description: description ?? null,
        })
        .select()
        .single()

      if (error) {
        toast.error('Kunne ikke opprette tur')
        return null
      }

      const newTrip = data as Trip
      setTrips((prev) => [newTrip, ...prev])
      setCurrentTrip(newTrip)  // saves to localStorage
      toast.success(`"${name}" er opprettet! 🗺️`)
      logActivity({ log_type: 'database', action: 'INSERT', entity_type: 'trip', entity_name: name, trip_id: newTrip.id })

      // For city trips (storbytur/resort): auto-create single city stop from geocoded coordinates
      if (trip_type !== 'road_trip' && city_lat != null && city_lng != null && destination_city) {
        let nights = 0
        if (date_from && date_to) {
          const from = new Date(date_from + 'T00:00:00')
          const to = new Date(date_to + 'T00:00:00')
          nights = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
        }
        await supabase.from('stops').insert({
          trip_id: newTrip.id,
          city: destination_city,
          state: destination_country ?? '',
          lat: city_lat,
          lng: city_lng,
          order: 0,
          nights,
          arrival_date: date_from ?? null,
        })
      }

      // Auto-legg til tureier som første reisedeltaker
      const [profileRes, prefRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('display_name, birth_date, gender')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_preferences')
          .select('interests, interests_extra, food_preferences, mobility_notes, other_info')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      const prof = profileRes.data as {
        display_name: string | null
        birth_date: string | null
        gender: string | null
      } | null
      const prefs = prefRes.data as {
        interests: string | null
        interests_extra: string | null
        food_preferences: string | null
        mobility_notes: string | null
        other_info: string | null
      } | null

      const displayName = prof?.display_name || user.email?.split('@')[0] || 'Meg'

      // Beregn alder
      let age: number | null = null
      if (prof?.birth_date) {
        const today = new Date()
        const dob = new Date(prof.birth_date)
        age = today.getFullYear() - dob.getFullYear()
        if (today.getMonth() < dob.getMonth() ||
            (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--
      }

      // Bygg skjult AI-kontekst
      const aiParts: string[] = []
      if (prefs?.food_preferences) aiParts.push(`Mat: ${prefs.food_preferences}`)
      if (prefs?.mobility_notes) aiParts.push(`Mobilitet: ${prefs.mobility_notes}`)
      if (prefs?.other_info) aiParts.push(prefs.other_info)

      // Legg til tureier som første deltaker i turfølget
      const { error: travelerErr } = await supabase.from('travelers').insert({
        trip_id: newTrip.id,
        name: displayName,
        linked_user_id: user.id,
        age,
        gender: prof?.gender ?? null,
        interests: prefs?.interests ?? null,
        description: prefs?.interests_extra ?? null,
        ai_context: aiParts.length > 0 ? aiParts.join('\n') : null,
      })
      if (travelerErr) {
        // Fallback: insert med kjernefelter (linked_user_id bevares alltid)
        await supabase.from('travelers').insert({
          trip_id: newTrip.id,
          name: displayName,
          linked_user_id: user.id,
          age,
          gender: prof?.gender ?? null,
        })
      }

      return newTrip
    },
    [supabase, setCurrentTrip]
  )

  const updateTrip = useCallback(
    async (tripId: string, data: Partial<Pick<Trip, 'group_description' | 'date_from' | 'date_to' | 'year'>>) => {
      setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...data } : t)))
      // Oppdater currentTrip i state (ID endres ikke, localStorage trenger ikke oppdateres)
      setCurrentTripState((prev) => (prev?.id === tripId ? { ...prev, ...data } : prev))
      const { error } = await supabase.from('trips').update(data).eq('id', tripId)
      if (error) toast.error('Kunne ikke lagre endringen')
    },
    [supabase],
  )

  const deleteTrip = useCallback(
    async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId)
      if (error) {
        toast.error('Kunne ikke slette tur')
        return
      }
      const deletedTrip = trips.find((t) => t.id === tripId)
      setTrips((prev) => prev.filter((t) => t.id !== tripId))
      // Fjern fra localStorage og nullstill valg hvis denne turen var aktiv
      setCurrentTripState((prev) => {
        if (prev?.id === tripId) {
          saveSelectedTripId(null)
          return null
        }
        return prev
      })
      toast.success('Tur slettet')
      logActivity({ log_type: 'database', action: 'DELETE', entity_type: 'trip', entity_name: deletedTrip?.name, trip_id: tripId })
    },
    [supabase, trips]
  )

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  // Lytt på trip-changed fra andre kilder (f.eks. NavBar-modal)
  // og oppdater currentTrip-state umiddelbart uten side-reload
  useEffect(() => {
    function onExternalTripChange(e: Event) {
      const trip = (e as CustomEvent<{ trip: Trip }>).detail?.trip
      if (trip) {
        setCurrentTripState(trip)
        saveSelectedTripId(trip.id)
      }
    }
    window.addEventListener('trip-changed', onExternalTripChange)
    return () => window.removeEventListener('trip-changed', onExternalTripChange)
  }, [])

  return {
    trips,
    currentTrip,
    loading,
    userId,
    setCurrentTrip,
    createTrip,
    updateTrip,
    deleteTrip,
  }
}
