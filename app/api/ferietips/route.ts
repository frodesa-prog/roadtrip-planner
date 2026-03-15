import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

interface StopContext {
  city: string
  state: string | null
  arrival_date: string | null
  nights: number
}

interface ActivityContext {
  name: string
  activity_type: string | null
  stop_city: string
}

interface TripContext {
  tripName: string
  stops: StopContext[]
  activities: ActivityContext[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildSystemPrompt(ctx: TripContext): string {
  const lines: string[] = [
    'Du er en erfaren og entusiastisk reiserådgiver som hjelper med planlegging av ferieturer. Du kjenner godt til nordamerikanske destinasjoner, men kan gi tips om alle steder i verden.',
    '',
    'Gi alltid konkrete, nyttige og personlige råd. Svar på norsk.',
  ]

  if (ctx.tripName) {
    lines.push('', `Reisens navn: ${ctx.tripName}`)
  }

  if (ctx.stops.length > 0) {
    lines.push('', 'Planlagte destinasjoner:')
    ctx.stops.forEach((s) => {
      const place = `${s.city}${s.state ? `, ${s.state}` : ''}`
      const dateInfo = s.arrival_date ? ` (ankomst ${s.arrival_date})` : ''
      const nightsInfo = s.nights > 0 ? ` – ${s.nights} ${s.nights === 1 ? 'natt' : 'netter'}` : ''
      lines.push(`- ${place}${dateInfo}${nightsInfo}`)
    })
  }

  if (ctx.activities.length > 0) {
    lines.push('', 'Allerede planlagte aktiviteter:')
    ctx.activities.forEach((a) => {
      const type = a.activity_type ? ` (${a.activity_type})` : ''
      lines.push(`- ${a.name}${type} i ${a.stop_city}`)
    })
  }

  lines.push(
    '',
    'Basert på denne informasjonen, gi relevante tips og anbefalinger. Du kan foreslå:',
    '- Restauranter og matsteder',
    '- Attraksjoner og aktiviteter som passer reiseruten',
    '- Praktiske tips om parkering, transport og åpningstider',
    '- Pakketips og ting å huske på',
    '- Tips om det beste tidspunktet for å besøke steder',
    '- Lokale gjemte perler og insider-tips',
    '',
    'Hold svarene konsise og strukturerte. Bruk gjerne punktlister når det passer.',
  )

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey || apiKey === 'din-api-nøkkel-her') {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY er ikke konfigurert' },
      { status: 500 },
    )
  }

  let body: { messages: ChatMessage[]; tripContext: TripContext }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  const { messages, tripContext } = body

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: buildSystemPrompt(tripContext),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const block = message.content[0]
    const text = block.type === 'text' ? block.text : ''

    return NextResponse.json({ text })
  } catch (err) {
    console.error('Anthropic API error:', err)
    const message = err instanceof Error ? err.message : 'Ukjent feil'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
