import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { dateCT } from '@/lib/time'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = await createAdminClient()
  const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  return profile?.is_admin ? admin : null
}

// GET — return all queued words sorted by date
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin
    .from('word_queue')
    .select('*')
    .order('play_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ words: data ?? [] })
}

// POST — bulk add words, auto-assigning consecutive dates
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { words, dates } = await request.json()
  if (!words?.length) return NextResponse.json({ error: 'No words provided' }, { status: 400 })

  // Find the next available date (day after the last queued word, or tomorrow)
  const { data: lastEntry } = await admin
    .from('word_queue')
    .select('play_date')
    .order('play_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const startDate = lastEntry?.play_date
    ? new Date(new Date(lastEntry.play_date + 'T00:00:00').getTime() + 86400000)
    : new Date(dateCT(1) + 'T00:00:00') // tomorrow, Central Time

  const rows = words.map((word: string, i: number) => {
    const playDate = dates?.[i] ?? (() => {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
    })()
    return { word: word.toUpperCase().trim(), play_date: playDate }
  })

  const { error } = await admin.from('word_queue').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, added: rows.length })
}
