'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'
import { listBuzzPostsAction } from '@/lib/actions/hive-buzz.actions'
import { toastNetworkError } from '@/lib/errors/notify'
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

  // Sync client state with server-supplied initialPosts when router.refresh()
  // runs (after compose/edit/delete). Without this, useState only honors the
  // initial value on first mount and the feed stays stale until manual reload.
  useEffect(() => {
    setPosts(initialPosts)
    setCursor(initialCursor)
  }, [initialPosts, initialCursor])

  const canPost = canPostBuzz(viewerRole)

  function loadOlder() {
    if (!cursor) return
    startLoadMore(async () => {
      try {
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
      } catch {
        toastNetworkError()
      }
    })
  }

  // Corkboard backdrop — two subtle warm radial accents over a dot grid.
  // Lives at the feed level so empty + populated states share the chrome.
  const corkboardStyle: React.CSSProperties = {
    background: `
      radial-gradient(circle at 18% 22%, rgba(255,195,0,0.045), transparent 55%),
      radial-gradient(circle at 82% 78%, rgba(255,195,0,0.035), transparent 55%),
      var(--canvas-dark-100)
    `,
    boxShadow: 'var(--sh-inset)',
    borderRadius: 'var(--r-card)',
    padding: '34px 28px 28px',
    position: 'relative',
  }

  if (posts.length === 0) {
    return (
      <div className="p-6 max-md:px-0 max-md:py-2">
        <div className="buzz-corkboard" style={corkboardStyle}>
          <DotGrid />
          <div className="relative">
            <BuzzEmptyState canPost={canPost} hiveId={hiveId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-md:px-0 max-md:py-2">
      <div className="buzz-corkboard" style={corkboardStyle}>
        <DotGrid />
        <div
          className="relative grid gap-7 max-md:gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
            alignItems: 'start',
          }}
        >
          {posts.map((post) => (
            <BuzzPostCard
              key={post.id}
              post={post}
              viewerRole={viewerRole}
              viewerUserId={viewerUserId}
            />
          ))}
        </div>
        {cursor && (
          <div className="relative pt-7 flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingMore}
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                borderRadius: 'var(--r-pill)',
                background:
                  'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
              }}
              className="font-mono text-[11px] uppercase tracking-wider px-4 py-2 transition-colors hover:text-[var(--canvas-dark-ink-strong)] disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Subtle dot grid overlay for the corkboard texture. Absolutely positioned
 * inside the corkboard container; non-interactive.
 */
function DotGrid() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
        borderRadius: 'var(--r-card)',
      }}
    />
  )
}
