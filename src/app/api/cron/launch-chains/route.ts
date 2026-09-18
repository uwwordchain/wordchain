/**
 * GET /api/cron/launch-chains
 *
 * Called by Vercel Cron daily (13:00 UTC ≈ 8 AM CT).
 * Guarded by CRON_SECRET. Respects the auto-launch toggle and the
 * day-of-week picker; the actual launch logic lives in src/lib/launch.ts
 * (shared with the admin "Launch now" button).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { launchTodaysChains } from '@/lib/launch'

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (or an admin testing it)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await createAdminClient()

  // ── Check auto-launch settings ─────────────────────────────────────
  const { data: settingsRows } = await admin
    .from('settings')
    .select('key, value')
    .in('key', ['auto_launch_enabled', 'auto_launch_days'])

  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  if (settings.auto_launch_enabled !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'Auto-launch is OFF' })
  }

  // Day-of-week check in Central Time (0 = Sunday … 6 = Saturday)
  // Default: all days enabled if the setting has never been saved.
  const enabledDays = (settings.auto_launch_days ?? '0,1,2,3,4,5,6')
    .split(',').filter(Boolean).map(Number)
  const dayNameCT = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' })
  const dayIndexCT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayNameCT)

  if (!enabledDays.includes(dayIndexCT)) {
    return NextResponse.json({ skipped: true, reason: `Auto-launch not enabled for ${dayNameCT}` })
  }

  const result = await launchTodaysChains()
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
