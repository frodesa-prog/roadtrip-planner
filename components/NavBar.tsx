'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Map, CalendarDays, FileText, Receipt, ListChecks, BookOpen, Lightbulb, LogOut, UserCircle, ClipboardList, Package, MoreHorizontal, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const links = [
  { href: '/plan', label: 'Planlegg', icon: Map },
  { href: '/todo', label: 'ToDo', icon: ClipboardList },
  { href: '/pakkeliste', label: 'Pakkeliste', icon: Package },
  { href: '/summary', label: 'Oppsummering', icon: CalendarDays },
  { href: '/aktiviteter', label: 'Aktiviteter', icon: ListChecks },
  { href: '/kostnader', label: 'Kostnader', icon: Receipt },
  { href: '/beskrivelse', label: 'Beskrivelse', icon: BookOpen },
  { href: '/ferietips', label: 'Ferietips', icon: Lightbulb },
  { href: '/notes', label: 'Notater', icon: FileText },
]

// Vises i bottom tab bar på mobil
const bottomNavLinks = [
  { href: '/plan', label: 'Plan', icon: Map },
  { href: '/todo', label: 'ToDo', icon: ClipboardList },
  { href: '/pakkeliste', label: 'Pakkeliste', icon: Package },
  { href: '/notes', label: 'Notater', icon: FileText },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Top nav (desktop) ─────────────────────────────────────────────── */}
      <nav className="h-11 flex-shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-1">
        {/* Logo */}
        <span className="text-sm font-bold text-white mr-4 flex items-center gap-2 select-none">
          <span className="text-base">🗺️</span>
          <span className="hidden sm:inline text-slate-200">Ferieplanlegger</span>
        </span>

        {/* Nav links – kun synlig på desktop */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Min Side + Logout – høyre side */}
        <div className="ml-auto flex items-center gap-1">
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
        {bottomNavLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          )
        })}

        {/* Mer-knapp */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
            moreOpen ? 'text-blue-400' : 'text-slate-500'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px]">Mer</span>
        </button>
      </nav>

      {/* ── «Mer»-overlay (mobil) ────────────────────────────────────────── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Alle sider</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {links.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </Link>
                )
              })}
              <Link
                href="/minside"
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/minside'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <UserCircle className="w-4 h-4 flex-shrink-0" />
                Min side
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Logg ut
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
