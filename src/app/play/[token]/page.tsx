import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PlayScreen, { type ChainContext, type CurrentUser } from '@/components/player/PlayScreen'

interface PlayPageProps {
  params: Promise<{ token: string }>
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { token } = await params

  const admin = await createAdminClient()
  const supabase = await createClient()

  // ── Load invite, auth state, and ad config in parallel ──────────────────
  const [
    { data: invite, error },
    { data: { user: authUser } },
    { data: activeAds },
    { data: adSettings },
  ] = await Promise.all([
    admin
      .from('chain_invites')
      .select(`
        id,
        token,
        used_at,
        inviter_user_id,
        invitee_user_id,
        chain:chains(
          id,
          slot,
          game_day:game_days(id, word, closes_at),
          chain_words(
            id,
            user_id,
            word,
            position,
            user:users(id, first_name, display_name)
          )
        )
      `)
      .eq('token', token)
      .maybeSingle(),
    supabase.auth.getUser(),
    admin.from('ads').select('*').eq('ad_type', 'banner').eq('is_active', true),
    admin.from('settings').select('value').eq('key', 'banner_ads_enabled').maybeSingle(),
  ])

  if (error || !invite) {
    notFound()
  }

  if (invite.used_at) {
    // Invite already used — show a friendly message instead of 404
    return (
      <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔗</div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          This link has been used.
        </div>
        <p style={{ fontSize: 11, color: '#767676', lineHeight: 1.6, marginBottom: 24 }}>
          Each invite link can only be used once. Ask the person who invited you for a new link, or head home.
        </p>
        <a href="/home" style={{ fontSize: 11, color: '#000', fontWeight: 700, textDecoration: 'underline' }}>
          ← Back to home
        </a>
      </div>
    )
  }

  const chain = invite.chain as any
  const gameDay = chain.game_day as any
  const rawWords: any[] = chain.chain_words ?? []

  // ── Day rollover ─────────────────────────────────────────────────────────
  // Chains lock at 11:59 PM CT. Links from a closed day show a friendly
  // end-of-day screen instead of the word entry (submit also enforces this).
  if (new Date() > new Date(gameDay.closes_at)) {
    return (
      <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          This chain has closed.
        </div>
        <p style={{ fontSize: 11, color: '#767676', lineHeight: 1.6, marginBottom: 24 }}>
          Chains lock at 11:59 PM CT and reset each day. Head home to see today&apos;s word and yesterday&apos;s winner.
        </p>
        <a href="/home" style={{ fontSize: 11, color: '#000', fontWeight: 700, textDecoration: 'underline' }}>
          ← Back to home
        </a>
      </div>
    )
  }

  // Sort words by position
  const sortedWords = [...rawWords].sort((a, b) => a.position - b.position)

  // Build previousWords array
  const previousWords = sortedWords.map((w: any) => ({
    word: w.word as string,
    user: w.user
      ? {
          first_name: w.user.first_name as string,
          display_name: w.user.display_name as string | null,
        }
      : null,
  }))

  // Determine start letter
  const isFirstInChain = sortedWords.length === 0
  const lastWord = isFirstInChain ? null : sortedWords[sortedWords.length - 1].word as string
  const lastPlayerRaw = isFirstInChain ? null : sortedWords[sortedWords.length - 1].user
  const lastPlayerName: string | null = lastPlayerRaw
    ? (lastPlayerRaw.display_name ?? lastPlayerRaw.first_name)
    : null

  const startLetter: string = isFirstInChain
    ? (gameDay.word as string).slice(-1).toUpperCase()
    : (lastWord as string).slice(-1).toUpperCase()

  const chainContext: ChainContext = {
    inviteToken: token,
    gameDay: {
      word: gameDay.word as string,
      closes_at: gameDay.closes_at as string,
    },
    chain: {
      id: chain.id as string,
      slot: chain.slot as string,
    },
    previousWords,
    startLetter,
    isFirstInChain,
    lastWord,
    lastPlayerName,
  }

  // ── Current user profile ─────────────────────────────────────────────────
  let currentUser: CurrentUser | null = null
  let isAdmin = false
  if (authUser) {
    const { data: profile } = await admin
      .from('users')
      .select('id, first_name, display_name, is_admin')
      .eq('id', authUser.id)
      .maybeSingle()
    if (profile) {
      currentUser = {
        id: profile.id,
        first_name: profile.first_name,
        display_name: profile.display_name ?? null,
      }
      isAdmin = profile.is_admin ?? false
    }

    // ── Track the chain hand-off ─────────────────────────────────────────
    // The moment a logged-in user opens an invite link, record them as the
    // recipient so "past players" history works even before they submit.
    // (New users get tracked too: signup carries them back to this URL.)
    if (
      !invite.used_at &&
      !invite.invitee_user_id &&
      invite.inviter_user_id &&
      invite.inviter_user_id !== authUser.id
    ) {
      await admin
        .from('chain_invites')
        .update({ invitee_user_id: authUser.id })
        .eq('id', invite.id)
        .is('invitee_user_id', null) // guard against a concurrent claim
    }
  }

  // Banner ad config (interstitial is handled globally in the root layout)
  const bannerAd = activeAds?.[0] ?? null

  const adConfig = {
    bannerActive: adSettings?.value === 'true',
    bannerImageUrl: bannerAd?.image_url ?? null,
    bannerLinkUrl: bannerAd?.link_url ?? null,
  }

  // ── Re-share mode ──────────────────────────────────────────────────────────
  // If the visitor owns this share link (they played the last word and this is
  // their unused pass-it-on token — e.g. they arrived via a "bump" text),
  // show them the share screen again instead of the word-entry screen.
  let reshare: { submittedWord: string; pastContacts: { id: string; name: string; phone: string }[] } | null = null
  if (authUser && invite.inviter_user_id === authUser.id) {
    const myWord = [...sortedWords].reverse().find((w: any) => w.user_id === authUser.id)
    if (myWord) {
      const { data: pastInvites } = await admin
        .from('chain_invites')
        .select('invitee:users!chain_invites_invitee_user_id_fkey(id, first_name, display_name, phone)')
        .eq('inviter_user_id', authUser.id)
        .not('invitee_user_id', 'is', null)

      const inThisChain = new Set<string>(sortedWords.map((w: any) => w.user_id))
      const seen = new Set<string>()
      const pastContacts: { id: string; name: string; phone: string }[] = []
      for (const row of (pastInvites ?? []) as any[]) {
        const u = row.invitee
        if (!u?.id || !u.phone || inThisChain.has(u.id) || seen.has(u.id)) continue
        seen.add(u.id)
        pastContacts.push({ id: u.id, name: u.display_name ?? u.first_name, phone: u.phone })
      }

      reshare = { submittedWord: myWord.word as string, pastContacts }
    }
  }

  return <PlayScreen chainContext={chainContext} currentUser={currentUser} isAdmin={isAdmin} ad={adConfig} reshare={reshare} />
}
