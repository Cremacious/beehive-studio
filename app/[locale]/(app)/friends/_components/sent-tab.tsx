'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import {
  cancelFriendRequestAction,
  type PendingRequest,
} from '@/lib/actions/friendships.actions'
import { Avatar, EmptyState, cardStyle, relTime } from './shared'

type Props = {
  locale: string
  outgoing: PendingRequest[]
}

export function SentTab({ locale, outgoing }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  function handleCancel(id: string) {
    setRemoved((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const r = await cancelFriendRequestAction({ friendshipId: id })
      if (!r.success) {
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success('Request cancelled')
        router.refresh()
      }
    })
  }

  const visible = outgoing.filter((r) => !removed.has(r.friendshipId))

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No sent requests"
        body="Friend requests you send will appear here until accepted."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {visible.map((r) => {
        const label = r.displayName ?? r.username ?? 'Unknown'
        return (
          <li
            key={r.friendshipId}
            className="flex items-center gap-3 px-4 py-3"
            style={cardStyle}
          >
            <Avatar url={r.avatarUrl} label={label} />
            <div className="flex-1 min-w-0">
              <Link
                href={r.username ? `/${locale}/u/${r.username}` : '#'}
                className="text-[14px] font-medium no-underline truncate block"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                {label}
              </Link>
              <p
                className="text-[11px] truncate"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {r.username ? `@${r.username}` : ''} · sent{' '}
                {relTime(r.requestedAt)}
              </p>
            </div>
            <button
              onClick={() => handleCancel(r.friendshipId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] text-[12px] font-medium cursor-pointer"
              style={{
                ...cardStyle,
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              <X size={12} /> Cancel
            </button>
          </li>
        )
      })}
    </ul>
  )
}
