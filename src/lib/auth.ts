import { createHash } from 'crypto'

const SALT = process.env.PIN_SALT || 'wordchain-default-salt'

export function hashPin(pin: string): string {
  return createHash('sha256').update(`${SALT}:${pin}`).digest('hex')
}

/**
 * Supabase Auth enforces a minimum 6-character password.
 * We pad the 4-digit PIN with a fixed suffix so Supabase accepts it,
 * while users only ever see and enter 4 digits.
 */
export function pinToPassword(pin: string): string {
  return `${pin}--wc`
}

const ALLOWED_DOMAINS = ['@wisc.edu', '@wiscoproject.org']

export function validateEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return ALLOWED_DOMAINS.some(domain => lower.endsWith(domain))
}
