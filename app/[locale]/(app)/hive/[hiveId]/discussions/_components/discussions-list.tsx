'use client'

import { useMemo, useState } from 'react'
import { Plus, MessageSquare } from 'lucide-react'
import type { DiscussionPostSummary } from '@/lib/actions/hive-discussions.actions'
import type { DiscussionTopic } from '@/lib/validations/hive-discussion'
import { canPostDiscussion, type HiveRole } from '@/lib/hive/permissions'
import { DiscussionRow, TOPIC_META } from './discussion-row'
import { DiscussionComposeModal } from './discussion-compose-modal'

const TOPICS: DiscussionTopic[] = ['GENERAL', 'WORLDBUILDING', 'FEEDBACK', 'OFF_TOPIC']

type Props = {
  posts: DiscussionPostSummary[]
  hiveId: string
  locale: string
  viewerRole: HiveRole
  viewerUserId: string
}

export function DiscussionsList({ posts, hiveId, locale, viewerRole }: Props) {
  const canPost = canPostDiscussion(viewerRole)
  const [composeOpen, setComposeOpen] = useState(false)
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
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl"
          >
            Discussions
          </h1>
          <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
            {posts.length} {posts.length === 1 ? 'thread' : 'threads'} across {TOPICS.length} boards
          </p>
        </div>
        {canPost && (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink, oklch(0.18 0.02 60))',
              borderRadius: 'var(--r-btn)',
              boxShadow: 'var(--sh-tile)',
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 font-geist font-semibold text-sm"
          >
            <Plus size={14} />
            New Thread
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label={`All (${posts.length})`} active={allActive} onClick={toggleAll} />
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

      <div
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="overflow-hidden"
      >
        <div
          className="grid items-center gap-4 px-5 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]"
          style={{
            gridTemplateColumns: '1fr 90px 130px',
            borderBottom: '1px solid var(--canvas-dark-300)',
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
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-[var(--canvas-dark-ink-strong)]">
              No threads yet
            </p>
            <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
              Be the first to start a discussion on this board.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {filtered.map((row) => (
              <li key={row.id}>
                <DiscussionRow row={row} hiveId={hiveId} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <DiscussionComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        hiveId={hiveId}
      />
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
      className={
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition ' +
        (active ? 'border-2' : 'border-border hover:border-brand/60')
      }
      style={
        active
          ? {
              color,
              background: `oklch(from ${color} l c h / 0.14)`,
              borderColor: color,
            }
          : undefined
      }
    >
      {label}
    </button>
  )
}
