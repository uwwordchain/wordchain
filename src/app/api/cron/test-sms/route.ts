/**
 * GET /api/cron/test-sms
 *
 * Same guard as launch-chains (CRON_SECRET Bearer). Disabled unless
 * TEST_SMS_ENABLED=true. Sends ONE starter-style text to TEST_SMS_PHONE — no
 * game day, chains, or queue changes.
 *
 * Not added to vercel.json (Hobby plan allows only 2 crons). Trigger manually
 * or schedule locally, e.g.:
 *   sleep 180 && curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://uwwordchain.app/api/cron/test-sms
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS } from '@/lib/sms'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.TEST_SMS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Test SMS drill is disabled' }, { status: 403 })
  }

  const to = process.env.TEST_SMS_PHONE?.trim()
  if (!to) {
    return NextResponse.json(
      { error: 'Set TEST_SMS_PHONE in Vercel (E.164 or 10-digit US) for drill texts' },
      { status: 500 },
    )
  }

  const twilioOk =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  if (!twilioOk) {
    return NextResponse.json(
      {
        error:
          'Twilio env missing on this deployment — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to Production, then redeploy.',
      },
      { status: 500 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uwwordchain.app'
  // Same copy shape as src/lib/launch.ts starter SMS (slot/word/link are fake).
  const body =
    `[TEST] You've been selected to start Chain A in today's UW WordChain! ` +
    `Today's word is DRILL. Your first word must start with L. ` +
    `Play here: ${appUrl}/home — ignore; this is a delivery test only.`

  try {
    await sendSMS(to, body)
    return NextResponse.json({ ok: true, to, note: 'Sent via production sendSMS + Twilio env' })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'send failed' },
      { status: 500 },
    )
  }
}
