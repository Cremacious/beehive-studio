'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'
import { listBuzzPostsAction } from '@/lib/actions/hive-buzz.actions'
import { canPostBuzz, type HiveRole } from '@/lib/hive/permissions'
import { BuzzPostCard } from './buzz-post-card'
import { ComposeBuzzModal } from './compose-buzz-modal'
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
  const [composeOpen, setComposeOpen] = useState(false)
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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl p-6">
        <div
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: 'var(--br-card)',
          }}
          className="p-6"
        >
          <header className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1
                style={{ color: 'var(--brand)' }}
                className="font-comfortaa font-bold text-2xl"
              >
                Buzz Board
              </h1>
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Inspiration, links, and vibes from your hive.
              </p>
            </div>
            {canPost && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
                className="inline-flex items-center gap-1.5 font-geist font-semibold text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
              >
                <Plus size={14} />
                New Buzz
              </button>
            )}
          </header>

          {posts.length === 0 ? (
            <BuzzEmptyState
              canPost={canPost}
              onCompose={() => setComposeOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <BuzzPostCard
                  key={post.id}
                  post={post}
                  viewerRole={viewerRole}
                  viewerUserId={viewerUserId}
                />
              ))}
              {cursor && (
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={loadOlder}
                    disabled={loadingMore}
                    style={{
                      color: 'var(--canvas-dark-ink-muted)',
                      borderRadius: 'var(--r-btn)',
                    }}
                    className="font-geist text-sm px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))] disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : 'Load older'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ComposeBuzzModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        hiveId={hiveId}
      />
    </main>
  )
}
