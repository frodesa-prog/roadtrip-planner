'use client'

import { usePathname } from 'next/navigation'
import NavBar from './NavBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Memory detail pages (/minner/[memoryId]) should have no NavBar
  const isMemoryDetail = /^\/minner\/[^/]+(\/.*)?$/.test(pathname ?? '')

  return (
    <div className="flex flex-col h-screen bg-[hsl(var(--page-bg))]">
      {!isMemoryDetail && <NavBar />}
      {/* pb-16 på mobil gir plass til den faste bottom tab bar-en (ikke for minnebok-sider) */}
      <div className={`flex-1 overflow-y-auto${isMemoryDetail ? '' : ' pb-16 md:pb-0'}`}>
        {children}
      </div>
    </div>
  )
}
