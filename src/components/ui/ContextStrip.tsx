export function ContextStrip({
  word,
  chainSlot,
  wordCount,
}: {
  word: string
  chainSlot: string
  wordCount: number
}) {
  return (
    <div className="context-strip">
      <span>
        Today: <strong className="word-upper" style={{ color: 'var(--white)' }}>{word}</strong>
      </span>
      <span>
        Chain {chainSlot} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </span>
    </div>
  )
}
