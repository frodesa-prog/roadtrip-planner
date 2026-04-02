'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Map, CalendarDays, FileText, Receipt, ListChecks, Lightbulb, LogOut, UserCircle, ClipboardList, Package, X, Menu, MessageSquare, HelpCircle, ChevronDown, Check, Plus, BookHeart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useChat } from '@/components/chat/ChatContext'
import { Trip } from '@/types'

export const OPEN_NEW_TRIP_WIZARD_EVENT = 'open-new-trip-wizard'

const SELECTED_TRIP_KEY = 'selected_trip_id'

const TRIP_TYPE_EMOJI: Record<string, string> = {
  road_trip: '🚗',
  storbytur: '🏙️',
  resort: '🌴',
}

function formatTripDates(trip: Trip): string {
  if (trip.date_from && trip.date_to) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = new Date(trip.date_from + 'T00:00:00')
    const to   = new Date(trip.date_to   + 'T00:00:00')
    return `${pad(from.getDate())}.${pad(from.getMonth()+1)} – ${pad(to.getDate())}.${pad(to.getMonth()+1)} ${to.getFullYear()}`
  }
  return String(trip.year)
}

// ── Inline trip dropdown in the top nav ─────────────────────────────────────
function TripDropdown() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setCurrentId(typeof window !== 'undefined' ? localStorage.getItem(SELECTED_TRIP_KEY) : null)
    const supabase = createClient()
    supabase.from('trips').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTrips(data as Trip[])
        setLoading(false)
      })

    function onTripChanged(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail?.trip) setCurrentId(detail.trip.id)
    }
    window.addEventListener('trip-changed', onTripChanged)
    return () => window.removeEventListener('trip-changed', onTripChanged)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentTrip = trips.find(t => t.id === currentId) ?? null
  const sortedTrips = trips.slice().sort((a, b) => {
    if (a.id === currentId) return -1
    if (b.id === currentId) return 1
    return 0
  })

  const selectTrip = useCallback((trip: Trip) => {
    localStorage.setItem(SELECTED_TRIP_KEY, trip.id)
    setCurrentId(trip.id)
    window.dispatchEvent(new CustomEvent('trip-changed', { detail: { trip } }))
    setOpen(false)
  }, [])

  return (
    <div ref={dropdownRef} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
        title="Bytt reise"
      >
        {loading ? (
          <span className="text-slate-400 text-xs">Laster…</span>
        ) : currentTrip ? (
          <>
            <span className="text-base leading-none flex-shrink-0">
              {TRIP_TYPE_EMOJI[currentTrip.trip_type ?? 'road_trip'] ?? '🗺️'}
            </span>
            <span className="truncate font-semibold text-slate-100 max-w-[140px]">
              {currentTrip.name}
            </span>
          </>
        ) : (
          <span className="text-slate-400 text-xs">Velg reise</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden min-w-[240px]">
          <div className="overflow-y-auto" style={{ maxHeight: 'min(70vh, 400px)' }}>
            {trips.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6 px-4">Ingen reiser registrert ennå</p>
            ) : (
              sortedTrips.map(trip => {
                const isActive = trip.id === currentId
                return (
                  <button
                    key={trip.id}
                    onClick={() => selectTrip(trip)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive ? 'bg-blue-900/40' : 'hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">
                      {TRIP_TYPE_EMOJI[trip.trip_type ?? 'road_trip'] ?? '🗺️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-300' : 'text-slate-100'}`}>
                        {trip.name}
                      </p>
                      <p className="text-xs text-slate-500">{formatTripDates(trip)}</p>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
          <div className="border-t border-slate-700 px-4 py-2.5">
            <button
              onClick={() => {
                setOpen(false)
                if (pathname === '/plan') {
                  window.dispatchEvent(new CustomEvent(OPEN_NEW_TRIP_WIZARD_EVENT))
                } else {
                  router.push('/plan?new=1')
                }
              }}
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus className="w-3 h-3" /> Opprett ny reise
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const links = [
  { href: '/plan', label: 'Planlegg', icon: Map },
  { href: '/summary', label: 'Oversikt', icon: CalendarDays },
  { href: '/todo', label: 'ToDo', icon: ClipboardList },
  { href: '/pakkeliste', label: 'Pakkeliste', icon: Package },
  { href: '/aktiviteter', label: 'Aktiviteter', icon: ListChecks },
  { href: '/kostnader', label: 'Kostnader', icon: Receipt },
  { href: '/ferietips', label: 'Ferietips', icon: Lightbulb },
  { href: '/notes', label: 'Notater', icon: FileText },
  { href: '/minner', label: 'Minner', icon: BookHeart, newTab: true },
  { href: '/hjelp', label: 'Hjelp', icon: HelpCircle },
]

// Vises i bottom tab bar på mobil
const bottomNavLinks = [
  { href: '/plan', label: 'Plan', icon: Map },
  { href: '/todo', label: 'ToDo', icon: ClipboardList },
  { href: '/pakkeliste', label: 'Pakkeliste', icon: Package },
  { href: '/minner', label: 'Minner', icon: BookHeart, newTab: true },
  { href: '/ferietips', label: 'Ferietips', icon: Lightbulb },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { toggle: toggleChat, unreadCount } = useChat()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Top nav ───────────────────────────────────────────────────────── */}
      <nav className="h-11 flex-shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-1">

        {/* Hamburger-knapp – kun på mobil, til venstre */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors mr-2 flex-shrink-0"
          title="Meny"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Trip dropdown – velg aktiv ferie */}
        <TripDropdown />

        {/* Nav links – kun synlig på desktop */}
        <div className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          {links.map(({ href, label, icon: Icon, newTab }) => {
            const isActive = pathname === href
            const cls = `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`
            return newTab ? (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className={cls}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Min Side + Chat + Logout – høyre side */}
        <div className="ml-auto flex items-center gap-1">
          <a
            href="/usa-map"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors text-sm font-medium"
            title="USA Roadtrip-kart"
          >
            <span>🇺🇸</span>
            <span className="hidden sm:inline">USA-kart</span>
          </a>
          <Link
            href="/minside"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/minside'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Min Side"
          >
            <UserCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Min side</span>
          </Link>
          {/* Chat-knapp med ulest-badge */}
          <button
            onClick={toggleChat}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-sm font-medium">Chat</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full
                text-[9px] text-white flex items-center justify-center font-bold px-0.5 leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Logg ut"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ── Bottom tab bar (mobil) ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex h-16">
        {bottomNavLinks.map(({ href, label, icon: Icon, newTab }) => {
          const isActive = pathname === href
          const cls = `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500'}`
          return newTab ? (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </a>
          ) : (
            <Link key={href} href={href} className={cls}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Mørk overlay bak drawer (mobil) ──────────────────────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Side-drawer / hamburger-meny (mobil) ─────────────────────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer-header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <span className="flex items-center select-none">
            <Image
              src="/logo.png"
              alt="MyVacayPlanner"
              width={110}
              height={60}
              className="object-contain"
            />
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Lukk"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Trip dropdown i mobil-drawer */}
        <div className="px-3 py-2 border-b border-slate-800">
          <TripDropdown />
        </div>

        {/* Nav-lenker */}
        <nav className="flex-1 overflow-y-auto py-2">
          {links.map(({ href, label, icon: Icon, newTab }) => {
            const isActive = pathname === href
            const cls = `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
              isActive ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`
            return newTab ? (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDrawerOpen(false)}
                className={cls}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </a>
            ) : (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={cls}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}

          <div className="mt-2 pt-2 border-t border-slate-800">
            <Link
              href="/minside"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                pathname === '/minside'
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <UserCircle className="w-4 h-4 flex-shrink-0" />
              Min side
            </Link>
            <button
              onClick={() => { setDrawerOpen(false); toggleChat() }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors text-left"
            >
              <div className="relative flex-shrink-0">
                <MessageSquare className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full
                    text-[8px] text-white flex items-center justify-center font-bold px-0.5 leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              Chat
              {unreadCount > 0 && (
                <span className="ml-auto text-xs bg-red-500/20 text-red-400 rounded-full px-2 py-0.5 font-medium">
                  {unreadCount} ny{unreadCount !== 1 ? 'e' : ''}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Logg ut – bunnen av drawer */}
        <div className="border-t border-slate-800 p-3 pb-20 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Logg ut
          </button>
        </div>
      </div>
    </>
  )
}
