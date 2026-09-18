'use client'
import { useState } from 'react'

interface MenuOverlayProps {
  isOpen: boolean
  onClose: () => void
  isLoggedIn: boolean
  isAdmin?: boolean
}

const ADMIN_LINKS = [
  { href: '/admin/words',   label: 'Word Queue' },
  { href: '/admin/chains',  label: 'Chains' },
  { href: '/admin/graphic', label: 'Daily Graphic' },
  { href: '/admin/ads',     label: 'Ads' },
  { href: '/admin/players', label: 'Players' },
]

// TEMPORARY — quick links to screens normally reachable only via invite
// links or specific states. Remove this section before launch.
// Each /test/* link mints a FRESH invite token on every click,
// so these never go stale or show "link has been used."
const TESTING_LINKS = [
  { href: '/test/start', label: 'Play — start of chain' },
  { href: '/test/mid',   label: 'Play — mid-chain' },
  { href: '/test/used',  label: 'Play — used link' },
  { href: '/signup',     label: 'Sign up' },
  { href: '/login',      label: 'Log in' },
  { href: '/reset-pin',  label: 'Reset PIN' },
]

export function MenuOverlay({ isOpen, onClose, isLoggedIn, isAdmin = false }: MenuOverlayProps) {
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/home'
    } catch {
      setLoggingOut(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'relative',
          width: '80%',
          maxWidth: 300,
          height: '100%',
          background: 'var(--white)',
          borderLeft: '2px solid var(--black)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drawer header with close button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>
            UW WordChain
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-2xl)',
              lineHeight: 1,
              color: 'var(--black)',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2) 0' }}>
          {/* Always visible */}
          <NavLink href="/home" onClick={onClose}>Home</NavLink>

          {/* Logged-in only */}
          {isLoggedIn && (
            <>
              <NavLink href="/account" onClick={onClose}>My Account</NavLink>
              <NavDivider />
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--text-body)',
                  fontWeight: 700,
                  color: '#cc0000',
                  background: 'none',
                  border: 'none',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  fontFamily: 'Space Mono, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  opacity: loggingOut ? 0.5 : 1,
                }}
              >
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </>
          )}

          {/* Not logged in */}
          {!isLoggedIn && (
            <>
              <NavLink href="/signup" onClick={onClose}>Sign up</NavLink>
              <NavLink href="/login" onClick={onClose}>Log in</NavLink>
            </>
          )}

          {/* Admin section */}
          {isAdmin && (
            <>
              <NavDivider label="Admin" />
              {ADMIN_LINKS.map(link => (
                <NavLink key={link.href} href={link.href} onClick={onClose} dim>
                  {link.label}
                </NavLink>
              ))}
            </>
          )}

          {/* TEMPORARY testing section — remove before launch */}
          <NavDivider label="Testing" />
          {TESTING_LINKS.map(link => (
            <NavLink key={link.href} href={link.href} onClick={onClose} dim>
              {link.label}
            </NavLink>
          ))}
          <p style={{
            padding: 'var(--space-1) var(--space-4)',
            fontSize: 'var(--text-2xs)',
            color: 'var(--light)',
            lineHeight: 1.5,
          }}>
            Play screens show the new-user view when logged out and the
            player view when logged in — log out to test both.
          </p>
        </nav>

        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--light)' }}>uwwordchain.org</div>
        </div>
      </div>
    </div>
  )
}

function NavLink({ href, onClick, children, dim }: {
  href: string
  onClick: () => void
  children: React.ReactNode
  dim?: boolean
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      style={{
        display: 'block',
        padding: 'var(--space-3) var(--space-4)',
        fontSize: 'var(--text-body)',
        fontWeight: 700,
        color: dim ? 'var(--mid)' : 'var(--black)',
        textDecoration: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </a>
  )
}

function NavDivider({ label }: { label?: string }) {
  return (
    <div style={{
      padding: 'var(--space-2) var(--space-4) var(--space-1)',
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--light)',
      borderTop: '1px solid var(--border-light)',
      marginTop: 'var(--space-1)',
    }}>
      {label ?? ''}
    </div>
  )
}
