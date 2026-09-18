/**
 * All game logic runs on US Central Time (America/Chicago), regardless of
 * where the server or the player's browser is located.
 */
export const CENTRAL_TZ = 'America/Chicago'

/** YYYY-MM-DD for today in Central Time. */
export function todayCT(): string {
  return dateCT(0)
}

/** YYYY-MM-DD for yesterday in Central Time. */
export function yesterdayCT(): string {
  return dateCT(-1)
}

/** YYYY-MM-DD for today + offsetDays, computed in Central Time. */
export function dateCT(offsetDays: number): string {
  const nowCT = new Date(new Date().toLocaleString('en-US', { timeZone: CENTRAL_TZ }))
  nowCT.setDate(nowCT.getDate() + offsetDays)
  return nowCT.toLocaleDateString('en-CA') // YYYY-MM-DD
}

/**
 * Converts a Central Time wall-clock moment (e.g. 11:59 PM on a play date)
 * to a UTC ISO string, accounting for daylight saving time.
 */
export function ctWallTimeToUTC(playDate: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  // Naive guess: treat the CT wall time as if it were UTC…
  const naive = new Date(`${playDate}T${hh}:${mm}:00Z`)
  // …then correct by the actual CT↔UTC offset at that moment.
  const ctWall = new Date(naive.toLocaleString('en-US', { timeZone: CENTRAL_TZ }))
  const utcWall = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offsetMs = utcWall.getTime() - ctWall.getTime()
  return new Date(naive.getTime() + offsetMs).toISOString()
}
