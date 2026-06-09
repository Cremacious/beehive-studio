'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import {
  acceptFriendRequestAction,
  rejectFriendRequestAction,
  cancelFriendRequestAction,
  type PendingRequest,
} from '@/lib/actions/friendships.actions'
import { Avatar, EmptyState, cardStyle, relTime } from './shared'

type Props = {
  locale: string
  incoming: PendingRequest[]
  outgoing: PendingRequest[]
}

type Seg = 'received' | 'sent'

export function PendingTab({ locale, incoming, outgoing }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const seg: Seg = sp.get('seg') === 'sent' ? 'sent' : 'received'
  const [, startTransition] = useTransition()
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  function setSeg(next: Seg) {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'pending')
    params.set('seg', next)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function optimisticRemove(id: string) {
    setRemoved((prev) => new Set(prev).add(id))
  }

  function rollback(id: string) {
    setRemoved((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function handleAccept(id: string) {
    optimisticRemove(id)
    startTransition(async () => {
      const r = await acceptFriendRequestAction({ friendshipId: id })
      if (!r.success) {
        rollback(id)
        toast.error(r.error)
      } else {
        toast.success('Friend request accepted')
        router.refresh()
      }
    })
  }

  function handleReject(id: string) {
    optimisticRemove(id)
    startTransition(async () => {
      const r = await rejectFriendRequestAction({ friendshipId: id })
      if (!r.success) {
        rollback(id)
        toast.error(r.error)
      } else {
        toast.success('Request declined')
        router.refresh()
      }
    })
  }

  function handleCancel(id: string) {
    optimisticRemove(id)
    startTransition(async () => {
      const r = await cancelFriendRequestAction({ friendshipId: id })
      if (!r.success) {
        rollback(id)
        toast.error(r.error)
      } else {
        toast.success('Request cancelled')
        router.refresh()
      }
    })
  }

  const visibleIncoming = incoming.filter((r) => !removed.has(r.friendshipId))
  const visibleOutgoing = outgoing.filter((r) => !removed.has(r.friendshipId))

  return (
    <section className="panel" aria-label="Pending requests">
      <div
        className="segment"
        style={{
          margin: '14px 24px 18px',
          display: 'inline-flex',
        }}
        role="tablist"
        aria-label="Pending segment"
      >
        <button
          type="button"
          role="tab"
          aria-selected={seg === 'received'}
          className={seg === 'received' ? 'active' : ''}
          onClick={() => setSeg('received')}
        >
          Received ({incoming.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seg === 'sent'}
          className={seg === 'sent' ? 'active' : ''}
          onClick={() => setSeg('sent')}
        >
          Sent ({outgoing.length})
        </button>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {seg === 'received' ? (
          <ReceivedList
            locale={locale}
            items={visibleIncoming}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ) : (
          <SentList
            locale={locale}
            items={visibleOutgoing}
            onCancel={handleCancel}
          />
        )}
      </div>
    </section>
  )
}

function ReceivedList({
  locale,
  items,
  onAccept,
  onReject,
}: {
  locale: string
  items: PendingRequest[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No pending requests"
        body="When someone sends you a friend request, you'll see it here."
      />
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((r) => {
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
              onClick={() => onAccept(r.friendshipId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] text-[12px] font-semibold cursor-pointer"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => onReject(r.friendshipId)}
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

function SentList({
  locale,
  items,
  onCancel,
}: {
  locale: string
  items: PendingRequest[]
  onCancel: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No sent requests"
        body="Friend requests you send will appear here until accepted."
      />
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((r) => {
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
              onClick={() => onCancel(r.friendshipId)}
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
