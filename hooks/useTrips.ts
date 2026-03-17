'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, NewTripData } from '@/types'
import { toast } from 'sonner'
import { logActivity } from '@/hooks/useActivityLog'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const loadTrips = useCallback(async () => {
    setLoading(true)
    const [{ data: { user } }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
    ])

    if (user) setUserId(user.id)

    if (!error && data) {
      setTrips(data as Trip[])
      // Auto-velg nyeste tur om ingen er valgt
      setCurrentTrip((prev) => prev ?? (data[0] as Trip) ?? null)

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

      const { name, year, trip_type, has_flight, has_car_rental,
              date_from, date_to, destination_city, destination_country,
              description, city_lat, city_lng } = tripData

      const { data, error } = await supabase
        .from('trips')
        .insert({
          name, year, status: 'planning', owner_id: user.id,
          trip_type: trip_type ?? 'road_trip',
          has_flight: has_flight ?? true,
          has_car_rental: has_car_rental ?? true,
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
      setCurrentTrip(newTrip)
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

      // Prøv med alle felt; fall tilbake til minste insert om kolonner mangler
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
        await supabase.from('travelers').insert({
          trip_id: newTrip.id,
          name: displayName,
        })
      }

      return newTrip
    },
    [supabase]
  )

  const updateTrip = useCallback(
    async (tripId: string, data: Partial<Pick<Trip, 'group_description'>>) => {
      setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...data } : t)))
      setCurrentTrip((prev) => (prev?.id === tripId ? { ...prev, ...data } : prev))
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
      setCurrentTrip((prev) => {
        if (prev?.id === tripId) return null
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
