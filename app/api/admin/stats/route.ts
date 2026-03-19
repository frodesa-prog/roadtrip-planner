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
  const { data } = await admin
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single()

  return data?.is_admin ? user : null
}

export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = adminClient()

  const [
    usersRes,
    tripsRes,
    tripTypesRes,
    stopsRes,
    activitiesRes,
    hotelsRes,
    messagesRes,
    notesRes,
    todosRes,
    budgetRes,
    archivesRes,
    documentsRes,
    photosRes,
    travelersRes,
    flightsRes,
    activityLogRes,
    recentTripsRes,
    recentUsersRes,
  ] = await Promise.all([
    admin.from('user_profiles').select('user_id, display_name, email, created_at, is_admin', { count: 'exact' }),
    admin.from('trips').select('*', { count: 'exact', head: true }),
    admin.from('trips').select('trip_type, status, created_at'),
    admin.from('stops').select('*', { count: 'exact', head: true }),
    admin.from('activities').select('activity_type', { count: 'exact' }),
    admin.from('hotels').select('*', { count: 'exact', head: true }),
    admin.from('trip_group_messages').select('*', { count: 'exact', head: true }),
    admin.from('notes').select('*', { count: 'exact', head: true }),
    admin.from('todo_items').select('completed', { count: 'exact' }),
    admin.from('budget_items').select('amount'),
    admin.from('trip_chat_archives').select('*', { count: 'exact', head: true }),
    admin.from('user_documents').select('*', { count: 'exact', head: true }),
    admin.from('photos').select('*', { count: 'exact', head: true }),
    admin.from('travelers').select('*', { count: 'exact', head: true }),
    admin.from('flights').select('*', { count: 'exact', head: true }),
    admin.from('activity_log').select('action, entity_type, created_at, user_id').order('created_at', { ascending: false }).limit(30),
    admin.from('trips').select('name, trip_type, status, created_at, owner_id').order('created_at', { ascending: false }).limit(10),
    admin.from('user_profiles').select('display_name, email, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  // Auth users – for last_sign_in_at
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authData?.users ?? []

  // Monthly signups (last 6 months)
  const now = new Date()
  const monthlySignups: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    monthlySignups[key] = 0
  }
  authUsers.forEach((u) => {
    const d = new Date(u.created_at)
    const key = d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    if (key in monthlySignups) monthlySignups[key]++
  })

  // Active last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5)
  const activeUsers = authUsers.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) > thirtyDaysAgo
  ).length

  // Trips by type
  const trips = tripTypesRes.data ?? []
  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const tripsThisMonth = trips.filter((t) => new Date(t.created_at) > new Date(now.getFullYear(), now.getMonth(), 1)).length
  trips.forEach((t) => {
    byType[t.trip_type ?? 'ukjent'] = (byType[t.trip_type ?? 'ukjent'] ?? 0) + 1
    byStatus[t.status ?? 'ukjent'] = (byStatus[t.status ?? 'ukjent'] ?? 0) + 1
  })

  // Activity types
  const actByType: Record<string, number> = {}
  ;(activitiesRes.data ?? []).forEach((a) => {
    const t = a.activity_type ?? 'annet'
    actByType[t] = (actByType[t] ?? 0) + 1
  })

  // Todos done/pending
  const todos = todosRes.data ?? []
  const todosDone = todos.filter((t) => t.completed).length

  // Total budget
  const totalBudget = (budgetRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  return NextResponse.json({
    users: {
      total: usersRes.count ?? 0,
      activeLastMonth: activeUsers,
      monthlySignups,
      recentSignups: recentUsersRes.data ?? [],
    },
    trips: {
      total: tripsRes.count ?? 0,
      thisMonth: tripsThisMonth,
      byType,
      byStatus,
      recent: recentTripsRes.data ?? [],
    },
    content: {
      stops: stopsRes.count ?? 0,
      activities: activitiesRes.count ?? 0,
      activityTypes: actByType,
      hotels: hotelsRes.count ?? 0,
      travelers: travelersRes.count ?? 0,
      flights: flightsRes.count ?? 0,
    },
    engagement: {
      chatMessages: messagesRes.count ?? 0,
      chatArchives: archivesRes.count ?? 0,
      notes: notesRes.count ?? 0,
      documents: documentsRes.count ?? 0,
      photos: photosRes.count ?? 0,
      todosDone,
      todosPending: todos.length - todosDone,
      totalBudget,
    },
    recentActivity: activityLogRes.data ?? [],
  })
}
