import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const supabase = await createClient()

    // Supabase sends a magic reset link; redirectTo is where they land after clicking it
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-pin`,
    })

    // Always return success — never reveal whether an email exists
    if (error) console.error('Reset request error:', error.message)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
