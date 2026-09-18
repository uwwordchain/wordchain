'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'Words', href: '/admin/words', icon: '◆' },
  { label: 'Chains', href: '/admin/chains', icon: '⬡' },
  { label: 'Graphic', href: '/admin/graphic', icon: '▣' },
  { label: 'Ads', href: '/admin/ads', icon: '◈' },
  { label: 'Players', href: '/admin/players', icon: '◉' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        width: '100%',
        background: 'var(--white)',
        borderTop: '2px solid var(--black)',
        display: 'flex',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px 12px',
              textDecoration: 'none',
              background: active ? 'var(--black)' : 'transparent',
              color: active ? 'var(--white)' : 'var(--mid)',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: 14, marginBottom: 2 }}>{item.icon}</span>
            <span style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontFamily: 'Space Mono, monospace',
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
