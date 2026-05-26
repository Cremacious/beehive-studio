'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
import type { SuggestedWriter } from '@/lib/types/community'

export function SuggestedWritersStrip({
  locale,
  writers: initial,
}: {
  locale: string
  writers: SuggestedWriter[]
}) {
  const [writers, setWriters] = useState(initial)

  async function handleFollow(userId: string) {
    setWriters(ws => ws.map(w => w.id === userId ? { ...w, isFollowing: true } : w))
    const result = await toggleFollowAction(userId)
    if (!result.success) {
      setWriters(ws => ws.map(w => w.id === userId ? { ...w, isFollowing: false } : w))
    }
  }

  if (writers.length === 0) return null

  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Writers to follow</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {writers.map(w => (
          <div
            key={w.id}
            className="flex flex-col items-center gap-2 min-w-[120px] bg-background border border-border rounded-md p-3 shrink-0"
          >
            <Link href={`/${locale}/u/${w.username}`}>
              {w.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.image} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <span className="w-12 h-12 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-sm font-bold text-brand">
                  {w.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </Link>
            <Link
              href={`/${locale}/u/${w.username}`}
              className="text-xs font-medium text-foreground hover:text-brand text-center truncate w-full"
            >
              @{w.username}
            </Link>
            <span className="text-[10px] text-muted-foreground">{w.bookCount} book{w.bookCount !== 1 ? 's' : ''}</span>
            {!w.isFollowing ? (
              <button
                onClick={() => handleFollow(w.id)}
                className="text-[10px] w-full px-2 py-1 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
              >
                Follow
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground">Following</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
