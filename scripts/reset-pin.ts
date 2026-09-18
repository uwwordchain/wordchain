/**
 * One-time script: reset a user's PIN in both Supabase Auth and public.users
 * Usage: npx tsx scripts/reset-pin.ts <email> <new-pin>
 * Example: npx tsx scripts/reset-pin.ts elle@wiscoproject.org 2626
 */

// Run with: npx tsx --env-file=.env.local scripts/reset-pin.ts <email> <pin>
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PIN_SALT          = process.env.PIN_SALT || 'wordchain-default-salt'

const email  = process.argv[2]
const newPin = process.argv[3]

if (!email || !newPin) {
  console.error('Usage: npx tsx scripts/reset-pin.ts <email> <pin>')
  process.exit(1)
}
if (!/^\d{4}$/.test(newPin)) {
  console.error('PIN must be exactly 4 digits')
  process.exit(1)
}

function pinToPassword(pin: string) { return `${pin}--wc` }
function hashPin(pin: string) {
  return createHash('sha256').update(`${PIN_SALT}:${pin}`).digest('hex')
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  // 1. Find the auth user by email
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) { console.error('Failed to list users:', listErr.message); process.exit(1) }

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser) { console.error(`No user found with email: ${email}`); process.exit(1) }

  console.log(`Found user: ${authUser.email} (${authUser.id})`)

  // 2. Update Supabase Auth password
  const { error: pwErr } = await admin.auth.admin.updateUserById(authUser.id, {
    password: pinToPassword(newPin),
  })
  if (pwErr) { console.error('Failed to update auth password:', pwErr.message); process.exit(1) }
  console.log('✓ Auth password updated')

  // 3. Update pin_hash in public.users
  const { error: dbErr } = await admin
    .from('users')
    .update({ pin_hash: hashPin(newPin) })
    .eq('id', authUser.id)
  if (dbErr) { console.error('Failed to update pin_hash:', dbErr.message); process.exit(1) }
  console.log('✓ pin_hash updated')

  console.log(`\n✅ PIN reset to ${newPin} for ${email}. You can now log in.`)
}

run()
