import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Ferieplanlegger',
  description: 'Planlegg og arkiver dine roadtrips',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="no" className={`${inter.variable} dark`}>
      <body className="font-sans antialiased bg-slate-950 text-slate-100">
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  )
}
