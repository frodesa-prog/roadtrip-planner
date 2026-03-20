'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Map, CalendarDays, FileText, Receipt, ListChecks, Lightbulb, LogOut, UserCircle, ClipboardList, Package, X, Menu, MessageSquare, HelpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useChat } from '@/components/chat/ChatContext'

const links = [
  { href: '/plan', label: 'Planlegg', icon: Map },
  { href: '/todo', label: 'ToDo', icon: ClipboardList },
  { href: '/pakkeliste', label: 'Pakkeliste', icon: Package },
  { href: '/summary', label: 'Oppsummering', icon: CalendarDays },
  { href: '/aktiviteter', label: 'Aktiviteter', icon: ListChecks },
  { href: '/kostnader', label: 'Kostnader', icon: Receipt },
  { href: '/ferietips', label: 'Ferietips', icon: Lightbulb },
  { href: '/notes', label: 'Notater', icon: FileText },
  { href: '/hjelp', label: 'Hjelp', icon: HelpCircle },
]

// Vises i bottom tab bar på mobil
const bottomNavLinks = [
  { href: '/plan', label: 'Plan', icon: Map },
  { href: '/todo', label: 'ToDo', icon: ClipboardList },
  { href: '/pakkeliste', label: 'Pakkeliste', icon: Package },
  { href: '/notes', label: 'Notater', icon: FileText },
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

        {/* Logo */}
        <span className="text-sm font-bold text-white mr-4 flex items-center gap-2 select-none">
          <span className="text-base">🗺️</span>
          <span className="text-slate-200">Ferieplanlegger</span>
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

        {/* Min Side + Chat + Logout – høyre side */}
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
          <span className="flex items-center gap-2 text-sm font-bold text-slate-200 select-none">
            <span className="text-base">🗺️</span>
            Ferieplanlegger
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Lukk"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav-lenker */}
        <nav className="flex-1 overflow-y-auto py-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                }`}
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
