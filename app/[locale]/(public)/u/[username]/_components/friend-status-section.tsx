'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        Friends
      </span>
    )
  }
  if (status === 'PENDING_OUTGOING') {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--canvas-dark-300)] px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
        Request sent
      </span>
    )
  }
  if (status === 'PENDING_INCOMING') {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{
          background: 'oklch(from var(--brand) l c h / 0.18)',
          color: 'var(--brand)',
        }}
      >
        Request received
      </span>
    )
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
      <span className="text-[12px] text-[var(--canvas-dark-ink-muted)]">
        <strong className="text-[var(--canvas-dark-ink-strong)]">{mutuals.total}</strong> mutual ·
      </span>
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <Link
            key={m.userId}
            href={m.username ? `/${locale}/u/${m.username}` : '#'}
            title={m.displayName ?? m.username ?? 'Unknown'}
            className="h-7 w-7 overflow-hidden rounded-full border border-[var(--canvas-dark-200)] bg-[var(--canvas-dark-300)]"
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] text-[var(--canvas-dark-ink-muted)]">
                {(m.displayName ?? m.username ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        ))}
      </div>
      {overflow > 0 && (
        <span className="text-[11px] text-[var(--canvas-dark-ink-muted)]">+{overflow} more</span>
      )}
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
      <section className="mb-6">
        <MutualFriendsRow mutuals={mutuals} locale={locale} />
      </section>
    )
  }

  const showPill = status !== 'NONE'
  const showKebab = status === 'ACCEPTED'

  function handleToggleMute() {
    startTransition(async () => {
      if (muted) {
        const result = await unmuteUserAction({ targetUserId })
        if (!result.success) {
          toast.error('Could not unmute')
          return
        }
        setMuted(false)
        toast.success('Unmuted')
      } else {
        const result = await muteUserAction({ targetUserId })
        if (!result.success) {
          toast.error('Could not mute')
          return
        }
        setMuted(true)
        toast.success(`Muted${targetUsername ? ` @${targetUsername}` : ''}`)
      }
    })
  }

  function handleBlock() {
    startTransition(async () => {
      const result = await blockUserAction({ targetUserId })
      if (!result.success) {
        toast.error('Could not block')
        return
      }
      toast.success(`Blocked${targetUsername ? ` @${targetUsername}` : ''}`)
      router.push(`/${locale}/community`)
      router.refresh()
    })
  }

  if (!showPill && mutuals.total === 0 && !showKebab) return null

  return (
    <section className="mb-6 flex flex-wrap items-center gap-4">
      {showPill && <StatusPill status={status} />}

      {showKebab && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--canvas-dark-300)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]"
              aria-label="More actions"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
          >
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/${locale}/friends`}>
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
