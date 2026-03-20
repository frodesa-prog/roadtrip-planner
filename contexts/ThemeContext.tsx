'use client'

import { createContext, useContext, useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeName =
  | 'default'
  | 'light-white'
  | 'light-ocean'
  | 'light-sunset'
  | 'light-steel'
  | 'dark-forest'
  | 'dark-midnight'

export interface ThemeConfig {
  id: ThemeName
  name: string
  type: 'dark' | 'light'
  preview: {
    bg: string
    card: string
    primary: string
    text: string
    accent: string
  }
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Standard',
    type: 'dark',
    preview: { bg: '#060d1e', card: '#0f1a2e', primary: '#3b82f6', text: '#e2e8f5', accent: '#1e3a5f' },
  },
  {
    id: 'light-white',
    name: 'Hvit',
    type: 'light',
    preview: { bg: '#f0f4fb', card: '#ffffff', primary: '#2563eb', text: '#0f172a', accent: '#dbeafe' },
  },
  {
    id: 'light-ocean',
    name: 'Havblå',
    type: 'light',
    preview: { bg: '#dbeef8', card: '#eef7fd', primary: '#0891b2', text: '#0c2d40', accent: '#bae6fd' },
  },
  {
    id: 'light-sunset',
    name: 'Solnedgang',
    type: 'light',
    preview: { bg: '#fef1e2', card: '#fffaf3', primary: '#ea6c00', text: '#3b1500', accent: '#fed7aa' },
  },
  {
    id: 'light-steel',
    name: 'Stålblå',
    type: 'light',
    preview: { bg: '#dde6f4', card: '#f0f5fc', primary: '#2f6eb5', text: '#0d1f38', accent: '#c0d4ed' },
  },
  {
    id: 'dark-forest',
    name: 'Mørk skog',
    type: 'dark',
    preview: { bg: '#060e09', card: '#0c1a10', primary: '#22c55e', text: '#dcf5e4', accent: '#14532d' },
  },
  {
    id: 'dark-midnight',
    name: 'Midnatt',
    type: 'dark',
    preview: { bg: '#08060f', card: '#110b1e', primary: '#a78bfa', text: '#ede8ff', accent: '#3b1f7a' },
  },
]

const DARK_THEMES: ThemeName[] = ['default', 'dark-forest', 'dark-midnight']
const STORAGE_KEY = 'app_theme'

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  isDark: boolean
  themeConfig: ThemeConfig
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'default',
  setTheme: () => {},
  isDark: true,
  themeConfig: THEMES[0],
})

// ── Helper ────────────────────────────────────────────────────────────────────

export function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.setAttribute('data-theme', theme)
  if (DARK_THEMES.includes(theme)) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('default')

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeName) || 'default'
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  function setTheme(next: ThemeName) {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }

  const isDark = DARK_THEMES.includes(theme)
  const themeConfig = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, themeConfig }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppTheme() {
  return useContext(ThemeContext)
}
