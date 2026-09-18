import { createAdminClient } from '@/lib/supabase/server'
import { AdsClient } from './AdsClient'

export default async function AdminAdsPage() {
  const admin = await createAdminClient()

  const [{ data: ads }, { data: settingsRows }] = await Promise.all([
    admin.from('ads').select('*').order('created_at', { ascending: false }),
    admin
      .from('settings')
      .select('key, value')
      .in('key', ['banner_ads_enabled', 'interstitial_ads_enabled']),
  ])

  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  return (
    <AdsClient
      initialAds={ads ?? []}
      bannerEnabled={settings.banner_ads_enabled === 'true'}
      interstitialEnabled={settings.interstitial_ads_enabled === 'true'}
    />
  )
}
