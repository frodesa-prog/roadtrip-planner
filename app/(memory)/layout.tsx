import type { ReactNode } from 'react'

// Minimal layout for standalone memory book pages (no NavBar)
export default function MemoryLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
