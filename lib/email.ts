import { Resend } from 'resend'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, userProfiles } from '@/db/schema/auth'
import {
  passwordResetEmailHtml,
  passwordResetEmailText,
} from './email/templates/password-reset'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — email sending is unavailable in this environment')
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

async function lookupUsername(email: string): Promise<string> {
  try {
    const rows = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .innerJoin(users, eq(users.id, userProfiles.userId))
      .where(eq(users.email, email))
      .limit(1)
    return rows[0]?.username ?? ''
  } catch {
    return ''
  }
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? 'Beehive Books <noreply@beehive-studio.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function brandedEmail(heading: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="background:#141414;color:#ffffff;font-family:Arial,sans-serif;margin:0;padding:32px;">
      <div style="max-width:520px;margin:0 auto;">
        <div style="font-size:24px;font-weight:700;color:#FFC300;margin-bottom:24px;">🐝 Beehive Books</div>
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
    subject: 'Verify your Beehive Books email',
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
  const username = await lookupUsername(email)
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your Beehive Books password',
    html: passwordResetEmailHtml({ url, username }),
    text: passwordResetEmailText({ url, username }),
  })
  if (error) throw new Error(`Failed to send email: ${error.message}`)
}

export async function sendSupportNotificationEmail(opts: {
  to: string
  fromEmail: string
  category: string
  subject: string
  message: string
  userId?: string | null
}) {
  const categoryLabel =
    opts.category === 'general'
      ? 'General question'
      : opts.category === 'technical'
        ? 'Technical support'
        : 'User feedback'

  const body = [
    `<strong>From:</strong> ${opts.fromEmail}`,
    opts.userId ? `<strong>User ID:</strong> ${opts.userId}` : null,
    `<strong>Category:</strong> ${categoryLabel}`,
    `<strong>Message:</strong><br/><pre style="white-space:pre-wrap;font-size:14px;">${opts.message}</pre>`,
  ]
    .filter(Boolean)
    .join('<br/><br/>')

  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to: opts.to,
      replyTo: opts.fromEmail,
      subject: `[Support] ${opts.subject}`,
      html: brandedEmail('New support message', body, 'View in admin', `${APP_URL}/admin/support`),
    })
    if (error) console.error('[support email] notification failed:', error.message)
  } catch (err) {
    console.error('[support email] notification threw:', err)
  }
}

export async function sendSupportResponseEmail(opts: {
  to: string
  subject: string
  adminResponse: string
}) {
  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to: opts.to,
      subject: `Re: ${opts.subject}`,
      html: brandedEmail(
        `Re: ${opts.subject}`,
        opts.adminResponse.replace(/\n/g, '<br/>'),
        'Visit Beehive Books',
        APP_URL,
      ),
    })
    if (error) console.error('[support email] response failed:', error.message)
  } catch (err) {
    console.error('[support email] response threw:', err)
  }
}

// APP_URL available for future use (e.g. constructing links server-side)
export { APP_URL }
