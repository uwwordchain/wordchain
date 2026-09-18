'use client'
import { useState } from 'react'
import { MenuOverlay } from '@/components/player/MenuOverlay'

interface TopbarProps {
  showLogin?: boolean
  loginHref?: string
  /** The menu is available on every screen by default */
  showMenu?: boolean
  isLoggedIn?: boolean
  isAdmin?: boolean
  backHref?: string
  /** Optional text title (e.g. "Admin Panel"); defaults to the logo */
  title?: string
}

export function Topbar({
  showLogin,
  loginHref = '/login',
  showMenu = true,
  isLoggedIn = false,
  isAdmin = false,
  backHref,
  title,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <MenuOverlay
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />

      <div className="topbar">
        {backHref && (
          <a href={backHref} className="topbar__back">←</a>
        )}

        {title ? (
          <span className="topbar__title">{title}</span>
        ) : (
          <a href="/home" className="topbar__title" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="UW WordChain"
              style={{ height: '1.5rem', width: 'auto', display: 'block' }}
            />
          </a>
        )}

        {showLogin && !isLoggedIn && (
          <a href={loginHref} className="topbar__login">Log in</a>
        )}
        {showMenu && (
          <button
            className="topbar__menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            ≡
          </button>
        )}
      </div>
    </>
  )
}
