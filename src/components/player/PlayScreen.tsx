'use client'

import { useState, useRef } from 'react'
import { Topbar } from '@/components/ui/Topbar'
import { ContextStrip } from '@/components/ui/ContextStrip'
import { Button } from '@/components/ui/Button'
import { Accordion } from '@/components/ui/Accordion'
import { AdBanner } from '@/components/player/AdBanner'

export interface AdConfig {
  bannerActive: boolean
  bannerImageUrl: string | null
  bannerLinkUrl: string | null
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChainContext {
  inviteToken: string
  gameDay: { word: string; closes_at: string }
  chain: { id: string; slot: string }
  previousWords: Array<{
    word: string
    user?: { display_name?: string | null; first_name: string } | null
  }>
  startLetter: string
  isFirstInChain: boolean
  lastWord: string | null
  lastPlayerName: string | null
}

export interface CurrentUser {
  id: string
  first_name: string
  display_name?: string | null
}

interface PlayScreenProps {
  chainContext: ChainContext
  currentUser: CurrentUser | null
  isAdmin?: boolean
  ad?: AdConfig | null
  /** Set when the visitor owns this share link (e.g. arrived via a bump text):
      skips word entry and shows the share screen for their existing word. */
  reshare?: { submittedWord: string; pastContacts: { id: string; name: string; phone: string }[] } | null
}

type PlayState = 'prompt' | 'submitting' | 'error' | 'success'

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayScreen({ chainContext, currentUser, isAdmin = false, ad = null, reshare = null }: PlayScreenProps) {
  const {
    inviteToken,
    gameDay,
    chain,
    previousWords,
    startLetter,
    isFirstInChain,
    lastWord,
    lastPlayerName,
  } = chainContext

  const [playState, setPlayState] = useState<PlayState>(reshare ? 'success' : 'prompt')
  const [wordInput, setWordInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [shareToken, setShareToken] = useState(reshare ? chainContext.inviteToken : '')
  const [submittedWord, setSubmittedWord] = useState(reshare?.submittedWord ?? '')
  const [pastContacts, setPastContacts] = useState<{ id: string; name: string; phone: string }[]>(reshare?.pastContacts ?? [])
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const wordCount = previousWords.length
  const loginUrl = `/login?next=/play/${inviteToken}`
  const signupUrl = `/signup?next=/play/${inviteToken}`
  const isError = playState === 'error'
  const isSubmitting = playState === 'submitting'

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
    setWordInput(val)
    if (isError) { setPlayState('prompt'); setErrorMsg('') }
  }

  const handleSubmit = async () => {
    if (!wordInput) return
    if (wordInput[0] !== startLetter) {
      setErrorMsg(`Must start with ${startLetter}`)
      setPlayState('error')
      return
    }
    if (wordInput.length < 2) {
      setErrorMsg('Word must be at least 2 letters')
      setPlayState('error')
      return
    }
    setPlayState('submitting')
    try {
      const res = await fetch('/api/play/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, word: wordInput }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Something went wrong'); setPlayState('error'); return }
      setSubmittedWord(data.word)
      setShareToken(data.shareToken)
      setPastContacts(data.pastContacts ?? [])
      setPlayState('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setPlayState('error')
    }
  }

  // Opens the native texting app, optionally pre-addressed to a phone number.
  const openSMS = (phone?: string) => {
    const nextLetter = submittedWord.slice(-1).toUpperCase()
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://uwwordchain.org'
    const shareUrl = `${origin}/play/${shareToken}`
    const msg = encodeURIComponent(
      `You're next in the chain! I played ${submittedWord.toUpperCase()}, so your word starts with ${nextLetter}. Keep the chain going: ${shareUrl}`
    )
    // iOS and Android disagree on the sms: URI separator — iOS drops the
    // body entirely unless "&" is used; Android expects "?".
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    window.location.href = `sms:${phone ?? ''}${isIOS ? '&' : '?'}body=${msg}`
  }

  const handleNativeSMS = () => openSMS()

  const handleCopy = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://uwwordchain.org'
    const shareUrl = `${origin}/play/${shareToken}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* silent */ }
  }

  // ── Context header (reused across states) ─────────────────────────────────

  const FirstInChainHeader = () => (
    <>
      <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        You've been selected to start a chain.
      </p>
      <h1 className="headline" style={{ marginBottom: 'var(--space-1)' }}>
        You're first.<br />Kick it off.
      </h1>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-1)', lineHeight: 1.6 }}>
        Your first word starts with{' '}
        <strong style={{ color: 'var(--black)', fontSize: 'var(--text-body)' }}>{startLetter}</strong>
      </p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', marginBottom: 'var(--space-5)' }}>
        Last letter of today's word{' '}
        <strong className="word-upper" style={{ color: 'var(--black)' }}>{gameDay.word}</strong>
      </p>
    </>
  )

  const MidChainHeader = () => (
    <>
      <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        {lastPlayerName ? `${lastPlayerName} added a word.` : 'Someone added a word.'} Your turn.
      </p>
      <h1 className="headline word-upper" style={{ marginBottom: 'var(--space-1)' }}>{lastWord}</h1>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-1)', lineHeight: 1.6 }}>
        Last letter of <strong className="word-upper">{lastWord}</strong>
      </p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', marginBottom: 'var(--space-5)' }}>
        Your word starts with{' '}
        <strong style={{ color: 'var(--black)' }}>{startLetter}</strong>
      </p>
    </>
  )

  const LetterTileInline = () => (
    <div className="letter-tile-wrap" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="letter-tile">{startLetter}</div>
      <span className="letter-tile-label">
        {isFirstInChain
          ? <>Last letter of <strong className="word-upper">{gameDay.word}</strong></>
          : <>Last letter of <strong className="word-upper">{lastWord}</strong></>}
      </span>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // SUCCESS  (03-C)
  // ══════════════════════════════════════════════════════════════════════════

  if (playState === 'success') {
    const nextLetter = submittedWord.slice(-1).toUpperCase()
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://uwwordchain.org'
    const shareUrl = `${origin}/play/${shareToken}`
    // In re-share mode the visitor's word is already part of previousWords
    const fullChain = [
      ...previousWords.map((w, i) => ({
        word: w.word,
        name: i === 0 ? 'UW WordChain' : (w.user?.display_name ?? w.user?.first_name ?? 'Player'),
      })),
      ...(reshare ? [] : [{ word: submittedWord, name: 'You' }]),
    ]

    return (
      <div className="screen">
        <AdBanner active={ad?.bannerActive ?? false} imageUrl={ad?.bannerImageUrl ?? null} linkUrl={ad?.bannerLinkUrl ?? null} />
        <Topbar showMenu isLoggedIn isAdmin={isAdmin} />
        <ContextStrip word={gameDay.word} chainSlot={chain.slot} wordCount={reshare ? wordCount : wordCount + 1} />

        <div className="screen-body">
          <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>
            {reshare ? 'Your chain needs a push' : 'Word accepted ✓'}
          </p>
          <h1 className="headline word-upper" style={{ marginBottom: 'var(--space-1)' }}>{submittedWord}</h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
            Next word starts with{' '}
            <strong style={{ color: 'var(--black)', fontSize: 'var(--text-lg)' }}>{nextLetter}</strong>
          </p>

          {/* Share card */}
          <div style={{
            background: 'var(--white)',
            border: '2px solid var(--black)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
          }}>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Pass the chain</p>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
              Send this link to someone new. Their word starts with{' '}
              <strong style={{ color: 'var(--black)' }}>{nextLetter}</strong>.
            </p>
            <div className="share-url" style={{ marginBottom: 'var(--space-2)' }}>{shareUrl}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Button onClick={handleNativeSMS}>Send via text →</Button>
              <Button variant="ghost" onClick={handleCopy}>
                {copied ? '✓ Copied!' : 'Copy link'}
              </Button>
            </div>

            {/* Quick share — people you've passed the chain to before */}
            {pastContacts.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-3)' }}>
                <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Quick share — past players</p>
                <div style={{ maxHeight: '11rem', overflowY: 'auto' }}>
                  {pastContacts.map((c, idx) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: 'var(--space-2) 0',
                        borderBottom: idx < pastContacts.length - 1 ? '1px solid var(--border-light)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{c.name}</span>
                      <button
                        onClick={() => openSMS(c.phone)}
                        style={{
                          fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700,
                          padding: '4px 12px', background: 'var(--black)', color: 'var(--white)',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        Text →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a href="/home" style={{ textAlign: 'center', fontSize: 'var(--text-base)', color: 'var(--mid)', textDecoration: 'underline' }}>
            ← Back to home
          </a>
        </div>

        {/* Chain history accordion */}
        <div style={{ borderTop: '2px solid var(--black)' }}>
          <Accordion title={`Chain ${chain.slot} · ${fullChain.length} word${fullChain.length !== 1 ? 's' : ''}`}>
            <div>
              {fullChain.map((entry, idx) => (
                <div
                  key={idx}
                  className="chain-row"
                  style={{ borderBottom: idx < fullChain.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                >
                  <div className="chain-row__num">{idx + 1}</div>
                  <div>
                    <div className="chain-row__word">{entry.word}</div>
                    <div className="chain-row__name">{entry.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>
        </div>

        <div className="app-footer">uwwordchain.org</div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOT LOGGED IN  (01-A / 01-B new user)
  // ══════════════════════════════════════════════════════════════════════════

  if (!currentUser) {
    return (
      <div className="screen">
        <AdBanner active={ad?.bannerActive ?? false} imageUrl={ad?.bannerImageUrl ?? null} linkUrl={ad?.bannerLinkUrl ?? null} />
        <Topbar showLogin loginHref={loginUrl} />

        <ContextStrip word={gameDay.word} chainSlot={chain.slot} wordCount={wordCount} />

        <div className="screen-body">
          {isFirstInChain ? <FirstInChainHeader /> : <MidChainHeader />}
          <LetterTileInline />

          <a href={signupUrl} className="btn-primary" style={{ marginBottom: 'var(--space-2)' }}>
            Join now to play →
          </a>
          <p style={{ textAlign: 'center', fontSize: 'var(--text-base)', color: 'var(--mid)' }}>
            Already a member?{' '}
            <a href={loginUrl} style={{ color: 'var(--black)', fontWeight: 700 }}>Log in</a>
          </p>
        </div>

        <div className="app-footer">uwwordchain.org</div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGGED IN — word entry  (01-A / 01-B logged-in → 03-A / 03-B)
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="screen">
      <AdBanner active={ad?.bannerActive ?? false} imageUrl={ad?.bannerImageUrl ?? null} linkUrl={ad?.bannerLinkUrl ?? null} />
      <Topbar showMenu isLoggedIn isAdmin={isAdmin} />
      <ContextStrip word={gameDay.word} chainSlot={chain.slot} wordCount={wordCount} />

      <div className="screen-body">
        {isFirstInChain ? <FirstInChainHeader /> : <MidChainHeader />}
        <LetterTileInline />

        {/* Word input */}
        <input
          ref={inputRef}
          type="text"
          value={wordInput}
          onChange={handleInputChange}
          onKeyDown={e => { if (e.key === 'Enter' && !isSubmitting) handleSubmit() }}
          placeholder={`${startLetter}...`}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          disabled={isSubmitting}
          className={`word-input${isError ? ' word-input--error' : ''}`}
          style={{ marginBottom: isError ? 'var(--space-1)' : 'var(--space-2)' }}
        />

        {isError && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--error)', marginBottom: 'var(--space-2)' }}>
            {errorMsg}
          </p>
        )}

        {!isError && wordInput.length > 0 && wordInput[0] !== startLetter && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mid)', marginBottom: 'var(--space-2)' }}>
            Must start with <strong>{startLetter}</strong>
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !wordInput || wordInput.length < 2}
          style={{ marginTop: 'var(--space-2)' }}
        >
          {isSubmitting ? 'Checking word...' : 'Submit →'}
        </Button>
      </div>

      <div className="app-footer">uwwordchain.org</div>
    </div>
  )
}
