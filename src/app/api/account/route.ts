import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hashPin, pinToPassword } from '@/lib/auth'

// ── DELETE /api/account  — self-delete ────────────────────────────────────
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = await createAdminClient()

  // Remove public profile first (FK), then auth record
  await admin.from('users').delete().eq('id', user.id)
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { name, displayName, phone, newPin, currentPin, skipCurrentPinCheck } = body

  const admin = await createAdminClient()

  // ── Profile fields ────────────────────────────────────────────────────────
  const profileUpdate: Record<string, string | null> = {}
  if (name?.trim()) {
    // Single "Name" field — split into first + last (same as signup)
    const parts = name.trim().split(/\s+/)
    profileUpdate.first_name = parts[0]
    profileUpdate.last_name  = parts.slice(1).join(' ') || null
  }
  if (displayName !== undefined)      profileUpdate.display_name = displayName?.trim() || null
  if (phone !== undefined)            profileUpdate.phone        = phone?.trim() || null

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from('users').update(profileUpdate).eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── PIN change ────────────────────────────────────────────────────────────
  if (newPin) {
    // skipCurrentPinCheck is only set by the /reset-pin recovery flow,
    // where the user is already authenticated via a Supabase recovery session.
    if (!skipCurrentPinCheck && !currentPin) {
      return NextResponse.json({ error: 'Current PIN required to set a new PIN' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: 'New PIN must be 4 digits' }, { status: 400 })
    }

    // Verify current PIN (skip if coming from email recovery flow)
    if (!skipCurrentPinCheck) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: pinToPassword(currentPin),
      })
      if (signInErr) {
        return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 400 })
      }
    }

    // Update auth password + pin_hash
    const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, {
      password: pinToPassword(newPin),
    })
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })

    await admin.from('users').update({ pin_hash: hashPin(newPin) }).eq('id', user.id)
  }

  return NextResponse.json({ success: true })
}
