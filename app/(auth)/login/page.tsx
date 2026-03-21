'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Mail, Lock, Route,
  ClipboardList, Archive, Wallet, Users, PackageOpen,
  CheckCircle2,
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
  { icon: Route,         color: C.copper,    bg: '#fdf1ea', title: 'Planlegg reiseruten',          desc: 'Stoppesteder, kjøreruter på kart og daglig organisering.' },
  { icon: ClipboardList, color: C.mint,      bg: '#eaf7f6', title: 'Gjøremål & pakkeliste',         desc: 'Del lister med turfølget og følg med på hvem som pakker hva.' },
  { icon: Wallet,        color: C.blue,      bg: '#edf2fb', title: 'Kostnadsoversikt',              desc: 'Registrer utgifter, del på kostnader og se budsjettet i sanntid.' },
  { icon: Users,         color: C.navyLight, bg: '#f0f3fa', title: 'Planlegg sammen',               desc: 'Chat med turfølget og planlegg i fellesskap uansett hvor dere er.' },
  { icon: Archive,       color: C.copper,    bg: '#fdf1ea', title: 'Arkiver minner',                desc: 'Etter reisen lagres alt automatisk — klar til å se tilbake på.' },
  { icon: PackageOpen,   color: C.mint,      bg: '#eaf7f6', title: 'Roadtrip, storbytur & resort',  desc: 'Verktøyet tilpasser seg ferietypen din.' },
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
    <main className="min-h-screen flex flex-col items-center px-4 py-12 lg:py-20">

      {/* ── Logo + tagline ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative w-40 h-40 drop-shadow-lg mb-4">
          <Image src="/logo.png" alt="MyVacayPlanner" fill className="object-contain" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: C.navy }}>
          MyVacayPlanner
        </h1>
        <p className="mt-1 text-base font-medium tracking-widest uppercase" style={{ color: C.copper }}>
          Plan.&nbsp; Travel.&nbsp; Relive.
        </p>
        <p className="mt-3 text-sm text-center max-w-md leading-relaxed" style={{ color: C.navyLight }}>
          Et komplett verktøy for å planlegge ferier, holde oversikt under turen
          og arkivere minner etterpå — alt på ett sted.
        </p>
      </div>

      {/* ── Login card ────────────────────────────────────────────────── */}
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden mb-10">

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-3 text-sm font-semibold transition-colors"
              style={{
                color: mode === m ? C.copper : C.navyLight,
                borderBottom: mode === m ? `2px solid ${C.copper}` : '2px solid transparent',
                background: mode === m ? '#fdf9f6' : 'transparent',
              }}
            >
              {m === 'login' ? 'Logg inn' : 'Ny bruker'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.blue }} />
            <input
              type="email"
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
              onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
              onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.blue }} />
            <input
              type="password"
              placeholder={mode === 'register' ? 'Passord (minst 6 tegn)' : 'Passord'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
              onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
              onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${C.copper}, #b8714a)` }}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>
      </div>

      {/* ── Feature grid ──────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
          <div key={title} className="flex gap-3 p-4 rounded-xl border border-slate-200/70 bg-white/60 shadow-sm">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: C.navy }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: C.navyLight }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Trust tags ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-10">
        {['Roadtrip', 'Storbytur', 'Resort', 'Delt med turfølget', 'Kart & ruter', 'Kostnadsfordeling'].map((tag) => (
          <span key={tag} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.navyLight }}>
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.mint }} />
            {tag}
          </span>
        ))}
      </div>

      <footer className="text-xs" style={{ color: '#9fb3c8' }}>
        © 2026 MyVacayPlanner · Privat app
      </footer>
    </main>
  )
}
