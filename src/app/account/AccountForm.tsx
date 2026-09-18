'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { PinInput } from '@/components/ui/PinInput'
import { Button } from '@/components/ui/Button'

interface InitialData {
  email: string
  name: string
  displayName: string
  phone: string
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', marginBottom: 'var(--space-4)' }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--border-light)',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--mid)',
      }}>
        {title}
      </div>
      <div style={{ padding: 'var(--space-4)' }}>{children}</div>
    </div>
  )
}

// ── PIN reset flow ─────────────────────────────────────────────────────────
type PinStep =
  | 'idle'
  | 'enter-current'   // waiting for user to type current PIN
  | 'verifying'       // calling API to check current PIN
  | 'current-wrong'   // wrong PIN — show error, stay on this step
  | 'enter-new'       // current verified, enter new PIN
  | 'enter-confirm'   // confirm new PIN
  | 'saving'          // saving new PIN
  | 'done'            // success

function PinResetFlow() {
  const [step,       setStep]       = useState<PinStep>('idle')
  const [pinKey,     setPinKey]     = useState(0)   // increment to reset PinInput boxes
  const [verifiedPin, setVerifiedPin] = useState('')  // stored current PIN after verification
  const [newPin,     setNewPin]     = useState('')
  const [error,      setError]      = useState('')

  // Auto-called when a PinInput fills to 4 digits
  const handleCurrentPin = async (pin: string) => {
    if (pin.length < 4) return
    setStep('verifying')
    setError('')
    try {
      const res = await fetch('/api/account/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (data.valid) {
        setVerifiedPin(pin)
        setStep('enter-new')
        setPinKey(k => k + 1) // clear PIN boxes
      } else {
        setError('Incorrect PIN. Try again.')
        setStep('current-wrong')
        setPinKey(k => k + 1)
      }
    } catch {
      setError('Network error. Try again.')
      setStep('current-wrong')
      setPinKey(k => k + 1)
    }
  }

  const handleNewPin = (pin: string) => {
    if (pin.length < 4) return
    setNewPin(pin)
    setStep('enter-confirm')
    setPinKey(k => k + 1)
  }

  const handleConfirmPin = async (pin: string) => {
    if (pin.length < 4) return
    if (pin !== newPin) {
      setError("PINs don't match. Start over.")
      setStep('enter-new')
      setNewPin('')
      setPinKey(k => k + 1)
      return
    }
    // All good — save
    setStep('saving')
    setError('')
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: verifiedPin, newPin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStep('enter-new')
        setPinKey(k => k + 1)
        return
      }
      setStep('done')
      setTimeout(() => { setStep('idle'); setVerifiedPin(''); setNewPin(''); setPinKey(k => k + 1) }, 2500)
    } catch {
      setError('Network error.')
      setStep('enter-new')
      setPinKey(k => k + 1)
    }
  }

  const reset = () => { setStep('idle'); setError(''); setVerifiedPin(''); setNewPin(''); setPinKey(k => k + 1) }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('enter-current')}
        style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 'var(--text-md)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--black)',
          color: 'var(--white)',
          border: '2px solid var(--black)',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Reset PIN
      </button>
    )
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
        <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>✓</div>
        <p style={{ fontSize: 'var(--text-body)', fontWeight: 700 }}>PIN updated successfully.</p>
      </div>
    )
  }

  const stepLabel: Record<string, string> = {
    'enter-current': 'Enter your current PIN',
    'verifying':     'Checking PIN…',
    'current-wrong': 'Enter your current PIN',
    'enter-new':     'Create your new PIN',
    'enter-confirm': 'Confirm your new PIN',
    'saving':        'Saving…',
  }

  const stepHint: Partial<Record<PinStep, string>> = {
    'enter-current': 'This is the PIN you use to log in.',
    'enter-new':     'Choose a new 4-digit PIN.',
    'enter-confirm': 'Re-enter your new PIN to confirm.',
  }

  // Progress dots
  const steps: PinStep[] = ['enter-current', 'enter-new', 'enter-confirm']
  const currentIdx = steps.indexOf(step === 'current-wrong' ? 'enter-current' : step === 'verifying' ? 'enter-current' : step === 'saving' ? 'enter-confirm' : step)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            height: 3,
            flex: 1,
            background: i <= currentIdx ? 'var(--black)' : 'var(--border-light)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Step label */}
      <div>
        <p style={{ fontSize: 'var(--text-body)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
          {stepLabel[step] ?? ''}
        </p>
        {stepHint[step] && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
            {stepHint[step]}
          </p>
        )}
      </div>

      {/* PIN input */}
      {(step === 'enter-current' || step === 'current-wrong') && (
        <PinInput key={pinKey} onChange={handleCurrentPin} />
      )}
      {step === 'verifying' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 'var(--otp-box-w)', height: 'var(--otp-box-h)',
              border: '2px solid var(--border-light)',
              background: 'var(--bg)',
            }} />
          ))}
        </div>
      )}
      {step === 'enter-new' && (
        <PinInput key={pinKey} onChange={handleNewPin} />
      )}
      {(step === 'enter-confirm' || step === 'saving') && (
        <PinInput key={pinKey} onChange={step === 'enter-confirm' ? handleConfirmPin : () => {}} />
      )}

      {/* Error */}
      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', lineHeight: 1.5 }}>{error}</p>
      )}

      {/* Cancel */}
      {step !== 'saving' && (
        <button
          onClick={reset}
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 'var(--text-xs)',
            color: 'var(--mid)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
            textAlign: 'left',
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────
export function AccountForm({ initialData }: { initialData: InitialData }) {
  const [form, setForm]         = useState({ name: initialData.name, displayName: initialData.displayName, phone: initialData.phone })
  const [saving, setSaving]     = useState(false)
  const [saved,  setSaved]      = useState(false)
  const [profileErr, setProfileErr] = useState('')
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteErr,  setDeleteErr]  = useState('')

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setProfileErr('Name is required'); return }
    setSaving(true); setProfileErr(''); setSaved(false)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, displayName: form.displayName, phone: form.phone }),
      })
      const data = await res.json()
      if (!res.ok) { setProfileErr(data.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setProfileErr('Network error.') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleteStep('deleting'); setDeleteErr('')
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setDeleteErr(data.error); setDeleteStep('confirm'); return }
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/home'
    } catch { setDeleteErr('Network error.'); setDeleteStep('confirm') }
  }

  return (
    <>
      {/* ── Profile ── */}
      <Section title="Profile">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="field-label">Email</label>
          <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg)', border: '2px solid var(--border-light)', fontSize: 'var(--text-body)', color: 'var(--mid)' }}>
            {initialData.email}
          </div>
          <span className="field-hint">Email cannot be changed.</span>
        </div>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Input label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoComplete="name" />
          <Input label="Display Name (optional)" hint="Shown to other players. Defaults to your name." value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} placeholder={form.name} />
          <Input label="Phone Number" type="tel" hint="Used for chain invites via text." value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} autoComplete="tel" placeholder="(608) 555-1234" />
          {profileErr && <div className="error-box">{profileErr}</div>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
          </Button>
        </form>
      </Section>

      {/* ── PIN reset ── */}
      <Section title="PIN">
        <PinResetFlow />
      </Section>

      {/* ── Danger zone ── */}
      <Section title="Danger Zone">
        {deleteStep === 'idle' && (
          <>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
              Permanently delete your account and all your data. This cannot be undone.
            </p>
            <button
              onClick={() => setDeleteStep('confirm')}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-md)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: 'var(--space-3) var(--space-4)', background: 'none', border: '2px solid var(--error)', color: 'var(--error)', cursor: 'pointer', width: '100%' }}
            >
              Delete my account
            </button>
          </>
        )}
        {deleteStep === 'confirm' && (
          <>
            <p style={{ fontSize: 'var(--text-body)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Are you sure?</p>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Your account, game history, and all associated data will be permanently removed.
            </p>
            {deleteErr && <div className="error-box" style={{ marginBottom: 'var(--space-3)' }}>{deleteErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <button
                onClick={handleDelete}
                style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-md)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: 'var(--space-3) var(--space-4)', background: 'var(--error)', border: '2px solid var(--error)', color: 'var(--white)', cursor: 'pointer', width: '100%' }}
              >
                Yes, delete my account
              </button>
              <Button variant="ghost" onClick={() => { setDeleteStep('idle'); setDeleteErr('') }}>Cancel</Button>
            </div>
          </>
        )}
        {deleteStep === 'deleting' && (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--mid)', textAlign: 'center' }}>Deleting account…</p>
        )}
      </Section>
    </>
  )
}
