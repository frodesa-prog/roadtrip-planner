import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Ferieminner',
}

export default function MinnerListLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
