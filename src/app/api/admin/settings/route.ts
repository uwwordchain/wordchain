import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = await createAdminClient()
  const { data: p } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  return p?.is_admin ? admin : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await admin.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value
  return NextResponse.json({ settings })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates: Record<string, string> = await request.json()
  for (const [key, value] of Object.entries(updates)) {
    await admin.from('settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }
  return NextResponse.json({ success: true })
}
