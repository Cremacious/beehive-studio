'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FeedItemRenderer } from './feed-item'
import { getCommunityFeedAction } from '@/lib/actions/community.actions'
import type { FeedItem } from '@/lib/types/community'

export function FeedList({
  locale,
  initialItems,
  initialNextCursor,
  hasAnyFollows,
}: {
  locale: string
  initialItems: FeedItem[]
  initialNextCursor: string | null
  hasAnyFollows: boolean
}) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const result = await getCommunityFeedAction({ cursor })
    setLoading(false)
    if (result.success) {
      setItems(prev => [...prev, ...result.data.items])
      setCursor(result.data.nextCursor)
    }
  }

  if (!hasAnyFollows) {
    return (
      <section className="bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Follow writers to fill your feed. Try the suggestions above ↑
        </p>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing new from your follows this week. Try the suggestions above ↑
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => {
        const key = item.type === 'new_chapter' ? item.chapterId
                  : item.type === 'new_book' ? item.bookId
                  : item.sparkId
        return <FeedItemRenderer key={`${item.type}_${key}`} item={item} locale={locale} />
      })}

      {cursor ? (
        <button
          onClick={loadMore}
          disabled={loading}
          className="text-xs px-4 py-2 rounded border border-border text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50 self-center"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          You&apos;re caught up — <Link href={`/${locale}/discover`} className="text-brand hover:underline">explore Discover</Link>
        </p>
      )}
    </div>
  )
}
