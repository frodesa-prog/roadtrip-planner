'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Loader2, X } from 'lucide-react'
import { GeoResult } from '@/types'

interface Suggestion {
  placeId: string
  mainText: string
  secondaryText: string
}

interface Props {
  placeholder?: string
  isIntl: boolean
  /** Changes to this value trigger an internal reset (clear query + selection) */
  resetKey?: string | number
  /** 'sm' = wizard style (larger), 'xs' = sidebar style (compact) */
  size?: 'sm' | 'xs'
  accentColor?: 'green' | 'teal' | 'blue'
  onSelect: (result: GeoResult | null) => void
}

const ACCENT = {
  green: { focus: 'focus:border-green-500', chip: 'border-green-600/60 text-green-400' },
  teal:  { focus: 'focus:border-teal-500',  chip: 'border-teal-600/60 text-teal-400'  },
  blue:  { focus: 'focus:border-blue-500',  chip: 'border-blue-600/60 text-blue-400'  },
}

export default function LocationAutocompleteInput({
  placeholder = 'Søk etter sted…',
  isIntl,
  resetKey,
  size = 'sm',
  accentColor = 'green',
  onSelect,
}: Props) {
  const [query, setQuery]               = useState('')
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([])
  const [open, setOpen]                 = useState(false)
  const [fetching, setFetching]         = useState(false)
  const [resolving, setResolving]       = useState(false)
  const [selected, setSelected]         = useState<GeoResult | null>(null)
  const [dropPos, setDropPos]           = useState({ top: 0, left: 0, width: 300 })
  const [mounted, setMounted]           = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)

  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Reset when parent changes resetKey
  useEffect(() => {
    setQuery('')
    setSuggestions([])
    setSelected(null)
    setOpen(false)
    setActiveIndex(-1)
  }, [resetKey])

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  function updatePos() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) })
  }

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setFetching(true)
    try {
      const res  = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(q)}`)
      const json = await res.json()
      const preds: Suggestion[] = (json.predictions ?? []).slice(0, 7).map((p: {
        place_id: string
        structured_formatting?: { main_text?: string; secondary_text?: string }
        description: string
      }) => ({
        placeId:       p.place_id,
        mainText:      p.structured_formatting?.main_text      ?? p.description,
        secondaryText: p.structured_formatting?.secondary_text ?? '',
      }))
      setSuggestions(preds)
      setActiveIndex(-1)
      if (preds.length > 0) { setOpen(true); updatePos() }
      else setOpen(false)
    } catch {
      setSuggestions([])
      setOpen(false)
    }
    setFetching(false)
  }, [])

  async function resolvePlace(suggestion: Suggestion) {
    setOpen(false)
    setSuggestions([])
    setQuery(suggestion.mainText + (suggestion.secondaryText ? `, ${suggestion.secondaryText}` : ''))
    setResolving(true)
    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?place_id=${encodeURIComponent(suggestion.placeId)}&key=${apiKey}`
      )
      const json = await res.json()
      const r    = json.results?.[0]
      if (r?.geometry?.location) {
        const comps     = r.address_components as { long_name: string; short_name: string; types: string[] }[]
        const cityComp  = comps.find((c) => c.types.includes('locality') || c.types.includes('postal_town'))
        const stateComp = isIntl
          ? comps.find((c) => c.types.includes('country'))
          : comps.find((c) => c.types.includes('administrative_area_level_1'))
        const result: GeoResult = {
          city:  cityComp?.long_name  ?? suggestion.mainText,
          state: isIntl ? (stateComp?.long_name ?? '') : (stateComp?.short_name ?? ''),
          lat:   r.geometry.location.lat,
          lng:   r.geometry.location.lng,
        }
        setSelected(result)
        onSelect(result)
      }
    } catch {
      // silent – user can try again
    }
    setResolving(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    setSelected(null)
    onSelect(null)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchSuggestions(q), 300)
  }

  function handleBlur() {
    setTimeout(() => { setOpen(false) }, 160)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      if (suggestions[idx]) resolvePlace(suggestions[idx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
    setSuggestions([])
    setOpen(false)
    onSelect(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const colors = ACCENT[accentColor]
  const isXs   = size === 'xs'
  const textCls = isXs ? 'text-xs'   : 'text-sm'
  const pyCls   = isXs ? 'py-1.5'    : 'py-2'
  const pxCls   = isXs ? 'px-2.5'    : 'px-3'

  /* ── Selected chip ── */
  if (selected) {
    return (
      <div className={`flex items-center gap-2 ${pxCls} ${pyCls} rounded-lg bg-slate-800 border ${colors.chip}`}>
        <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isXs ? 'w-3 h-3' : ''}`} />
        <span className={`flex-1 ${textCls} truncate font-medium`}>
          {selected.city}{selected.state ? `, ${selected.state}` : ''}
        </span>
        <button
          type="button"
          onClick={clearSelection}
          className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0"
          aria-label="Fjern valgt sted"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  /* ── Input + dropdown ── */
  const dropdown =
    open && suggestions.length > 0 && mounted
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden"
          >
            {suggestions.map((s, idx) => (
              <button
                key={s.placeId}
                onMouseDown={(e) => { e.preventDefault(); resolvePlace(s) }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full text-left px-3 py-2 transition-colors flex items-start gap-2.5 border-b border-slate-700/40 last:border-0 ${
                  idx === activeIndex ? 'bg-slate-700' : 'hover:bg-slate-700/60'
                }`}
              >
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-200 truncate">{s.mainText}</p>
                  {s.secondaryText && (
                    <p className="text-[10px] text-slate-500 truncate">{s.secondaryText}</p>
                  )}
                </div>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (suggestions.length > 0) { setOpen(true); updatePos() }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg ${pxCls} ${pyCls} pr-8 text-slate-100 ${textCls} placeholder:text-slate-500 focus:outline-none ${colors.focus}`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          {fetching || resolving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <MapPin className="w-3.5 h-3.5" />
          }
        </div>
      </div>
      {dropdown}
    </>
  )
}
