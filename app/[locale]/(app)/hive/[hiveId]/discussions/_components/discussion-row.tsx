'use client'

import Link from 'next/link'
import type { DiscussionPostSummary } from '@/lib/actions/hive-discussions.actions'
import type { DiscussionTopic } from '@/lib/validations/hive-discussion'
import { HivePill } from '../../_components/hive-pill'

function relTime(d: Date | string): string {
  const date = new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Topic → CSS-var token. Reuses existing --wiki-* tokens since the codebase
// has no dedicated --topic-* family yet.
export const TOPIC_META: Record<DiscussionTopic, { label: string; tokenVar: string }> = {
  GENERAL: { label: 'General', tokenVar: '--wiki-other' },
  WORLDBUILDING: { label: 'Worldbuilding', tokenVar: '--wiki-lore' },
  FEEDBACK: { label: 'Feedback', tokenVar: '--wiki-theme' },
  OFF_TOPIC: { label: 'Off-topic', tokenVar: '--wiki-terminology' },
}

export function TopicPill({ topic }: { topic: DiscussionTopic }) {
  const meta = TOPIC_META[topic]
  return <HivePill token={meta.tokenVar}>{meta.label}</HivePill>
}

export function DiscussionRow({
  row,
  hiveId,
  locale,
}: {
  row: DiscussionPostSummary
  hiveId: string
  locale: string
}) {
  // Derive title from first line. The body remainder is intentionally NOT
  // shown in the list — the row only carries title + author + counts so it
  // reads like a forum index. Click through to see the full body.
  const firstLine = row.bodyExcerpt.split('\n')[0] ?? ''
  const title = (row.title || firstLine).slice(0, 80) || 'Untitled'

  return (
    <Link
      href={`/${locale}/hive/${hiveId}/discussions/${row.id}`}
      className="grid grid-cols-[1fr_90px_130px] max-md:grid-cols-1 max-md:gap-1.5 items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--canvas-dark-300)]"
    >
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <TopicPill topic={row.topic} />
          <h3 className="font-comfortaa font-semibold text-[15px] truncate text-[var(--canvas-dark-ink-strong)]">
            {title}
          </h3>
        </div>
        {row.username && (
          <p
            className="text-[11px] font-mono text-[var(--canvas-dark-ink-muted)]"
            style={{ letterSpacing: '0.04em' }}
          >
            started by{' '}
            <span className="text-[var(--canvas-dark-ink)] font-medium">
              @{row.username}
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-col items-center justify-center text-center">
        <div className="font-comfortaa font-bold text-[18px] text-[var(--canvas-dark-ink-strong)] leading-none">
          {row.replyCount}
        </div>
        <div
          className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mt-1"
          style={{ letterSpacing: '0.12em' }}
        >
          replies
        </div>
      </div>

      <p
        className="text-[11px] font-mono text-right self-center text-[var(--canvas-dark-ink-muted)]"
        style={{ letterSpacing: '0.04em' }}
      >
        {relTime(row.lastActivityAt)}
      </p>
    </Link>
  )
}
