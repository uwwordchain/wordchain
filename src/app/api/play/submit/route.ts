import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isValidWord } from '@/lib/word-validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, word } = body

    if (!token || !word) {
      return NextResponse.json({ error: 'Missing token or word' }, { status: 400 })
    }

    const normalized = word.toUpperCase().trim()
    if (!/^[A-Z]{2,}$/.test(normalized)) {
      return NextResponse.json({ error: 'Word must be letters only, at least 2 characters' }, { status: 400 })
    }

    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // ── Look up invite token ─────────────────────────────────────────────────
    const { data: invite, error: inviteErr } = await admin
      .from('chain_invites')
      .select(`
        *,
        chain:chains(
          id,
          slot,
          game_day:game_days(id, word, closes_at),
          chain_words(id, user_id, word, position)
        )
      `)
      .eq('token', token)
      .maybeSingle()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
    }

    if (invite.used_at) {
      return NextResponse.json({ error: 'This invite has already been used' }, { status: 409 })
    }

    const chain = invite.chain as any
    const gameDay = chain.game_day as any
    const words: any[] = chain.chain_words ?? []

    // ── Game still open? ─────────────────────────────────────────────────────
    if (new Date() > new Date(gameDay.closes_at)) {
      return NextResponse.json({ error: "Today's game has closed" }, { status: 400 })
    }

    // ── Determine required start letter ──────────────────────────────────────
    let startLetter: string
    if (words.length === 0) {
      // First word in chain — last letter of Word of the Day
      startLetter = gameDay.word.slice(-1).toUpperCase()
    } else {
      const sorted = [...words].sort((a: any, b: any) => a.position - b.position)
      startLetter = sorted[sorted.length - 1].word.slice(-1).toUpperCase()
    }

    // ── Validate start letter ────────────────────────────────────────────────
    if (normalized[0] !== startLetter) {
      return NextResponse.json(
        { error: `Word must start with ${startLetter}` },
        { status: 400 }
      )
    }

    // ── No repeated words within the chain ───────────────────────────────────
    const usedWords = words.map((w: any) => w.word.toUpperCase())
    if (usedWords.includes(normalized)) {
      return NextResponse.json(
        { error: 'That word has already been used in this chain' },
        { status: 400 }
      )
    }

    // ── Each user may only play once per chain ────────────────────────────────
    const alreadyPlayed = words.some((w: any) => w.user_id === user.id)
    if (alreadyPlayed) {
      return NextResponse.json(
        { error: "You've already added a word to this chain today" },
        { status: 409 }
      )
    }

    // ── Real word check ───────────────────────────────────────────────────────
    const valid = await isValidWord(normalized)
    if (!valid) {
      return NextResponse.json({ error: 'Not a valid English word' }, { status: 400 })
    }

    // Next position = highest existing position + 1 (robust to any numbering)
    const nextPosition = words.length === 0
      ? 1
      : Math.max(...words.map((w: any) => w.position)) + 1

    // ── Insert the word ───────────────────────────────────────────────────────
    const { error: wordErr } = await admin.from('chain_words').insert({
      chain_id: chain.id,
      user_id: user.id,
      word: normalized,
      position: nextPosition,
    })

    if (wordErr) {
      console.error('chain_words insert error:', wordErr)
      return NextResponse.json({ error: wordErr.message }, { status: 500 })
    }

    // ── Mark invite as used ───────────────────────────────────────────────────
    await admin
      .from('chain_invites')
      .update({ used_at: new Date().toISOString(), invitee_user_id: user.id })
      .eq('token', token)

    // ── Bump chain last_activity_at ───────────────────────────────────────────
    await admin
      .from('chains')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', chain.id)

    // ── Generate next invite token ────────────────────────────────────────────
    // Use crypto.randomUUID stripped of dashes for a clean URL token
    const nextToken = crypto.randomUUID().replace(/-/g, '')

    const { error: inviteCreateErr } = await admin.from('chain_invites').insert({
      chain_id: chain.id,
      inviter_user_id: user.id,
      token: nextToken,
    })

    if (inviteCreateErr) {
      console.error('chain_invites insert error:', inviteCreateErr)
      return NextResponse.json({ error: inviteCreateErr.message }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uwwordchain.app'
    const shareUrl = `${appUrl}/play/${nextToken}`
    const nextLetter = normalized.slice(-1).toUpperCase()

    // ── Past players: everyone this user has handed a chain to before ──────
    // (tracked via chain_invites when recipients open the link / play)
    const { data: pastInvites } = await admin
      .from('chain_invites')
      .select('invitee:users!chain_invites_invitee_user_id_fkey(id, first_name, display_name, phone)')
      .eq('inviter_user_id', user.id)
      .not('invitee_user_id', 'is', null)

    // Exclude anyone already in this chain (players can't repeat) and dedupe
    const inThisChain = new Set<string>([user.id, ...words.map((w: any) => w.user_id)])
    const seen = new Set<string>()
    const pastContacts: { id: string; name: string; phone: string }[] = []
    for (const row of (pastInvites ?? []) as any[]) {
      const u = row.invitee
      if (!u?.id || !u.phone || inThisChain.has(u.id) || seen.has(u.id)) continue
      seen.add(u.id)
      pastContacts.push({ id: u.id, name: u.display_name ?? u.first_name, phone: u.phone })
    }

    return NextResponse.json({
      success: true,
      word: normalized,
      position: nextPosition,
      nextLetter,
      shareToken: nextToken,
      shareUrl,
      pastContacts,
    })
  } catch (err) {
    console.error('Submit word error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
