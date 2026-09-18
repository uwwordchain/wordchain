'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Input } from '@/components/ui/Input'
import { PinInput } from '@/components/ui/PinInput'
import { Button } from '@/components/ui/Button'
import { Topbar } from '@/components/ui/Topbar'

// Browser Supabase client — needed so PKCE code_verifier is stored in localStorage
function useSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Forgot PIN inline panel ────────────────────────────────────────────────
function ForgotPin({ onCancel }: { onCancel: () => void }) {
  const supabase = useSupabase()
  const [email, setEmail]       = useState('')
  const [sent, setSent]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [resent, setResent]     = useState(false)
  const [error, setError]       = useState('')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const sendRequest = async (emailAddr: string) => {
    setLoading(true); setError('')
    try {
      // Must call from the browser so Supabase stores the PKCE code_verifier in localStorage
      await supabase.auth.resetPasswordForEmail(emailAddr, {
        redirectTo: `${appUrl}/reset-pin`,
      })
      return true // always true — never reveal whether email exists or rate limit hit
    } catch {
      setError('Network error. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await sendRequest(email)
    if (ok) setSent(true)
  }

  const handleResend = async () => {
    const ok = await sendRequest(email)
    if (ok) {
      setResent(true)
      setTimeout(() => setResent(false), 3000)
    }
  }

  if (sent) {
    return (
      <div style={{
        border: '2px solid var(--black)',
        padding: 'var(--space-4)',
        background: 'var(--white)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}>
        <p className="eyebrow">Check your email</p>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', lineHeight: 1.6 }}>
          If that address is registered, a reset link is on its way. Check your inbox and click the link to set a new PIN.
        </p>
        <button
          onClick={handleResend}
          disabled={loading}
          style={{ fontSize: 'var(--text-xs)', color: resent ? 'green' : 'var(--mid)', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', textDecoration: 'underline', textAlign: 'left', fontFamily: 'inherit', padding: 0, opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Resending…' : resent ? '✓ Email resent!' : 'Resend email'}
        </button>
      </div>
    )
  }

  return (
    <div style={{
      border: '2px solid var(--black)',
      padding: 'var(--space-4)',
      background: 'var(--white)',
    }}>
      <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Reset PIN</p>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
        Enter your email and we'll send a reset link.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Input
          type="email"
          placeholder="you@wisc.edu"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        {error && <div className="error-box">{error}</div>}
        <Button type="submit" disabled={loading || !email}>
          {loading ? 'Sending…' : 'Send reset link →'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
        >
          Cancel
        </button>
      </form>
    </div>
  )
}

// ── Login form ─────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/home'

  const [email, setEmail]   = useState('')
  const [pin, setPin]       = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  const validate = () => {
    const errs: Record<string, string> = {}
    const emailLower = email.toLowerCase()
    const validDomain = emailLower.endsWith('@wisc.edu') || emailLower.endsWith('@wiscoproject.org')
    if (!validDomain) errs.email = 'Must be a @wisc.edu email'
    if (pin.length !== 4) errs.pin = 'PIN must be 4 digits'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true); setServerError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error || 'Invalid email or PIN'); return }
      router.push(nextUrl)
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <Topbar backHref="/home" />
      <div style={{ padding: 'var(--space-6) var(--space-5)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Welcome back</p>
        <h1 className="headline" style={{ marginBottom: 'var(--space-6)' }}>Welcome back.</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="wisc.edu Email"
            type="email"
            placeholder="you@wisc.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />

          <div>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>PIN</p>
            <PinInput onChange={setPin} />
            {errors.pin && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', marginTop: 'var(--space-1)' }}>
                {errors.pin}
              </p>
            )}
          </div>

          {serverError && <div className="error-box">{serverError}</div>}

          <Button type="submit" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
            {loading ? 'Logging in…' : 'Log in →'}
          </Button>
        </form>

        {/* Forgot PIN — toggles inline panel */}
        <div style={{ marginTop: 'var(--space-4)' }}>
          {showForgot ? (
            <ForgotPin onCancel={() => setShowForgot(false)} />
          ) : (
            <button
              onClick={() => setShowForgot(true)}
              style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0, display: 'block', width: '100%', textAlign: 'center' }}
            >
              Forgot PIN? Reset via email
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-base)', color: 'var(--mid)', marginTop: 'var(--space-4)' }}>
          Don't have an account?{' '}
          <a href="/signup" style={{ color: 'var(--black)', fontWeight: 700 }}>Sign up</a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="screen"><Topbar backHref="/home" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
