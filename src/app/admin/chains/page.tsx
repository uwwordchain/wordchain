import { createAdminClient } from '@/lib/supabase/server'
import { todayCT, yesterdayCT } from '@/lib/time'
import { ChainsClient } from './ChainsClient'

export default async function AdminChainsPage() {
  const admin = await createAdminClient()
  const today = todayCT()
  const yesterday = yesterdayCT()

  // Run all independent queries in parallel — one round trip instead of six
  const [
    { data: starters },
    { data: users },
    { data: gameDay },
    { data: allWords },
    { data: settingsRows },
    { data: yesterdayGameDay },
  ] = await Promise.all([
    admin
      .from('chain_starters_queue')
      .select('*, user:users(id, first_name, display_name)')
      .gte('play_date', today)
      .order('play_date').order('chain_slot'),
    admin
      .from('users')
      .select('id, first_name, display_name, email, phone')
      .order('first_name'),
    admin
      .from('game_days').select('id,word').eq('play_date', today).maybeSingle(),
    admin.from('chain_words').select('chain_id'),
    admin
      .from('settings').select('key, value')
      .in('key', ['auto_launch_enabled', 'auto_launch_days', 'congrats_sent_date']),
    admin
      .from('game_days').select('id').eq('play_date', yesterday).maybeSingle(),
  ])

  // Active chains today (depends on gameDay)
  let activeChains: any[] = []
  if (gameDay) {
    const { data } = await admin
      .from('chains')
      .select('id, slot, last_activity_at, chain_words(id, word, position, user:users(first_name, display_name))')
      .eq('game_day_id', gameDay.id).order('slot')
    activeChains = data ?? []
  }

  // All-time longest
  const counts: Record<string, number> = {}
  for (const r of allWords ?? []) counts[r.chain_id] = (counts[r.chain_id] ?? 0) + 1
  const longestCount = Math.max(0, ...Object.values(counts))

  // Auto-launch settings — passed down so the toggle renders correctly immediately
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value
  const autoLaunch = settings.auto_launch_enabled === 'true'
  const launchDays = (settings.auto_launch_days ?? '0,1,2,3,4,5,6')
    .split(',').filter(Boolean).map(Number)

  // Yesterday's winning chain (for the "Send congrats text" button)
  let yesterdayWinner: { slot: string; words: number; players: number } | null = null
  if (yesterdayGameDay) {
    const { data: yChains } = await admin
      .from('chains')
      .select('slot, chain_words(user_id)')
      .eq('game_day_id', yesterdayGameDay.id)
    const sorted = (yChains ?? [])
      .map(c => ({ slot: c.slot, entries: (c.chain_words as { user_id: string }[]) ?? [] }))
      .sort((a, b) => b.entries.length - a.entries.length)
    const top = sorted[0]
    if (top && top.entries.length > 0) {
      yesterdayWinner = {
        slot: top.slot,
        words: top.entries.length,
        players: new Set(top.entries.map(e => e.user_id)).size,
      }
    }
  }
  const congratsSent = settings.congrats_sent_date === yesterday

  return (
    <ChainsClient
      initialStarters={starters ?? []}
      users={users ?? []}
      activeChains={activeChains}
      longestCount={longestCount}
      gameDay={gameDay ?? null}
      today={today}
      initialAutoLaunch={autoLaunch}
      initialLaunchDays={launchDays}
      yesterdayWinner={yesterdayWinner}
      initialCongratsSent={congratsSent}
    />
  )
}
