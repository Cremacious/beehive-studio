'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ListFilter, ChevronDown } from 'lucide-react'
import { relTime } from '@/components/hive/collab/rel-time'
import type { DiscussionPostSummary } from '@/lib/actions/hive-discussions.actions'
import type { DiscussionTopic } from '@/lib/validations/hive-discussion'
import type { HiveRole } from '@/lib/hive/permissions'
import { HiveSectionDivider } from '../../_components/hive-section-divider'
import { DiscussionRow, TOPIC_META } from './discussion-row'

const TOPICS: DiscussionTopic[] = ['GENERAL', 'WORLDBUILDING', 'FEEDBACK', 'OFF_TOPIC']

type Props = {
  posts: DiscussionPostSummary[]
  hiveId: string
  locale: string
  viewerRole: HiveRole
  viewerUserId: string
  /** Render the mobile compact list (issue #50) instead of the desktop table. */
  mobile?: boolean
  /** Mobile-only New Discussion button, rendered above the list. */
  cta?: ReactNode
}

function threadTitle(p: DiscussionPostSummary): string {
  const firstLine = p.bodyExcerpt.split('\n')[0] ?? ''
  return (p.title || firstLine).slice(0, 80) || 'Untitled'
}

export function DiscussionsList({ posts, hiveId, locale, mobile, cta }: Props) {
  const [activeTopics, setActiveTopics] = useState<Set<DiscussionTopic> | null>(null)

  const filtered = useMemo(() => {
    if (!activeTopics) return posts
    return posts.filter((p) => activeTopics.has(p.topic))
  }, [posts, activeTopics])

  function toggleAll() {
    setActiveTopics(null)
  }

  function toggleTopic(t: DiscussionTopic) {
    setActiveTopics((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(t)) {
        next.delete(t)
        if (next.size === 0) return null
      } else {
        next.add(t)
      }
      return next
    })
  }

  const allActive = activeTopics === null

  const topicCounts = useMemo(() => {
    const map = new Map<DiscussionTopic, number>()
    for (const t of TOPICS) map.set(t, 0)
    for (const p of posts) map.set(p.topic, (map.get(p.topic) ?? 0) + 1)
    return map
  }, [posts])

  // ── Mobile (issue #50, variant C — compact list) ──
  if (mobile) {
    return (
      <div className="flex flex-col gap-3 pb-6">
        {cta}
        <div className="relative">
          <ListFilter
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--brand)' }}
          />
          <select
            aria-label="Filter by topic"
            value={allActive ? '__all__' : ([...activeTopics][0] ?? '__all__')}
            onChange={(e) => {
              const v = e.target.value
              if (v === '__all__') setActiveTopics(null)
              else setActiveTopics(new Set([v as DiscussionTopic]))
            }}
            className="w-full appearance-none outline-none pl-9 pr-9 font-medium text-[13px]"
            style={{
              height: 42,
              borderRadius: 'var(--r-row)',
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
              border: 'var(--br-card)',
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            <option value="__all__">All topics ({posts.length})</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {TOPIC_META[t].label} ({topicCounts.get(t) ?? 0})
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-[var(--canvas-dark-ink-strong)]">No threads yet</p>
            <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
              Be the first to start a discussion on this board.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            {filtered.map((row, i) => (
              <Link
                key={row.id}
                href={`/${locale}/hive/${hiveId}/discussions/${row.id}`}
                className="flex flex-col gap-1 px-3.5 py-3 no-underline"
                style={{
                  borderBottom:
                    i === filtered.length - 1
                      ? undefined
                      : '1px solid oklch(from var(--canvas-dark-200) l c h / 0.6)',
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0"
                    style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${TOPIC_META[row.topic].tokenVar})` }}
                  />
                  <span
                    className="flex-1 min-w-0 truncate font-comfortaa font-semibold text-[14px]"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {threadTitle(row)}
                  </span>
                </div>
                <span className="pl-4 font-mono text-[10px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  {row.username ? `@${row.username} · ` : ''}
                  {row.replyCount} {row.replyCount === 1 ? 'reply' : 'replies'} · {relTime(row.lastActivityAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <HiveSectionDivider label="Filter by topic" hideTopBorder>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label={`All (${posts.length})`}
            active={allActive}
            onClick={toggleAll}
          />
          {TOPICS.map((t) => {
            const active = !allActive && activeTopics.has(t)
            const count = topicCounts.get(t) ?? 0
            return (
              <FilterChip
                key={t}
                label={`${TOPIC_META[t].label} (${count})`}
                tokenVar={TOPIC_META[t].tokenVar}
                active={active}
                onClick={() => toggleTopic(t)}
              />
            )
          })}
        </div>
      </HiveSectionDivider>

      <section className="pt-6">
        <div
          className="grid items-center gap-3 px-5 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] max-md:hidden"
          style={{
            gridTemplateColumns: '1fr 90px 130px',
            background: 'var(--canvas-dark-100)',
            borderTop: 'var(--br-card)',
            borderBottom: 'var(--br-card)',
            letterSpacing: '0.12em',
          }}
        >
          <span>Thread</span>
          <span className="text-center">Replies</span>
          <span className="text-right">Last activity</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-[var(--canvas-dark-ink-strong)]">
              No threads yet
            </p>
            <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
              Be the first to start a discussion on this board.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
            {filtered.map((row) => (
              <li key={row.id}>
                <DiscussionRow row={row} hiveId={hiveId} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  tokenVar,
}: {
  label: string
  active: boolean
  onClick: () => void
  tokenVar?: string
}) {
  // Tokenized chip (e.g. topic-specific): alpha-tint when ON, recessed inset when OFF.
  if (tokenVar) {
    const accent = `var(${tokenVar})`
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition border"
        style={
          active
            ? {
                background: `oklch(from ${accent} l c h / 0.20)`,
                color: accent,
                borderColor: `oklch(from ${accent} l c h / 0.45)`,
              }
            : {
                background: `oklch(from ${accent} l c h / 0.10)`,
                color: accent,
                borderColor: `oklch(from ${accent} l c h / 0.22)`,
                opacity: 0.6,
              }
        }
      >
        {label}
      </button>
    )
  }
  // Neutral "All" chip: recessed inset; brightens when active.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition border"
      style={{
        background: 'var(--canvas-dark-100)',
        boxShadow: 'var(--sh-inset)',
        borderColor: 'transparent',
        color: active
          ? 'var(--canvas-dark-ink-strong)'
          : 'var(--canvas-dark-ink-muted)',
      }}
    >
      {label}
    </button>
  )
}
