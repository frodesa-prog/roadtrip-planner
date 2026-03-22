import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Ferieplanlegger',
  description: 'Planlegg og arkiver dine roadtrips',
  icons: {
    icon: '/favicon.png',
  },
}

// Inline script that runs before React hydrates to prevent theme flash
const themeScript = `
(function(){
  var t = localStorage.getItem('app_theme') || 'default';
  var dark = ['default','dark-forest','dark-midnight'];
  document.documentElement.setAttribute('data-theme', t);
  if (dark.indexOf(t) >= 0) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="no" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply stored theme before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
