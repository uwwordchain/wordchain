import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = await createAdminClient()
  const { data: p } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  return p?.is_admin ? { admin, callerId: user.id } : null
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chainId } = await request.json()
  if (!chainId) return NextResponse.json({ error: 'chainId required' }, { status: 400 })

  const { admin } = ctx

  // Get the chain + last word + game day info
  const { data: chain } = await admin
    .from('chains')
    .select(`
      id, slot,
      game_day:game_days(word),
      chain_words(id, word, position, user:users(id, first_name, phone))
    `)
    .eq('id', chainId)
    .maybeSingle()

  if (!chain) return NextResponse.json({ error: 'Chain not found' }, { status: 404 })

  const words = (chain.chain_words as any[]) ?? []
  if (!words.length) return NextResponse.json({ error: 'Chain has no words yet' }, { status: 400 })

  // Find the last word and its player
  const lastWord = [...words].sort((a, b) => b.position - a.position)[0]
  const lastPlayer = lastWord.user as any
  const phone = lastPlayer?.phone

  if (!phone) {
    return NextResponse.json({ error: 'Last player has no phone number on file' }, { status: 400 })
  }

  // Reuse the player's own outstanding share link (created when they
  // submitted their word) so the link opens their re-share screen.
  const { data: existingInvite } = await admin
    .from('chain_invites')
    .select('token')
    .eq('chain_id', chainId)
    .eq('inviter_user_id', lastPlayer.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let token = existingInvite?.token
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '')
    await admin.from('chain_invites').insert({
      chain_id: chainId,
      inviter_user_id: lastPlayer.id,
      token,
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uwwordchain.org'
  const firstName = lastPlayer?.first_name ?? 'Hey'

  const body =
    `${firstName}, your chain's gone cold! Chain ${chain.slot} is stuck on ` +
    `${lastWord.word.toUpperCase()} — try sending it again: ${appUrl}/play/${token}`

  try {
    await sendSMS(phone, body)
  } catch (e) {
    return NextResponse.json(
      { error: `Text failed to send: ${e instanceof Error ? e.message : 'unknown error'}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, sentTo: phone })
}
