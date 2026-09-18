import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/ui/Topbar'
import { AccountForm } from './AccountForm'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account')

  const admin = await createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, email, first_name, last_name, display_name, phone, is_admin, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
  })

  return (
    <div className="screen">
      <Topbar backHref="/home" showMenu isLoggedIn isAdmin={profile.is_admin} />

      <div className="screen-body">
        <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>Account</p>
        <h1 className="headline" style={{ marginBottom: 'var(--space-1)' }}>
          {profile.display_name ?? profile.first_name}
        </h1>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--light)', marginBottom: 'var(--space-6)' }}>
          Member since {joinDate}
          {profile.is_admin && (
            <span style={{
              marginLeft: 'var(--space-2)',
              background: 'var(--black)',
              color: 'var(--white)',
              fontSize: 'var(--text-2xs)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '1px 5px',
            }}>
              Admin
            </span>
          )}
        </p>

        <AccountForm
          initialData={{
            email: profile.email,
            name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
            displayName: profile.display_name ?? '',
            phone: profile.phone ?? '',
          }}
        />
      </div>

      <div className="app-footer">uwwordchain.org</div>
    </div>
  )
}
