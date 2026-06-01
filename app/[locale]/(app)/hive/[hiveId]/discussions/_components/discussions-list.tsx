'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
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
  // null = "All" selected. Set = individual topics filtered.
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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-comfortaa font-bold text-2xl text-foreground">
              Discussions
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conversations with your hive.
            </p>
          </div>
          {canPost && (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{
                background: 'var(--color-brand)',
                color: 'var(--brand-ink, oklch(0.18 0.02 60))',
              }}
            >
              <Plus size={14} />
              New Post
            </button>
          )}
        </header>

        <div className="flex flex-wrap gap-2 mb-4">
          <FilterChip label="All" active={allActive} onClick={toggleAll} />
          {TOPICS.map((t) => {
            const active = !allActive && activeTopics.has(t)
            return (
              <FilterChip
                key={t}
                label={TOPIC_META[t].label}
                tokenVar={TOPIC_META[t].tokenVar}
                active={active}
                onClick={() => toggleTopic(t)}
              />
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="px-3 py-12 rounded-md border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No posts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to start a discussion.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((row) => (
              <DiscussionRow key={row.id} row={row} hiveId={hiveId} locale={locale} />
            ))}
          </div>
        )}
      </div>

      <DiscussionComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        hiveId={hiveId}
      />
    </main>
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
        (active ? 'border-2 border-brand' : 'border-border hover:border-brand/60')
      }
      style={
        active
          ? {
              color,
              background: `oklch(from ${color} l c h / 0.14)`,
            }
          : undefined
      }
    >
      {label}
    </button>
  )
}
