'use client'
import { useState } from 'react'
import { Accordion } from '@/components/ui/Accordion'

const SLOTS = ['A', 'B', 'C'] as const
type Slot = typeof SLOTS[number]

interface StarterRow { id: string; play_date: string; chain_slot: string; user_id: string | null; user?: { first_name: string; display_name: string | null } | null }
interface User { id: string; first_name: string; display_name: string | null; email: string; phone: string | null }
interface ChainWord { word: string; position: number; user?: { first_name: string; display_name: string | null } | null }
interface ActiveChain { id: string; slot: string; last_activity_at: string | null; chain_words: ChainWord[] }

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function minutesAgo(ts: string | null) {
  if (!ts) return null
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function inactiveColor(ts: string | null) {
  if (!ts) return 'var(--light)'
  const h = (Date.now() - new Date(ts).getTime()) / 3600000
  if (h < 4) return 'green'
  if (h < 12) return '#e6a817'
  return '#b44'
}

function isInactive(ts: string | null) {
  if (!ts) return false
  return (Date.now() - new Date(ts).getTime()) > 4 * 3600000
}

function Toggle({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note?: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', padding: 0, textAlign: 'left' }}
    >
      <span style={{ width: 36, height: 20, background: on ? 'var(--black)' : '#ccc', borderRadius: 10, position: 'relative', display: 'inline-block', flexShrink: 0, transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 14, height: 14, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
      </span>
      <span>
        <span style={{ fontSize: 'var(--text-body)', fontWeight: 700 }}>{label}</span>
        {note && <span style={{ fontWeight: 400, color: 'var(--mid)', fontSize: 'var(--text-xs)' }}> {note}</span>}
      </span>
    </button>
  )
}

/** Searchable user picker — type to filter by name, email, or phone */
function UserPicker({ users, onPick }: { users: User[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const query = q.trim().toLowerCase()
  const matches = users
    .filter(u => u.phone)
    .filter(u => !query ||
      `${u.display_name ?? ''} ${u.first_name} ${u.email} ${u.phone}`.toLowerCase().includes(query))

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'Space Mono, monospace',
    fontSize: 'var(--text-xs)', padding: '4px 6px',
    border: '1px solid var(--border-light)', background: 'var(--white)',
    outline: 'none', borderRadius: 0,
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={q}
        placeholder="Type name or phone…"
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={inputStyle}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: 'var(--white)', border: '1px solid var(--border-light)', borderTop: 'none',
          maxHeight: '10rem', overflowY: 'auto', boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: '6px 8px', fontSize: 'var(--text-2xs)', color: 'var(--light)' }}>
              No players match &ldquo;{q}&rdquo;
            </div>
          ) : matches.slice(0, 30).map(u => (
            <button
              key={u.id}
              onMouseDown={e => e.preventDefault()} // keep focus so onClick fires before blur
              onClick={() => { onPick(u.id); setQ(''); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)',
                padding: '6px 8px', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
              }}
            >
              {u.display_name ?? u.first_name} — {u.phone}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChainsClient({
  initialStarters, users, activeChains, longestCount, gameDay, today,
  initialAutoLaunch, initialLaunchDays, yesterdayWinner, initialCongratsSent,
}: {
  initialStarters: StarterRow[]
  users: User[]
  activeChains: ActiveChain[]
  longestCount: number
  gameDay: { id: string; word: string } | null
  today: string
  initialAutoLaunch: boolean
  initialLaunchDays: number[]
  yesterdayWinner: { slot: string; words: number; players: number } | null
  initialCongratsSent: boolean
}) {
  const [starters, setStarters] = useState(initialStarters)
  const [autoLaunch, setAutoLaunch] = useState(initialAutoLaunch)
  const [autoLaunchSaving, setAutoLaunchSaving] = useState(false)
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editSlots, setEditSlots] = useState<Record<Slot, string>>({ A: '', B: '', C: '' })
  const [addDate, setAddDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [bumping, setBumping] = useState<string | null>(null)
  const [bumpMsg, setBumpMsg] = useState('')
  const [launching, setLaunching] = useState(false)
  const [congratsSent, setCongratsSent] = useState(initialCongratsSent)
  const [congratsSending, setCongratsSending] = useState(false)
  const [congratsMsg, setCongratsMsg] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Auto-launch days of week (0 = Sunday … 6 = Saturday) — loaded server-side
  const [launchDays, setLaunchDays] = useState<number[]>(initialLaunchDays)

  const toggleAutoLaunch = async (val: boolean) => {
    setAutoLaunch(val)
    setAutoLaunchSaving(true)
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_launch_enabled: String(val) }),
    }).catch(() => {})
    setAutoLaunchSaving(false)
  }

  const toggleLaunchDay = async (day: number) => {
    const next = launchDays.includes(day)
      ? launchDays.filter(d => d !== day)
      : [...launchDays, day].sort()
    setLaunchDays(next)
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_launch_days: next.join(',') }),
    }).catch(() => {})
  }

  // Group starters by date
  const byDate: Record<string, Record<string, StarterRow | undefined>> = {}
  for (const s of starters) {
    if (!byDate[s.play_date]) byDate[s.play_date] = {}
    byDate[s.play_date][s.chain_slot] = s
  }
  const dates = Object.keys(byDate).sort()

  const startEditing = (date: string) => {
    setEditDate(date)
    const slots: Record<Slot, string> = { A: '', B: '', C: '' }
    for (const slot of SLOTS) slots[slot] = byDate[date]?.[slot]?.user_id ?? ''
    setEditSlots(slots)
  }

  const saveEdits = async () => {
    setSaving(true); setError('')
    try {
      for (const slot of SLOTS) {
        await fetch('/api/admin/chains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ play_date: editDate, chain_slot: slot, user_id: editSlots[slot] || null }),
        })
      }
      const res = await fetch('/api/admin/chains')
      const data = await res.json()
      setStarters(data.starters ?? [])
      setEditDate(null)
    } catch { setError('Save failed') }
    finally { setSaving(false) }
  }

  const addDateRow = async () => {
    if (!addDate) return
    setSaving(true)
    for (const slot of SLOTS) {
      await fetch('/api/admin/chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ play_date: addDate, chain_slot: slot, user_id: null }),
      })
    }
    const res = await fetch('/api/admin/chains')
    const data = await res.json()
    setStarters(data.starters ?? [])
    setAddDate('')
    setSaving(false)
  }

  const deleteDateRow = async (date: string) => {
    setSaving(true); setError('')
    try {
      // A date has up to one row per slot — delete them all
      const ids = SLOTS.map(slot => byDate[date]?.[slot]?.id).filter(Boolean) as string[]
      for (const id of ids) {
        await fetch('/api/admin/chains', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      }
      setStarters(prev => prev.filter(s => s.play_date !== date))
    } catch { setError('Delete failed') }
    finally { setSaving(false); setConfirmDeleteDate(null) }
  }

  const launchNow = async () => {
    setLaunching(true); setBumpMsg('')
    try {
      const res = await fetch('/api/admin/chains/launch', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setBumpMsg(data.error ?? 'Launch failed'); return }
      const sent = (data.results ?? []).filter((r: any) => r.status === 'sent').length
      setBumpMsg(`✓ Launched — ${sent} starter text${sent !== 1 ? 's' : ''} sent`)
      // Reload so the new game day + chains appear
      window.location.reload()
    } catch { setBumpMsg('Launch failed') }
    finally { setLaunching(false) }
  }

  const sendCongrats = async () => {
    setCongratsSending(true); setCongratsMsg('')
    try {
      const res = await fetch('/api/admin/chains/congrats', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setCongratsMsg(data.error ?? 'Failed to send'); return }
      setCongratsSent(true)
      setCongratsMsg(`✓ Sent to ${data.sent} of ${data.total} winning player${data.total !== 1 ? 's' : ''} (Chain ${data.slot})`)
    } catch { setCongratsMsg('Failed to send') }
    finally { setCongratsSending(false) }
  }

  const bump = async (chainId: string) => {
    setBumping(chainId); setBumpMsg('')
    const res = await fetch('/api/admin/chains/bump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId }),
    })
    const data = await res.json()
    setBumping(null)
    setBumpMsg(res.ok ? `✓ Nudge sent to ${data.sentTo}` : data.error)
  }

  const userLabel = (uid: string | null | undefined) => {
    if (!uid) return <span style={{ color: 'var(--light)', fontStyle: 'italic' }}>Random</span>
    const u = users.find(u => u.id === uid)
    return <span>{u ? (u.display_name ?? u.first_name) : uid}</span>
  }

  const S = {
    section: { padding: 'var(--space-4)', borderBottom: '1px solid var(--border-light)' } as React.CSSProperties,
    label: { fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mid)', marginBottom: 'var(--space-1)' } as React.CSSProperties,
    select: { width: '100%', fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', padding: '4px 6px', border: '1px solid var(--border-light)', background: 'var(--white)', outline: 'none', borderRadius: 0 } as React.CSSProperties,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '2px solid var(--black)', background: 'var(--white)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>Admin</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>Chains</h1>
      </div>

      {error && <div className="error-box" style={{ margin: 'var(--space-4)' }}>{error}</div>}

      {/* Chain Starters Queue */}
      <div style={S.section}>
        <p style={S.label}>Chain Starters</p>

        {/* Auto-launch toggle */}
        <div style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0' }}>
            <Toggle
              on={autoLaunch}
              onChange={toggleAutoLaunch}
              label="Auto-launch"
              note="8:00 AM CT"
            />
            {autoLaunchSaving && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)' }}>saving…</span>}
          </div>

          {/* Days of week */}
          {autoLaunch && (
            <div style={{ paddingBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                  const on = launchDays.includes(day)
                  return (
                    <button
                      key={day}
                      onClick={() => toggleLaunchDay(day)}
                      aria-pressed={on}
                      title={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}
                      style={{
                        width: '2rem', height: '2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Space Mono, monospace',
                        fontSize: 'var(--text-xs)', fontWeight: 700,
                        background: on ? 'var(--black)' : 'var(--white)',
                        color: on ? 'var(--white)' : 'var(--light)',
                        border: on ? '1.5px solid var(--black)' : '1px solid var(--border-light)',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
                Launches only on highlighted days.
                {launchDays.length === 0 && ' No days selected — nothing will launch.'}
              </p>
            </div>
          )}
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', marginBottom: 'var(--space-3)' }}>
          Leave any chain blank to use random selection for that day.
        </p>

        {dates.length === 0 && (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--light)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            No dates scheduled. Add one below.
          </p>
        )}

        {/* After 5 days the list scrolls so the sections below stay visible */}
        <div style={dates.length > 5 ? { maxHeight: '22rem', overflowY: 'auto', borderBottom: '1px solid var(--border-light)' } : undefined}>
        {dates.map(date => {
          const isToday = date === today
          const isEditing = editDate === date

          return (
            <div key={date} style={{
              borderBottom: '1px solid var(--border-light)',
              background: isToday ? '#fffff0' : 'var(--white)',
            }}>
              {/* Date row */}
              {isEditing ? (
                /* ── Expanded edit state ── */
                <div style={{ border: '1.5px solid var(--black)', padding: 'var(--space-3)', margin: 'var(--space-2) 0' }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                    {formatDate(date)} — editing
                  </div>
                  {SLOTS.map(slot => (
                    <div key={slot} style={{ marginBottom: 'var(--space-2)' }}>
                      <label style={{ ...S.label, fontSize: 'var(--text-2xs)', display: 'block', marginBottom: 3 }}>Chain {slot}</label>
                      {editSlots[slot] ? (
                        /* Assigned — show name with clear button */
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1.5px solid var(--black)', padding: '5px 10px', fontSize: 'var(--text-xs)' }}>
                          <span style={{ fontWeight: 700 }}>{users.find(u => u.id === editSlots[slot])?.display_name ?? users.find(u => u.id === editSlots[slot])?.first_name ?? '—'}</span>
                          <button onClick={() => setEditSlots(p => ({ ...p, [slot]: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', fontFamily: 'inherit', fontSize: 14 }}>×</button>
                        </div>
                      ) : (
                        /* Empty — searchable picker */
                        <div>
                          <UserPicker users={users} onPick={id => setEditSlots(p => ({ ...p, [slot]: id }))} />
                          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--mid)', marginTop: 2 }}>Leave blank → random</div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    <button onClick={saveEdits} disabled={saving} style={{ flex: 1, fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700, padding: 'var(--space-2)', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer' }}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditDate(null)} style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', padding: 'var(--space-2)', background: 'none', border: '1px solid var(--border-light)', cursor: 'pointer', color: 'var(--mid)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Collapsed row ── */
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) 0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-body)', fontWeight: isToday ? 700 : 400, marginBottom: 3 }}>
                      {formatDate(date)}
                      {isToday && <span style={{ marginLeft: 6, fontSize: 'var(--text-2xs)', background: 'var(--black)', color: 'var(--white)', fontWeight: 700, padding: '1px 5px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TODAY</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)' }}>
                      {SLOTS.map((slot, i) => (
                        <span key={slot}>{i > 0 ? ' · ' : ''}{slot}: {byDate[date]?.[slot]?.user_id
                          ? (users.find(u => u.id === byDate[date][slot]!.user_id)?.display_name ?? users.find(u => u.id === byDate[date][slot]!.user_id)?.first_name ?? '?')
                          : 'Random'
                        }</span>
                      ))}
                    </div>
                  </div>
                  {confirmDeleteDate === date ? (
                    <span style={{ display: 'inline-flex', gap: 4 }}>
                      <button onClick={() => deleteDateRow(date)} disabled={saving}
                        style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '2px 6px', background: '#b44', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        {saving ? '…' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmDeleteDate(null)}
                        style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '2px 6px', background: 'none', border: '1px solid var(--border-light)', cursor: 'pointer', color: 'var(--mid)' }}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button onClick={() => startEditing(date)} style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', background: 'none', border: '1px solid var(--border-light)', cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' }}>
                        Edit
                      </button>
                      <button onClick={() => setConfirmDeleteDate(date)} title="Remove this day"
                        style={{ fontSize: 'var(--text-xs)', fontFamily: 'inherit', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#b44', textDecoration: 'underline' }}>
                        ✕
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
        </div>

        {/* Add date */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', alignItems: 'center' }}>
          <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} min={today}
            style={{ flex: 1, fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', padding: 'var(--space-2)', border: '1px solid var(--border-light)', background: 'var(--white)', outline: 'none', borderRadius: 0 }} />
          <button onClick={addDateRow} disabled={!addDate || saving}
            style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700, padding: 'var(--space-2) var(--space-3)', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: addDate ? 'pointer' : 'not-allowed', opacity: addDate ? 1 : 0.4 }}>
            + Add day
          </button>
        </div>
      </div>

      {/* Active chains accordion */}
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <p style={S.label}>Active Today</p>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)' }}>
            All-time longest: <strong style={{ color: 'var(--black)' }}>{longestCount} words</strong>
          </span>
        </div>

        {bumpMsg && <p style={{ fontSize: 'var(--text-xs)', color: bumpMsg.startsWith('✓') ? 'green' : '#b44', marginBottom: 'var(--space-3)' }}>{bumpMsg}</p>}

        {activeChains.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0', border: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--light)', marginBottom: 'var(--space-3)' }}>
              {gameDay ? 'No chains launched yet today.' : 'No game launched today.'}
            </p>
            <button onClick={launchNow} disabled={launching}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700, padding: 'var(--space-2) var(--space-4)', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', opacity: launching ? 0.5 : 1 }}>
              {launching ? 'Launching…' : 'Launch today\'s chains now →'}
            </button>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
              Sends the starter texts using today's word and the queue above.
            </p>
          </div>
        ) : (
          <Accordion title={`Active today — ${activeChains.length} chain${activeChains.length !== 1 ? 's' : ''}`}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activeChains.length === 0 ? (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', padding: 'var(--space-3) 0' }}>No chains running yet.</p>
              ) : activeChains.map((chain, i) => {
                const words = [...(chain.chain_words ?? [])].sort((a, b) => a.position - b.position)
                const ago = minutesAgo(chain.last_activity_at)
                const color = inactiveColor(chain.last_activity_at)
                const stale = isInactive(chain.last_activity_at)
                const isViewing = viewingId === chain.id
                return (
                  <div key={chain.id} style={{ borderBottom: i < activeChains.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) 0' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 'var(--text-body)', fontWeight: 700 }}>Chain {chain.slot}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color, marginLeft: 8 }}>
                          {words.length} word{words.length !== 1 ? 's' : ''} · {ago ?? 'no activity'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button onClick={() => bump(chain.id)} disabled={bumping === chain.id || words.length === 0}
                          title={words.length === 0 ? 'No words yet — nobody to bump' : 'Text the last player a reminder to re-share their link'}
                          style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-2xs)', fontWeight: 700, padding: '3px 8px', background: stale ? 'var(--black)' : 'none', color: stale ? 'var(--white)' : 'var(--mid)', border: stale ? 'none' : '1px solid var(--border-light)', cursor: words.length === 0 ? 'not-allowed' : 'pointer', opacity: bumping === chain.id || words.length === 0 ? 0.5 : 1 }}>
                          {bumping === chain.id ? '…' : 'Bump'}
                        </button>
                        <button
                          onClick={() => setViewingId(isViewing ? null : chain.id)}
                          style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-2xs)', padding: '3px 8px', background: isViewing ? 'var(--black)' : 'none', border: isViewing ? '1px solid var(--black)' : '1px solid var(--border-light)', cursor: 'pointer', color: isViewing ? 'var(--white)' : 'var(--mid)' }}>
                          {isViewing ? 'Hide' : 'View'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: all words + players (scrolls after 5) */}
                    {isViewing && (
                      <div style={{
                        margin: '0 0 var(--space-3)', border: '1px solid var(--border-light)',
                        background: '#fafafa', padding: 'var(--space-2) var(--space-3)',
                        ...(words.length > 5 ? { maxHeight: '11rem', overflowY: 'auto' } : {}),
                      }}>
                        {words.length === 0 ? (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', padding: 'var(--space-2) 0' }}>
                            No words yet — waiting on the starter.
                          </p>
                        ) : words.map((w, idx) => (
                          <div key={`${chain.id}-${w.position}`} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', padding: '6px 0', borderBottom: idx < words.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', width: '1.4em', flexShrink: 0 }}>{w.position}</span>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.08em' }}>{w.word.toUpperCase()}</span>
                            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mid)', marginLeft: 'auto' }}>
                              {w.user ? (w.user.display_name ?? w.user.first_name) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Accordion>
        )}

        {/* Yesterday's winner — manual congrats text (wireframe A2) */}
        <div style={{ marginTop: 'var(--space-4)', border: '1px solid var(--border-light)', padding: 'var(--space-3)' }}>
          <p style={S.label}>Yesterday&apos;s Winner</p>
          {yesterdayWinner ? (
            <>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', margin: 'var(--space-2) 0 var(--space-3)' }}>
                Chain {yesterdayWinner.slot} — {yesterdayWinner.words} word{yesterdayWinner.words !== 1 ? 's' : ''} · {yesterdayWinner.players} player{yesterdayWinner.players !== 1 ? 's' : ''}
              </p>
              <button
                onClick={sendCongrats}
                disabled={congratsSending || congratsSent}
                style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700,
                  padding: 'var(--space-2) var(--space-3)', width: '100%',
                  background: congratsSent ? 'var(--white)' : 'var(--black)',
                  color: congratsSent ? 'var(--mid)' : 'var(--white)',
                  border: congratsSent ? '1px solid var(--border-light)' : 'none',
                  cursor: congratsSent ? 'default' : 'pointer',
                  opacity: congratsSending ? 0.5 : 1,
                }}
              >
                {congratsSending ? 'Sending…' : congratsSent ? 'Congrats sent ✓' : 'Send congrats text to winning team →'}
              </button>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
                Texts everyone on the winning chain who has a phone number on file.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
              No completed game yesterday.
            </p>
          )}
          {congratsMsg && (
            <p style={{ fontSize: 'var(--text-xs)', color: congratsMsg.startsWith('✓') ? 'green' : '#b44', marginTop: 'var(--space-2)' }}>
              {congratsMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
