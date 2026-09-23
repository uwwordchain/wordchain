/**
 * GET /test/start — fresh invite on an empty chain (start-of-chain view)
 * GET /test/mid   — fresh invite on a chain with words (mid-chain view);
 *                   seeds a word itself if nobody has played yet
 * GET /test/used  — fresh invite that's already marked used (used-link view)
 *
 * TEMPORARY testing helper (linked from the menu) — mints a new one-time
 * token on every visit so links never go stale. Reuses chains where
 * possible (slots are constrained to A–F by the schema). Remove before launch.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { todayCT, ctWallTimeToUTC } from '@/lib/time'

const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F'] // must match chains_slot_check

// Seed words for /test/mid, keyed by required starting letter
const SEED_WORDS: Record<string, string> = {
  A: 'ANCHOR', B: 'BREEZE', C: 'CANDLE', D: 'DRIFT', E: 'EMBER', F: 'FABLE',
  G: 'GARNET', H: 'HARBOR', I: 'INDIGO', J: 'JOURNAL', K: 'KETTLE', L: 'LANTERN',
  M: 'MEADOW', N: 'NECTAR', O: 'ORBIT', P: 'PEBBLE', Q: 'QUILT', R: 'RIVER',
  S: 'SADDLE', T: 'TIMBER', U: 'UMBER', V: 'VELVET', W: 'WILLOW', X: 'XENON',
  Y: 'YONDER', Z: 'ZEPHYR',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params
  const admin = await createAdminClient()
  const origin = request.nextUrl.origin
  const today = todayCT()

  let { data: gameDay } = await admin
    .from('game_days').select('id, word').eq('play_date', today).maybeSingle()

  if (!gameDay) {
    // Pre-launch window (before the morning cron): bootstrap today's game
    // day from the scheduled word so test links work at any hour.
    const { data: queued } = await admin
      .from('word_queue').select('word').eq('play_date', today).maybeSingle()
    if (!queued) {
      return NextResponse.redirect(`${origin}/admin/words`)
    }
    const { data: created, error } = await admin
      .from('game_days')
      .insert({ play_date: today, word: queued.word, closes_at: ctWallTimeToUTC(today, 23, 59) })
      .select('id, word').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    gameDay = created
  }

  const { data: chains } = await admin
    .from('chains')
    .select('id, slot, chain_words(user_id, word, position)')
    .eq('game_day_id', gameDay.id)

  const all = (chains ?? []).map(c => ({
    id: c.id, slot: c.slot, words: ((c.chain_words as any[]) ?? []),
  }))
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  /** Reuse an empty chain, or create one in a free A–F slot */
  async function getEmptyChain(): Promise<{ id: string } | { error: string }> {
    const empty = all.find(c => c.words.length === 0)
    if (empty) return { id: empty.id }
    const usedSlots = new Set(all.map(c => c.slot))
    const slot = SLOTS.find(s => !usedSlots.has(s))
    if (!slot) return { error: 'All 6 chain slots are in use with words — use the mid-chain link instead' }
    const { data: chain, error } = await admin
      .from('chains')
      .insert({ game_day_id: gameDay!.id, slot })
      .select('id').single()
    if (error) return { error: error.message }
    return { id: chain.id }
  }

  if (kind === 'start') {
    const chain = await getEmptyChain()
    if ('error' in chain) return NextResponse.json({ error: chain.error }, { status: 409 })
    await admin.from('chain_invites').insert({ chain_id: chain.id, token })
    return NextResponse.redirect(`${origin}/play/${token}`)
  }

  if (kind === 'mid') {
    // Prefer a chain that already has words
    let target = [...all].sort((a, b) => b.words.length - a.words.length)[0]
    if (!target || target.words.length === 0) {
      // Nobody has played yet — seed a word so the mid-chain view exists.
      // (user_id null renders as "Former player" / anonymous.)
      const chain = await getEmptyChain()
      if ('error' in chain) return NextResponse.json({ error: chain.error }, { status: 409 })
      const startLetter = gameDay.word.slice(-1).toUpperCase()
      const seedWord = SEED_WORDS[startLetter] ?? 'RIVER'
      const { error: seedErr } = await admin.from('chain_words').insert({
        chain_id: chain.id, user_id: null, word: seedWord.toLowerCase(), position: 1,
      })
      if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 })
      target = { id: chain.id, slot: '?', words: [{ user_id: null, word: seedWord, position: 1 }] }
    }
    const lastUser = [...target.words].sort((a, b) => b.position - a.position)[0]?.user_id ?? null
    await admin.from('chain_invites').insert({
      chain_id: target.id, inviter_user_id: lastUser, token,
    })
    return NextResponse.redirect(`${origin}/play/${token}`)
  }

  if (kind === 'used') {
    const chain = all[0] ?? null
    let chainId = chain?.id
    if (!chainId) {
      const created = await getEmptyChain()
      if ('error' in created) return NextResponse.json({ error: created.error }, { status: 409 })
      chainId = created.id
    }
    await admin.from('chain_invites').insert({
      chain_id: chainId, token, used_at: new Date().toISOString(),
    })
    return NextResponse.redirect(`${origin}/play/${token}`)
  }

  return NextResponse.json({ error: `Unknown test kind: ${kind}` }, { status: 400 })
}
