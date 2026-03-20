import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = adminClient()
  const { data } = await admin.from('user_profiles').select('is_admin').eq('user_id', user.id).single()
  return data?.is_admin ? user : null
}

/** Hook calls use a shared secret instead of session auth */
function verifyToken(req: NextRequest) {
  const token = req.headers.get('x-dev-log-token')
  return token === process.env.DEV_LOG_TOKEN && !!process.env.DEV_LOG_TOKEN
}

// ── GET – list entries (admin session required) ───────────────────────────────

export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = adminClient()
  const { data, error } = await admin
    .from('dev_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data })
}

// ── POST – create entry (hook token OR admin session) ────────────────────────

export async function POST(req: NextRequest) {
  const isHook = verifyToken(req)
  if (!isHook) {
    const user = await verifyAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    prompt: string
    session_id?: string
    project?: string
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const admin = adminClient()
  const { data, error } = await admin.from('dev_log').insert({
    prompt: body.prompt.trim(),
    session_id: body.session_id ?? null,
    project: body.project ?? 'roadtrip-planner',
    deploy_status: 'pending',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// ── PATCH – update deploy status and/or summary (hook token OR admin session) ─

export async function PATCH(req: NextRequest) {
  const isHook = verifyToken(req)
  if (!isHook) {
    const user = await verifyAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    id?: string
    session_id?: string
    deploy_status?: 'success' | 'failed' | 'none'
    commit_hash?: string
    commit_message?: string
    summary?: string
  }

  // At least one update field must be present
  if (!body.deploy_status && !body.summary) {
    return NextResponse.json({ error: 'Missing deploy_status or summary' }, { status: 400 })
  }

  const admin = adminClient()

  // Find the entry: by id directly, or by most-recent entry for this session
  let entryId = body.id
  if (!entryId && body.session_id) {
    // For deploy status updates, prefer pending entries; for summary-only, accept any status
    const query = admin
      .from('dev_log')
      .select('id')
      .eq('session_id', body.session_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (body.deploy_status) {
      // Only attach to a pending entry when updating deploy status
      query.eq('deploy_status', 'pending')
    }

    const { data } = await query.single()
    entryId = data?.id
  }

  if (!entryId) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (body.deploy_status) {
    updates.deploy_status = body.deploy_status
    updates.deployed_at = new Date().toISOString()
  }
  if (body.commit_hash)   updates.commit_hash    = body.commit_hash
  if (body.commit_message) updates.commit_message = body.commit_message
  if (body.summary)       updates.summary        = body.summary

  const { error } = await admin.from('dev_log').update(updates).eq('id', entryId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── DELETE – remove an entry (admin session required) ────────────────────────

export async function DELETE(req: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = adminClient()
  const { error } = await admin.from('dev_log').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
