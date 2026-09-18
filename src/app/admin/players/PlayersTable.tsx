'use client'
import { useState, useRef, useEffect } from 'react'

export interface PlayerRow {
  id: string
  name: string
  email: string
  phone: string | null
  is_admin: boolean
  joined: string
  chains: number
  sentEmails: string[]
  recvEmails: string[]
}

const CT = 'America/Chicago'

function formatJoined(ts: string) {
  // Numeric date, Central Time — e.g. 9/17/2026
  return new Date(ts).toLocaleDateString('en-US', { timeZone: CT })
}

function toCsv(rows: PlayerRow[]) {
  const header = ['Name', 'Email', 'Phone', 'Joined', 'Admin', 'Chains', 'Sent To', 'Received From']
  const lines = rows.map(r => [
    r.name, r.email, r.phone ?? '',
    new Date(r.joined).toLocaleDateString('en-CA', { timeZone: CT }), // YYYY-MM-DD, CT
    r.is_admin ? 'yes' : 'no', r.chains,
    r.sentEmails.join('; '), r.recvEmails.join('; '),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  return [header.join(','), ...lines].join('\n')
}

const MAX_EMAILS_SHOWN = 3

/** One email per line, truncated to 3 — click the ellipsis to expand. */
function EmailList({ emails }: { emails: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!emails.length) return <span style={{ color: 'var(--light)' }}>—</span>
  const shown = expanded ? emails : emails.slice(0, MAX_EMAILS_SHOWN)
  const hiddenCount = emails.length - MAX_EMAILS_SHOWN
  const toggleStyle: React.CSSProperties = {
    fontFamily: 'inherit', fontSize: 'var(--text-2xs)', color: 'var(--mid)',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    textAlign: 'left', textDecoration: 'underline',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {shown.map(e => (
        <span key={e} style={{ whiteSpace: 'nowrap' }}>{e}</span>
      ))}
      {hiddenCount > 0 && !expanded && (
        <button onClick={() => setExpanded(true)} title="Show all" style={toggleStyle}>
          … +{hiddenCount} more
        </button>
      )}
      {expanded && hiddenCount > 0 && (
        <button onClick={() => setExpanded(false)} style={toggleStyle}>
          show less
        </button>
      )}
    </div>
  )
}

export function PlayersTable({ initialRows }: { initialRows: PlayerRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Let a regular mouse wheel scroll the table sideways (touchpads and touch
  // already scroll horizontally natively via overflow-x).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return // touchpad already horizontal
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q))
    : rows

  const downloadCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    const link = document.createElement('a')
    link.download = `uwwordchain-players-${new Date().toLocaleDateString('en-CA', { timeZone: CT })}.csv`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const toggleAdmin = async (id: string, current: boolean) => {
    setBusyId(id); setError('')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, isAdmin: !current }),
    })
    setBusyId(null)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_admin: !current } : r))
  }

  const deleteUser = async (id: string) => {
    setBusyId(id); setError('')
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    setBusyId(null); setConfirmDelete(null)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mid)' }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 'var(--text-2xs)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--mid)', padding: '6px 16px 6px 0', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 16px 8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 'var(--text-2xs)', verticalAlign: 'middle' }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '2px solid var(--black)', background: 'var(--white)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>Admin</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>Players</h1>
      </div>

      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

        {/* Search + CSV */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{
              flex: 1, boxSizing: 'border-box',
              fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)',
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-light)', outline: 'none', borderRadius: 0,
              background: 'var(--white)',
            }}
          />
          <button
            onClick={downloadCsv}
            style={{ fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-2xs)', fontWeight: 700, padding: '4px 12px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer' }}
          >
            ↓ CSV
          </button>
        </div>

        {error && <p style={{ fontSize: 'var(--text-xs)', color: '#b44' }}>{error}</p>}

        {/* Table — scrolls sideways (mouse wheel, touchpad, or finger) */}
        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
        >
          <table style={{ borderCollapse: 'collapse', minWidth: 1020, width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Phone</th>
                <th style={th}>Joined</th>
                <th style={th}>Chains</th>
                <th style={th} title="Players this user has sent a chain invite to">→ Sent To</th>
                <th style={th} title="Players who have sent a chain invite to this user">← Received From</th>
                <th style={th}>Admin</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.name}</td>
                  <td style={{ ...td, color: 'var(--mid)', whiteSpace: 'nowrap' }}>{r.email}</td>
                  <td style={{ ...td, color: 'var(--mid)', whiteSpace: 'nowrap' }}>{r.phone ?? '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatJoined(r.joined)}</td>
                  <td style={td}>{r.chains}</td>
                  <td style={{ ...td, verticalAlign: 'top' }}><EmailList emails={r.sentEmails} /></td>
                  <td style={{ ...td, verticalAlign: 'top' }}><EmailList emails={r.recvEmails} /></td>
                  <td style={td}>
                    <button
                      onClick={() => toggleAdmin(r.id, r.is_admin)}
                      disabled={busyId === r.id}
                      role="switch"
                      aria-checked={r.is_admin}
                      title={r.is_admin ? 'Remove admin' : 'Make admin'}
                      style={{
                        position: 'relative', width: 34, height: 18, borderRadius: 9,
                        border: '1px solid var(--black)', cursor: 'pointer', padding: 0,
                        background: r.is_admin ? 'var(--black)' : 'var(--white)',
                        opacity: busyId === r.id ? 0.5 : 1,
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 1, left: r.is_admin ? 17 : 1,
                        width: 14, height: 14, borderRadius: '50%',
                        background: r.is_admin ? 'var(--white)' : 'var(--black)',
                        transition: 'left 0.15s',
                      }} />
                    </button>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {confirmDelete === r.id ? (
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          onClick={() => deleteUser(r.id)}
                          disabled={busyId === r.id}
                          style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '1px 5px', background: '#b44', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                          {busyId === r.id ? '…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '1px 5px', background: 'none', border: '1px solid var(--border-light)', cursor: 'pointer', color: 'var(--mid)' }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(r.id)}
                        title="Delete user"
                        style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '1px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#b44', textDecoration: 'underline' }}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', textAlign: 'center' }}>
          {rows.length} total player{rows.length !== 1 ? 's' : ''} · Sorted by most chains
        </p>
      </div>
    </div>
  )
}
