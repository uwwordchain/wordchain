interface AdBannerProps {
  imageUrl: string | null
  linkUrl?: string | null
  active: boolean
}

/**
 * Renders the top banner ad.
 * Shows nothing at all when active=false or no image is set.
 * Falls back to a placeholder label only in the admin preview context.
 */
export function AdBanner({ imageUrl, linkUrl, active }: AdBannerProps) {
  if (!active || !imageUrl) return null

  const inner = (
    <div className="ad-banner" style={{ padding: 0, height: 'auto', minHeight: '3.75rem', overflow: 'hidden', cursor: linkUrl ? 'pointer' : 'default' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Advertisement"
        style={{ width: '100%', maxHeight: '6rem', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )

  if (linkUrl) {
    return <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>{inner}</a>
  }
  return inner
}
