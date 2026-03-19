import { NextResponse } from 'next/server'
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

export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = adminClient()

  // Get auth users (last_sign_in_at, created_at, confirmed)
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authData?.users ?? []

  // Get profiles
  const { data: profiles } = await admin.from('user_profiles').select('user_id, display_name, email, is_admin, created_at')

  // Get trip counts per owner
  const { data: trips } = await admin.from('trips').select('owner_id')
  const tripCountByUser: Record<string, number> = {}
  ;(trips ?? []).forEach((t) => {
    tripCountByUser[t.owner_id] = (tripCountByUser[t.owner_id] ?? 0) + 1
  })

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]))

  const users = authUsers.map((u) => {
    const profile = profileMap[u.id]
    return {
      id: u.id,
      email: u.email ?? profile?.email ?? '',
      displayName: profile?.display_name ?? null,
      isAdmin: profile?.is_admin ?? false,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      emailConfirmed: !!u.email_confirmed_at,
      tripCount: tripCountByUser[u.id] ?? 0,
    }
  })

  // Sort by lastSignIn desc
  users.sort((a, b) => {
    const da = a.lastSignIn ? new Date(a.lastSignIn).getTime() : 0
    const db = b.lastSignIn ? new Date(b.lastSignIn).getTime() : 0
    return db - da
  })

  return NextResponse.json({ users })
}
