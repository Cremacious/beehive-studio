'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import {
  acceptFriendRequestAction,
  rejectFriendRequestAction,
  type PendingRequest,
} from '@/lib/actions/friendships.actions'
import { Avatar, EmptyState, cardStyle, relTime } from './shared'

type Props = {
  locale: string
  incoming: PendingRequest[]
}

export function RequestsTab({ locale, incoming }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  // Optimistically removed friendshipIds.
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  function handleAccept(id: string) {
    setRemoved((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const r = await acceptFriendRequestAction({ friendshipId: id })
      if (!r.success) {
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success('Friend request accepted')
        router.refresh()
      }
    })
  }

  function handleReject(id: string) {
    setRemoved((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const r = await rejectFriendRequestAction({ friendshipId: id })
      if (!r.success) {
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success('Request declined')
        router.refresh()
      }
    })
  }

  const visible = incoming.filter((r) => !removed.has(r.friendshipId))

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No pending requests"
        body="When someone sends you a friend request, you'll see it here."
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
                {r.username ? `@${r.username}` : ''} · requested{' '}
                {relTime(r.requestedAt)}
              </p>
            </div>
            <button
              onClick={() => handleAccept(r.friendshipId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] text-[12px] font-semibold cursor-pointer"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => handleReject(r.friendshipId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] text-[12px] font-medium cursor-pointer"
              style={{
                ...cardStyle,
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              <X size={12} /> Reject
            </button>
          </li>
        )
      })}
    </ul>
  )
}
