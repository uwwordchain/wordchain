/**
 * Word validation.
 *
 * Primary: bundled ENABLE word list (~173k words, public domain — the
 * standard list for Scrabble-style games). Instant, free, and can't go down.
 *
 * Fallback: Datamuse API, for legitimate newer words the 1990s-era ENABLE
 * list doesn't know (e.g. "selfie", "emoji"). If Datamuse is unreachable
 * for an unknown word, we fail open (accept) rather than block the game.
 */
import { readFile } from 'fs/promises'
import path from 'path'

let WORDS: Set<string> | null = null
const ONLINE_CACHE = new Map<string, boolean>()

async function loadWordList(): Promise<Set<string>> {
  if (WORDS) return WORDS
  const raw = await readFile(path.join(process.cwd(), 'src/data/wordlist.txt'), 'utf8')
  WORDS = new Set(raw.split('\n').map(w => w.trim()).filter(Boolean))
  return WORDS
}

export async function isValidWord(word: string): Promise<boolean> {
  const normalized = word.toLowerCase().trim()

  // ── Primary: local word list ───────────────────────────────────────────
  try {
    const words = await loadWordList()
    if (words.has(normalized)) return true
  } catch {
    // Word list unreadable (shouldn't happen) — fall through to Datamuse
  }

  // ── Fallback: Datamuse, for newer words the list doesn't know ──────────
  if (ONLINE_CACHE.has(normalized)) return ONLINE_CACHE.get(normalized)!
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(normalized)}&max=1`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (res.ok) {
      const data: Array<{ word: string }> = await res.json()
      const valid = data[0]?.word === normalized
      ONLINE_CACHE.set(normalized, valid)
      return valid
    }
  } catch { /* Datamuse unreachable */ }

  // Unknown word and no way to verify — accept it (don't cache the guess)
  return true
}
