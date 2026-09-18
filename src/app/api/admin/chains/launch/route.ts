/**
 * POST /api/admin/chains/launch
 *
 * Manual trigger: launches today's chains immediately (creates the game
 * day, chains, invites, and sends the starter texts). Works regardless
 * of the auto-launch toggle — this IS the manual alternative to it.
 */
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { launchTodaysChains } from '@/lib/launch'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const admin = await createAdminClient()
  const { data: p } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  return !!p?.is_admin
}

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await launchTodaysChains()
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
