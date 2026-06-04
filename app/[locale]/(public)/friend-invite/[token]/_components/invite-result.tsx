import Link from 'next/link'
import { Lock, Users, AlertCircle } from 'lucide-react'

type Props =
  | { kind: 'error'; code: string; locale: string }
  | { kind: 'success'; success: 'already_friends' | 'accepted'; locale: string }

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  TOKEN_NOT_FOUND: {
    title: 'Invite not found',
    body: "This invite link doesn't exist.",
  },
  TOKEN_EXPIRED: {
    title: 'Invite expired',
    body: 'This invite link expired.',
  },
  TOKEN_ALREADY_CLAIMED: {
    title: 'Invite already used',
    body: 'This invite link has already been used.',
  },
  SELF_INVITE: {
    title: "That's your invite",
    body: "You can't claim your own invite.",
  },
  BLOCKED: {
    title: 'Cannot accept',
    body: "This invite can't be accepted right now.",
  },
  INVALID_INPUT: {
    title: 'Malformed link',
    body: 'This invite link is malformed.',
  },
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{ background: '#262728' }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="max-w-md w-full p-8 text-center"
      >
        {children}
      </div>
    </main>
  )
}

export function InviteResult(props: Props) {
  const { kind, locale } = props

  if (kind === 'error') {
    const copy = ERROR_COPY[props.code] ?? {
      title: 'Something went wrong',
      body: "We couldn't process this invite. Please try again.",
    }
    const Icon = props.code === 'TOKEN_NOT_FOUND' || props.code === 'INVALID_INPUT' ? AlertCircle : Lock
    return (
      <PanelShell>
        <Icon className="w-10 h-10 mx-auto mb-4 text-[var(--destructive)]" />
        <h1 style={{ color: 'var(--destructive)' }} className="font-comfortaa font-bold text-xl mb-2">
          {copy.title}
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">{copy.body}</p>
        <Link
          href={`/${locale}/discover`}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--sh-tile)',
          }}
          className="inline-block font-geist font-semibold text-sm px-5 py-2.5"
        >
          Back to Discover
        </Link>
      </PanelShell>
    )
  }

  const title = props.success === 'already_friends' ? "You're already friends!" : 'Friend request accepted.'
  const body =
    props.success === 'already_friends'
      ? 'You can find this writer on Discover or in your friends list.'
      : "You're connected. Find new writers on Discover."

  return (
    <PanelShell>
      <Users className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--brand)' }} />
      <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-xl mb-2">
        {title}
      </h1>
      <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">{body}</p>
      <Link
        href={`/${locale}/discover`}
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-tile)',
        }}
        className="inline-block font-geist font-semibold text-sm px-5 py-2.5"
      >
        Discover writers
      </Link>
    </PanelShell>
  )
}
