/**
 * GET /api/cron/daily-graphic
 *
 * Runs shortly after the game day closes (12:10 AM CT ≈ 06:10 UTC).
 * Emails the auto-generated daily leaderboard graphic to all admin accounts.
 * The graphic itself is generated on demand at /api/graphic/daily, so the
 * website "re-ups" automatically — this cron only handles the admin email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getDailyStats, yesterdayCT } from '@/lib/daily-stats'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional ?date=YYYY-MM-DD override for manual re-sends
  const date = request.nextUrl.searchParams.get('date') ?? yesterdayCT()
  const stats = await getDailyStats(date)

  if (!stats) {
    return NextResponse.json({ skipped: true, reason: `No game data for ${date}` })
  }

  // All admin recipients
  const admin = await createAdminClient()
  const { data: admins } = await admin
    .from('users')
    .select('email')
    .eq('is_admin', true)

  const recipients = (admins ?? []).map(a => a.email).filter(Boolean)
  if (!recipients.length) {
    return NextResponse.json({ skipped: true, reason: 'No admin accounts' })
  }

  // Generate the PNG and attach it directly — works from any environment
  // and gives admins a downloadable file plus an inline preview.
  const graphicRes = await fetch(`${request.nextUrl.origin}/api/graphic/daily?date=${date}`)
  if (!graphicRes.ok) {
    return NextResponse.json(
      { error: `Graphic generation failed (${graphicRes.status})` },
      { status: 500 }
    )
  }
  const graphicBase64 = Buffer.from(await graphicRes.arrayBuffer()).toString('base64')

  const teamsList = stats.teams
    .map(t => `<li>Team ${t.slot}: ${t.wordCount} word${t.wordCount !== 1 ? 's' : ''}</li>`)
    .join('')

  const html = `
    <div style="font-family: monospace; max-width: 560px;">
      <h2 style="letter-spacing: 2px;">DAILY LEADERBOARD — ${date}</h2>
      <p>Starting word: <strong>${stats.startingWord}</strong></p>
      <ul>${teamsList}</ul>
      <p>Longest word: <strong>${stats.longestWord ? `${stats.longestWord.word} — ${stats.longestWord.player}` : 'no entries'}</strong></p>
      <p>Most obscure: <strong>${stats.mostObscure ? `${stats.mostObscure.word} — ${stats.mostObscure.player}` : 'no entries'}</strong></p>
      <p style="margin-top: 24px;">
        <img src="cid:daily-graphic" alt="Daily leaderboard graphic" width="540" style="display:block; max-width:100%; border:1px solid #ddd;" />
      </p>
      <p>The graphic is attached as a PNG — ready to post to Instagram/Twitter.</p>
    </div>
  `

  await sendEmail({
    to: recipients,
    subject: `UW WordChain daily graphic — ${date}`,
    html,
    attachments: [
      {
        filename: `uwwordchain-${date}.png`,
        content: graphicBase64,
        content_id: 'daily-graphic',
      },
    ],
  })

  return NextResponse.json({ success: true, date, sentTo: recipients.length })
}
