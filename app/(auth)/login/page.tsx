'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Loader2, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

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
      toast.success('Konto opprettet! Sjekk e-posten for bekreftelse, eller logg inn direkte.')
      setMode('login')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-blue-500/20 border border-blue-500/30 rounded-full p-4 mb-4">
            <MapPin className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Ferieplanlegger</h1>
          <p className="text-blue-200/60 text-sm mt-1">Planlegg og arkiver dine eventyr</p>
        </div>

        {/* Kort */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-center">
            {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="email"
                placeholder="E-post"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="password"
                placeholder="Passord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white h-10 font-medium"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                'Logg inn'
              ) : (
                'Opprett konto'
              )}
            </Button>
          </form>

          <div className="text-center pt-1">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-blue-300/70 hover:text-blue-300 transition-colors"
            >
              {mode === 'login'
                ? 'Ny bruker? Opprett konto'
                : 'Har du allerede konto? Logg inn'}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Frode &amp; Monica · Privat app
        </p>
      </div>
    </div>
  )
}
