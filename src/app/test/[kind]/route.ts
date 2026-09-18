/**
 * GET /test/start — fresh invite on a brand-new empty chain (start-of-chain view)
 * GET /test/mid   — fresh invite on today's longest chain (mid-chain view)
 * GET /test/used  — fresh invite that's already marked used (used-link view)
 *
 * TEMPORARY testing helper (linked from the menu) — mints a new one-time
 * token on every visit so links never go stale. Remove before launch.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { todayCT } from '@/lib/time'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params
  const admin = await createAdminClient()
  const origin = request.nextUrl.origin

  const { data: gameDay } = await admin
    .from('game_days').select('id').eq('play_date', todayCT()).maybeSingle()

  if (!gameDay) {
    // No game today — send the tester to the launch button
    return NextResponse.redirect(`${origin}/admin/chains`)
  }

  const { data: chains } = await admin
    .from('chains')
    .select('id, slot, chain_words(user_id, position)')
    .eq('game_day_id', gameDay.id)

  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  if (kind === 'start') {
    // New empty chain with the next free slot letter
    const usedSlots = new Set((chains ?? []).map(c => c.slot))
    const slot = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(s => !usedSlots.has(s)) ?? 'Z'
    const { data: chain, error } = await admin
      .from('chains')
      .insert({ game_day_id: gameDay.id, slot })
      .select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await admin.from('chain_invites').insert({ chain_id: chain.id, token })
    return NextResponse.redirect(`${origin}/play/${token}`)
  }

  if (kind === 'mid') {
    // Today's chain with the most words
    const withWords = (chains ?? [])
      .map(c => ({ ...c, words: (c.chain_words as any[]) ?? [] }))
      .filter(c => c.words.length > 0)
      .sort((a, b) => b.words.length - a.words.length)
    const target = withWords[0]
    if (!target) return NextResponse.redirect(`${origin}/test/start`)
    const lastUser = [...target.words].sort((a, b) => b.position - a.position)[0]?.user_id ?? null
    await admin.from('chain_invites').insert({
      chain_id: target.id, inviter_user_id: lastUser, token,
    })
    return NextResponse.redirect(`${origin}/play/${token}`)
  }

  if (kind === 'used') {
    const chain = chains?.[0]
    if (!chain) return NextResponse.redirect(`${origin}/test/start`)
    await admin.from('chain_invites').insert({
      chain_id: chain.id, token, used_at: new Date().toISOString(),
    })
    return NextResponse.redirect(`${origin}/play/${token}`)
  }

  return NextResponse.json({ error: `Unknown test kind: ${kind}` }, { status: 400 })
}
