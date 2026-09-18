export function LetterTile({ letter, label }: { letter: string; label?: string }) {
  return (
    <div className="letter-tile-wrap">
      <div className="letter-tile">{letter}</div>
      {label && (
        <span
          className="letter-tile-label"
          dangerouslySetInnerHTML={{ __html: label }}
        />
      )}
    </div>
  )
}
