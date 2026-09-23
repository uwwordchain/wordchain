/**
 * GET /api/graphic/daily            → PNG leaderboard graphic for yesterday (CT)
 * GET /api/graphic/daily?date=YYYY-MM-DD → graphic for a specific play date
 * Add &download=1 to force a file download.
 *
 * Generated with Vercel OG (satori). Design: red gradient square,
 * "DAILY LEADERBOARD" eyebrow, starting word title, white pill rows,
 * rule + uwwordchain.app footer.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getDailyStats, yesterdayCT } from '@/lib/daily-stats'

// ── Font loading (Space Mono from Google Fonts, cached per instance) ────────
let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null

async function loadFont(weight: 400 | 700): Promise<ArrayBuffer> {
  const css = await (await fetch(
    `https://fonts.googleapis.com/css2?family=Space+Mono:wght@${weight}&display=swap`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; satori)' } } // non-browser UA → TTF urls
  )).text()
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1]
  if (!url) throw new Error('Could not resolve font URL')
  return await (await fetch(url)).arrayBuffer()
}

async function getFonts() {
  if (!fontCache) {
    const [regular, bold] = await Promise.all([loadFont(400), loadFont(700)])
    fontCache = { regular, bold }
  }
  return fontCache
}

// ── Pill row component ──────────────────────────────────────────────────────
const PILL_WIDTH = 760

function Pill({ children }: { children: string }) {
  // Auto-fit: Space Mono bold glyph width ≈ 0.62em + letterSpacing.
  // Shrink the font so long lines (longest/most obscure) stay inside the pill.
  const len = children.length
  const fontSize = Math.min(32, Math.floor((PILL_WIDTH - 90) / (len * 0.62 + len * 0.09)))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: PILL_WIDTH,
        height: 88,
        borderRadius: 44,
        background: '#ffffff',
        color: '#4a4a4a',
        fontSize,
        fontWeight: 700,
        letterSpacing: fontSize * 0.09,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const date = searchParams.get('date') ?? yesterdayCT()
  const download = searchParams.get('download') === '1'

  const stats = await getDailyStats(date)

  if (!stats) {
    return new Response('No game data for that date', { status: 404 })
  }

  const fonts = await getFonts()

  // Closed game days never change — cache aggressively at the CDN.
  // (Anything older than yesterday is fully immutable; yesterday gets 1h.)
  const cacheControl = date < yesterdayCT()
    ? 'public, s-maxage=604800, immutable'
    : 'public, s-maxage=3600, stale-while-revalidate=86400'

  const image = new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '90px 70px 70px',
          background: 'linear-gradient(135deg, #f0272b 0%, #cc1a1a 45%, #6e100a 100%)',
          fontFamily: 'Space Mono',
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', color: '#ffffff', fontSize: 30, fontWeight: 700, letterSpacing: 10 }}>
          DAILY LEADERBOARD
        </div>

        {/* Starting word */}
        <div style={{ display: 'flex', color: '#ffffff', fontSize: 64, fontWeight: 700, letterSpacing: 8, marginTop: 36 }}>
          {stats.startingWord}
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, marginTop: 56, alignItems: 'center' }}>
          {stats.teams.map(team => (
            <Pill key={team.slot}>
              {`Team ${team.slot} — ${team.wordCount} word${team.wordCount !== 1 ? 's' : ''}`}
            </Pill>
          ))}
          <Pill>
            {stats.longestWord
              ? `Longest: ${stats.longestWord.word} — ${stats.longestWord.player}`
              : 'Longest word — no entries'}
          </Pill>
          <Pill>
            {stats.mostObscure
              ? `Most obscure: ${stats.mostObscure.word} — ${stats.mostObscure.player}`
              : 'Most obscure — no entries'}
          </Pill>
        </div>

        {/* Rule + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', height: 2, background: '#ffffff' }} />
          <div style={{ display: 'flex', color: '#ffffff', fontSize: 28, fontWeight: 400, letterSpacing: 2, marginTop: 24 }}>
            uwwordchain.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: 'Space Mono', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Space Mono', data: fonts.bold, weight: 700, style: 'normal' },
      ],
    }
  )

  const headers = new Headers(image.headers)
  headers.set('Cache-Control', cacheControl)
  if (download) {
    headers.set('Content-Disposition', `attachment; filename="uwwordchain-${date}.png"`)
  }
  return new Response(image.body, { status: 200, headers })
}
