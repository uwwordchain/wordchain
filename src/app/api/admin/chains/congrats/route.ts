/**
 * POST /api/admin/chains/congrats
 *
 * Manual admin action (per wireframe A2): texts a congrats message to
 * every player on yesterday's winning (longest) chain. Records the send
 * in settings so the button shows "already sent" for that date.
 */
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms'
import { yesterdayCT } from '@/lib/time'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = await createAdminClient()
  const { data: p } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  return p?.is_admin ? admin : null
}

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = yesterdayCT()

  const { data: gameDay } = await admin
    .from('game_days').select('id').eq('play_date', date).maybeSingle()
  if (!gameDay) {
    return NextResponse.json({ error: `No game found for ${date}` }, { status: 404 })
  }

  const { data: chains } = await admin
    .from('chains')
    .select('id, slot, chain_words(word, user:users(id, first_name, phone))')
    .eq('game_day_id', gameDay.id)

  if (!chains?.length) {
    return NextResponse.json({ error: 'No chains found for yesterday' }, { status: 404 })
  }

  // Winner = longest chain
  const winner = [...chains].sort(
    (a, b) => (b.chain_words as any[]).length - (a.chain_words as any[]).length
  )[0]
  const words = (winner.chain_words as any[]) ?? []
  if (!words.length) {
    return NextResponse.json({ error: 'Winning chain has no words' }, { status: 400 })
  }

  // Every unique player on the winning team with a phone number
  const seen = new Set<string>()
  const players: { first_name: string; phone: string }[] = []
  for (const w of words) {
    const u = w.user
    if (!u?.id || !u.phone || seen.has(u.id)) continue
    seen.add(u.id)
    players.push({ first_name: u.first_name, phone: u.phone })
  }

  if (!players.length) {
    return NextResponse.json({ error: 'No winning players have phone numbers on file' }, { status: 400 })
  }

  let sent = 0
  const failures: string[] = []
  for (const p of players) {
    const body =
      `Congrats ${p.first_name}! Your team won yesterday's UW WordChain — ` +
      `Chain ${winner.slot} finished with ${words.length} words, the longest of the day.`
    try {
      await sendSMS(p.phone, body)
      sent++
    } catch (e) {
      failures.push(`${p.phone}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  // Remember that congrats went out for this date
  await admin.from('settings').upsert({ key: 'congrats_sent_date', value: date }, { onConflict: 'key' })

  return NextResponse.json({
    success: true,
    date,
    slot: winner.slot,
    sent,
    total: players.length,
    ...(failures.length ? { failures } : {}),
  })
}
