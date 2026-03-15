'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Traveler, UserPreferences, UserProfile } from '@/types'
import { toast } from 'sonner'

type TravelerInput = Partial<Pick<Traveler, 'name' | 'age' | 'gender' | 'interests' | 'description' | 'ai_context' | 'linked_user_id' | 'cabin_bags' | 'cabin_bag_weight' | 'checked_bags' | 'checked_bag_weight'>>

// Beregn alder fra fødselsdato
function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const today = new Date()
  const dob = new Date(birthDate)
  let age = today.getFullYear() - dob.getFullYear()
  if (
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
  ) age--
  return age
}

// Bygg skjult AI-kontekst fra preferanser (vises ikke i UI)
function buildAiContext(prefs: UserPreferences | null): string | null {
  if (!prefs) return null
  const parts: string[] = []
  if (prefs.food_preferences) parts.push(`Mat: ${prefs.food_preferences}`)
  if (prefs.mobility_notes) parts.push(`Mobilitet: ${prefs.mobility_notes}`)
  if (prefs.other_info) parts.push(prefs.other_info)
  return parts.length > 0 ? parts.join('\n') : null
}

export type LinkedTravelerResult = 'success' | 'not_found' | 'no_access' | 'error'

export function useTravelers(tripId: string | null) {
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setTravelers([]); return }
    supabase
      .from('travelers')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at')
      .then(({ data }) => { if (data) setTravelers(data as Traveler[]) })
  }, [tripId, supabase])

  const addTraveler = useCallback(async (data: TravelerInput): Promise<Traveler | null> => {
    if (!tripId) return null
    const optimistic: Traveler = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      name: data.name ?? '',
      age: data.age ?? null,
      gender: data.gender ?? null,
      interests: data.interests ?? null,
      description: data.description ?? null,
      ai_context: data.ai_context ?? null,
      linked_user_id: data.linked_user_id ?? null,
      cabin_bags: data.cabin_bags ?? 1,
      cabin_bag_weight: data.cabin_bag_weight ?? 8,
      checked_bags: data.checked_bags ?? 1,
      checked_bag_weight: data.checked_bag_weight ?? 23,
      created_at: new Date().toISOString(),
    }
    setTravelers((prev) => [...prev, optimistic])
    const { data: created, error } = await supabase
      .from('travelers')
      .insert({ trip_id: tripId, ...data })
      .select()
      .single()
    if (error) {
      setTravelers((prev) => prev.filter((t) => t.id !== optimistic.id))
      toast.error('Kunne ikke legge til person')
      return null
    }
    setTravelers((prev) =>
      prev.map((t) => (t.id === optimistic.id ? (created as Traveler) : t)),
    )
    return created as Traveler
  }, [tripId, supabase])

  // ── Legg til registrert appbruker via e-postadresse ────────────────────────
  const addLinkedTraveler = useCallback(
    async (email: string): Promise<LinkedTravelerResult> => {
      if (!tripId) return 'error'

      const { data: { user: me } } = await supabase.auth.getUser()
      if (!me) return 'error'

      // Slå opp bruker i user_profiles (inkl. fødselsdato og kjønn)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, email, birth_date, gender')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      if (profileError || !profileData) return 'not_found'

      const foundProfile = profileData as UserProfile

      const profileAge = ageFromBirthDate(foundProfile.birth_date)
      const profileGender = foundProfile.gender ?? null

      // Sjekk at vi ikke legger til oss selv igjen
      if (foundProfile.user_id === me.id) {
        // Hent egne preferanser
        const { data: ownPrefData } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', me.id)
          .maybeSingle()
        const ownPrefs = ownPrefData as UserPreferences | null

        await addTraveler({
          name: foundProfile.display_name || email.split('@')[0],
          age: profileAge,
          gender: profileGender,
          interests: ownPrefs?.interests ?? null,
          description: ownPrefs?.interests_extra ?? null,
          ai_context: buildAiContext(ownPrefs),
          linked_user_id: foundProfile.user_id,
        })
        return 'success'
      }

      // Sjekk om brukeren har gitt oss tilgang til sine preferanser
      const { data: accessData } = await supabase
        .from('preference_access')
        .select('id')
        .eq('user_id', foundProfile.user_id)
        .eq('granted_to_email', me.email ?? '')
        .maybeSingle()

      if (!accessData) {
        // Ingen tilgang – legg til med navn/alder/kjønn, ingen preferanser
        await addTraveler({
          name: foundProfile.display_name || email.split('@')[0],
          age: profileAge,
          gender: profileGender,
          linked_user_id: foundProfile.user_id,
        })
        return 'no_access'
      }

      // Tilgang gitt – hent preferanser og fyll ut deltaker
      const { data: prefData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', foundProfile.user_id)
        .maybeSingle()

      const prefs = prefData as UserPreferences | null

      await addTraveler({
        name: foundProfile.display_name || email.split('@')[0],
        age: profileAge,
        gender: profileGender,
        interests: prefs?.interests ?? null,
        description: prefs?.interests_extra ?? null,      // Vises i UI
        ai_context: buildAiContext(prefs),                // Skjult AI-kontekst
        linked_user_id: foundProfile.user_id,
      })

      return 'success'
    },
    [tripId, supabase, addTraveler],
  )

  const updateTraveler = useCallback(async (id: string, data: TravelerInput) => {
    setTravelers((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)))
    const { error } = await supabase.from('travelers').update(data).eq('id', id)
    if (error) toast.error('Kunne ikke oppdatere person')
  }, [supabase])

  const deleteTraveler = useCallback(async (id: string) => {
    setTravelers((prev) => prev.filter((t) => t.id !== id))
    const { error } = await supabase.from('travelers').delete().eq('id', id)
    if (error) toast.error('Kunne ikke slette person')
  }, [supabase])

  return { travelers, addTraveler, addLinkedTraveler, updateTraveler, deleteTraveler }
}
