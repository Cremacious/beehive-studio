'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, MoreVertical, UserMinus, X } from 'lucide-react'
import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  rejectFriendRequestAction,
  unfriendAction,
  type FriendSummary,
  type PendingRequest,
} from '@/lib/actions/friendships.actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Tab = 'friends' | 'pending' | 'sent'

type Props = {
  locale: string
  initialTab: Tab
  friends: FriendSummary[]
  incoming: PendingRequest[]
  outgoing: PendingRequest[]
}

function relTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const ms = Date.now() - date.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 30) return `${d2}d ago`
  const mo = Math.floor(d2 / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function Avatar({ url, label }: { url: string | null; label: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="w-10 h-10 rounded-full object-cover" />
    )
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold"
      style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
    >
      {label[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export function FriendsTabs({ locale, initialTab, friends, incoming, outgoing }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const router = useRouter()
  const [, startTransition] = useTransition()

  function pendingAccept(id: string) {
    startTransition(async () => {
      const r = await acceptFriendRequestAction({ friendshipId: id })
      if (!r.success) toast.error(r.error)
      else { toast.success('Accepted'); router.refresh() }
    })
  }
  function pendingReject(id: string) {
    startTransition(async () => {
      const r = await rejectFriendRequestAction({ friendshipId: id })
      if (!r.success) toast.error(r.error)
      else { toast.success('Declined'); router.refresh() }
    })
  }
  function pendingCancel(id: string) {
    startTransition(async () => {
      const r = await cancelFriendRequestAction({ friendshipId: id })
      if (!r.success) toast.error(r.error)
      else { toast.success('Cancelled'); router.refresh() }
    })
  }
  function doUnfriend(userId: string) {
    startTransition(async () => {
      const r = await unfriendAction({ otherUserId: userId })
      if (!r.success) toast.error(r.error)
      else { toast.success('Removed'); router.refresh() }
    })
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'friends', label: 'Friends', count: friends.length },
    { id: 'pending', label: 'Pending', count: incoming.length },
    { id: 'sent', label: 'Sent', count: outgoing.length },
  ]

  return (
    <>
      <div className="flex gap-1 border-b border-[#2a2a2a] mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer"
            style={{
              color: tab === t.id ? 'var(--canvas-dark-ink-strong)' : 'var(--canvas-dark-ink-muted)',
              borderBottomColor: tab === t.id ? 'var(--brand)' : 'transparent',
            }}
          >
            {t.label}
            <span className="ml-1.5 text-[11px] text-[#666]">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        friends.length === 0 ? (
          <EmptyState
            title="No friends yet"
            body="Visit a writer's profile and tap Add Friend to send a request."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li
                key={f.userId}
                className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3"
              >
                <Avatar url={f.avatarUrl} label={f.displayName ?? f.username ?? '?'} />
                <div className="flex-1 min-w-0">
                  <Link
                    href={f.username ? `/${locale}/u/${f.username}` : '#'}
                    className="text-[#ddd] hover:text-white text-[14px] font-medium no-underline truncate block"
                  >
                    {f.displayName ?? f.username ?? 'Unknown'}
                  </Link>
                  <p className="text-[#666] text-[11px]">
                    {f.username ? `@${f.username}` : ''} · friends since {relTime(f.friendsSince)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label="Friend options"
                      className="p-1.5 rounded text-[#888] hover:text-white cursor-pointer"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
                  >
                    <DropdownMenuItem
                      onSelect={(e) => { e.preventDefault(); doUnfriend(f.userId) }}
                      variant="destructive"
                      className="cursor-pointer"
                    >
                      <UserMinus size={14} /> Unfriend
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'pending' && (
        incoming.length === 0 ? (
          <EmptyState
            title="No pending requests"
            body="When someone sends you a friend request, you'll see it here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {incoming.map((r) => (
              <li
                key={r.friendshipId}
                className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3"
              >
                <Avatar url={r.avatarUrl} label={r.displayName ?? r.username ?? '?'} />
                <div className="flex-1 min-w-0">
                  <Link
                    href={r.username ? `/${locale}/u/${r.username}` : '#'}
                    className="text-[#ddd] hover:text-white text-[14px] font-medium no-underline truncate block"
                  >
                    {r.displayName ?? r.username ?? 'Unknown'}
                  </Link>
                  <p className="text-[#666] text-[11px]">
                    {r.username ? `@${r.username}` : ''} · requested {relTime(r.requestedAt)}
                  </p>
                </div>
                <button
                  onClick={() => pendingAccept(r.friendshipId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer"
                  style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  <Check size={12} /> Accept
                </button>
                <button
                  onClick={() => pendingReject(r.friendshipId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] border border-[#2a2a2a] text-[#888] hover:text-white cursor-pointer"
                >
                  <X size={12} /> Decline
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'sent' && (
        outgoing.length === 0 ? (
          <EmptyState title="No sent requests" body="Friend requests you send will appear here until accepted." />
        ) : (
          <ul className="flex flex-col gap-2">
            {outgoing.map((r) => (
              <li
                key={r.friendshipId}
                className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3"
              >
                <Avatar url={r.avatarUrl} label={r.displayName ?? r.username ?? '?'} />
                <div className="flex-1 min-w-0">
                  <Link
                    href={r.username ? `/${locale}/u/${r.username}` : '#'}
                    className="text-[#ddd] hover:text-white text-[14px] font-medium no-underline truncate block"
                  >
                    {r.displayName ?? r.username ?? 'Unknown'}
                  </Link>
                  <p className="text-[#666] text-[11px]">
                    {r.username ? `@${r.username}` : ''} · sent {relTime(r.requestedAt)}
                  </p>
                </div>
                <button
                  onClick={() => pendingCancel(r.friendshipId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] border border-[#2a2a2a] text-[#888] hover:text-white cursor-pointer"
                >
                  <X size={12} /> Cancel
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#2a2a2a] py-12 text-center">
      <p className="text-[#ddd] text-[14px] mb-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
        {title}
      </p>
      <p className="text-[#666] text-[12px]">{body}</p>
    </div>
  )
}
