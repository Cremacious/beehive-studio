'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { UserPlus, Check } from 'lucide-react'
import { sendFriendRequestAction } from '@/lib/actions/friendships.actions'
import type { SuggestedWriter } from '@/lib/types/community'

type Props = {
  locale: string
  suggested: SuggestedWriter[]
}

/**
 * Right rail for /friends — single panel of suggested friends, full
 * screen height with internal scroll. Replaces the Suggested tab.
 */
export function FriendsSuggestedRail({ locale, suggested }: Props) {
  const [, startTransition] = useTransition()
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

  return (
    <aside
      className="hidden xl:flex flex-col"
      style={{
        position: 'sticky',
        top: 80,
        width: 300,
        height: 'calc(100vh - 100px)',
        alignSelf: 'start',
      }}
      aria-label="Suggested friends"
    >
      <div
        className="rounded-2xl flex flex-col h-full overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Header — fixed */}
        <div
          className="px-4 pt-4 pb-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          <h2
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
          >
            Suggested friends
          </h2>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {suggested.length === 0 ? (
            <p
              className="text-[12px] py-3"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              No suggestions right now. Check back as more writers join.
            </p>
          ) : (
            suggested.map((w, i) => {
              const isSent = sent.has(w.id)
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-2.5 py-2.5"
                  style={{
                    borderTop:
                      i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    className="rounded-full shrink-0 overflow-hidden"
                    style={{
                      width: 32,
                      height: 32,
                      background: 'oklch(0.45 0.05 256)',
                    }}
                    aria-hidden="true"
                  >
                    {w.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${locale}/u/${w.username}`}
                      className="text-[13px] font-bold truncate block no-underline"
                      style={{
                        color: 'var(--canvas-dark-ink-strong)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      @{w.username}
                    </Link>
                    <div
                      className="text-[10px] truncate"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      {w.bookCount} {w.bookCount === 1 ? 'book' : 'books'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(w.id, w.username)}
                    disabled={isSent}
                    aria-label={isSent ? 'Friend request sent' : `Add ${w.username} as a friend`}
                    className="inline-flex items-center justify-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:cursor-default"
                    style={{
                      background: isSent
                        ? 'rgba(255,255,255,0.06)'
                        : 'var(--brand)',
                      color: isSent
                        ? 'var(--canvas-dark-ink-muted)'
                        : 'var(--brand-ink)',
                      border: isSent
                        ? '1px solid rgba(255,255,255,0.08)'
                        : 'none',
                    }}
                  >
                    {isSent ? (
                      <>
                        <Check size={11} aria-hidden="true" /> Sent
                      </>
                    ) : (
                      <>
                        <UserPlus size={11} aria-hidden="true" /> Add
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </aside>
  )
}
