'use client'
import { useEffect } from 'react'

/**
 * Safety net: if a Supabase recovery email lands on the home page (because the
 * redirect allow-list stripped the /reset-pin path), the session tokens — or an
 * error like otp_expired — arrive in the URL fragment, which the server never
 * sees. Forward them to /reset-pin so the reset flow can complete.
 */
export function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.slice(1))
    const isRecovery = params.get('type') === 'recovery' && params.has('access_token')
    const isAuthError = params.has('error_code') || params.has('error_description')
    if (isRecovery || isAuthError) {
      window.location.replace(`/reset-pin${hash}`)
    }
  }, [])
  return null
}
