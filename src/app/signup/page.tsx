'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { PinInput } from '@/components/ui/PinInput'
import { Button } from '@/components/ui/Button'
import { Topbar } from '@/components/ui/Topbar'



function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/home'

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    displayName: '',
    pin: '',
    smsConsent: false,
    termsConsent: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const validate = () => {
    const errs: Record<string, string> = {}
    const emailLower = formData.email.toLowerCase()
    const validDomain = emailLower.endsWith('@wisc.edu') || emailLower.endsWith('@wiscoproject.org')
    if (!validDomain) {
      errs.email = 'Must be a @wisc.edu email'
    }
    if (!formData.name.trim()) {
      errs.name = 'Required'
    }
    if (formData.pin.length !== 4) {
      errs.pin = 'PIN must be 4 digits'
    }
    if (!formData.termsConsent) {
      errs.termsConsent = 'You must agree to the terms'
    }
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setLoading(true)
    setServerError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error || 'Something went wrong')
        return
      }
      if (data.autoLoggedIn) {
        // Signed in automatically — go straight to the destination
        // (e.g. back to the invite link they came from).
        window.location.href = nextUrl
      } else {
        // Fallback: authenticate manually with the new PIN
        const loginDest = nextUrl !== '/home' ? `/login?next=${encodeURIComponent(nextUrl)}` : '/login'
        router.push(loginDest)
      }
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <Topbar backHref="/home" />
      <div style={{ padding: '24px 20px', flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Create account</div>
        <h1 className="headline" style={{ marginBottom: 4 }}>Join WordChain.</h1>
        <p style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 24 }}>wisc.edu accounts only.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="wisc.edu Email"
            type="email"
            placeholder="you@wisc.edu"
            value={formData.email}
            onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
            error={errors.email}
            autoComplete="email"
          />

          <Input
            label="Name"
            type="text"
            value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
            error={errors.name}
            autoComplete="name"
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="(608) 555-1234"
            hint="For receiving chain invites via text."
            value={formData.phone}
            onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            autoComplete="tel"
          />

          <Input
            label="Display Name (optional)"
            type="text"
            hint="Shown to other players. Defaults to your name."
            value={formData.displayName}
            onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))}
          />

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>4-Digit PIN</div>
            <PinInput onChange={pin => setFormData(p => ({ ...p, pin }))} />
            <div className="hint" style={{ marginTop: 4 }}>You'll use this to log in. Don't forget it!</div>
            {errors.pin && (
              <div style={{ fontSize: 10, color: '#cc0000', marginTop: 2 }}>{errors.pin}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.smsConsent}
                onChange={e => setFormData(p => ({ ...p, smsConsent: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--black)' }}
              />
              <span style={{ fontSize: 10, color: 'var(--mid)', lineHeight: 1.5 }}>
                I consent to receive SMS game invites. Msg &amp; data rates may apply. Reply STOP to opt out.
              </span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.termsConsent}
                onChange={e => setFormData(p => ({ ...p, termsConsent: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--black)' }}
              />
              <span style={{ fontSize: 10, color: 'var(--mid)', lineHeight: 1.5 }}>
                I agree to the{' '}
                <a href="/terms" style={{ color: 'var(--black)' }}>Terms of Service</a> and{' '}
                <a href="/privacy" style={{ color: 'var(--black)' }}>Privacy Policy</a>.
              </span>
            </label>
            {errors.termsConsent && (
              <div style={{ fontSize: 10, color: '#cc0000' }}>{errors.termsConsent}</div>
            )}
          </div>

          {serverError && (
            <div
              style={{
                padding: '10px 12px',
                background: '#fff0f0',
                border: '1px solid #cc0000',
                fontSize: 11,
                color: '#cc0000',
              }}
            >
              {serverError}
            </div>
          )}

          <Button type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Creating account...' : 'Create account →'}
          </Button>

          <p className="hint" style={{ textAlign: 'center' }}>
            You'll stay signed in for 30 days · log out anytime from ≡
          </p>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--mid)' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--black)', fontWeight: 700 }}>Log in</a>
          </p>
        </form>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="screen">
          <Topbar backHref="/home" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
