import { createAdminClient } from '@/lib/supabase/server'
import { yesterdayCT } from '@/lib/daily-stats'

export default async function AdminGraphicPage() {
  const admin = await createAdminClient()
  const date = yesterdayCT()

  const { data: gameDay } = await admin
    .from('game_days')
    .select('id')
    .eq('play_date', date)
    .maybeSingle()

  const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mid)' }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '2px solid var(--black)', background: 'var(--white)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>Admin</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>Daily Social Card</h1>
      </div>

      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <p style={eyebrow}>Yesterday&apos;s recap</p>
          <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginTop: 2 }}>Daily Graphic</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', marginTop: 'var(--space-1)' }}>
            Auto-generated after each day closes and emailed to all admins at 12:10 AM CT.
          </p>
        </div>

        {!gameDay ? (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--light)', textAlign: 'center', padding: 'var(--space-5) 0', border: '1px solid var(--border-light)' }}>
            No game data for yesterday ({date}).
          </p>
        ) : (
          <>
            {/* Live generated graphic */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/graphic/daily?date=${date}`}
              alt={`Daily leaderboard graphic for ${date}`}
              style={{ width: '100%', display: 'block', border: '1px solid var(--border-light)' }}
            />

            <a
              href={`/api/graphic/daily?date=${date}&download=1`}
              style={{
                fontFamily: 'Space Mono, monospace', fontSize: 'var(--text-body)', fontWeight: 700,
                padding: 'var(--space-3)', background: 'none', border: '1.5px solid var(--black)',
                color: 'var(--black)', width: '100%', textAlign: 'center', textDecoration: 'none',
                display: 'block', boxSizing: 'border-box',
              }}
            >
              Download graphic
            </a>
          </>
        )}
      </div>
    </div>
  )
}
