import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/ui/Topbar'
import { AdBanner } from '@/components/player/AdBanner'
import { RecoveryRedirect } from '@/components/player/RecoveryRedirect'
import { peekNextWord, willLaunchToday } from '@/lib/launch'
import { todayCT, yesterdayCT } from '@/lib/time'
import type { GameDay } from '@/types'

// Public launch date — before this, the home page shows a coming-soon banner
// on days with no game scheduled.
const LAUNCH_DATE = '2026-10-01'

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatCloseTime(closeStr: string) {
  // Always display in Central Time — the server renders in UTC otherwise
  return new Date(closeStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/Chicago',
  })
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminDb = await createAdminClient()
  const today = todayCT()
  const yesterday = yesterdayCT()

  // All independent queries in parallel — one round trip instead of five
  const [
    profileRes,
    { data: activeAds },
    { data: adSettings },
    gameDayRes,
    { data: yesterdayGame },
    { data: allChainWords },
    { data: allChains },
    nextWord,
    launchCheck,
  ] = await Promise.all([
    user
      ? adminDb.from('users').select('is_admin').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    adminDb.from('ads').select('*').eq('ad_type', 'banner').eq('is_active', true),
    adminDb.from('settings').select('value').eq('key', 'banner_ads_enabled').maybeSingle(),
    supabase.from('game_days').select('*').eq('play_date', today).maybeSingle(),
    adminDb
      .from('game_days')
      .select('id, chains(id, slot, chain_words(id, word, position, user:users(first_name, display_name)))')
      .eq('play_date', yesterday)
      .maybeSingle(),
    adminDb.from('chain_words').select('chain_id'),
    adminDb.from('chains').select('id, slot, game_day:game_days(play_date)'),
    peekNextWord(adminDb),
    willLaunchToday(adminDb),
  ])

  const isAdmin = profileRes.data?.is_admin ?? false
  const bannerAd = activeAds?.[0] ?? null
  const bannerEnabled = adSettings?.value === 'true'
  const gameDay: GameDay | null = gameDayRes.data ?? null

  // Check if this user has submitted a word in any of today's chains
  let hasPlayedToday = false
  if (gameDay && user) {
    const { data: todayChains } = await supabase
      .from('chains')
      .select('id')
      .eq('game_day_id', gameDay.id)

    const chainIds = todayChains?.map((c: { id: string }) => c.id) ?? []

    if (chainIds.length > 0) {
      const { data: wordEntry } = await supabase
        .from('chain_words')
        .select('id')
        .eq('user_id', user.id)
        .in('chain_id', chainIds)
        .limit(1)
        .maybeSingle()
      hasPlayedToday = !!wordEntry
    }
  }

  // Word source of truth: launched game day → next word in the queue,
  // but only if today is actually going to launch (pre-launch window
  // between midnight and the morning cron) → no game at all.
  const isPreLaunch = !gameDay && launchCheck.launch && !!nextWord
  const game: Pick<GameDay, 'play_date' | 'word' | 'closes_at'> | null = gameDay ?? (isPreLaunch
    ? { play_date: today, word: nextWord!.word, closes_at: '' }
    : null)
  const beforeLaunch = today < LAUNCH_DATE

  // Yesterday's winning chain — the chain with the most words.
  // Hidden entirely when yesterday had no chains.
  const yesterdayChains = ((yesterdayGame?.chains as any[]) ?? [])
    .map(c => ({
      slot: c.slot as string,
      words: [...((c.chain_words as any[]) ?? [])].sort((a, b) => a.position - b.position),
    }))
    .filter(c => c.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length)
  const winner = yesterdayChains[0] ?? null

  // All-time record (longest chain ever)
  const chainCounts: Record<string, number> = {}
  for (const row of allChainWords ?? []) chainCounts[row.chain_id] = (chainCounts[row.chain_id] ?? 0) + 1
  let record: { count: number; slot: string; date: string } | null = null
  for (const c of allChains ?? []) {
    const count = chainCounts[c.id] ?? 0
    if (count > 0 && (!record || count > record.count)) {
      const playDate = (c.game_day as any)?.play_date as string | undefined
      record = {
        count,
        slot: c.slot,
        date: playDate
          ? new Date(playDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '',
      }
    }
  }

  return (
    <div className="screen">
      <RecoveryRedirect />
      <AdBanner
        active={bannerEnabled}
        imageUrl={bannerAd?.image_url ?? null}
        linkUrl={bannerAd?.link_url ?? null}
      />
      <Topbar showLogin={!user} isLoggedIn={!!user} isAdmin={isAdmin} />

      {/* Today's Word Card / launch banner */}
      <div style={{
        margin: 'var(--space-4) var(--space-4) 0',
        border: '2px solid var(--black)',
        padding: 'var(--space-4)',
      }}>
        {game ? (
          <>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
              {formatDate(game.play_date)}
            </p>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-1)', fontWeight: 400 }}>
              Today's word
            </p>
            <div className="word-upper" style={{ fontSize: 'var(--text-hero)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 'var(--space-2)' }}>
              {game.word}
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--light)' }}>
              {isPreLaunch ? 'Chains launch this morning' : `Closes at ${formatCloseTime(game.closes_at)}`}
            </p>
          </>
        ) : beforeLaunch ? (
          <>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Coming soon</p>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-1)', fontWeight: 400 }}>
              UW WordChain launches
            </p>
            <div className="word-upper" style={{ fontSize: 'var(--text-hero)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 'var(--space-2)' }}>
              OCT 1
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--light)' }}>
              {user
                ? "You're signed up — players are picked from the community every day. Keep an eye on your texts!"
                : 'Sign up now — players are picked from the community every day.'}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>{formatDate(today)}</p>
            <div className="word-upper" style={{ fontSize: 'var(--text-hero)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 'var(--space-2)' }}>
              NO GAME TODAY
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--light)' }}>
              Check back tomorrow.
            </p>
          </>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: 'var(--space-3) var(--space-4) 0' }}>
        {!user ? (
          <a href="/signup" className="btn-primary">Sign up to be selected <span className="arrow">→</span></a>
        ) : hasPlayedToday ? (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            border: '1px solid var(--border-light)',
            fontSize: 'var(--text-base)',
            color: 'var(--mid)',
            textAlign: 'center',
          }}>
            ✓ You played today
          </div>
        ) : null}
      </div>

      {/* Yesterday's Winner — hidden when yesterday had no chains */}
      {winner && (
        <>
          <div style={{ padding: 'var(--space-5) var(--space-4) 0' }}>
            <hr className="divider" />
          </div>

          <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
              Yesterday's winner · Chain {winner.slot}
            </p>
            <div>
              {winner.words.map((w: any, idx: number) => (
                <div
                  key={w.id ?? idx}
                  className="chain-row"
                  style={{ borderBottom: idx < winner.words.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                >
                  <div className="chain-row__num">{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div className="chain-row__word">{w.word}</div>
                    <div className="chain-row__name">{w.user?.display_name ?? w.user?.first_name ?? 'Former player'}</div>
                  </div>
                </div>
              ))}
            </div>
            {record && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
                All-time record:{' '}
                <strong style={{ color: 'var(--black)' }}>{record.count} words</strong>
                {' '}· Chain {record.slot}{record.date ? ` · ${record.date}` : ''}
              </p>
            )}
          </div>
        </>
      )}

      <div className="app-footer">uwwordchain.app</div>
    </div>
  )
}
