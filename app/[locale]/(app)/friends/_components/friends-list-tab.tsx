'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreVertical, User, VolumeX, ShieldX, UserMinus } from 'lucide-react'
import {
  unfriendAction,
  type FriendSummary,
} from '@/lib/actions/friendships.actions'
import { muteUserAction } from '@/lib/actions/mutes.actions'
import { blockUserAction } from '@/lib/actions/blocks.actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Avatar, EmptyState, cardStyle, relTime } from './shared'

type Props = {
  locale: string
  friends: FriendSummary[]
}

type DialogState =
  | { mode: 'closed' }
  | { mode: 'unfriend'; userId: string; label: string }
  | { mode: 'block'; userId: string; label: string }

export function FriendsListTab({ locale, friends }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' })

  function handleMute(userId: string, label: string) {
    startTransition(async () => {
      const r = await muteUserAction({ targetUserId: userId })
      if (!r.success) toast.error(r.error)
      else toast.success(`Muted ${label}`)
    })
  }

  function confirmUnfriend(userId: string) {
    startTransition(async () => {
      const r = await unfriendAction({ otherUserId: userId })
      if (!r.success) toast.error(r.error)
      else {
        toast.success('Removed')
        router.refresh()
      }
    })
  }

  function confirmBlock(userId: string, label: string) {
    startTransition(async () => {
      const r = await blockUserAction({ targetUserId: userId })
      if (!r.success) toast.error(r.error)
      else {
        toast.success(`Blocked ${label}`)
        router.refresh()
      }
    })
  }

  if (friends.length === 0) {
    return (
      <EmptyState
        title="You haven't added any friends yet"
        body="Search for writers above or browse the Suggested tab to send your first friend request."
        action={
          <Link
            href={`/${locale}/friends?tab=suggested`}
            className="inline-flex items-center px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              textDecoration: 'none',
            }}
          >
            Find writers
          </Link>
        }
      />
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {friends.map((f) => {
          const label = f.displayName ?? f.username ?? 'Unknown'
          return (
            <li
              key={f.userId}
              className="flex items-center gap-3 px-4 py-3"
              style={cardStyle}
            >
              <Avatar url={f.avatarUrl} label={label} />
              <div className="flex-1 min-w-0">
                <Link
                  href={f.username ? `/${locale}/u/${f.username}` : '#'}
                  className="text-[14px] font-medium no-underline truncate block"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {label}
                </Link>
                <p
                  className="text-[11px] truncate"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {f.username ? `@${f.username}` : ''} · friends since{' '}
                  {relTime(f.friendsSince)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Friend options"
                    className="p-1.5 rounded cursor-pointer"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    <MoreVertical size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {f.username && (
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/u/${f.username}`}>
                        <User size={14} /> View profile
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      handleMute(f.userId, label)
                    }}
                  >
                    <VolumeX size={14} /> Mute
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setDialog({ mode: 'block', userId: f.userId, label })
                    }}
                    variant="destructive"
                  >
                    <ShieldX size={14} /> Block
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setDialog({ mode: 'unfriend', userId: f.userId, label })
                    }}
                    variant="destructive"
                  >
                    <UserMinus size={14} /> Unfriend
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={dialog.mode === 'unfriend'}
        onOpenChange={(open) => !open && setDialog({ mode: 'closed' })}
        title={
          dialog.mode === 'unfriend' ? `Unfriend ${dialog.label}?` : 'Unfriend?'
        }
        description="You can send another friend request later."
        confirmLabel="Unfriend"
        variant="destructive"
        onConfirm={() => {
          if (dialog.mode === 'unfriend') confirmUnfriend(dialog.userId)
        }}
      />
      <ConfirmDialog
        open={dialog.mode === 'block'}
        onOpenChange={(open) => !open && setDialog({ mode: 'closed' })}
        title={
          dialog.mode === 'block' ? `Block ${dialog.label}?` : 'Block?'
        }
        description="Blocking will unfriend, stop notifications, and hide each other across the app."
        confirmLabel="Block"
        variant="destructive"
        onConfirm={() => {
          if (dialog.mode === 'block')
            confirmBlock(dialog.userId, dialog.label)
        }}
      />
    </>
  )
}
