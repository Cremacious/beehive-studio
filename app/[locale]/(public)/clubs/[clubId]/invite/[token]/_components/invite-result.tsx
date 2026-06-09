import Link from 'next/link'
import { Lock, Users, AlertCircle, Clock, Check, UserX } from 'lucide-react'

type Props = {
  kind: 'error'
  code: string
  locale: string
  clubId: string
}

type Tone = 'error' | 'warning' | 'muted' | 'success'

const ERROR_COPY: Record<
  string,
  { title: string; body: string; tone: Tone; Icon: typeof AlertCircle }
> = {
  TOKEN_NOT_FOUND: {
    title: 'Invite not found',
    body: "This club invite isn't valid. Ask a member for a new link.",
    tone: 'error',
    Icon: AlertCircle,
  },
  TOKEN_EXPIRED: {
    title: 'This invite expired',
    body: 'Club invite links last 14 days. Ask for a fresh one.',
    tone: 'warning',
    Icon: Clock,
  },
  TOKEN_ALREADY_CLAIMED: {
    title: 'Already claimed',
    body: 'This invite has already been used to join.',
    tone: 'muted',
    Icon: Check,
  },
  SELF_INVITE: {
    title: "That's your own invite",
    body: "You can't accept an invite to a club you run.",
    tone: 'warning',
    Icon: UserX,
  },
  INVALID_INPUT: {
    title: 'Malformed link',
    body: 'This invite link is malformed.',
    tone: 'error',
    Icon: AlertCircle,
  },
}

export function InviteResult(props: Props) {
  const { code, locale } = props
  // BLOCKED masquerades as TOKEN_NOT_FOUND so block existence isn't revealed.
  const effectiveCode = code === 'BLOCKED' ? 'TOKEN_NOT_FOUND' : code
  const copy =
    ERROR_COPY[effectiveCode] ?? {
      title: 'Something went wrong',
      body: "We couldn't process this invite. Please try again.",
      tone: 'error' as Tone,
      Icon: AlertCircle,
    }
  const { Icon } = copy

  return (
    <div className="claim-stage">
      <div className="claim-card">
        <div className={`icon-wrap tone-${copy.tone}`}>
          <Icon />
        </div>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <div className="actions">
          <Link className="btn-brand" href={`/${locale}/clubs`}>
            Back to Clubs
          </Link>
        </div>
      </div>
    </div>
  )
}

// Keep imports referenced for potential future tone variants.
void Lock
void Users
