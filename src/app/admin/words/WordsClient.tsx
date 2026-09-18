'use client'
import { useState, useCallback } from 'react'
import { todayCT } from '@/lib/time'
import type { WordQueueEntry } from '@/types'

function formatDateShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function lastLetter(word: string) {
  return word.slice(-1).toUpperCase()
}

export function WordsClient({
  initialWords,
  launchedWord,
}: {
  initialWords: WordQueueEntry[]
  /** The word of today's launched game (game_days) — source of truth once live */
  launchedWord: string | null
}) {
  const [words, setWords] = useState<WordQueueEntry[]>(initialWords)
  const [bulkInput, setBulkInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editWord, setEditWord] = useState('')

  const today = todayCT()

  // Refresh after mutations (initial data comes from the server render)
  const fetchWords = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/words')
      if (res.ok) {
        const data = await res.json()
        setWords(data.words ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  const todayEntry = words.find(w => w.play_date === today) ?? null
  // Once a game is live, game_days is authoritative; the queue entry is the plan
  const todayWord = launchedWord ?? todayEntry?.word ?? null
  const isLive = launchedWord !== null
  const upcoming = words.filter(w => w.play_date > today)

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return
    setLoading(true); setMessage('')
    const wordList = bulkInput.split(',').map(w => w.trim().toUpperCase()).filter(Boolean)
    try {
      const res = await fetch('/api/admin/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: wordList }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✓ Added ${wordList.length} word(s) to the end of the queue`)
        setBulkInput('')
        fetchWords()
      } else {
        setMessage(data.error || 'Error adding words')
      }
    } catch {
      setMessage('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id))
    await fetch(`/api/admin/words/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const handleSaveEdit = async (id: string) => {
    const w = editWord.toUpperCase().trim()
    if (!w) return
    setWords(prev => prev.map(entry => entry.id === id ? { ...entry, word: w } : entry))
    setEditId(null)
    await fetch(`/api/admin/words/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: w }),
    }).catch(() => {})
  }

  const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mid)' }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 'var(--text-2xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mid)', padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-light)' }
  const td: React.CSSProperties = { padding: '8px 8px 8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 'var(--text-xs)', verticalAlign: 'middle' }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '2px solid var(--black)', background: 'var(--white)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>Admin</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>Word of the Day</h1>
      </div>

      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Today's word — pinned */}
        <div style={{ border: '1.5px solid var(--black)', padding: 'var(--space-3)', background: '#fafafa' }}>
          <p style={{ ...eyebrow, marginBottom: 'var(--space-1)' }}>
            Today — {formatDateShort(today)}{isLive ? ' · Live now' : todayWord ? ' · Scheduled' : ''}
          </p>
          {todayWord ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '0.15em' }}>{todayWord}</div>
                <div style={{
                  width: '2.25rem', height: '2.25rem', border: '2px solid var(--black)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-lg)', fontWeight: 700, flexShrink: 0,
                }}>
                  {lastLetter(todayWord)}
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginTop: 'var(--space-1)' }}>
                Players&apos; words must start with {lastLetter(todayWord)}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-xs)', color: '#b44' }}>
              No word scheduled for today. Add words below.
            </p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />

        {/* Bulk add */}
        <div>
          <p style={{ ...eyebrow, marginBottom: 'var(--space-2)' }}>Add words to queue</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', marginBottom: 'var(--space-2)' }}>
            Paste comma-separated words. They&apos;ll be added to the end of the queue in order.
          </p>
          <textarea
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            placeholder="FLAME, HOVER, QUEST, BRIGHT, STONE…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-light)',
              fontFamily: 'Space Mono, monospace',
              fontSize: 'var(--text-xs)',
              resize: 'vertical', outline: 'none', borderRadius: 0,
              background: 'var(--white)', color: 'var(--mid)', lineHeight: 1.6,
            }}
          />
          <button
            onClick={handleBulkAdd}
            disabled={loading || !bulkInput.trim()}
            style={{
              marginTop: 'var(--space-2)',
              fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700,
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--black)', color: 'var(--white)', border: 'none',
              cursor: bulkInput.trim() ? 'pointer' : 'not-allowed',
              opacity: bulkInput.trim() ? 1 : 0.4,
            }}
          >
            {loading ? 'Adding…' : 'Add to queue →'}
          </button>
          {message && (
            <p style={{ fontSize: 'var(--text-xs)', color: message.startsWith('✓') ? 'green' : '#b44', marginTop: 'var(--space-2)' }}>
              {message}
            </p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />

        {/* Upcoming queue */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <p style={eyebrow}>Upcoming queue</p>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)' }}>
              {upcoming.length} word{upcoming.length !== 1 ? 's' : ''} scheduled
            </span>
          </div>

          {upcoming.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              Queue is empty. Add words above.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Word</th>
                  <th style={th}>Starts with</th>
                  <th style={th}></th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((entry, idx) => {
                  const isNext = idx === 0
                  return (
                    <tr key={entry.id} style={{ background: isNext ? '#f7f7f7' : 'transparent' }}>
                      <td style={{ ...td, fontWeight: isNext ? 700 : 400 }}>{formatDateShort(entry.play_date)}</td>
                      <td style={{ ...td, fontWeight: isNext ? 700 : 400 }}>
                        {editId === entry.id ? (
                          <input
                            value={editWord}
                            onChange={e => setEditWord(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit(entry.id)}
                            onBlur={() => handleSaveEdit(entry.id)}
                            autoFocus
                            style={{
                              fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-xs)', fontWeight: 700,
                              border: '1.5px solid var(--black)', padding: '2px 6px', width: '6rem',
                              outline: 'none', borderRadius: 0, background: 'var(--white)',
                            }}
                          />
                        ) : entry.word}
                      </td>
                      <td style={{ ...td, fontWeight: isNext ? 700 : 400 }}>{lastLetter(entry.word)}</td>
                      <td style={td}>
                        {editId !== entry.id && (
                          <button
                            onClick={() => { setEditId(entry.id); setEditWord(entry.word) }}
                            style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '1px 6px', border: '1px solid var(--border-light)', background: 'none', cursor: 'pointer', color: 'var(--black)' }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button
                          onClick={() => handleRemove(entry.id)}
                          title="Remove"
                          style={{ fontSize: 'var(--text-xs)', fontFamily: 'inherit', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--mid)' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
            Words auto-publish at midnight CT. Edit or remove any time before then.
          </p>
        </div>
      </div>
    </div>
  )
}
