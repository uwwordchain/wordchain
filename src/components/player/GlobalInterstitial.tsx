'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { InterstitialAd } from './InterstitialAd'

interface Config {
  active: boolean
  imageUrl?: string | null
  linkUrl?: string | null
}

// No ads on admin, auth, or account pages
const EXCLUDED_PREFIXES = ['/admin', '/login', '/signup', '/reset-pin', '/account']

/**
 * Mounts the slide-up interstitial on every page except admin, auth, and account.
 * Fetches the active ad config client-side so static pages stay static.
 */
export function GlobalInterstitial() {
  const pathname = usePathname()
  const isExcludedPage = EXCLUDED_PREFIXES.some(p => pathname.startsWith(p))
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    if (isExcludedPage) return
    // Skip the fetch entirely if it already showed this session
    if (sessionStorage.getItem('wc_interstitial_shown')) return
    fetch('/api/ads/interstitial')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [isExcludedPage])

  if (isExcludedPage || !config?.active) return null

  return (
    <InterstitialAd
      active
      imageUrl={config.imageUrl ?? null}
      linkUrl={config.linkUrl ?? null}
    />
  )
}
