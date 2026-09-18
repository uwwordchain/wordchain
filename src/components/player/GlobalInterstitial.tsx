'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { InterstitialAd } from './InterstitialAd'

interface Config {
  active: boolean
  imageUrl?: string | null
  linkUrl?: string | null
}

/**
 * Mounts the slide-up interstitial on every non-admin page.
 * Fetches the active ad config client-side so static pages stay static.
 */
export function GlobalInterstitial() {
  const pathname = usePathname()
  const isAdminPage = pathname.startsWith('/admin')
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    if (isAdminPage) return
    // Skip the fetch entirely if it already showed this session
    if (sessionStorage.getItem('wc_interstitial_shown')) return
    fetch('/api/ads/interstitial')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [isAdminPage])

  if (isAdminPage || !config?.active) return null

  return (
    <InterstitialAd
      active
      imageUrl={config.imageUrl ?? null}
      linkUrl={config.linkUrl ?? null}
    />
  )
}
