import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pinToPassword } from '@/lib/auth'

/** Verify the user's current PIN without changing it */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { pin } = await request.json()
  if (!pin || pin.length !== 4) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: pinToPassword(pin),
  })

  if (error) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true })
}
