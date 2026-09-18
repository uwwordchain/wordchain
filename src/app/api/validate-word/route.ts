import { NextRequest, NextResponse } from 'next/server'
import { isValidWord } from '@/lib/word-validation'

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get('word')
  if (!word) {
    return NextResponse.json({ valid: false, error: 'No word provided' }, { status: 400 })
  }
  const valid = await isValidWord(word)
  return NextResponse.json({ valid, word: word.toUpperCase() })
}
