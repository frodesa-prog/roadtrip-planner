'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Mail, Lock, Route,
  ClipboardList, Archive, Wallet, Users, PackageOpen,
  CheckCircle2, MapPin, Map, DollarSign, MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'

const C = {
  navy:      '#3d4e6b',
  copper:    '#c4845a',
  mint:      '#6dbdb8',
  blue:      '#8ea8d4',
  navyLight: '#5a6f91',
  bg:        '#f2f4f8',
  card:      '#ffffff',
  border:    '#dce3ef',
}

const FEATURES = [
  { icon: Route,         color: C.copper,    bg: '#fdf1ea', title: 'Planlegg reiseruten',         desc: 'Legg til stoppesteder, se kjøreruter på kart og organiser hele turen dag for dag.' },
  { icon: ClipboardList, color: C.mint,      bg: '#eaf7f6', title: 'Gjøremål & pakkeliste',        desc: 'Aldri glem noe igjen. Del lister med turfølget og følg med på hvem som pakker hva.' },
  { icon: Wallet,        color: C.blue,      bg: '#edf2fb', title: 'Kostnadsoversikt',             desc: 'Registrer utgifter, del på kostnader og se budsjettet i sanntid.' },
  { icon: Users,         color: C.navyLight, bg: '#f0f3fa', title: 'Planlegg sammen',              desc: 'Chat med turfølget, reager på meldinger og planlegg i fellesskap.' },
  { icon: Archive,       color: C.copper,    bg: '#fdf1ea', title: 'Arkiver minner',               desc: 'Etter reisen lagres alt automatisk i arkivet — klar til å se tilbake på.' },
  { icon: PackageOpen,   color: C.mint,      bg: '#eaf7f6', title: 'Roadtrip, storbytur & resort', desc: 'Verktøyet tilpasser seg ferietypen din — biltur, bytur eller strandhotel.' },
]

// ── App mockup screens ────────────────────────────────────────────────────────

function MockupPlanning() {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg border" style={{ borderColor: C.border, background: C.bg, fontFamily: 'system-ui' }}>
      {/* Nav */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: C.card, borderColor: C.border }}>
        <span className="text-xs font-bold" style={{ color: C.navy }}>✈️ Ferieplanlegger</span>
        {['Planlegg','ToDo','Pakkeliste','Oversikt'].map((t, i) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: i === 0 ? C.copper : 'transparent', color: i === 0 ? '#fff' : C.navyLight, fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
        ))}
      </div>
      {/* Body */}
      <div className="flex" style={{ height: 180 }}>
        {/* Sidebar */}
        <div className="w-36 border-r p-2 space-y-1.5 flex-shrink-0" style={{ borderColor: C.border }}>
          <div className="rounded-lg px-2.5 py-2 text-[10px] font-semibold" style={{ background: `${C.copper}18`, color: C.copper, borderLeft: `3px solid ${C.copper}` }}>🚗 Roadtrip 2026</div>
          {['Oslo → Bergen','Bergen → Ålesund','Ålesund → Trondheim'].map((s, i) => (
            <div key={s} className="rounded-lg px-2.5 py-1.5 text-[9px]" style={{ background: i === 1 ? `${C.mint}18` : 'transparent', color: C.navyLight, border: i === 1 ? `1px solid ${C.mint}44` : '1px solid transparent' }}>
              <span style={{ color: C.mint, fontWeight: 600 }}>{i + 1}.</span> {s}
            </div>
          ))}
        </div>
        {/* Map area */}
        <div className="flex-1 flex items-center justify-center" style={{ background: '#e8eef5' }}>
          <div className="text-center">
            <Map className="w-8 h-8 mx-auto mb-1" style={{ color: C.blue }} />
            <p className="text-[10px]" style={{ color: C.navyLight }}>Interaktivt kart</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockupCosts() {
  const items = [
    { label: 'Hotell Bergen', amount: '2 400', cat: 'Overnatting', color: C.mint },
    { label: 'Bensinstasjon', amount: '680', cat: 'Transport', color: C.blue },
    { label: 'Middag Bryggen', amount: '1 200', cat: 'Mat', color: C.copper },
  ]
  return (
    <div className="rounded-xl overflow-hidden shadow-lg border" style={{ borderColor: C.border, background: C.bg }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: C.card, borderColor: C.border }}>
        <span className="text-xs font-bold" style={{ color: C.navy }}>✈️ Ferieplanlegger</span>
        {['Planlegg','ToDo','Pakkeliste','Oversikt','Kostnader'].map((t, i) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: i === 4 ? C.copper : 'transparent', color: i === 4 ? '#fff' : C.navyLight, fontWeight: i === 4 ? 600 : 400 }}>{t}</span>
        ))}
      </div>
      <div className="p-3 space-y-1.5" style={{ height: 180 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold" style={{ color: C.navy }}>Totalt: 4 280 kr</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${C.mint}20`, color: C.mint, border: `1px solid ${C.mint}44` }}>3 deltakere</span>
        </div>
        {items.map(({ label, amount, cat, color }) => (
          <div key={label} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] flex-1" style={{ color: C.navy }}>{label}</span>
            <span className="text-[9px]" style={{ color: C.navyLight }}>{cat}</span>
            <span className="text-[10px] font-semibold" style={{ color: C.copper }}>{amount} kr</span>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          {[['Overnatting', C.mint, '45%'], ['Transport', C.blue, '28%'], ['Mat', C.copper, '27%']].map(([l, c, p]) => (
            <div key={l} className="flex-1 rounded-md p-1.5 text-center" style={{ background: `${c}18`, border: `1px solid ${c}33` }}>
              <p className="text-[8px]" style={{ color: c as string }}>{l}</p>
              <p className="text-[11px] font-bold" style={{ color: C.navy }}>{p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockupChat() {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg border" style={{ borderColor: C.border, background: C.bg }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: C.card, borderColor: C.border }}>
        <span className="text-xs font-bold" style={{ color: C.navy }}>✈️ Ferieplanlegger</span>
        <MessageCircle className="w-3 h-3 ml-auto" style={{ color: C.copper }} />
        <span className="text-[10px]" style={{ color: C.navyLight }}>Chat</span>
      </div>
      <div className="p-3 space-y-2" style={{ height: 180 }}>
        {[
          { name: 'Sara', msg: 'Har dere booket hotellet i Bergen?', own: false },
          { name: 'Deg', msg: 'Ja! Bekreftelsesnummer: 48291 🏨', own: true, reactions: ['👍','❤️'] },
          { name: 'Lars', msg: 'Supert! Gleder meg 🚗', own: false },
        ].map(({ name, msg, own, reactions }, i) => (
          <div key={i} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
            {!own && <span className="text-[8px] mb-0.5 ml-1" style={{ color: C.navyLight }}>{name}</span>}
            <div className="max-w-[75%] px-2.5 py-1.5 rounded-2xl text-[10px]"
              style={{ background: own ? C.copper : C.card, color: own ? '#fff' : C.navy, border: own ? 'none' : `1px solid ${C.border}` }}>
              {msg}
            </div>
            {reactions && (
              <div className="flex gap-1 mt-0.5">
                {reactions.map(r => <span key={r} className="text-[10px] px-1 py-0.5 rounded-full" style={{ background: `${C.mint}20`, border: `1px solid ${C.mint}44` }}>{r}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

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
    <main className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #f8f9fc 0%, #edf1f8 50%, #f2f7f6 100%)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center px-10 py-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <span className="font-bold text-base tracking-tight" style={{ color: C.navy }}>MyVacayPlanner</span>
        <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: '#eaf7f6', color: C.mint }}>
          Privat beta
        </span>
      </header>

      {/* ── Hero: logo + tagline ─────────────────────────────────────── */}
      <section className="flex items-center gap-12 px-10 pt-16 pb-10 lg:px-16">
        {/* Logo — 3× original size */}
        <div className="relative flex-shrink-0" style={{ width: 420, height: 420 }}>
          <Image
            src="/logo.png"
            alt="MyVacayPlanner"
            fill
            className="object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        {/* Tagline */}
        <div>
          <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-4" style={{ color: C.navy }}>
            Plan.<br />
            <span style={{ color: C.copper }}>Travel.</span><br />
            <span style={{ color: C.mint }}>Relive.</span>
          </h1>
          <p className="text-base lg:text-lg max-w-sm leading-relaxed mb-6" style={{ color: C.navyLight }}>
            Et komplett verktøy for å planlegge ferier, holde oversikt under turen og arkivere minner etterpå.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {['Roadtrip', 'Storbytur', 'Resort', 'Delt med turfølget', 'Kart & ruter', 'Kostnadsfordeling'].map((tag) => (
              <span key={tag} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.navyLight }}>
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.mint }} />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features + Login (same height) ──────────────────────────── */}
      <section className="flex items-stretch gap-4 px-10 pb-16 lg:px-16">

        {/* Feature grid: 2 cols × 3 rows */}
        <div className="flex-1 grid grid-cols-2 gap-3">
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

        {/* Login card — stretches to same height as feature grid */}
        <div className="w-72 flex-shrink-0 flex flex-col">
          <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">

            {/* Card header */}
            <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f8f9fd, #f0f3fa)' }}>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4" style={{ color: C.copper }} />
                <h2 className="font-bold text-sm" style={{ color: C.navy }}>
                  {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
                </h2>
              </div>
              <p className="text-[11px]" style={{ color: C.navyLight }}>
                {mode === 'login'
                  ? 'Velkommen tilbake! Logg inn for å fortsette.'
                  : 'Opprett en konto og kom i gang.'}
              </p>
            </div>

            {/* Form — flex-1 fills remaining height */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-6 py-5 gap-4">
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: C.navy }}>E-post</label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: C.blue }} />
                    <input
                      type="email"
                      placeholder="din@epost.no"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-8 pr-3 py-2 rounded-lg border text-xs outline-none transition-all"
                      style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
                      onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
                      onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: C.navy }}>Passord</label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: C.blue }} />
                    <input
                      type="password"
                      placeholder={mode === 'register' ? 'Minst 6 tegn' : '••••••••'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border text-xs outline-none transition-all"
                      style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
                      onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
                      onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 flex-shrink-0">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-xs text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${C.copper}, #b8714a)` }}
                >
                  {loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="text-[11px] transition-colors hover:underline"
                    style={{ color: C.mint }}
                  >
                    {mode === 'login'
                      ? 'Ny bruker? Opprett konto gratis'
                      : 'Har du allerede konto? Logg inn'}
                  </button>
                </div>

                <p className="text-center text-[10px]" style={{ color: '#9fb3c8' }}>
                  Privat app · Bare inviterte brukere
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── App screenshots / mockups ────────────────────────────────── */}
      <section className="px-10 py-16 lg:px-16 border-t border-slate-200/60" style={{ background: 'linear-gradient(180deg, transparent, #edf1f8 60%)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold mb-2" style={{ color: C.navy }}>Se hva du får</h2>
            <p className="text-sm" style={{ color: C.navyLight }}>Alt du trenger for å planlegge, gjennomføre og huske reisen</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.copper }}>
                <Route className="w-3.5 h-3.5" /> Planlegge
              </p>
              <MockupPlanning />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.blue }}>
                <DollarSign className="w-3.5 h-3.5" /> Kostnader
              </p>
              <MockupCosts />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.mint }}>
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </p>
              <MockupChat />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-10 py-3 border-t border-slate-200/60 bg-white/30 text-xs" style={{ color: '#9fb3c8' }}>
        <span>© 2026 MyVacayPlanner</span>
        <span className="italic">Plan. Travel. Relive.</span>
      </footer>
    </main>
  )
}
