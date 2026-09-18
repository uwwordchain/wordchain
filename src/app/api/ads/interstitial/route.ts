import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Cached at the CDN for 60s — this is fetched on every page view,
// and a one-minute delay on ad changes is acceptable.
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

// Public endpoint — returns the currently active interstitial ad (if enabled)
export async function GET() {
  const admin = await createAdminClient()

  const [{ data: setting }, { data: ad }] = await Promise.all([
    admin
      .from('settings')
      .select('value')
      .eq('key', 'interstitial_ads_enabled')
      .maybeSingle(),
    admin
      .from('ads')
      .select('image_url, link_url')
      .eq('ad_type', 'interstitial')
      .eq('is_active', true)
      .maybeSingle(),
  ])

  if (setting?.value !== 'true' || !ad?.image_url) {
    return NextResponse.json({ active: false }, { headers: CACHE_HEADERS })
  }

  return NextResponse.json(
    { active: true, imageUrl: ad.image_url, linkUrl: ad.link_url },
    { headers: CACHE_HEADERS }
  )
}
