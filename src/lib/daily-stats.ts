import { createAdminClient } from '@/lib/supabase/server'
import { findMostObscure } from '@/lib/word-obscurity'
import { yesterdayCT } from '@/lib/time'

export { yesterdayCT }

export interface DailyStats {
  date: string          // YYYY-MM-DD
  startingWord: string
  teams: Array<{ slot: string; wordCount: number }>
  longestWord: { word: string; player: string } | null
  mostObscure: { word: string; player: string } | null
}

/** Gathers the leaderboard stats for a given play date. Returns null if no game that day. */
export async function getDailyStats(date: string): Promise<DailyStats | null> {
  const admin = await createAdminClient()

  const { data: gameDay } = await admin
    .from('game_days')
    .select('id, word')
    .eq('play_date', date)
    .maybeSingle()

  if (!gameDay) return null

  const { data: chains } = await admin
    .from('chains')
    .select('id, slot, chain_words(word, position, user:users(first_name, display_name))')
    .eq('game_day_id', gameDay.id)
    .order('slot')

  const teams = (chains ?? []).map(c => ({
    slot: c.slot as string,
    wordCount: (c.chain_words as any[])?.length ?? 0,
  }))

  const allWords = (chains ?? []).flatMap(c =>
    ((c.chain_words as any[]) ?? []).map(w => ({
      word: w.word as string,
      player: (w.user?.display_name ?? w.user?.first_name ?? 'Player') as string,
    }))
  )

  const longest = allWords.reduce<typeof allWords[number] | null>((best, w) =>
    !best || w.word.length > best.word.length ? w : best, null)

  const obscure = await findMostObscure(allWords)

  return {
    date,
    startingWord: gameDay.word.toUpperCase(),
    teams,
    longestWord: longest ? { word: longest.word.toUpperCase(), player: longest.player } : null,
    mostObscure: obscure ? { word: obscure.word.toUpperCase(), player: obscure.player } : null,
  }
}
