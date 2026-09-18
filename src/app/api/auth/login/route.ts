import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateEmail, pinToPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, pin } = body

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Email must be a @wisc.edu address' }, { status: 400 })
    }
    if (!pin || pin.length !== 4) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pinToPassword(pin),
    })

    if (error) {
      return NextResponse.json({ error: 'Invalid email or PIN' }, { status: 401 })
    }

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
