'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { UserPlus, Check } from 'lucide-react'
import { sendFriendRequestAction } from '@/lib/actions/friendships.actions'
import type { SuggestedWriter } from '@/lib/types/community'
import { Avatar, EmptyState, cardStyle } from './shared'

type Props = {
  locale: string
  suggested: SuggestedWriter[]
}

export function SuggestedTab({ locale, suggested }: Props) {
  const [, startTransition] = useTransition()
  // userId → 'sent' | 'pending'
  const [sent, setSent] = useState<Set<string>>(new Set())

  function handleAdd(userId: string, username: string) {
    if (sent.has(userId)) return
    setSent((prev) => new Set(prev).add(userId))
    startTransition(async () => {
      const r = await sendFriendRequestAction({ recipientId: userId })
      if (!r.success) {
        setSent((prev) => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success(
          r.data.autoAccepted
            ? `You and @${username} are now friends`
            : `Friend request sent to @${username}`,
        )
      }
    })
  }

  if (suggested.length === 0) {
    return (
      <EmptyState
        title="No suggestions right now"
        body="Suggested writers are recently active authors you don't already follow. Check back as more people publish."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {suggested.map((w) => {
        const isSent = sent.has(w.id)
        return (
          <div
            key={w.id}
            className="flex items-start gap-3 p-4"
            style={cardStyle}
          >
            <Avatar url={w.image} label={w.username} size={44} />
            <div className="flex-1 min-w-0">
              <Link
                href={`/${locale}/u/${w.username}`}
                className="text-[14px] font-semibold no-underline truncate block"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                @{w.username}
              </Link>
              {w.bio && (
                <p
                  className="text-[12px] line-clamp-2 mt-0.5"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {w.bio}
                </p>
              )}
              <p
                className="text-[11px] mt-1"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {w.bookCount} {w.bookCount === 1 ? 'book' : 'books'}
              </p>
              <button
                onClick={() => handleAdd(w.id, w.username)}
                disabled={isSent}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-pill)] text-[12px] font-semibold cursor-pointer disabled:cursor-default"
                style={{
                  background: isSent
                    ? 'var(--canvas-dark-300)'
                    : 'var(--brand)',
                  color: isSent ? 'var(--canvas-dark-ink-muted)' : 'var(--brand-ink)',
                }}
              >
                {isSent ? (
                  <>
                    <Check size={12} /> Sent
                  </>
                ) : (
                  <>
                    <UserPlus size={12} /> Add friend
                  </>
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
