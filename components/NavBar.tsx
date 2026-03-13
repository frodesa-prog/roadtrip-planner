'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, CalendarDays, FileText, Receipt } from 'lucide-react'

const links = [
  { href: '/plan', label: 'Planlegg', icon: Map },
  { href: '/summary', label: 'Oppsummering', icon: CalendarDays },
  { href: '/kostnader', label: 'Kostnader', icon: Receipt },
  { href: '/notes', label: 'Notater', icon: FileText },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="h-11 flex-shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-1">
      {/* Logo */}
      <span className="text-sm font-bold text-white mr-4 flex items-center gap-2 select-none">
        <span className="text-base">🗺️</span>
        <span className="hidden sm:inline text-slate-200">Roadtrip</span>
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
    </nav>
  )
}
