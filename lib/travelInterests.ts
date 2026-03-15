// Delte interessekategorier – brukes i TripPanels (turfølge-skjema)
// og MinSide (preferanser-siden). Oppdater kun her.

export const TRAVEL_INTERESTS = [
  { label: 'Baseball',      emoji: '⚾' },
  { label: 'Friluftsliv',   emoji: '🥾' },
  { label: 'Restauranter',  emoji: '🍽️' },
  { label: 'Shopping',      emoji: '🛍️' },
  { label: 'Museer',        emoji: '🏛️' },
  { label: 'Musikk',        emoji: '🎵' },
  { label: 'Parker',        emoji: '🎡' },
  { label: 'Natur',         emoji: '🌲' },
  { label: 'Fotografi',     emoji: '📸' },
  { label: 'Strand',        emoji: '🏖️' },
  { label: 'Sport',         emoji: '🏅' },
  { label: 'Kino',          emoji: '🎬' },
] as const

export type TravelInterestLabel = typeof TRAVEL_INTERESTS[number]['label']

export function parseInterests(str: string | null): string[] {
  if (!str) return []
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

export function serializeInterests(arr: string[]): string | null {
  const joined = arr.join(',')
  return joined || null
}
