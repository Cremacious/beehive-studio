import Link from 'next/link'
import { Lock, Users, AlertCircle } from 'lucide-react'

type Props = {
  kind: 'error'
  code: string
  locale: string
  clubId: string
}

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  TOKEN_NOT_FOUND: {
    title: 'Invite not found',
    body: "This invite link doesn't exist. It may be invalid or revoked.",
  },
  TOKEN_EXPIRED: {
    title: 'Invite expired',
    body: 'This invite link expired. Ask the club owner for a new one.',
  },
  TOKEN_ALREADY_CLAIMED: {
    title: 'Invite already used',
    body: 'This invite link has already been used.',
  },
  SELF_INVITE: {
    title: "That's your invite",
    body: "You can't claim your own invite.",
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
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
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
  const { code, locale } = props
  // BLOCKED masquerades as TOKEN_NOT_FOUND so block existence isn't revealed.
  const effectiveCode = code === 'BLOCKED' ? 'TOKEN_NOT_FOUND' : code
  const copy = ERROR_COPY[effectiveCode] ?? {
    title: 'Something went wrong',
    body: "We couldn't process this invite. Please try again.",
  }
  const Icon =
    effectiveCode === 'TOKEN_NOT_FOUND' || effectiveCode === 'INVALID_INPUT'
      ? AlertCircle
      : effectiveCode === 'SELF_INVITE'
        ? Users
        : Lock

  return (
    <PanelShell>
      <Icon
        className="w-10 h-10 mx-auto mb-4 text-[var(--destructive)]"
      />
      <h1
        style={{ color: 'var(--destructive)' }}
        className="font-comfortaa font-bold text-xl mb-2"
      >
        {copy.title}
      </h1>
      <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">
        {copy.body}
      </p>
      <Link
        href={`/${locale}/clubs`}
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-tile)',
        }}
        className="inline-block font-geist font-semibold text-sm px-5 py-2.5"
      >
        Back to Clubs
      </Link>
    </PanelShell>
  )
}
