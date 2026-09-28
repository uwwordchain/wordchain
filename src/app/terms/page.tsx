import { Topbar } from '@/components/ui/Topbar'

export const metadata = { title: 'Terms of Service — UW WordChain' }

const H2: React.CSSProperties = { fontSize: 'var(--text-base)', fontWeight: 700, margin: 'var(--space-5) 0 var(--space-2)' }
const P: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--mid)', lineHeight: 1.7, marginBottom: 'var(--space-3)' }

export default function TermsPage() {
  return (
    <div className="screen">
      <Topbar />
      <div style={{ padding: 'var(--space-4)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Last updated: September 28, 2026</p>
        <h1 className="headline" style={{ marginBottom: 'var(--space-4)' }}>Terms of Service</h1>

        <p style={P}>
          UW WordChain is a free daily community word game operated with The Wisco Project. By
          creating an account or playing, you agree to these terms.
        </p>

        <h2 style={H2}>The game</h2>
        <p style={P}>
          Each day, selected players receive a link to add a word to a chain and pass it on. Play is
          free. We may change, pause, or discontinue the game at any time.
        </p>

        <h2 style={H2}>Your account</h2>
        <p style={P}>
          You must provide accurate information and keep your PIN private. You are responsible for
          activity on your account. We may remove accounts or content that disrupt the game, are
          abusive, or violate these terms.
        </p>

        <h2 style={H2}>Conduct</h2>
        <p style={P}>
          Submitted words appear publicly next to your display name. Don&rsquo;t submit offensive words,
          impersonate others, use automation to play, or attempt to disrupt the service.
        </p>

        <h2 style={H2}>Text messages</h2>
        <p style={P}>
          If you opt in, we send game notification texts (about 0–3 per day on days you are involved).
          Message and data rates may apply. Reply STOP to opt out, HELP for help. See our{' '}
          <a href="/privacy" style={{ color: 'var(--black)' }}>Privacy Policy</a> for details.
        </p>

        <h2 style={H2}>Disclaimer</h2>
        <p style={P}>
          The service is provided &ldquo;as is,&rdquo; without warranties of any kind. To the fullest extent
          permitted by law, we are not liable for any damages arising from your use of the service.
        </p>

        <h2 style={H2}>Contact</h2>
        <p style={P}>Questions about these terms: wordchain@wiscoproject.org.</p>
      </div>
      <div className="app-footer">uwwordchain.app</div>
    </div>
  )
}
