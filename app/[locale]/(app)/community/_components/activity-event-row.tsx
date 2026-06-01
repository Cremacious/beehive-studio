import Link from 'next/link'
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

const VERB: Record<string, string> = {
  chapter_submitted: 'submitted a chapter',
  chapter_submitted_approved: 'had a chapter approved',
  chapter_submitted_rejected: 'had a chapter sent back for revision',
  annotation_added: 'left an annotation',
  suggestion_proposed: 'proposed a suggestion',
  suggestion_accepted: 'had a suggestion accepted',
  suggestion_rejected: 'had a suggestion declined',
  buzz_posted: 'posted a buzz',
  discussion_posted: 'posted in discussion',
  member_joined: 'joined the hive',
}

// Activity payload shape (set by createBuzzPostAction):
//   { type: 'TEXT' | 'LINK', bodyExcerpt: string, linkUrl: string | null }
function buzzVerb(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return VERB.buzz_posted
  const p = payload as { type?: unknown; bodyExcerpt?: unknown; linkUrl?: unknown }
  if (p.type === 'LINK' && typeof p.linkUrl === 'string') {
    try {
      const host = new URL(p.linkUrl).hostname
      return `shared a link to ${host}`
    } catch {
      return 'shared a link'
    }
  }
  if (p.type === 'TEXT' && typeof p.bodyExcerpt === 'string') {
    const excerpt = p.bodyExcerpt.length > 80 ? `${p.bodyExcerpt.slice(0, 80)}...` : p.bodyExcerpt
    return `posted: '${excerpt}'`
  }
  return VERB.buzz_posted
}

export function ActivityEventRow({ event, locale }: { event: HiveActivityEvent; locale: string }) {
  const verb = event.type === 'buzz_posted' ? buzzVerb(event.payload) : (VERB[event.type] ?? 'made an update')
  const handle = event.actorUsername ? `@${event.actorUsername}` : 'Someone'
  const initial = event.actorUsername?.[0]?.toUpperCase() ?? '?'

  return (
    <article className="bg-card border border-border rounded-lg p-4 flex gap-3">
      {event.actorUsername ? (
        <Link href={`/${locale}/u/${event.actorUsername}`} className="shrink-0">
          {event.actorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.actorAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[11px] font-bold text-brand">
              {initial}
            </span>
          )}
        </Link>
      ) : (
        <span className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[11px] font-bold text-brand shrink-0">
          {initial}
        </span>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="truncate">
            {event.actorUsername ? (
              <Link
                href={`/${locale}/u/${event.actorUsername}`}
                className="text-foreground font-medium hover:text-brand"
              >
                {handle}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{handle}</span>
            )}
            <span className="text-muted-foreground"> {verb} in </span>
            <Link
              href={`/${locale}/hive/${event.hiveId}`}
              className="text-foreground font-medium hover:text-brand"
            >
              {event.hiveName}
            </Link>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{relTime(event.createdAt)}</span>
        </div>
      </div>
    </article>
  )
}
