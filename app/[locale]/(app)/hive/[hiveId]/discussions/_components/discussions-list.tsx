'use client'

import { useMemo, useState } from 'react'
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
}

export function DiscussionsList({ posts, hiveId, locale }: Props) {
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
        <p
          className="px-6 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3"
          style={{ letterSpacing: '0.12em' }}
        >
          Threads
        </p>
        <div
          className="grid items-center gap-3 px-5 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]"
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
