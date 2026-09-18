/**
 * SMS sending via Twilio's REST API (plain fetch — no SDK dependency).
 *
 * Required env vars (falls back to console-log stub when unset, so dev
 * works without a Twilio account):
 *   TWILIO_ACCOUNT_SID   — from the Twilio Console dashboard
 *   TWILIO_AUTH_TOKEN    — from the Twilio Console dashboard
 *   TWILIO_PHONE_NUMBER  — your purchased number, E.164 (e.g. +16085551234)
 */

/** Normalize US numbers to E.164 (+1XXXXXXXXXX). Leaves +… numbers alone. */
function toE164(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}` // best effort
}

export async function sendSMS(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from) {
    console.log(`[SMS STUB — Twilio not configured] To: ${to}\nBody: ${body}`)
    return
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toE164(to),
        From: from,
        Body: body,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Twilio error ${res.status}: ${(err as any).message ?? 'unknown'}`)
  }
}

export function buildChainInviteMessage({
  inviterName,
  word,
  startLetter,
  link,
}: {
  inviterName: string
  word: string
  startLetter: string
  link: string
}): string {
  return `${inviterName} added "${word}" to a UW WordChain. Your word starts with ${startLetter}. Play now: ${link}`
}
