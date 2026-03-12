import Link from 'next/link'
import { MapPin, BookOpen, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-8 px-6">
        {/* Logo / ikon */}
        <div className="flex justify-center">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-full p-6">
            <MapPin className="w-16 h-16 text-blue-400" />
          </div>
        </div>

        {/* Tittel */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Roadtrip Planner
          </h1>
          <p className="text-blue-200/70 text-lg max-w-md mx-auto">
            Planlegg neste eventyr. Arkiver minner fra reiser dere aldri glemmer.
          </p>
        </div>

        {/* Knapper */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/plan">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white gap-2 w-full sm:w-auto">
              <MapPin className="w-4 h-4" />
              Planlegg ny tur
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/archive">
            <Button size="lg" variant="outline" className="border-blue-400/40 text-blue-200 hover:bg-blue-900/40 gap-2 w-full sm:w-auto">
              <BookOpen className="w-4 h-4" />
              Se arkiv
            </Button>
          </Link>
        </div>

        {/* Versjon */}
        <p className="text-slate-600 text-sm pt-8">v0.1 – under utvikling 🚧</p>
      </div>
    </main>
  )
}
