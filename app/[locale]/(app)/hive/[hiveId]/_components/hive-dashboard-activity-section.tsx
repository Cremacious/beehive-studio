import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Edit3,
  Highlighter,
  Link as LinkIcon,
  MessageCircle,
  MessagesSquare,
  Send,
  Sparkles,
  UserPlus,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { HiveSectionDivider } from './hive-section-divider'
import type { HiveActivityEvent } from '@/lib/actions/hive-activity.actions'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type EventMeta = {
  icon: LucideIcon
  accent: string
}

function getEventMeta(event: HiveActivityEvent): EventMeta {
  switch (event.type) {
    case 'member_joined':
      return { icon: UserPlus, accent: '--role-contributor' }
    case 'chapter_submitted':
      return { icon: Send, accent: '--status-warning' }
    case 'chapter_submitted_approved':
      return { icon: CheckCircle2, accent: '--status-success' }
    case 'chapter_submitted_rejected':
      return { icon: XCircle, accent: '--status-error' }
    case 'discussion_posted':
      return { icon: MessagesSquare, accent: '--role-moderator' }
    case 'annotation_added':
      return { icon: Highlighter, accent: '--status-first-draft' }
    case 'suggestion_proposed':
      return { icon: Edit3, accent: '--brand' }
    case 'suggestion_accepted':
      return { icon: Check, accent: '--status-success' }
    case 'suggestion_rejected':
      return { icon: X, accent: '--status-error' }
    case 'buzz_posted': {
      const p = event.payload as { type?: unknown } | null
      if (p && typeof p === 'object' && p.type === 'LINK') {
        return { icon: LinkIcon, accent: '--goal-daily' }
      }
      return { icon: MessageCircle, accent: '--goal-daily' }
    }
    default:
      return { icon: Sparkles, accent: '--canvas-dark-ink-muted' }
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

function readPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object') return null
  const v = (payload as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : null
}

function renderVerb(event: HiveActivityEvent): React.ReactNode {
  const handle = event.actorUsername ? `@${event.actorUsername}` : 'Someone'
  const actor = <b>{handle}</b>

  switch (event.type) {
    case 'member_joined':
      return (
        <>
          {actor} joined the hive
        </>
      )
    case 'chapter_submitted': {
      const title = readPayloadString(event.payload, 'title') ?? '(untitled)'
      return (
        <>
          {actor} submitted <b>&ldquo;{truncate(title, 50)}&rdquo;</b> for review
        </>
      )
    }
    case 'chapter_submitted_approved': {
      const title = readPayloadString(event.payload, 'title') ?? '(untitled)'
      return (
        <>
          {actor} approved <b>&ldquo;{truncate(title, 50)}&rdquo;</b>
        </>
      )
    }
    case 'chapter_submitted_rejected': {
      const title = readPayloadString(event.payload, 'title') ?? '(untitled)'
      return (
        <>
          {actor} rejected <b>&ldquo;{truncate(title, 50)}&rdquo;</b>
        </>
      )
    }
    case 'discussion_posted': {
      const topic = readPayloadString(event.payload, 'topic')
      const title = readPayloadString(event.payload, 'title') ?? readPayloadString(event.payload, 'titleExcerpt') ?? ''
      return (
        <>
          {actor} started a discussion{topic ? <> in {topic}</> : null}
          {title ? (
            <>
              : <b>&ldquo;{truncate(title, 50)}&rdquo;</b>
            </>
          ) : null}
        </>
      )
    }
    case 'annotation_added': {
      const chapterTitle = readPayloadString(event.payload, 'chapterTitle') ?? 'a chapter'
      const layer = readPayloadString(event.payload, 'layer')
      return (
        <>
          {actor} annotated <b>{chapterTitle}</b>
          {layer ? <> ({layer})</> : null}
        </>
      )
    }
    case 'suggestion_proposed': {
      const chapterTitle = readPayloadString(event.payload, 'chapterTitle') ?? 'a chapter'
      return (
        <>
          {actor} suggested an edit on <b>{chapterTitle}</b>
        </>
      )
    }
    case 'suggestion_accepted': {
      const chapterTitle = readPayloadString(event.payload, 'chapterTitle') ?? 'a chapter'
      return (
        <>
          {actor} accepted a suggestion on <b>{chapterTitle}</b>
        </>
      )
    }
    case 'suggestion_rejected': {
      const chapterTitle = readPayloadString(event.payload, 'chapterTitle') ?? 'a chapter'
      return (
        <>
          {actor} dismissed a suggestion on <b>{chapterTitle}</b>
        </>
      )
    }
    case 'buzz_posted': {
      const p = event.payload as { type?: unknown; bodyExcerpt?: unknown; linkUrl?: unknown } | null
      if (p && typeof p === 'object') {
        if (p.type === 'LINK' && typeof p.linkUrl === 'string') {
          let host = '(link)'
          try {
            host = new URL(p.linkUrl).hostname
          } catch {
            // fallback
          }
          return (
            <>
              {actor} shared a link to <b>{host}</b>
            </>
          )
        }
        if (p.type === 'TEXT' && typeof p.bodyExcerpt === 'string') {
          return (
            <>
              {actor} posted: <b>&ldquo;{truncate(p.bodyExcerpt, 60)}&rdquo;</b>
            </>
          )
        }
      }
      return <>{actor} posted to the buzz board</>
    }
    default:
      return <>{actor} made an update</>
  }
}

function ActivityRow({
  event,
  locale,
}: {
  event: HiveActivityEvent
  locale: string
}) {
  const { icon: Icon, accent } = getEventMeta(event)
  const initial = event.actorUsername?.[0]?.toUpperCase() ?? '?'

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--r-row)]"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        padding: '12px 14px',
      }}
    >
      {/* Actor avatar */}
      {event.actorUsername ? (
        <Link
          href={`/${locale}/u/${event.actorUsername}`}
          className="shrink-0"
          aria-label={`@${event.actorUsername}`}
        >
          {event.actorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.actorAvatarUrl}
              alt=""
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background: 'var(--canvas-dark-200)',
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              {initial}
            </span>
          )}
        </Link>
      ) : (
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{
            background: 'var(--canvas-dark-200)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {initial}
        </span>
      )}

      {/* Event-type icon chip */}
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: `oklch(from var(${accent}) l c h / 0.14)`,
          color: `var(${accent})`,
        }}
        aria-hidden="true"
      >
        <Icon className="w-3.5 h-3.5" />
      </span>

      {/* Verb sentence */}
      <span
        className="flex-1 min-w-0 truncate text-[13px]"
        style={{ color: 'var(--canvas-dark-ink)' }}
      >
        {renderVerb(event)}
      </span>

      {/* Relative time */}
      <span
        className="font-mono text-[11px] uppercase tracking-wider shrink-0"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {relTime(event.createdAt)}
      </span>
    </div>
  )
}

export type HiveDashboardActivitySectionProps = {
  events: HiveActivityEvent[]
  hiveId: string
  locale: string
}

export function HiveDashboardActivitySection({
  events,
  hiveId,
  locale,
}: HiveDashboardActivitySectionProps) {
  return (
    <HiveSectionDivider label="Recent activity">
      {events.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <span
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{
              background: 'var(--canvas-dark-200)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <Sparkles className="w-5 h-5" />
          </span>
          <p
            className="text-sm max-w-sm"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            No activity yet. Invite members or post something on the Buzz Board to
            get started.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <ActivityRow key={event.id} event={event} locale={locale} />
            ))}
          </div>
          <Link
            href={`/${locale}/community?hive=${hiveId}`}
            className="inline-flex items-center gap-1.5 mt-3 font-mono text-[12px] uppercase tracking-wider transition-colors"
            style={{ color: 'var(--brand)' }}
          >
            View all activity
            <ArrowRight className="w-3 h-3" />
          </Link>
        </>
      )}
    </HiveSectionDivider>
  )
}
