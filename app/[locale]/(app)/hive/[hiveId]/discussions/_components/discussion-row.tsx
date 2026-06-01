'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import type { DiscussionPostSummary } from '@/lib/actions/hive-discussions.actions'
import type { DiscussionTopic } from '@/lib/validations/hive-discussion'

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

export const TOPIC_META: Record<DiscussionTopic, { label: string; tokenVar: string }> = {
  GENERAL: { label: 'General', tokenVar: '--wiki-other' },
  WORLDBUILDING: { label: 'Worldbuilding', tokenVar: '--wiki-lore' },
  FEEDBACK: { label: 'Feedback', tokenVar: '--wiki-theme' },
  OFF_TOPIC: { label: 'Off-topic', tokenVar: '--wiki-terminology' },
}

export function TopicPill({ topic }: { topic: DiscussionTopic }) {
  const meta = TOPIC_META[topic]
  const color = `var(${meta.tokenVar}, var(--color-brand))`
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0"
      style={{
        color,
        background: `oklch(from ${color} l c h / 0.14)`,
      }}
    >
      {meta.label}
    </span>
  )
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
  // Title = first 80 chars (already derived server-side); excerpt = next ~120
  const excerpt = row.bodyExcerpt.slice(row.title.length, row.title.length + 120).trim()

  return (
    <Link
      href={`/${locale}/hive/${hiveId}/discussions/${row.id}`}
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
      }}
      className="flex items-start gap-3 px-4 py-3 hover:-translate-y-px transition-transform"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--canvas-dark-ink-muted)] bg-[var(--canvas-dark-100)] shrink-0 mt-0.5 text-xs font-semibold"
      >
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          row.username?.[0]?.toUpperCase() ?? '?'
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <TopicPill topic={row.topic} />
          <h3 className="font-comfortaa font-semibold text-sm truncate text-[var(--canvas-dark-ink-strong)]">
            {row.title || 'Untitled'}
          </h3>
        </div>
        {excerpt && (
          <p className="mt-1 text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-2">
            {excerpt}
          </p>
        )}
        <p className="mt-1.5 text-[11px] font-mono text-[var(--canvas-dark-ink-muted)]">
          {row.username && (
            <>
              <span>@{row.username}</span>
              <span className="mx-1.5">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={11} />
            {row.replyCount} {row.replyCount === 1 ? 'reply' : 'replies'}
          </span>
          <span className="mx-1.5">·</span>
          <span>{relTime(row.lastActivityAt)}</span>
        </p>
      </div>
    </Link>
  )
}
