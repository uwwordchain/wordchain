import { createAdminClient } from '@/lib/supabase/server'
import { todayCT } from '@/lib/time'
import { WordsClient } from './WordsClient'

export default async function AdminWordsPage() {
  const admin = await createAdminClient()
  const today = todayCT()

  // Queue = ordered list of upcoming words (play_date is just the sort
  // key); game_days = what actually launched today. Launched words are
  // deleted from the queue, so everything here is still unused.
  const [{ data: words }, { data: launchedGame }] = await Promise.all([
    admin
      .from('word_queue')
      .select('*')
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
