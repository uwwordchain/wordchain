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

// GET — list all uploaded ad images
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin
    .from('ads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ads: data ?? [] })
}

// PATCH — set an image active (deactivates others of the same type)
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_active, link_url } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: ad } = await admin.from('ads').select('ad_type').eq('id', id).maybeSingle()
  if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 })

  if (is_active) {
    // Deactivate all others of this type first — only one active at a time
    await admin.from('ads').update({ is_active: false }).eq('ad_type', ad.ad_type)
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof is_active === 'boolean') update.is_active = is_active
  if (link_url !== undefined) update.link_url = link_url || null

  const { error } = await admin.from('ads').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — remove an image from the library
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await admin.from('ads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
