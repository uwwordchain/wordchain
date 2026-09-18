import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { todayCT } from '@/lib/time'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = await createAdminClient()
  const { data: p } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  return p?.is_admin ? admin : null
}

// GET — return starters queue + active chains summary
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = todayCT()

  // Independent queries in parallel
  const [{ data: starters }, { data: gameDay }, { data: longestRaw }] = await Promise.all([
    admin
      .from('chain_starters_queue')
      .select('*, user:users(id, first_name, display_name, email)')
      .gte('play_date', today)
      .order('play_date', { ascending: true })
      .order('chain_slot', { ascending: true }),
    admin
      .from('game_days')
      .select('id, word')
      .eq('play_date', today)
      .maybeSingle(),
    admin.from('chain_words').select('chain_id'),
  ])

  // Active chains (depends on today's game day)
  let activeChains: any[] = []
  if (gameDay) {
    const { data } = await admin
      .from('chains')
      .select(`
        id, slot, last_activity_at,
        chain_words(id, word, position, user:users(first_name, display_name))
      `)
      .eq('game_day_id', gameDay.id)
      .order('slot')
    activeChains = data ?? []
  }
  const chainCounts: Record<string, number> = {}
  for (const row of longestRaw ?? []) {
    chainCounts[row.chain_id] = (chainCounts[row.chain_id] ?? 0) + 1
  }
  const longestCount = Math.max(0, ...Object.values(chainCounts))

  return NextResponse.json({ starters: starters ?? [], activeChains, longestCount, gameDay })
}

// POST — add a chain starter assignment
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { play_date, chain_slot, user_id } = await request.json()
  if (!play_date || !chain_slot) {
    return NextResponse.json({ error: 'play_date and chain_slot required' }, { status: 400 })
  }

  const { error } = await admin.from('chain_starters_queue').upsert(
    { play_date, chain_slot, user_id: user_id ?? null },
    { onConflict: 'play_date,chain_slot' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — remove a starter slot
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await admin.from('chain_starters_queue').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
