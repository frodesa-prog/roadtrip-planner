'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Mail, Lock, Route,
  ClipboardList, Archive, Wallet, Users, PackageOpen,
  CheckCircle2, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'

const C = {
  navy:      '#3d4e6b',
  copper:    '#c4845a',
  mint:      '#6dbdb8',
  blue:      '#8ea8d4',
  navyLight: '#5a6f91',
}

const FEATURES = [
  { icon: Route,         color: C.copper,    bg: '#fdf1ea', title: 'Planlegg reiseruten',         desc: 'Legg til stoppesteder, se kjøreruter på kart og organiser hele turen dag for dag.' },
  { icon: ClipboardList, color: C.mint,      bg: '#eaf7f6', title: 'Gjøremål & pakkeliste',        desc: 'Aldri glem noe igjen. Del lister med turfølget og følg med på hvem som pakker hva.' },
  { icon: Wallet,        color: C.blue,      bg: '#edf2fb', title: 'Kostnadsoversikt',             desc: 'Registrer utgifter, del på kostnader og se budsjettet i sanntid.' },
  { icon: Users,         color: C.navyLight, bg: '#f0f3fa', title: 'Planlegg sammen',              desc: 'Chat med turfølget, reager på meldinger og planlegg i fellesskap.' },
  { icon: Archive,       color: C.copper,    bg: '#fdf1ea', title: 'Arkiver minner',               desc: 'Etter reisen lagres alt automatisk i arkivet — klar til å se tilbake på.' },
  { icon: PackageOpen,   color: C.mint,      bg: '#eaf7f6', title: 'Roadtrip, storbytur & resort', desc: 'Verktøyet tilpasser seg ferietypen din — biltur, bytur eller strandhotel.' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState<'login' | 'register'>('login')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error('Feil e-post eller passord')
        setLoading(false)
        return
      }
      router.push('/plan')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }
      toast.success('Konto opprettet! Sjekk e-posten for bekreftelse.')
      setMode('login')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center px-8 py-4 border-b border-slate-200/60 bg-white/40 backdrop-blur-sm">
        <span className="font-bold text-base tracking-tight" style={{ color: C.navy }}>
          MyVacayPlanner
        </span>
        <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium"
          style={{ background: '#eaf7f6', color: C.mint }}>
          Privat beta
        </span>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:flex-row gap-0">

        {/* Left — hero + features */}
        <section className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-14 lg:py-14">

          {/* Hero text */}
          <div className="mb-10">
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-3" style={{ color: C.navy }}>
              Plan.<br />
              <span style={{ color: C.copper }}>Travel.</span>{' '}
              <span style={{ color: C.mint }}>Relive.</span>
            </h1>
            <p className="text-base lg:text-lg max-w-md leading-relaxed" style={{ color: C.navyLight }}>
              Et komplett verktøy for å planlegge ferier, holde oversikt under turen
              og arkivere minner etterpå — alt på ett sted.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5">
              {['Roadtrip', 'Storbytur', 'Resort', 'Delt med turfølget', 'Kart & ruter', 'Kostnadsfordeling'].map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.navyLight }}>
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.mint }} />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="flex gap-3 p-4 rounded-xl border border-slate-200/70 bg-white/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: C.navy }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: C.navyLight }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right — logo + auth card */}
        <aside className="flex flex-col items-center justify-center px-8 py-12 lg:py-14 lg:w-[400px] lg:flex-shrink-0">

          {/* Logo — no white background via mix-blend-mode */}
          <div className="relative w-56 h-56 mb-6 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="MyVacayPlanner"
              fill
              className="object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>

          {/* Auth card */}
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">

            {/* Card header */}
            <div className="px-7 py-5 border-b border-slate-100" style={{ background: 'linear-gradient(135deg, #f8f9fd, #f0f3fa)' }}>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4" style={{ color: C.copper }} />
                <h2 className="font-bold text-base" style={{ color: C.navy }}>
                  {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
                </h2>
              </div>
              <p className="text-xs" style={{ color: C.navyLight }}>
                {mode === 'login'
                  ? 'Velkommen tilbake! Logg inn for å fortsette planleggingen.'
                  : 'Opprett en konto og kom i gang med planleggingen.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>E-post</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.blue }} />
                  <input
                    type="email"
                    placeholder="din@epost.no"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
                    style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
                    onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
                    onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Passord</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.blue }} />
                  <input
                    type="password"
                    placeholder={mode === 'register' ? 'Minst 6 tegn' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
                    style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
                    onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
                    onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60 mt-1"
                style={{ background: `linear-gradient(135deg, ${C.copper}, #b8714a)` }}
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: C.mint }}
                >
                  {mode === 'login'
                    ? 'Ny bruker? Opprett konto gratis'
                    : 'Har du allerede konto? Logg inn'}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-xs mt-5" style={{ color: '#9fb3c8' }}>
            Privat app · Bare inviterte brukere
          </p>
        </aside>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-8 py-3 border-t border-slate-200/60 bg-white/30 text-xs" style={{ color: '#9fb3c8' }}>
        <span>© 2026 MyVacayPlanner</span>
        <span className="italic">Plan. Travel. Relive.</span>
      </footer>
    </main>
  )
}
