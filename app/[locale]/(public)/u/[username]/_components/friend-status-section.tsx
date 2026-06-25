'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { MoreHorizontal, BellOff, Bell, Ban, ExternalLink } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  muteUserAction,
  unmuteUserAction,
} from '@/lib/actions/mutes.actions'
import { blockUserAction } from '@/lib/actions/blocks.actions'
import type { FriendshipStatus } from '@/lib/actions/friendships.actions'
import type { MutualFriend } from '@/lib/social/get-mutual-friends'

type Props = {
  status: FriendshipStatus
  targetUserId: string
  targetUsername: string | null
  mutuals: { mutuals: MutualFriend[]; total: number }
  initialMuted: boolean
  viewerIsSelf: boolean
  isAuthenticated: boolean
  locale: string
}

function StatusPill({ status }: { status: FriendshipStatus }) {
  if (status === 'ACCEPTED') {
    return <span className="pill role-owner"><span className="dot" />Friends</span>
  }
  if (status === 'PENDING_OUTGOING') {
    return <span className="pill role-reader"><span className="dot" />Request sent</span>
  }
  if (status === 'PENDING_INCOMING') {
    return <span className="pill role-contributor"><span className="dot" />Request received</span>
  }
  return null
}

function MutualFriendsRow({
  mutuals,
  locale,
}: {
  mutuals: { mutuals: MutualFriend[]; total: number }
  locale: string
}) {
  if (mutuals.total === 0) return null
  const shown = mutuals.mutuals
  const overflow = mutuals.total - shown.length
  return (
    <div className="flex items-center gap-3">
      <span className="meta-mono">
        <strong style={{ color: 'var(--canvas-dark-ink-strong)' }}>{mutuals.total}</strong> mutual
      </span>
      <span className="cluster">
        {shown.map((m) => (
          <Link
            key={m.userId}
            href={m.username ? `/${locale}/u/${m.username}` : '#'}
            title={m.displayName ?? m.username ?? 'Unknown'}
            className="avatar s24 a-slate"
            style={{ overflow: 'hidden' }}
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (m.displayName ?? m.username ?? '?').charAt(0).toUpperCase()
            )}
          </Link>
        ))}
      </span>
      {overflow > 0 && <span className="meta-mono">+{overflow} more</span>}
    </div>
  )
}

export function FriendStatusSection({
  status,
  targetUserId,
  targetUsername,
  mutuals,
  initialMuted,
  viewerIsSelf,
  isAuthenticated,
  locale,
}: Props) {
  const router = useRouter()
  const [muted, setMuted] = useState(initialMuted)
  const [blockOpen, setBlockOpen] = useState(false)
  const [, startTransition] = useTransition()

  // Don't render the section for self or unauthenticated viewers.
  if (viewerIsSelf || !isAuthenticated) {
    if (mutuals.total === 0) return null
    return (
      <section>
        <MutualFriendsRow mutuals={mutuals} locale={locale} />
      </section>
    )
  }

  const showPill = status !== 'NONE'
  const showKebab = status === 'ACCEPTED'

  function handleToggleMute() {
    startTransition(async () => {
      try {
        if (muted) {
          const result = await unmuteUserAction({ targetUserId })
          if (!result.success) {
            toastActionError(result.error)
            return
          }
          setMuted(false)
          toast.success('Unmuted')
        } else {
          const result = await muteUserAction({ targetUserId })
          if (!result.success) {
            toastActionError(result.error)
            return
          }
          setMuted(true)
          toast.success(`Muted${targetUsername ? ` @${targetUsername}` : ''}`)
        }
      } catch {
        toastNetworkError()
      }
    })
  }

  function handleBlock() {
    startTransition(async () => {
      try {
        const result = await blockUserAction({ targetUserId })
        if (!result.success) {
          toastActionError(result.error)
          return
        }
        toast.success(`Blocked${targetUsername ? ` @${targetUsername}` : ''}`)
        router.push(`/${locale}/community`)
        router.refresh()
      } catch {
        toastNetworkError()
      }
    })
  }

  if (!showPill && mutuals.total === 0 && !showKebab) return null

  return (
    <section className="flex flex-wrap items-center gap-4">
      {showPill && <StatusPill status={status} />}

      {showKebab && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="btn-tile btn-sm"
              aria-label="More actions"
              style={{ width: 32, padding: 0, justifyContent: 'center' }}
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
          >
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/${locale}/community/friends`}>
                <ExternalLink size={14} /> View on Friends
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); handleToggleMute() }}
              className="cursor-pointer"
            >
              {muted ? <Bell size={14} /> : <BellOff size={14} />}
              {muted ? 'Unmute' : 'Mute'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); setBlockOpen(true) }}
              variant="destructive"
              className="cursor-pointer"
            >
              <Ban size={14} /> Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <MutualFriendsRow mutuals={mutuals} locale={locale} />

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Block ${targetUsername ? `@${targetUsername}` : 'this user'}?`}
        description="They won't be able to see your profile or contact you, and any existing friendship or follow will be removed."
        confirmLabel="Block"
        variant="destructive"
        onConfirm={handleBlock}
      />
    </section>
  )
}
