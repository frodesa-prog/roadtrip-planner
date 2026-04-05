'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Mail, Lock, Route,
  ClipboardList, Archive, Wallet, Users, PackageOpen,
  CheckCircle2, MapPin, Map, DollarSign, MessageCircle, X,
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

// ── Travel illustration ───────────────────────────────────────────────────────

function TravelIllustration() {
  return (
    <svg viewBox="0 0 700 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-2xl mx-auto">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ddeeff" />
          <stop offset="100%" stopColor="#f2f4f8" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b0d9f5" />
          <stop offset="100%" stopColor="#8ea8d4" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect width="700" height="220" fill="url(#sky)" rx="16" />
      <circle cx="580" cy="48" r="30" fill="#fde68a" opacity="0.7" />
      <circle cx="580" cy="48" r="22" fill="#fcd34d" opacity="0.8" />
      <g opacity="0.7">
        <ellipse cx="120" cy="45" rx="45" ry="18" fill="white" />
        <ellipse cx="100" cy="50" rx="30" ry="14" fill="white" />
        <ellipse cx="145" cy="50" rx="30" ry="14" fill="white" />
      </g>
      <g opacity="0.5">
        <ellipse cx="420" cy="35" rx="32" ry="13" fill="white" />
        <ellipse cx="405" cy="40" rx="22" ry="10" fill="white" />
        <ellipse cx="440" cy="40" rx="22" ry="10" fill="white" />
      </g>
      <polygon points="0,170 80,80 160,170" fill="#c0d4ed" opacity="0.6" />
      <polygon points="60,170 150,65 240,170" fill="#8ea8d4" opacity="0.5" />
      <polygon points="480,170 570,75 660,170" fill="#c0d4ed" opacity="0.5" />
      <polygon points="540,170 630,90 720,170" fill="#8ea8d4" opacity="0.4" />
      <rect x="0" y="168" width="700" height="52" rx="0" fill="url(#sea)" opacity="0.5" />
      <ellipse cx="350" cy="168" rx="700" ry="12" fill="#b0d9f5" opacity="0.3" />
      <path d="M80,140 Q200,40 350,80 Q500,120 620,50" stroke={C.copper} strokeWidth="2" strokeDasharray="6,6" fill="none" opacity="0.8" />
      <g transform="translate(330,68) rotate(-15)">
        <ellipse cx="0" cy="0" rx="22" ry="7" fill={C.copper} />
        <polygon points="22,-3 34,0 22,3" fill={C.copper} />
        <polygon points="-22,-7 -14,-18 -10,-7" fill="#b8714a" />
        <polygon points="-5,-7 12,-7 18,0 12,7 -5,7 -2,0" fill="#d4956e" />
        <rect x="-8" y="-3" width="20" height="6" rx="3" fill="white" opacity="0.5" />
      </g>
      <line x1="270" y1="170" x2="270" y2="130" stroke="#6b7c5a" strokeWidth="4" />
      <ellipse cx="258" cy="130" rx="18" ry="8" fill="#5a8a5a" opacity="0.8" transform="rotate(-20,258,130)" />
      <ellipse cx="282" cy="132" rx="18" ry="8" fill="#4a7a4a" opacity="0.8" transform="rotate(20,282,132)" />
      <ellipse cx="270" cy="126" rx="14" ry="6" fill="#6aaa6a" opacity="0.9" />
      <line x1="440" y1="170" x2="440" y2="132" stroke="#6b7c5a" strokeWidth="4" />
      <ellipse cx="428" cy="132" rx="18" ry="8" fill="#5a8a5a" opacity="0.8" transform="rotate(-20,428,132)" />
      <ellipse cx="452" cy="134" rx="18" ry="8" fill="#4a7a4a" opacity="0.8" transform="rotate(20,452,134)" />
      <ellipse cx="440" cy="128" rx="14" ry="6" fill="#6aaa6a" opacity="0.9" />
      <g transform="translate(612,38)">
        <circle cx="0" cy="-4" r="8" fill={C.mint} />
        <polygon points="-4,0 4,0 0,10" fill={C.mint} />
        <circle cx="0" cy="-4" r="3.5" fill="white" />
      </g>
      <g transform="translate(82,132)">
        <circle cx="0" cy="-4" r="7" fill={C.navy} opacity="0.7" />
        <polygon points="-3.5,0 3.5,0 0,9" fill={C.navy} opacity="0.7" />
        <circle cx="0" cy="-4" r="3" fill="white" />
      </g>
    </svg>
  )
}

// ── App mockup screens ────────────────────────────────────────────────────────

function MockupPlanning() {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg border h-full" style={{ borderColor: C.border, background: C.bg, fontFamily: 'system-ui' }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: C.card, borderColor: C.border }}>
        <span className="text-xs font-bold" style={{ color: C.navy }}>✈️ MyVacay</span>
        {['Planlegg','ToDo','Oversikt'].map((t, i) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: i === 0 ? C.copper : 'transparent', color: i === 0 ? '#fff' : C.navyLight, fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
        ))}
      </div>
      <div className="flex" style={{ height: 200 }}>
        <div className="w-36 border-r p-2 space-y-1.5 flex-shrink-0" style={{ borderColor: C.border }}>
          <div className="rounded-lg px-2.5 py-2 text-[10px] font-semibold" style={{ background: `${C.copper}18`, color: C.copper, borderLeft: `3px solid ${C.copper}` }}>🚗 Roadtrip 2026</div>
          {['Oslo → Bergen','Bergen → Ålesund','Ålesund → Trondheim'].map((s, i) => (
            <div key={s} className="rounded-lg px-2.5 py-1.5 text-[9px]" style={{ background: i === 1 ? `${C.mint}18` : 'transparent', color: C.navyLight, border: i === 1 ? `1px solid ${C.mint}44` : '1px solid transparent' }}>
              <span style={{ color: C.mint, fontWeight: 600 }}>{i + 1}.</span> {s}
            </div>
          ))}
        </div>
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
    <div className="rounded-xl overflow-hidden shadow-lg border h-full" style={{ borderColor: C.border, background: C.bg }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: C.card, borderColor: C.border }}>
        <span className="text-xs font-bold" style={{ color: C.navy }}>✈️ MyVacay</span>
        {['Planlegg','Oversikt','Kostnader'].map((t, i) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: i === 2 ? C.copper : 'transparent', color: i === 2 ? '#fff' : C.navyLight, fontWeight: i === 2 ? 600 : 400 }}>{t}</span>
        ))}
      </div>
      <div className="p-3 space-y-1.5" style={{ height: 200 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold" style={{ color: C.navy }}>Totalt: 4 280 kr</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${C.mint}20`, color: C.mint, border: `1px solid ${C.mint}44` }}>3 deltakere</span>
        </div>
        {items.map(({ label, amount, cat, color }) => (
          <div key={label} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] flex-1" style={{ color: C.navy }}>{label}</span>
            <span className="text-[9px] hidden sm:inline" style={{ color: C.navyLight }}>{cat}</span>
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
    <div className="rounded-xl overflow-hidden shadow-lg border h-full" style={{ borderColor: C.border, background: C.bg }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: C.card, borderColor: C.border }}>
        <span className="text-xs font-bold" style={{ color: C.navy }}>✈️ MyVacay</span>
        <MessageCircle className="w-3 h-3 ml-auto" style={{ color: C.copper }} />
        <span className="text-[10px]" style={{ color: C.navyLight }}>Chat</span>
      </div>
      <div className="p-3 space-y-2" style={{ height: 200 }}>
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

// ── Auth modal ────────────────────────────────────────────────────────────────

function AuthModal({ mode: initialMode, onClose }: { mode: 'login' | 'register'; onClose: () => void }) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState<'login' | 'register'>(initialMode)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { toast.error('Feil e-post eller passord'); setLoading(false); return }
      router.push('/plan'); router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myvacayplanner.com'}/plan`,
        },
      })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Konto opprettet! Sjekk e-posten for bekreftelse.')
      setMode('login'); setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(30,40,60,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #f8f9fd, #f0f3fa)', borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: C.copper }} />
            <h2 className="font-bold text-sm" style={{ color: C.navy }}>
              {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" style={{ color: C.navyLight }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
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
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: '#d4dce8', color: C.navy, background: '#fafbfd' }}
                onFocus={(e) => { e.target.style.borderColor = C.copper; e.target.style.boxShadow = `0 0 0 3px ${C.copper}22` }}
                onBlur={(e)  => { e.target.style.borderColor = '#d4dce8'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          <div className="space-y-2 pb-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${C.copper}, #b8714a)` }}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs transition-colors hover:underline py-1"
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
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #f8f9fc 0%, #edf1f8 50%, #f2f7f6 100%)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center px-4 sm:px-8 lg:px-10 py-3 sm:py-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <span className="font-bold text-sm sm:text-base tracking-tight" style={{ color: C.navy }}>MyVacayPlanner</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setAuthModal('login')}
            className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-colors hover:bg-slate-50"
            style={{ borderColor: C.navy, color: C.navy }}
          >
            Logg inn
          </button>
          <button
            onClick={() => setAuthModal('register')}
            className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${C.copper}, #b8714a)` }}
          >
            <span className="hidden sm:inline">Registrer deg</span>
            <span className="sm:hidden">Registrer</span>
          </button>
        </div>
      </header>

      {/* ── Hero: tagline ────────────────────────────────────────────── */}
      <section className="flex flex-col items-center gap-6 px-4 sm:px-8 lg:px-16 pt-2 sm:pt-3 pb-0 text-center">
        {/* Tagline */}
        <div className="max-w-2xl w-full">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-3 sm:mb-4" style={{ color: C.navy }}>
            Plan.<br />
            <span style={{ color: C.copper }}>Travel.</span>{' '}
            <span style={{ color: C.mint }}>Relive.</span>
          </h1>
          <p className="text-sm sm:text-base lg:text-lg max-w-sm mx-auto leading-relaxed mb-5 sm:mb-6" style={{ color: C.navyLight }}>
            Et komplett verktøy for å planlegge ferier, holde oversikt under turen og arkivere minner etterpå.
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-5 gap-y-2">
            {['Roadtrip', 'Storbytur', 'Resort', 'Delt med turfølget', 'Kart & ruter', 'Kostnadsfordeling'].map((tag) => (
              <span key={tag} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.navyLight }}>
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.mint }} />
                {tag}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* ── Illustration ─────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 lg:px-16 -mt-10 pb-2">
        <div className="relative w-full max-w-4xl mx-auto" style={{ aspectRatio: '16/7' }}>
          <Image
            src="/illustration1.png"
            alt="Reiseillustrasjon"
            fill
            className="object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 lg:px-16 pt-2 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

        <div className="flex justify-center mt-8">
          <button
            onClick={() => setAuthModal('register')}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-base text-white shadow-lg transition-all hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg, ${C.copper} 0%, #b8714a 100%)` }}
          >
            Kom i gang
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </section>

      {/* ── App screenshots / mockups ────────────────────────────────── */}
      <section className="px-4 sm:px-8 lg:px-16 py-10 sm:py-14 border-t border-slate-200/60" style={{ background: 'linear-gradient(180deg, transparent, #edf1f8 60%)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: C.navy }}>Se hva du får</h2>
            <p className="text-sm" style={{ color: C.navyLight }}>Alt du trenger for å planlegge, gjennomføre og huske reisen</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            <div className="flex flex-col">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.copper }}>
                <Route className="w-3.5 h-3.5" /> Planlegge
              </p>
              <div style={{ height: 240 }}>
                <MockupPlanning />
              </div>
            </div>
            {/* Kostnader — midterste kolonne */}
            <div className="flex flex-col">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.blue }}>
                <DollarSign className="w-3.5 h-3.5" /> Kostnader
              </p>
              <div style={{ height: 240 }}>
                <MockupCosts />
              </div>
            </div>
            {/* Chat */}
            <div className="flex flex-col sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.mint }}>
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </p>
              <div style={{ height: 240 }}>
                <MockupChat />
              </div>
            </div>
          </div>

          {/* Logo sentrert under midterste skjermbilde */}
          <div className="flex justify-center mt-10">
            <div
              className="relative"
              style={{ width: 'min(280px, 65vw)', aspectRatio: '1 / 1' }}
            >
              <Image
                src="/logo.png"
                alt="MyVacayPlanner"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="flex flex-col sm:flex-row items-center gap-1 sm:justify-between px-4 sm:px-8 lg:px-10 py-4 sm:py-3 border-t border-slate-200/60 bg-white/30 text-xs text-center" style={{ color: '#9fb3c8' }}>
        <span>© 2026 MyVacayPlanner</span>
        <span>
          Utviklet av{' '}
          <a
            href="https://www.sirkussand.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline transition-colors"
            style={{ color: C.copper }}
          >
            SirkusSand
          </a>
        </span>
        <span className="italic">Plan. Travel. Relive.</span>
      </footer>

      {/* ── Auth modal ───────────────────────────────────────────────── */}
      {authModal && (
        <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />
      )}
    </main>
  )
}
