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

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>

/**
 * The word queue is an ordered list, not a calendar: each launched game day
 * consumes the FIRST word in the queue (play_date is only a sort key).
 * Days that don't launch don't consume a word — nothing is ever skipped.
 */
export async function peekNextWord(admin: AdminClient): Promise<{ id: string; word: string } | null> {
  const { data } = await admin
    .from('word_queue')
    .select('id, word')
    .order('play_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/**
 * Whether today's cron should launch: manually scheduled dates ALWAYS
 * launch; otherwise auto-launch settings (toggle + day-of-week) decide.
 */
export async function willLaunchToday(admin: AdminClient): Promise<{ launch: boolean; reason?: string }> {
  const { data: scheduledToday } = await admin
    .from('chain_starters_queue')
    .select('id')
    .eq('play_date', todayCT())
    .limit(1)
  if ((scheduledToday?.length ?? 0) > 0) return { launch: true }

  const { data: settingsRows } = await admin
    .from('settings')
    .select('key, value')
    .in('key', ['auto_launch_enabled', 'auto_launch_days'])
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  if (settings.auto_launch_enabled !== 'true') {
    return { launch: false, reason: 'No manual schedule for today and auto-launch is OFF' }
  }

  // Day-of-week check in Central Time (0 = Sunday … 6 = Saturday)
  // Default: all days enabled if the setting has never been saved.
  const enabledDays = (settings.auto_launch_days ?? '0,1,2,3,4,5,6')
    .split(',').filter(Boolean).map(Number)
  const dayNameCT = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' })
  const dayIndexCT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayNameCT)

  if (!enabledDays.includes(dayIndexCT)) {
    return { launch: false, reason: `No manual schedule for today and auto-launch not enabled for ${dayNameCT}` }
  }
  return { launch: true }
}

export async function launchTodaysChains(): Promise<LaunchResult> {
  const admin = await createAdminClient()
  const today = todayCT()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uwwordchain.app'

  // ── Ensure game_day exists ─────────────────────────────────────────
  let gameDay: { id: string; word: string } | null = null
  {
    const { data: existing } = await admin
      .from('game_days').select('id, word').eq('play_date', today).maybeSingle()

    if (existing) {
      gameDay = existing
    } else {
      // Take the next word in the queue (ordered list — see peekNextWord)
      const wq = await peekNextWord(admin)
      if (!wq) {
        return { success: false, error: 'The word queue is empty — add words in the Words tab first' }
      }

      // Chains lock at 11:59 PM Central Time
      const closesAt = ctWallTimeToUTC(today, 23, 59)
      const { data: created, error } = await admin
        .from('game_days')
        .insert({ play_date: today, word: wq.word, closes_at: closesAt })
        .select('id, word').single()

      if (error) return { success: false, error: error.message }
      gameDay = created

      // Word is consumed — remove it from the queue
      await admin.from('word_queue').delete().eq('id', wq.id)
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

  // Nobody can be randomly picked if they're already spoken for today:
  // (a) scheduled starters for any of today's slots, and
  // (b) starters of chains already launched today (e.g. via the admin button).
  for (const r of starterRows ?? []) {
    const phone = r.phone_override ?? (allUsers ?? []).find(u => u.id === r.user_id)?.phone
    if (phone) usedPhones.add(phone)
  }
  {
    const { data: launchedChains } = await admin
      .from('chains').select('starter_user_id').eq('game_day_id', gameDay.id)
    for (const c of launchedChains ?? []) {
      const phone = (allUsers ?? []).find(u => u.id === c.starter_user_id)?.phone
      if (phone) usedPhones.add(phone)
    }
  }

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
