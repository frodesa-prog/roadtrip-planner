import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'USA kart',
}

export default function UsaMapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
