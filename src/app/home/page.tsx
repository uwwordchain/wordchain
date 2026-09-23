import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/ui/Topbar'
import { AdBanner } from '@/components/player/AdBanner'
import { todayCT, yesterdayCT } from '@/lib/time'
import type { GameDay, ChainWord, User } from '@/types'

const PLACEHOLDER_GAME: GameDay = {
  id: 'placeholder',
  play_date: new Date().toISOString().split('T')[0],
  word: 'SPARK',
  launched_at: new Date().toISOString(),
  closes_at: new Date(new Date().setHours(23, 59, 0, 0)).toISOString(),
}

const PLACEHOLDER_CHAIN: { slot: string; words: (ChainWord & { user: User })[] } = {
  slot: 'A',
  words: [
    { id: '1', chain_id: 'c1', user_id: 'u1', word: 'KNIGHT', position: 1, submitted_at: '', user: { id: 'u1', email: 'alex@wisc.edu', phone: null, first_name: 'Alex', display_name: 'Alex T.', is_admin: false, created_at: '' } },
    { id: '2', chain_id: 'c1', user_id: 'u2', word: 'TORCH',  position: 2, submitted_at: '', user: { id: 'u2', email: 'bri@wisc.edu',  phone: null, first_name: 'Bri',  display_name: 'Bri M.', is_admin: false, created_at: '' } },
    { id: '3', chain_id: 'c1', user_id: 'u3', word: 'HELLO',  position: 3, submitted_at: '', user: { id: 'u3', email: 'cade@wisc.edu', phone: null, first_name: 'Cade', display_name: 'Cade R.', is_admin: false, created_at: '' } },
    { id: '4', chain_id: 'c1', user_id: 'u4', word: 'OCEAN',  position: 4, submitted_at: '', user: { id: 'u4', email: 'dee@wisc.edu',  phone: null, first_name: 'Dee',  display_name: 'Dee K.', is_admin: false, created_at: '' } },
    { id: '5', chain_id: 'c1', user_id: 'u5', word: 'NEON',   position: 5, submitted_at: '', user: { id: 'u5', email: 'eli@wisc.edu',  phone: null, first_name: 'Eli',  display_name: 'Eli P.', is_admin: false, created_at: '' } },
    { id: '6', chain_id: 'c1', user_id: 'u6', word: 'NOBLE',  position: 6, submitted_at: '', user: { id: 'u6', email: 'fay@wisc.edu',  phone: null, first_name: 'Fay',  display_name: 'Fay Z.', is_admin: false, created_at: '' } },
  ],
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatCloseTime(closeStr: string) {
  return new Date(closeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
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
    { data: queuedToday },
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
    adminDb.from('word_queue').select('word').eq('play_date', today).maybeSingle(),
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

  // Word source of truth: launched game day → scheduled word from the
  // admin queue (pre-launch window between midnight and chain launch) →
  // sample data only if neither exists.
  const isPreLaunch = !gameDay && !!queuedToday
  const game = gameDay ?? (queuedToday
    ? { ...PLACEHOLDER_GAME, play_date: today, word: queuedToday.word }
    : PLACEHOLDER_GAME)
  const isPlaceholder = !gameDay && !queuedToday

  // Yesterday's winning chain — the chain with the most words
  const yesterdayChains = ((yesterdayGame?.chains as any[]) ?? [])
    .map(c => ({
      slot: c.slot as string,
      words: [...((c.chain_words as any[]) ?? [])].sort((a, b) => a.position - b.position),
    }))
    .filter(c => c.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length)
  const winner = yesterdayChains[0] ?? null
  const chain = winner ?? PLACEHOLDER_CHAIN
  const isWinnerPlaceholder = !winner

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
      <AdBanner
        active={bannerEnabled}
        imageUrl={bannerAd?.image_url ?? null}
        linkUrl={bannerAd?.link_url ?? null}
      />
      <Topbar showLogin={!user} isLoggedIn={!!user} isAdmin={isAdmin} />

      {/* Today's Word Card */}
      <div style={{
        margin: 'var(--space-4) var(--space-4) 0',
        border: '2px solid var(--black)',
        padding: 'var(--space-4)',
      }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
          {isPlaceholder ? 'Sample · ' : ''}{formatDate(game.play_date)}
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
      </div>

      {/* CTA */}
      <div style={{ padding: 'var(--space-3) var(--space-4) 0' }}>
        {!user ? (
          <a href="/signup" className="btn-primary">Sign up to be selected →</a>
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

      {/* Divider */}
      <div style={{ padding: 'var(--space-5) var(--space-4) 0' }}>
        <hr className="divider" />
      </div>

      {/* Yesterday's Winner (per wireframe) */}
      <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
          {isWinnerPlaceholder ? 'Sample · ' : ''}Yesterday's winner · Chain {chain.slot}
        </p>
        <div>
          {chain.words.map((w: any, idx: number) => (
            <div
              key={w.id ?? idx}
              className="chain-row"
              style={{ borderBottom: idx < chain.words.length - 1 ? '1px solid var(--border-light)' : 'none' }}
            >
              <div className="chain-row__num">{idx + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="chain-row__word">{w.word}</div>
                <div className="chain-row__name">{w.user?.display_name ?? w.user?.first_name}</div>
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

      <div className="app-footer">uwwordchain.app</div>
    </div>
  )
}
