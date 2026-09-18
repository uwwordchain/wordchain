import { createAdminClient } from '@/lib/supabase/server'
import { todayCT } from '@/lib/time'
import { WordsClient } from './WordsClient'

export default async function AdminWordsPage() {
  const admin = await createAdminClient()
  const today = todayCT()

  // Queue = the schedule; game_days = what actually launched today.
  const [{ data: words }, { data: launchedGame }] = await Promise.all([
    admin
      .from('word_queue')
      .select('*')
      .gte('play_date', today)
      .order('play_date', { ascending: true }),
    admin
      .from('game_days')
      .select('word')
      .eq('play_date', today)
      .maybeSingle(),
  ])

  return (
    <WordsClient
      initialWords={words ?? []}
      launchedWord={launchedGame?.word ?? null}
    />
  )
}
