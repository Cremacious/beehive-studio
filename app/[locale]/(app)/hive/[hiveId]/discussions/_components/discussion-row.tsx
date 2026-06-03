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
  const excerpt = row.bodyExcerpt.slice(row.title.length, row.title.length + 160).trim()

  return (
    <Link
      href={`/${locale}/hive/${hiveId}/discussions/${row.id}`}
      className="grid items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--canvas-dark-300)]"
      style={{ gridTemplateColumns: '1fr 90px 130px' }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-[var(--canvas-dark-ink-muted)] bg-[var(--canvas-dark-100)] shrink-0 mt-0.5 text-xs font-semibold"
          style={{ boxShadow: 'var(--sh-inset)' }}
        >
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            row.username?.[0]?.toUpperCase() ?? '?'
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <TopicPill topic={row.topic} />
            <h3 className="font-comfortaa font-semibold text-base truncate text-[var(--canvas-dark-ink-strong)]">
              {row.title || 'Untitled'}
            </h3>
          </div>
          {excerpt && (
            <p className="mt-1 text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-1">
              {excerpt}
            </p>
          )}
          {row.username && (
            <p className="mt-1.5 text-[11px] font-mono text-[var(--canvas-dark-ink-muted)]">
              started by <span className="text-[var(--canvas-dark-ink)]">@{row.username}</span>
            </p>
          )}
        </div>
      </div>

      <div className="text-center">
        <div className="font-comfortaa font-bold text-lg text-[var(--canvas-dark-ink-strong)] leading-none">
          {row.replyCount}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mt-0.5">
          {row.replyCount === 1 ? 'reply' : 'replies'}
        </div>
      </div>

      <div className="text-right">
        <div className="text-xs text-[var(--canvas-dark-ink)] inline-flex items-center gap-1 justify-end">
          <MessageSquare size={11} className="text-[var(--canvas-dark-ink-muted)]" />
          {relTime(row.lastActivityAt)}
        </div>
      </div>
    </Link>
  )
}
