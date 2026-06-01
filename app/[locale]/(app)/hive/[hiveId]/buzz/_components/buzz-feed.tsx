'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'
import { listBuzzPostsAction } from '@/lib/actions/hive-buzz.actions'
import { canPostBuzz, type HiveRole } from '@/lib/hive/permissions'
import { Button } from '@/components/ui/button'
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
      <div className="mx-auto max-w-2xl px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-comfortaa font-bold text-2xl text-foreground">
              Buzz Board
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inspiration, links, and vibes from your hive.
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
          <div className="space-y-2.5">
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
                <Button
                  variant="ghost"
                  onClick={loadOlder}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load older'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ComposeBuzzModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        hiveId={hiveId}
      />
    </main>
  )
}
