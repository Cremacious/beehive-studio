'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'
import { listBuzzPostsAction } from '@/lib/actions/hive-buzz.actions'
import { canPostBuzz, type HiveRole } from '@/lib/hive/permissions'
import { BuzzPostCard } from './buzz-post-card'
import { BuzzEmptyState } from './buzz-empty-state'

type Cursor = { createdAt: Date; id: string } | null

type Props = {
  initialPosts: BuzzPostSummary[]
  initialCursor: Cursor
  hiveId: string
  locale: string
  viewerRole: HiveRole
  viewerUserId: string
}

export function BuzzFeed({
  initialPosts,
  initialCursor,
  hiveId,
  viewerRole,
  viewerUserId,
}: Props) {
  const [posts, setPosts] = useState<BuzzPostSummary[]>(initialPosts)
  const [cursor, setCursor] = useState<Cursor>(initialCursor)
  const [loadingMore, startLoadMore] = useTransition()

  const canPost = canPostBuzz(viewerRole)

  function loadOlder() {
    if (!cursor) return
    startLoadMore(async () => {
      const res = await listBuzzPostsAction({
        hiveId,
        cursor: cursor!,
        limit: 20,
      })
      if (!res.success) {
        toast.error('Could not load more posts')
        return
      }
      setPosts((prev) => [...prev, ...res.data.posts])
      setCursor(res.data.nextCursor)
    })
  }

  if (posts.length === 0) {
    return (
      <div className="p-6">
        <BuzzEmptyState canPost={canPost} hiveId={hiveId} />
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-3">
      {posts.map((post) => (
        <BuzzPostCard
          key={post.id}
          post={post}
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
        />
      ))}
      {cursor && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingMore}
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              borderRadius: 'var(--r-btn)',
            }}
            className="font-mono text-[12px] tracking-wider px-3 py-2 transition-colors hover:text-[var(--canvas-dark-ink-strong)] disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load older'}
          </button>
        </div>
      )}
    </div>
  )
}
