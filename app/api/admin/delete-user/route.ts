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

export async function DELETE(req: NextRequest) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json() as { userId: string }
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Prevent self-deletion
  if (userId === caller.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const admin = adminClient()

  // Check target is not also admin
  const { data: targetProfile } = await admin.from('user_profiles').select('is_admin, email').eq('user_id', userId).single()
  if (targetProfile?.is_admin) {
    return NextResponse.json({ error: 'Cannot delete another administrator' }, { status: 400 })
  }

  // Delete from Supabase Auth (cascades to auth-linked data; app data cleaned by DB cascade or left for manual cleanup)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error('[admin/delete-user] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
