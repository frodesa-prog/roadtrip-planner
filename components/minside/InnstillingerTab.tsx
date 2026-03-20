'use client'

import { Check, Moon, Sun } from 'lucide-react'
import { useAppTheme, THEMES, type ThemeName } from '@/contexts/ThemeContext'

// ── Theme card ─────────────────────────────────────────────────────────────────

function ThemeCard({
  id,
  name,
  type,
  preview,
  active,
  onSelect,
}: {
  id: ThemeName
  name: string
  type: 'dark' | 'light'
  preview: { bg: string; card: string; primary: string; text: string; accent: string }
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/60 ${
        active ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-primary/40'
      }`}
      title={name}
    >
      {/* Colour preview — all inline styles to show the target theme, not the current */}
      <div
        className="w-full h-28 flex flex-col gap-1 p-2"
        style={{ backgroundColor: preview.bg }}
      >
        {/* Simulated nav bar */}
        <div
          className="h-3 rounded-sm w-full flex items-center gap-1 px-1"
          style={{ backgroundColor: preview.card }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-1 rounded-full"
              style={{ backgroundColor: preview.primary, width: `${14 + i * 6}px`, opacity: 0.7 + i * 0.1 }}
            />
          ))}
        </div>

        {/* Simulated content cards */}
        <div className="flex gap-1 flex-1">
          <div
            className="flex-1 rounded-sm flex flex-col gap-0.5 p-1"
            style={{ backgroundColor: preview.card }}
          >
            <div className="h-1.5 rounded-full w-3/4" style={{ backgroundColor: preview.text, opacity: 0.6 }} />
            <div className="h-1 rounded-full w-1/2" style={{ backgroundColor: preview.text, opacity: 0.35 }} />
            <div className="mt-auto h-2 rounded-sm w-2/3" style={{ backgroundColor: preview.primary, opacity: 0.85 }} />
          </div>
          <div
            className="flex-1 rounded-sm flex flex-col gap-0.5 p-1"
            style={{ backgroundColor: preview.card }}
          >
            <div className="h-1.5 rounded-full w-1/2" style={{ backgroundColor: preview.text, opacity: 0.6 }} />
            <div className="h-1 rounded-full w-3/4" style={{ backgroundColor: preview.text, opacity: 0.35 }} />
            <div className="mt-auto h-2 rounded-sm w-1/2" style={{ backgroundColor: preview.accent, opacity: 0.9 }} />
          </div>
        </div>

        {/* Primary colour stripe */}
        <div className="h-2 rounded-sm w-full" style={{ backgroundColor: preview.primary }} />
      </div>

      {/* Label row */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: preview.card }}
      >
        <div className="flex items-center gap-1.5">
          {type === 'dark' ? (
            <Moon className="w-3 h-3" style={{ color: preview.text, opacity: 0.7 }} />
          ) : (
            <Sun className="w-3 h-3" style={{ color: preview.text, opacity: 0.7 }} />
          )}
          <span className="text-xs font-semibold" style={{ color: preview.text }}>
            {name}
          </span>
        </div>

        {active && (
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: preview.primary }}
          >
            <Check className="w-2.5 h-2.5" style={{ color: preview.bg }} />
          </span>
        )}
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InnstillingerTab() {
  const { theme, setTheme } = useAppTheme()

  const darkThemes = THEMES.filter((t) => t.type === 'dark')
  const lightThemes = THEMES.filter((t) => t.type === 'light')

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        {/* Use CSS-variable-based classes for automatic contrast in all themes */}
        <h2 className="text-lg font-semibold text-foreground mb-0.5">Innstillinger</h2>
        <p className="text-sm text-muted-foreground">Tilpass utseendet på appen etter dine preferanser.</p>
      </div>

      {/* ── Appearance section ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-px h-4 bg-primary/60 rounded-full" />
          <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Fargetema</h3>
        </div>

        {/* Dark themes */}
        <div className="mb-5">
          <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
            <Moon className="w-3 h-3" /> Mørke temaer
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {darkThemes.map((t) => (
              <ThemeCard
                key={t.id}
                {...t}
                active={theme === t.id}
                onSelect={() => setTheme(t.id)}
              />
            ))}
          </div>
        </div>

        {/* Light themes */}
        <div>
          <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
            <Sun className="w-3 h-3" /> Lyse temaer
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lightThemes.map((t) => (
              <ThemeCard
                key={t.id}
                {...t}
                active={theme === t.id}
                onSelect={() => setTheme(t.id)}
              />
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground/70">
          Valgt tema lagres automatisk i nettleseren og huskes til neste besøk.
        </p>
      </section>
    </div>
  )
}
