'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { PinInput } from '@/components/ui/PinInput'
import { Button } from '@/components/ui/Button'
import { Topbar } from '@/components/ui/Topbar'

type Step = 'loading' | 'invalid' | 'enter-new' | 'enter-confirm' | 'saving' | 'done'

function ResetPinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep]         = useState<Step>('loading')
  const [newPin, setNewPin]     = useState('')
  const [pinKey, setPinKey]     = useState(0)
  const [error, setError]       = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Supabase appends ?code=... (PKCE flow) after the user clicks the reset link.
    // Exchange it for a session so we can call updateUser.
    const code = searchParams.get('code')
    if (!code) { setStep('invalid'); return }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) { setStep('invalid'); return }
      setStep('enter-new')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewPin = (pin: string) => {
    if (pin.length < 4) return
    setNewPin(pin)
    setStep('enter-confirm')
    setPinKey(k => k + 1)
  }

  const handleConfirmPin = async (pin: string) => {
    if (pin.length < 4) return
    if (pin !== newPin) {
      setError("PINs don't match. Try again.")
      setStep('enter-new')
      setNewPin('')
      setPinKey(k => k + 1)
      return
    }

    setStep('saving')
    setError('')

    try {
      // Update Supabase Auth password (padded to meet 6-char minimum)
      const password = `${pin}--wc`
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) { setError(pwErr.message); setStep('enter-new'); setPinKey(k => k + 1); return }

      // Update pin_hash via our API (user is now authenticated via the recovery session)
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin: pin, skipCurrentPinCheck: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        console.warn('pin_hash update failed:', data.error) // non-fatal — auth password already updated
      }

      setStep('done')
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Network error. Please try again.')
      setStep('enter-new')
      setPinKey(k => k + 1)
    }
  }

  const SCREEN: React.CSSProperties = { maxWidth: 'min(430px, 100%)', margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }

  return (
    <div style={SCREEN}>
      <Topbar backHref="/login" />
      <div className="screen-body">
        {step === 'loading' && (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)' }}>Verifying link…</p>
        )}

        {step === 'invalid' && (
          <>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Link expired</p>
            <h1 className="headline" style={{ marginBottom: 'var(--space-3)' }}>This link is no longer valid.</h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              Reset links expire after 1 hour. Request a new one from the login page.
            </p>
            <Button onClick={() => router.push('/login')}>Back to login</Button>
          </>
        )}

        {(step === 'enter-new' || step === 'enter-confirm') && (
          <>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Reset PIN</p>
            <h1 className="headline" style={{ marginBottom: 'var(--space-6)' }}>
              {step === 'enter-new' ? 'Choose a new PIN.' : 'Confirm your new PIN.'}
            </h1>

            {/* Progress */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
              {[0, 1].map(i => (
                <div key={i} style={{ flex: 1, height: 3, background: i === 0 || step === 'enter-confirm' ? 'var(--black)' : 'var(--border-light)', transition: 'background 0.2s' }} />
              ))}
            </div>

            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
              {step === 'enter-new' ? 'Choose a new 4-digit PIN.' : 'Re-enter your new PIN to confirm.'}
            </p>

            <PinInput key={pinKey} onChange={step === 'enter-new' ? handleNewPin : handleConfirmPin} />

            {error && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>
            )}
          </>
        )}

        {step === 'saving' && (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)' }}>Saving your new PIN…</p>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: 'var(--text-hero)', marginBottom: 'var(--space-3)' }}>✓</div>
            <h1 className="headline" style={{ marginBottom: 'var(--space-3)' }}>PIN updated!</h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', lineHeight: 1.6 }}>
              Redirecting you to login…
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPinPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 'min(430px,100%)', margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <Topbar backHref="/login" />
      </div>
    }>
      <ResetPinForm />
    </Suspense>
  )
}
