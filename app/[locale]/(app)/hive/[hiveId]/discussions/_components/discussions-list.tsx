'use client'

import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
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
      <HiveSectionDivider label="Filter" hideTopBorder>
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

      <HiveSectionDivider label="Threads">
        <div
          className="overflow-hidden rounded-[var(--r-row)]"
          style={{
            border: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
          }}
        >
          <div
            className="grid items-center gap-3 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]"
            style={{
              gridTemplateColumns: '1fr 90px 130px',
              borderBottom:
                '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            }}
          >
            <span>Thread</span>
            <span className="text-center inline-flex items-center justify-center gap-1">
              <MessageSquare size={10} />
              Replies
            </span>
            <span className="text-right">Last activity</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium text-[var(--canvas-dark-ink-strong)]">
                No threads yet
              </p>
              <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
                Be the first to start a discussion on this board.
              </p>
            </div>
          ) : (
            <ul
              className="divide-y"
              style={{ borderColor: 'oklch(from var(--canvas-dark-300) l c h / 0.5)' }}
            >
              {filtered.map((row) => (
                <li key={row.id}>
                  <DiscussionRow row={row} hiveId={hiveId} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </HiveSectionDivider>
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
  const color = tokenVar ? `var(${tokenVar}, var(--color-brand))` : 'var(--color-brand)'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition border"
      style={
        active
          ? {
              color,
              background: `oklch(from ${color} l c h / 0.14)`,
              borderColor: `oklch(from ${color} l c h / 0.3)`,
            }
          : {
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              borderColor: 'oklch(from var(--canvas-dark-300) l c h / 0.5)',
              color: 'var(--canvas-dark-ink-muted)',
              boxShadow: 'var(--sh-tile)',
            }
      }
    >
      {label}
    </button>
  )
}
