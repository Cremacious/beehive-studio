import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — email sending is unavailable in this environment')
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = 'Beehive Studio <noreply@beehive-studio.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function brandedEmail(heading: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="background:#141414;color:#ffffff;font-family:Arial,sans-serif;margin:0;padding:32px;">
      <div style="max-width:520px;margin:0 auto;">
        <div style="font-size:24px;font-weight:700;color:#FFC300;margin-bottom:24px;">🐝 Beehive Studio</div>
        <h1 style="font-size:22px;font-weight:700;margin-bottom:12px;">${heading}</h1>
        <p style="color:#cccccc;line-height:1.6;margin-bottom:24px;">${body}</p>
        <a href="${ctaUrl}"
           style="display:inline-block;background:#FFC300;color:#000000;font-weight:700;
                  text-decoration:none;padding:12px 24px;border-radius:9999px;">
          ${ctaLabel}
        </a>
        <p style="color:#555555;font-size:12px;margin-top:32px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `
}

export async function sendVerificationEmail(email: string, url: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your Beehive Studio email',
    html: brandedEmail(
      'Verify your email',
      'Click the button below to verify your email address and start writing.',
      'Verify email',
      url,
    ),
  })
  if (error) throw new Error(`Failed to send email: ${error.message}`)
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your Beehive Studio password',
    html: brandedEmail(
      'Reset your password',
      'Click the button below to reset your password. This link expires in 1 hour.',
      'Reset password',
      url,
    ),
  })
  if (error) throw new Error(`Failed to send email: ${error.message}`)
}

// APP_URL available for future use (e.g. constructing links server-side)
export { APP_URL }
