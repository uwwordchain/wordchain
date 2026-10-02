# UW WordChain

A daily word-chain game for the UW community, live at [uwwordchain.app](https://uwwordchain.app).
Every morning three players are texted a link to start a chain; each player adds
a word and texts the chain on to a friend. Longest chain at 11:59 PM CT wins.

## Architecture

Next.js (App Router) on Vercel. Supabase for the database and auth. Twilio for
outbound SMS, Resend for outbound email.

```
Vercel (hosting + cron)
  └── Next.js app
        ├── Supabase ── Postgres (games, chains, words, users) + auth (email / 4-digit PIN)
        ├── Twilio ──── game texts from (608) 830-1449, via Messaging Service (A2P registered)
        └── Resend ──── email from @uwwordchain.app (PIN resets, admin recap graphic)
```

### Service accounts

| Service | Purpose | Notes |
|---|---|---|
| **Vercel** | Hosting, auto-deploy from `main`, cron jobs | Env vars live here (see below) |
| **GitHub** | Source of truth — pushing to `main` deploys | github.com/uwwordchain/wordchain |
| **Supabase** | Postgres + auth | Project `onftgididmlmgudeakbb`; PIN reset emails use the implicit auth flow |
| **Twilio** | SMS | Number (608) 830-1449 in the "UW WordChain" Messaging Service; A2P 10DLC registered under a sole-proprietor brand |
| **Resend** | Transactional email | Domain `uwwordchain.app` verified |
| **Squarespace** | Domain registrar / DNS for uwwordchain.app | |

Credentials for all of the above are in the shared 1Password vault.

### Daily lifecycle

1. **8 AM CT** — Vercel cron hits `/api/cron/launch-chains`. Manually scheduled
   starters (`chain_starters_queue`) always launch; otherwise, if auto-launch is
   enabled in settings, random opted-in players are picked. Each starter gets a
   text with a unique play link.
2. Players submit words (`/api/play/submit`) and text their invite link to a friend.
3. **11:59 PM CT** — chains close (`closes_at` on the game day).
4. **12:10 AM CT** — cron hits `/api/cron/daily-graphic`, which builds the recap
   card and emails it to admins. The homepage shows yesterday's winner.

### Code map

```
src/app/            pages: home, play/[token], signup, login, reset-pin, account,
                    privacy, terms, admin/{words,chains,players,ads,graphic}
src/app/api/        route handlers: auth, play, admin, cron
src/lib/            launch.ts (chain launch + starter selection), sms.ts (Twilio),
                    email.ts (Resend), time.ts (Central Time helpers),
                    word-validation.ts, daily-stats.ts
src/components/     ui/ (shared), player/, admin/
```

### Environment variables (set in Vercel)

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin queries |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS |
| `RESEND_API_KEY` | Email |
| `NEXT_PUBLIC_APP_URL` | Absolute links in texts/emails |
| `CRON_SECRET` | Authorizes Vercel cron calls |
| `TEST_SMS_PHONE` | Optional; `/api/cron/test-sms` sends a drill starter-style text here (no launch) |
| `TEST_SMS_PHONE` | Optional; `/api/cron/test-sms` sends a drill starter-style text here (no launch) |

For local dev, copy these into `.env.local` (gitignored) and `npm run dev`.

## Gotchas

- **Cron times are UTC.** `0 13 * * *` = 8 AM CT only during daylight saving —
  change to `0 14 * * *` in `vercel.json` when DST ends in early November.
- **Twilio accepts messages it can't deliver** (HTTP success, then async carrier
  drop). Check Twilio's message logs when debugging delivery, not just the API
  response.
- **Supabase PIN reset emails** intentionally use the base `supabase-js` client
  with the implicit flow — `@supabase/ssr` hard-codes PKCE, which breaks
  cross-device reset links.
- A word must exist in the `word_queue` for a day to have a game. Keep it stocked
  via the admin Words tab.
