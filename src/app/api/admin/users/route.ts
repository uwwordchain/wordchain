import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/** Verify the caller is an authenticated admin */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = await createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.is_admin ? { supabase, admin, callerId: user.id } : null
}

// ── PATCH /api/admin/users  — toggle is_admin ─────────────────────────────
export async function PATCH(request: NextRequest) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, isAdmin } = await request.json()
  if (!userId || typeof isAdmin !== 'boolean') {
    return NextResponse.json({ error: 'Missing userId or isAdmin' }, { status: 400 })
  }

  // Prevent admins from demoting themselves
  if (userId === ctx.callerId && !isAdmin) {
    return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 })
  }

  const { error } = await ctx.admin
    .from('users')
    .update({ is_admin: isAdmin })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── DELETE /api/admin/users  — delete a user ──────────────────────────────
export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  if (userId === ctx.callerId) {
    return NextResponse.json({ error: 'You cannot delete your own account here' }, { status: 400 })
  }

  // Delete profile first (FKs null out via ON DELETE SET NULL), then auth.
  // Both deletes are error-checked — a silent failure here previously left
  // orphaned rows while reporting success.
  const { error: profileErr } = await ctx.admin.from('users').delete().eq('id', userId)
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  const { error: authErr } = await ctx.admin.auth.admin.deleteUser(userId)
  // "User not found" is fine — profile may exist without an auth record
  if (authErr && !/not.?found/i.test(authErr.message)) {
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
