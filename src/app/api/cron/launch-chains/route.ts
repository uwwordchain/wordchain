/**
 * GET /api/cron/launch-chains
 *
 * Called by Vercel Cron daily (13:00 UTC ≈ 8 AM CT).
 * Guarded by CRON_SECRET.
 *
 * Precedence: manually scheduled dates (chain_starters_queue) ALWAYS
 * launch — they override the auto toggle and day-of-week picker.
 * Auto-launch is only a backup for days with no manual schedule.
 * The actual launch logic lives in src/lib/launch.ts (shared with the
 * admin "Launch now" button); scheduled users always take their slots,
 * random picks only fill unassigned ones.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { launchTodaysChains, willLaunchToday } from '@/lib/launch'

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (or an admin testing it)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await createAdminClient()

  // Manually scheduled dates ALWAYS run; auto-launch settings are only
  // a backup for unscheduled days (logic shared in lib/launch.ts).
  const { launch, reason } = await willLaunchToday(admin)
  if (!launch) {
    return NextResponse.json({ skipped: true, reason })
  }

  const result = await launchTodaysChains()
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
