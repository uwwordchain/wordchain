export interface EmailAttachment {
  filename: string
  /** base64-encoded file content */
  content: string
  /** set to reference the attachment inline in HTML via <img src="cid:..."> */
  content_id?: string
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string | string[]
  subject: string
  html: string
  attachments?: EmailAttachment[]
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.log(`[EMAIL STUB — set RESEND_API_KEY to send] To: ${to}\nSubject: ${subject}`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Until the uwwordchain.org domain is verified in Resend, the default
      // onboarding@resend.dev sender works out of the box (test mode: it can
      // only deliver to the Resend account owner's email address).
      from: process.env.EMAIL_FROM || 'UW WordChain <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments?.length ? { attachments } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`Resend error (${res.status}): ${err}`)
  }
}

export function buildPinResetEmail(pin: string): string {
  return `<p>Your new WordChain PIN is: <strong>${pin}</strong></p><p>This PIN expires in 15 minutes.</p>`
}
