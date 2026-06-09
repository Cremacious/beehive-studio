import Link from 'next/link'
import { Lock, Users, AlertCircle, UserPlus, Clock, Check, UserX } from 'lucide-react'

type Props =
  | { kind: 'error'; code: string; locale: string }
  | { kind: 'success'; success: 'already_friends' | 'accepted'; locale: string }

type Tone = 'error' | 'warning' | 'muted' | 'success'

const ERROR_COPY: Record<
  string,
  { title: string; body: string; tone: Tone; Icon: typeof AlertCircle }
> = {
  TOKEN_NOT_FOUND: {
    title: 'Invite not found',
    body: "This invite link isn't valid. Double-check it or ask for a new one.",
    tone: 'error',
    Icon: AlertCircle,
  },
  TOKEN_EXPIRED: {
    title: 'This invite expired',
    body: 'Invite links last 14 days. Ask your friend to send a fresh one.',
    tone: 'warning',
    Icon: Clock,
  },
  TOKEN_ALREADY_CLAIMED: {
    title: 'Already claimed',
    body: "This invite has already been used and can't be claimed again.",
    tone: 'muted',
    Icon: Check,
  },
  SELF_INVITE: {
    title: "That's your own invite",
    body: "You can't accept an invite you created. Share it with a friend instead.",
    tone: 'warning',
    Icon: UserX,
  },
  BLOCKED: {
    // BLOCKED masquerades as TOKEN_NOT_FOUND visually so block existence isn't revealed.
    title: 'Invite not found',
    body: "This invite link isn't valid. Double-check it or ask for a new one.",
    tone: 'error',
    Icon: AlertCircle,
  },
  INVALID_INPUT: {
    title: 'Malformed link',
    body: 'This invite link is malformed.',
    tone: 'error',
    Icon: AlertCircle,
  },
}

export function InviteResult(props: Props) {
  const { kind, locale } = props

  if (kind === 'error') {
    const copy =
      ERROR_COPY[props.code] ?? {
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
            <Link className="btn-brand" href={`/${locale}/discover`}>
              Back to Discover
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isAlready = props.success === 'already_friends'
  const title = isAlready ? 'Already friends' : 'Friend request accepted'
  const body = isAlready
    ? 'You and this person are already connected. Nothing to do here!'
    : "You're connected. Find new writers on Discover."
  const Icon = isAlready ? Users : UserPlus

  return (
    <div className="claim-stage">
      <div className="claim-card">
        <div className="icon-wrap tone-success">
          <Icon />
        </div>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="actions">
          <Link className="btn-brand" href={`/${locale}/discover`}>
            Discover writers
          </Link>
        </div>
      </div>
    </div>
  )
}

// Keep Lock import referenced for potential future tone-muted lock state.
void Lock
