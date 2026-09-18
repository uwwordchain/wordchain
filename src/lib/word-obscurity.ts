/**
 * Word obscurity via the Datamuse API (free, no key required).
 * Datamuse returns word frequency as occurrences per million words of text
 * (tag "f:<number>"). Lower frequency = more obscure.
 */

const cache = new Map<string, number>()

/** Returns frequency per million words. Unknown words return 0 (max obscurity). */
export async function getWordFrequency(word: string): Promise<number> {
  const key = word.toLowerCase()
  if (cache.has(key)) return cache.get(key)!

  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(key)}&md=f&max=1`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) throw new Error(`Datamuse ${res.status}`)
    const data: Array<{ word: string; tags?: string[] }> = await res.json()
    const entry = data.find(d => d.word === key)
    const fTag = entry?.tags?.find(t => t.startsWith('f:'))
    const freq = fTag ? parseFloat(fTag.slice(2)) : 0
    cache.set(key, freq)
    return freq
  } catch {
    // On failure, fall back to letter-rarity scoring so the graphic still works
    return letterRarityFallback(key)
  }
}

/* Scrabble-style fallback if Datamuse is unreachable.
   Returns a pseudo-frequency: common letters → higher number (less obscure). */
const LETTER_SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
}

function letterRarityFallback(word: string): number {
  const avgScore = word.toUpperCase().split('')
    .reduce((sum, ch) => sum + (LETTER_SCORES[ch] ?? 0), 0) / word.length
  // Invert: high rarity score → low pseudo-frequency
  return Math.max(0, 100 - avgScore * 10)
}

/** Given a list of words, returns the most obscure one (lowest frequency). */
export async function findMostObscure<T extends { word: string }>(entries: T[]): Promise<T | null> {
  if (!entries.length) return null
  let best: T | null = null
  let bestFreq = Infinity
  for (const entry of entries) {
    const freq = await getWordFrequency(entry.word)
    if (freq < bestFreq) { bestFreq = freq; best = entry }
  }
  return best
}
