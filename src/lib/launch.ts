/**
 * Launches today's chains: creates the game_day (word from the queue),
 * a chain per scheduled slot (or A/B/C), an invite token each, and sends
 * the trigger SMS to each starter. Idempotent — already-launched slots
 * are skipped, so it's safe to run from the cron AND the admin button.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms'
import { todayCT, ctWallTimeToUTC } from '@/lib/time'

export interface LaunchResult {
  success: boolean
  error?: string
  date?: string
  results?: { slot: string; status: string; phone?: string }[]
}

export async function launchTodaysChains(): Promise<LaunchResult> {
  const admin = await createAdminClient()
  const today = todayCT()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uwwordchain.org'

  // ── Ensure game_day exists ─────────────────────────────────────────
  let gameDay: { id: string; word: string } | null = null
  {
    const { data: existing } = await admin
      .from('game_days').select('id, word').eq('play_date', today).maybeSingle()

    if (existing) {
      gameDay = existing
    } else {
      const { data: wq } = await admin
        .from('word_queue').select('word').eq('play_date', today).maybeSingle()

      if (!wq) {
        return { success: false, error: 'No word scheduled for today — add one in the Words tab first' }
      }

      // Chains lock at 11:59 PM Central Time
      const closesAt = ctWallTimeToUTC(today, 23, 59)
      const { data: created, error } = await admin
        .from('game_days')
        .insert({ play_date: today, word: wq.word, closes_at: closesAt })
        .select('id, word').single()

      if (error) return { success: false, error: error.message }
      gameDay = created
    }
  }

  // ── Determine slots ────────────────────────────────────────────────
  const { data: starterRows } = await admin
    .from('chain_starters_queue')
    .select('chain_slot, user_id, phone_override')
    .eq('play_date', today)

  const slots = starterRows?.length
    ? [...new Set(starterRows.map(r => r.chain_slot))].sort()
    : ['A', 'B', 'C']

  // ── Eligible users (have phones) ────────────────────────────────────
  const { data: allUsers } = await admin
    .from('users').select('id, first_name, phone').not('phone', 'is', null)

  const usedPhones = new Set<string>()

  function pickRandom<T extends { phone: string | null }>(pool: T[]): T | null {
    const avail = pool.filter(u => u.phone && !usedPhones.has(u.phone))
    if (!avail.length) return null
    return avail[Math.floor(Math.random() * avail.length)]
  }

  // ── Launch each slot ───────────────────────────────────────────────
  const results: { slot: string; status: string; phone?: string }[] = []

  for (const slot of slots) {
    const { data: existingChain } = await admin
      .from('chains').select('id').eq('game_day_id', gameDay.id).eq('slot', slot).maybeSingle()

    if (existingChain) { results.push({ slot, status: 'already launched' }); continue }

    const qRow = starterRows?.find(r => r.chain_slot === slot)
    let userId: string | null = qRow?.user_id ?? null
    let phone: string | null = qRow?.phone_override ?? null

    if (!userId && !phone) {
      const picked = pickRandom(allUsers ?? [])
      if (picked) { userId = picked.id; phone = picked.phone! }
    }

    if (!phone && userId) {
      phone = (allUsers ?? []).find(u => u.id === userId)?.phone ?? null
    }

    if (!phone) { results.push({ slot, status: 'no phone — skipped' }); continue }
    usedPhones.add(phone)

    const { data: chain, error: chainErr } = await admin
      .from('chains')
      .insert({ game_day_id: gameDay.id, slot, starter_user_id: userId })
      .select('id').single()

    if (chainErr) { results.push({ slot, status: `error: ${chainErr.message}` }); continue }

    const token = crypto.randomUUID().replace(/-/g, '')
    await admin.from('chain_invites').insert({
      chain_id: chain.id, invitee_user_id: userId, invitee_phone: phone, token,
    })

    const body =
      `You've been selected to start Chain ${slot} in today's UW WordChain! ` +
      `Today's word is ${gameDay.word.toUpperCase()}. ` +
      `Your first word must start with ${gameDay.word.slice(-1).toUpperCase()}. ` +
      `Play here: ${appUrl}/play/${token}`

    try {
      await sendSMS(phone, body)
      results.push({ slot, status: 'sent', phone })
    } catch (e) {
      results.push({ slot, status: `sms failed: ${e instanceof Error ? e.message : 'unknown'}`, phone })
    }
  }

  return { success: true, date: today, results }
}
