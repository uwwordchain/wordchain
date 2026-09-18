'use client'
import { useRef, useState } from 'react'

export interface AdRow {
  id: string
  ad_type: 'banner' | 'interstitial'
  name: string | null
  image_url: string | null
  is_active: boolean
  link_url: string | null
  created_at?: string
}

/* ── OFF/ON toggle (matches wireframe style) ─────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', padding: 0 }}
    >
      <span style={{ fontSize: 'var(--text-2xs)', color: on ? 'var(--light)' : 'var(--black)', fontWeight: on ? 400 : 700 }}>OFF</span>
      <span style={{ width: 32, height: 16, background: on ? 'var(--black)' : '#ccc', borderRadius: 8, position: 'relative', display: 'inline-block', flexShrink: 0, transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 12, height: 12, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
      </span>
      <span style={{ fontSize: 'var(--text-2xs)', color: on ? 'var(--black)' : 'var(--light)', fontWeight: on ? 700 : 400 }}>ON</span>
    </button>
  )
}

/* ── Upload zone ─────────────────────────────────────────────────────────── */
function UploadZone({ adType, hint, onUploaded }: { adType: 'banner' | 'interstitial'; hint: string; onUploaded: (ad: AdRow) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    const form = new FormData()
    form.append('file', file)
    form.append('ad_type', adType)
    try {
      const res = await fetch('/api/admin/ads/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUploaded(data.ad)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFile} style={{ display: 'none' }} id={`upload-${adType}`} />
      <label
        htmlFor={`upload-${adType}`}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          border: '1.5px dashed var(--border-light)', padding: 'var(--space-3)',
          cursor: uploading ? 'wait' : 'pointer', textAlign: 'center',
          opacity: uploading ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>[ + ]</span>
        <span style={{ fontSize: 'var(--text-xs)' }}>{uploading ? 'Uploading…' : adType === 'banner' ? 'Upload new banner' : 'Upload slide-up image'}</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)' }}>{hint}</span>
      </label>
      {error && <p style={{ fontSize: 'var(--text-xs)', color: '#b44', marginTop: 4 }}>{error}</p>}
    </div>
  )
}

/* ── Image library table ─────────────────────────────────────────────────── */
function AdTable({
  ads, thumbHeight, onSetActive, onDelete, busyId,
}: {
  ads: AdRow[]
  thumbHeight: number
  onSetActive: (id: string) => void
  onDelete: (id: string) => void
  busyId: string | null
}) {
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 'var(--text-2xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mid)', padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-light)' }
  const td: React.CSSProperties = { padding: '8px 8px 8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 'var(--text-xs)', verticalAlign: 'middle' }

  if (ads.length === 0) {
    return <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', padding: 'var(--space-3) 0', textAlign: 'center' }}>No images uploaded yet.</p>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--space-2)' }}>
      <thead>
        <tr><th style={th}>Image</th><th style={th}>Name</th><th style={th}>Status</th><th style={th}></th></tr>
      </thead>
      <tbody>
        {ads.map(ad => (
          <tr key={ad.id}>
            <td style={td}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ad.image_url ?? ''} alt={ad.name ?? 'ad'} style={{ width: 48, height: thumbHeight, objectFit: 'cover', border: '1px solid var(--border-light)', display: 'block' }} />
            </td>
            <td style={{ ...td, color: 'var(--mid)', wordBreak: 'break-all' }}>{ad.name ?? '—'}</td>
            <td style={td}>
              {/* Per-image active toggle — only one can be ON per ad type */}
              <button
                onClick={() => onSetActive(ad.id)}
                disabled={busyId === ad.id}
                aria-pressed={ad.is_active}
                title={ad.is_active ? 'Deactivate' : 'Make this the active image'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: busyId === ad.id ? 0.5 : 1 }}
              >
                <span style={{ width: 28, height: 14, background: ad.is_active ? 'var(--black)' : '#ccc', borderRadius: 7, position: 'relative', display: 'inline-block', flexShrink: 0, transition: 'background 0.2s' }}>
                  <span style={{ position: 'absolute', top: 2, left: ad.is_active ? 16 : 2, width: 10, height: 10, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', fontWeight: ad.is_active ? 700 : 400, color: ad.is_active ? 'var(--black)' : 'var(--light)' }}>
                  {ad.is_active ? 'ACTIVE' : 'Off'}
                </span>
              </button>
            </td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onDelete(ad.id)}
                  disabled={busyId === ad.id}
                  style={{ fontSize: 'var(--text-2xs)', fontFamily: 'inherit', padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', color: '#b44', textDecoration: 'underline' }}
                >
                  ✕
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export function AdsClient({
  initialAds, bannerEnabled: initBanner, interstitialEnabled: initInterstitial,
}: {
  initialAds: AdRow[]
  bannerEnabled: boolean
  interstitialEnabled: boolean
}) {
  const [ads, setAds] = useState<AdRow[]>(initialAds)
  const [bannerOn, setBannerOn] = useState(initBanner)
  const [interstitialOn, setInterstitialOn] = useState(initInterstitial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const banners = ads.filter(a => a.ad_type === 'banner')
  const interstitials = ads.filter(a => a.ad_type === 'interstitial')

  const saveToggle = async (key: string, val: boolean) => {
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: String(val) }),
    }).catch(() => {})
  }

  const setActive = async (id: string) => {
    const target = ads.find(a => a.id === id)
    if (!target) return
    const newState = !target.is_active

    setBusyId(id); setError('')
    const res = await fetch('/api/admin/ads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: newState }),
    })
    setBusyId(null)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }

    // Turning one ON switches off all others of the same type — only one active per type
    setAds(prev => prev.map(a => {
      if (a.id === id) return { ...a, is_active: newState }
      if (newState && a.ad_type === target.ad_type) return { ...a, is_active: false }
      return a
    }))
  }

  const deleteAd = async (id: string) => {
    setBusyId(id); setError('')
    const res = await fetch('/api/admin/ads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setBusyId(null)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
    setAds(prev => prev.filter(a => a.id !== id))
  }

  const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mid)' }

  return (
    <div>
      <div style={{ padding: 'var(--space-4)', borderBottom: '2px solid var(--black)', background: 'var(--white)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>Admin</p>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>Ad Content Editor</h1>
      </div>

      {error && <div style={{ margin: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', border: '1px solid #b44', color: '#b44', fontSize: 'var(--text-xs)' }}>{error}</div>}

      {/* ── Banner Ads ──────────────────────────────────────────────── */}
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={eyebrow}>Banner Ad</p>
          <Toggle on={bannerOn} onChange={v => { setBannerOn(v); saveToggle('banner_ads_enabled', v) }} />
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', margin: 'var(--space-1) 0 var(--space-2)' }}>
          Appears at the top of all player screens.
        </p>
        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginBottom: 'var(--space-2)' }}>
          Optimal size: 860 × 120 px (wide leaderboard)
        </p>

        <UploadZone
          adType="banner"
          hint="JPG or PNG · Max 2MB"
          onUploaded={ad => setAds(prev => [ad, ...prev])}
        />

        <AdTable ads={banners} thumbHeight={30} onSetActive={setActive} onDelete={deleteAd} busyId={busyId} />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '0 var(--space-4)' }} />

      {/* ── Slide-Up Ad ─────────────────────────────────────────────── */}
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={eyebrow}>Slide-Up Ad</p>
          <Toggle on={interstitialOn} onChange={v => { setInterstitialOn(v); saveToggle('interstitial_ads_enabled', v) }} />
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--mid)', margin: 'var(--space-1) 0 var(--space-2)' }}>
          Slides up from the bottom on select screens.
        </p>
        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginBottom: 'var(--space-2)' }}>
          Optimal size: 860 × 600 px · Taller format recommended
        </p>

        <UploadZone
          adType="interstitial"
          hint="JPG or PNG · Max 2MB · Taller format recommended"
          onUploaded={ad => setAds(prev => [ad, ...prev])}
        />

        <AdTable ads={interstitials} thumbHeight={44} onSetActive={setActive} onDelete={deleteAd} busyId={busyId} />

        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--light)', marginTop: 'var(--space-2)' }}>
          Toggle above turns the slide-up on/off instantly. Image change applies immediately when toggled on.
        </p>
      </div>
    </div>
  )
}
