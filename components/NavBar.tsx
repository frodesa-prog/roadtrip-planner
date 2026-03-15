'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Map, CalendarDays, FileText, Receipt, ListChecks, BookOpen, Lightbulb, LogOut, UserCircle, ClipboardList, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="h-11 flex-shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-1">
      {/* Logo */}
      <span className="text-sm font-bold text-white mr-4 flex items-center gap-2 select-none">
        <span className="text-base">🗺️</span>
        <span className="hidden sm:inline text-slate-200">Ferieplanlegger</span>
      </span>

      {/* Nav links */}
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

      {/* Min Side + Logout – far right */}
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
  )
}
