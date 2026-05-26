'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
import type { SuggestedWriter } from '@/lib/types/community'

export function SuggestedWritersPanel({
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
    <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <header>
        <h3 className="text-sm font-semibold text-foreground">Discover writers</h3>
      </header>

      <ul className="flex flex-col gap-3">
        {writers.slice(0, 3).map(w => (
          <li key={w.id} className="flex items-center gap-2">
            <Link href={`/${locale}/u/${w.username}`} className="shrink-0">
              {w.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.image} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[11px] font-bold text-brand">
                  {w.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                href={`/${locale}/u/${w.username}`}
                className="text-xs font-medium text-foreground hover:text-brand truncate block"
              >
                @{w.username}
              </Link>
              {w.bio && (
                <p className="text-[10px] text-muted-foreground truncate">{w.bio}</p>
              )}
            </div>
            {!w.isFollowing && (
              <button
                onClick={() => handleFollow(w.id)}
                className="text-[10px] px-2 py-1 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors shrink-0"
              >
                Follow
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
