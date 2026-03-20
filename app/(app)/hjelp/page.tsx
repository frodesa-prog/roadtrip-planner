'use client'

import { useState } from 'react'
import {
  Map, ClipboardList, Package, CalendarDays, ListChecks,
  Receipt, Lightbulb, FileText, Users, UserCircle,
  MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react'

interface Section {
  id: string
  icon: React.ElementType
  emoji: string
  title: string
  subtitle: string
  features: { title: string; desc: string }[]
  tips?: string[]
}

const SECTIONS: Section[] = [
  {
    id: 'plan',
    icon: Map,
    emoji: '🗺️',
    title: 'Planlegg',
    subtitle: 'Bygg opp reiseruten din steg for steg med kart og stopp.',
    features: [
      { title: 'Legg til stopp', desc: 'Trykk «Nytt stopp» for å legge til byer, severdigheter eller overnattingssteder langs ruten. Hvert stopp har sin egen detaljseksjon.' },
      { title: 'Velg ferietype', desc: 'Roadtrip viser en rekkefølge av stopp med kjørestrekning mellom dem. Storby/resort viser ett stopp med daglige gjøremål.' },
      { title: 'Kart og satellitt', desc: 'Bytt mellom kartvisning og satellittbilde. Lyse temaer starter automatisk med kartvisning, mørke temaer med satellitt.' },
      { title: 'Aktiviteter og spisesteder', desc: 'Under hvert stopp kan du legge til aktiviteter og restauranter med tidspunkt, sted og notater. De vises som pins på kartet.' },
      { title: 'Hotell', desc: 'Registrer hotellnavn og -adresse per stopp. Hotellet vises på kartet og brukes som referansepunkt for avstandsberegninger.' },
      { title: 'Mulige aktiviteter', desc: 'Samle ideer du ikke er sikker på ennå. Disse vises separat og kan flyttes til bekreftede aktiviteter.' },
      { title: 'Flyinformasjon', desc: 'Legg inn ut- og hjemreise med flynummer, tidspunkt og mellomstopp.' },
    ],
    tips: [
      'Dra og slipp stopp for å endre rekkefølgen på ruten.',
      'Klikk på en aktivitet i kartet for å se detaljer direkte.',
    ],
  },
  {
    id: 'todo',
    icon: ClipboardList,
    emoji: '✅',
    title: 'ToDo',
    subtitle: 'Hold oversikt over hva som må ordnes før dere reiser.',
    features: [
      { title: 'Kolonner per person', desc: 'Hvert reisefølgemedlem får sin egen kolonne med gjøremål. I tillegg finnes en «Felles»-kolonne for delte oppgaver.' },
      { title: 'Legg til gjøremål', desc: 'Skriv inn oppgaven og trykk Enter eller «Legg til». Du kan også sette frist med datovelgeren.' },
      { title: 'Kritiske oppgaver', desc: 'Marker en oppgave som kritisk (rød) for å fremheve at den er viktig å huske.' },
      { title: 'Fremgangsmåler', desc: 'Øverst ser du en fremdriftslinje for alle oppgaver samlet, og hver kolonne har sin egen mini-fremdriftslinje.' },
      { title: 'Nedtelling', desc: 'Antall dager til avreise vises øverst slik at du alltid vet hvor mye tid det er igjen.' },
      { title: 'Sortering', desc: 'Flytt oppgaver opp og ned innad i kolonnen, eller marker dem som fullført.' },
    ],
    tips: [
      'Fullførte oppgaver legges automatisk nederst i kolonnen.',
      'Kritiske oppgaver vises med rød kant og øverst i kolonnen.',
    ],
  },
  {
    id: 'pakkeliste',
    icon: Package,
    emoji: '🧳',
    title: 'Pakkeliste',
    subtitle: 'Se hva alle skal ha med og følg med på at alt er pakket.',
    features: [
      { title: 'Kolonner per reisende', desc: 'Alle i reisefølget får sin egen pakkeliste-kolonne. En «Felles»-kolonne finnes for utstyr dere deler.' },
      { title: 'Kategorier', desc: 'Filtrer listen på kategori: Klær, Hygiene, Elektronikk, Dokumenter, Håndbagage og Annet.' },
      { title: 'Kryss av', desc: 'Hak av for hvert plagg eller utstyrsdel som er pakket. Fremdriftslinjen oppdateres automatisk.' },
      { title: 'Bagasjekapasitet', desc: 'Registrer antall kofferter og vektgrenser per person for ut- og hjemreise. Appen hjelper deg å holde oversikt over total bagasjevekt.' },
      { title: 'Legg til artikler', desc: 'Skriv inn hva som skal pakkes, velg kategori og knytt det til riktig person eller felles.' },
    ],
    tips: [
      'Bruk kategorifilteret til å sjekke at alle dokumenter er med rett før avreise.',
    ],
  },
  {
    id: 'summary',
    icon: CalendarDays,
    emoji: '📅',
    title: 'Oppsummering',
    subtitle: 'Få en komplett dag-for-dag-oversikt over hele reisen.',
    features: [
      { title: 'Kalendervisning', desc: 'Alle stopp, aktiviteter, restauranter og fly vises i en kronologisk kalender ordnet per dag.' },
      { title: 'Flydetaljer', desc: 'Ut- og hjemreisefly vises med avgangs- og ankomsttid, flynummer og eventuelt mellomstopp.' },
      { title: 'Kjørestrekning', desc: 'Mellom stopp vises estimert kjøretid og distanse slik at du vet hva som venter på kjøreturen.' },
      { title: 'Aktiviteter og mat', desc: 'Alle bekreftede aktiviteter og restaurantbesøk vises per dag med tidspunkt og notater.' },
      { title: 'Budsjettoversikt', desc: 'Total reisekostnad og fordeling per kategori vises nederst i oppsummeringen.' },
    ],
    tips: [
      'Oppsummeringen er fin å skrive ut eller ta skjermbilde av som reiseguide.',
    ],
  },
  {
    id: 'aktiviteter',
    icon: ListChecks,
    emoji: '🎯',
    title: 'Aktiviteter',
    subtitle: 'Se alle aktiviteter og restauranter samlet på ett sted.',
    features: [
      { title: 'Samlet liste', desc: 'Alle aktiviteter og restaurantbesøk fra alle stopp vises i en liste gruppert per stopp.' },
      { title: 'Kartvisning', desc: 'Aktivitetene vises som pins på kartet. Trykk på en pin for å se detaljer i en informasjonsboks.' },
      { title: 'Avstandsberegning', desc: 'Velg en aktivitet for å se estimert gå- og kjøretid fra hotellet eller et annet sted.' },
      { title: 'Bestillingslenker', desc: 'Lagre lenker til billetter eller bestillinger direkte på aktiviteten, slik at de er lett tilgjengelig underveis.' },
      { title: 'Aktivitetstyper', desc: 'Aktiviteter har egne ikoner etter type: baseball, friluft, shopping, museum, fornøyelsespark, m.m.' },
    ],
  },
  {
    id: 'kostnader',
    icon: Receipt,
    emoji: '💰',
    title: 'Kostnader',
    subtitle: 'Hold styr på budsjettet og total kostnad for turen.',
    features: [
      { title: 'Kostnadskategorier', desc: 'Registrer kostnader fordelt på fly, leiebil, overnatting, mat, aktiviteter og transport.' },
      { title: 'Per stopp', desc: 'Legg inn utgifter knyttet til hvert enkelt stopp på ruten.' },
      { title: 'Totaloversikt', desc: 'Appen summerer automatisk alle utgifter og viser totalbeløp og kostnad per person.' },
      { title: 'Kategorisummering', desc: 'Se raskt hvilke kategorier som spiser mest av budsjettet.' },
    ],
    tips: [
      'Legg inn estimerte kostnader tidlig i planleggingen for å unngå ubehagelige overraskelser.',
    ],
  },
  {
    id: 'ferietips',
    icon: Lightbulb,
    emoji: '💡',
    title: 'Ferietips',
    subtitle: 'Få personlige reiseråd fra en AI-assistent som kjenner turen din.',
    features: [
      { title: 'AI-chat', desc: 'Still spørsmål om destinasjonene, aktiviteter, mat eller praktiske reiseråd. AI-assistenten kjenner til reiseruten din og reisefølget.' },
      { title: 'Hurtigforslag', desc: 'Bruk ferdiglagde forslag-knapper for vanlige spørsmål, som «Hva bør vi gjøre i [by]?» eller «Tips til pakking».' },
      { title: 'Flere chat-sesjoner', desc: 'Opprett separate samtaler for ulike temaer — én for aktiviteter, én for mat, osv.' },
      { title: 'Lagre som notat', desc: 'Gode svar fra AI-assistenten kan lagres direkte som reisenotat slik at du finner dem igjen senere.' },
    ],
    tips: [
      'Jo mer informasjon du har fylt inn i appen (stopp, aktiviteter, reisefølge), desto bedre og mer relevante tips får du.',
    ],
  },
  {
    id: 'notes',
    icon: FileText,
    emoji: '📝',
    title: 'Notater',
    subtitle: 'Skriv ned alt du vil huske — fra pakketips til minner fra reisen.',
    features: [
      { title: 'Fritekstnotater', desc: 'Skriv notater med formatering. Knytt dem til en spesifikk tur, et stopp eller en dato.' },
      { title: 'Bilder', desc: 'Last opp bilder, ta bilde med kamera eller lim inn fra utklippstavlen direkte i notatet.' },
      { title: 'Bildevisning', desc: 'Alle bilder i et notat vises i et galleri. Trykk for å se dem i full størrelse.' },
      { title: 'Automatisk lagring', desc: 'Notater lagres automatisk mens du skriver — du trenger aldri å trykke «Lagre».' },
      { title: 'Kobling til stopp', desc: 'Knytt et notat til et bestemt stopp og dato for enkel gjenfinning i Oppsummering.' },
    ],
  },
  {
    id: 'turfolge',
    icon: Users,
    emoji: '👥',
    title: 'Turfølge',
    subtitle: 'Legg til hvem som skal bli med og hva de liker.',
    features: [
      { title: 'Legg til reisende', desc: 'Registrer navn, alder og kjønn for alle i reisefølget.' },
      { title: 'Interesser', desc: 'Hak av for interesser per person (f.eks. baseball, friluft, shopping, museum). Dette brukes av AI-assistenten til å gi personlige tips.' },
      { title: 'Beskrivelse', desc: 'Legg til en fritekstbeskrivelse med spesielle behov, ønsker eller andre merknader for den reisende.' },
      { title: 'Kobling til oppgaver', desc: 'Reisende i turfølget brukes til å fordele gjøremål (ToDo) og pakkelister per person.' },
    ],
  },
  {
    id: 'minside',
    icon: UserCircle,
    emoji: '👤',
    title: 'Min side',
    subtitle: 'Administrer kontoen din og tilpass appen.',
    features: [
      { title: 'Fargetema', desc: 'Velg mellom seks fargetemaer: Standard (mørk), Hvit, Havblå, Solnedgang, Mørk skog og Midnatt. Temaet gjelder kun for deg.' },
      { title: 'Delte turer', desc: 'Inviter andre til å se eller redigere turen din ved å dele en lenke eller invitasjonskode.' },
      { title: 'Dokumenter', desc: 'Last opp og lagre reisedokumenter som pass, visum og reiseforsikring på ett trygt sted.' },
      { title: 'Standardpakkeliste', desc: 'Sett opp en mal for pakkelisten som automatisk fylles inn for nye turer.' },
      { title: 'Matpreferanser og interesser', desc: 'Legg inn dine personlige preferanser slik at AI-assistenten kan gi enda mer relevante forslag.' },
    ],
  },
  {
    id: 'chat',
    icon: MessageSquare,
    emoji: '💬',
    title: 'Chat',
    subtitle: 'Send meldinger til alle i reisefølget i sanntid.',
    features: [
      { title: 'Gruppesamtale', desc: 'Alle som har tilgang til turen ser og kan sende meldinger i chat-panelet. Meldinger synkroniseres øyeblikkelig.' },
      { title: 'Emoji-reaksjoner', desc: 'Hold musepekeren over en melding for å reagere med emoji: 👍 ❤️ 😂 😮 😢 🔥. Reaksjonene vises under meldingen.' },
      { title: 'Uleste meldinger', desc: 'Antall uleste meldinger vises som en rød badge på chat-ikonet i navigasjonen.' },
      { title: 'Åpne/lukke', desc: 'Chat-panelet åpner som en skuff fra høyre og kan lukkes igjen uten at du mister oversikten.' },
    ],
    tips: [
      'Chat er perfekt for å koordinere mens dere er på farten — for eksempel å avtale møtested eller dele et godt restauranttips.',
    ],
  },
]

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  const Icon = section.icon

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
          {section.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">{section.title}</h2>
          </div>
          <p className="text-sm text-slate-400 mt-0.5 truncate">{section.subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-slate-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-700/50">
          <p className="text-sm text-slate-400 mt-4 mb-4">{section.subtitle}</p>

          <div className="space-y-3">
            {section.features.map((f) => (
              <div key={f.title} className="flex gap-3">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-slate-200">{f.title}</span>
                  <span className="text-slate-500 mx-1.5">—</span>
                  <span className="text-sm text-slate-400">{f.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {section.tips && section.tips.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-blue-600/10 border border-blue-500/20">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Tips</p>
              <ul className="space-y-1">
                {section.tips.map((tip) => (
                  <li key={tip} className="text-sm text-blue-300/80 flex gap-2">
                    <span className="flex-shrink-0">💡</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const [filter, setFilter] = useState('')

  const filtered = filter.trim()
    ? SECTIONS.filter((s) =>
        s.title.toLowerCase().includes(filter.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(filter.toLowerCase()) ||
        s.features.some(
          (f) =>
            f.title.toLowerCase().includes(filter.toLowerCase()) ||
            f.desc.toLowerCase().includes(filter.toLowerCase()),
        ),
      )
    : SECTIONS

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">❓</span>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Hjelp</h1>
              <p className="text-xs text-slate-500">Oversikt over alle funksjoner i Ferieplanleggeren</p>
            </div>
          </div>
          <input
            type="search"
            placeholder="Søk etter funksjon…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Ingen treff for «{filter}»
          </div>
        ) : (
          filtered.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))
        )}

        <div className="pt-4 text-center text-xs text-slate-600">
          Ferieplanleggeren v0.1 — under utvikling 🚧
        </div>
      </div>
    </div>
  )
}
