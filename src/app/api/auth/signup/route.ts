import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hashPin, pinToPassword, validateEmail } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, firstName, phone, displayName, pin } = body

    // Single "Name" field, split into first + last (first word = first name)
    const fullName: string = (name ?? firstName ?? '').trim()
    const [first, ...rest] = fullName.split(/\s+/)
    const last = rest.join(' ') || null

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Email must be a @wisc.edu address' }, { status: 400 })
    }
    if (!first) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: pinToPassword(pin),
      email_confirm: true,
    })

    if (authError) {
      if (authError.message?.includes('already')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Insert into public.users
    const pinHash = hashPin(pin)
    const isAdmin = email.toLowerCase().endsWith('@wiscoproject.org')
    const { error: dbError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      phone: phone || null,
      first_name: first,
      last_name: last,
      display_name: displayName?.trim() || null,
      pin_hash: pinHash,
      is_admin: isAdmin,
    })

    if (dbError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Auto-login: sign in with the SSR client so session cookies are set
    // on this response — no separate login step needed after signup.
    const ssr = await createClient()
    const { error: signInError } = await ssr.auth.signInWithPassword({
      email,
      password: pinToPassword(pin),
    })

    // If auto-login somehow fails, the account still exists — fall back to login
    return NextResponse.json({ success: true, autoLoggedIn: !signInError })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
