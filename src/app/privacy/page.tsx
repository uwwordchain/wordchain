import { Topbar } from '@/components/ui/Topbar'

export const metadata = { title: 'Privacy Policy — UW WordChain' }

const H2: React.CSSProperties = { fontSize: 'var(--text-base)', fontWeight: 700, margin: 'var(--space-5) 0 var(--space-2)' }
const P: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--mid)', lineHeight: 1.7, marginBottom: 'var(--space-3)' }

export default function PrivacyPage() {
  return (
    <div className="screen">
      <Topbar />
      <div style={{ padding: 'var(--space-4)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Last updated: September 28, 2026</p>
        <h1 className="headline" style={{ marginBottom: 'var(--space-4)' }}>Privacy Policy</h1>

        <p style={P}>
          UW WordChain (&ldquo;we&rdquo;) is a free community word game operated with The Wisco Project.
          This policy describes what we collect and how we use it.
        </p>

        <h2 style={H2}>What we collect</h2>
        <p style={P}>
          When you create an account we collect your name, email address, an optional display name,
          and an optional mobile phone number. As you play, we store the words you submit and your
          participation in game chains.
        </p>

        <h2 style={H2}>How we use it</h2>
        <p style={P}>
          Your email is used to sign in and for account messages (such as PIN resets). If you opt in,
          your phone number is used solely to send UW WordChain game notification texts: selection
          notifications with a play link, occasional game reminders, and winner announcements —
          approximately 0–3 messages per day, only on days you are involved. Your display name (or
          first name) appears next to words you submit.
        </p>

        <h2 style={H2}>Text messaging &amp; consent</h2>
        <p style={P}>
          Game texts are sent only if you check the SMS consent box at signup. Consent is not a
          condition of using the service. Reply STOP to any message to opt out, or HELP for help.
          Message and data rates may apply. No mobile information will be shared with third
          parties or affiliates for marketing or promotional purposes.
        </p>

        <h2 style={H2}>Sharing</h2>
        <p style={P}>
          We do not sell or share your personal information with third parties. Data is stored with
          our infrastructure providers (Supabase, Vercel) and messages are delivered via Twilio (SMS)
          and Resend (email) solely to operate the game.
        </p>

        <h2 style={H2}>Deletion &amp; contact</h2>
        <p style={P}>
          You can delete your account from the Account page at any time, which removes your personal
          information. Questions or requests: wordchain@wiscoproject.org.
        </p>
      </div>
      <div className="app-footer">uwwordchain.app</div>
    </div>
  )
}
