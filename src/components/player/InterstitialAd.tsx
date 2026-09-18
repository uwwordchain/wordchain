'use client'
import { useEffect, useState } from 'react'

// Timing (set in code by developer)
const SHOW_AFTER_MS = 3000   // slides up 3 seconds after page load
const VISIBLE_MS = 5000      // stays fully visible for 5 seconds after the slide-up finishes
const SLIDE_MS = 350         // slide animation duration

type Phase = 'hidden' | 'shown' | 'closing'

interface InterstitialAdProps {
  imageUrl: string | null
  linkUrl?: string | null
  active: boolean
}

export function InterstitialAd({ imageUrl, linkUrl, active }: InterstitialAdProps) {
  const [phase, setPhase] = useState<Phase>('hidden')

  // Show after delay (once per session)
  useEffect(() => {
    if (!active || !imageUrl) return
    if (sessionStorage.getItem('wc_interstitial_shown')) return

    const showTimer = setTimeout(() => {
      // Flag is set when the ad actually appears (not before), so React
      // StrictMode's double mount/unmount in dev doesn't suppress it.
      sessionStorage.setItem('wc_interstitial_shown', '1')
      setPhase('shown')
    }, SHOW_AFTER_MS)

    return () => clearTimeout(showTimer)
  }, [active, imageUrl])

  // Auto-close: full visible duration starts after the slide-up completes
  useEffect(() => {
    if (phase !== 'shown') return
    const t = setTimeout(() => setPhase('closing'), SLIDE_MS + VISIBLE_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Unmount after the slide-down animation finishes
  useEffect(() => {
    if (phase !== 'closing') return
    const t = setTimeout(() => setPhase('hidden'), SLIDE_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (!active || !imageUrl || phase === 'hidden') return null

  const closing = phase === 'closing'

  return (
    <>
      {/* Backdrop — fades with the slide */}
      <div
        onClick={() => setPhase('closing')}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
          cursor: 'pointer',
          opacity: closing ? 0 : 1,
          transition: `opacity ${SLIDE_MS}ms ease-out`,
        }}
      />

      {/* Slide-up / slide-down panel */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        width: '100%',
        maxWidth: 'min(860px, 100%)',
        background: 'var(--white)',
        borderTop: '2px solid var(--black)',
        zIndex: 201,
        transform: closing
          ? 'translateX(-50%) translateY(100%)'
          : 'translateX(-50%) translateY(0)',
        transition: `transform ${SLIDE_MS}ms ease-in`,
        animation: closing ? undefined : `wcSlideUp ${SLIDE_MS}ms ease-out`,
      }}>
        <style>{`
          @keyframes wcSlideUp {
            from { transform: translateX(-50%) translateY(100%); }
            to   { transform: translateX(-50%) translateY(0); }
          }
        `}</style>

        {/* Close button — always visible */}
        <button
          onClick={() => setPhase('closing')}
          aria-label="Close ad"
          style={{
            position: 'absolute',
            top: 6, right: 8,
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid var(--border-light)',
            cursor: 'pointer',
            fontSize: 16, lineHeight: 1, color: 'var(--black)',
            fontFamily: 'inherit', padding: '3px 7px',
            zIndex: 1,
          }}
        >
          ×
        </button>

        {/* Ad image */}
        {linkUrl ? (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Advertisement" style={{ width: '100%', display: 'block', maxHeight: '60vh', objectFit: 'cover' }} />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Advertisement" style={{ width: '100%', display: 'block', maxHeight: '60vh', objectFit: 'cover' }} />
        )}

        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', textAlign: 'center', padding: '3px 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Advertisement
        </div>
      </div>
    </>
  )
}
