'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronDown, UserMinus, UserPlus, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  rejectFriendRequestAction,
  sendFriendRequestAction,
  unfriendAction,
  type FriendshipStatus,
} from '@/lib/actions/friendships.actions'

type Props = {
  targetUserId: string
  locale: string
  initialStatus: FriendshipStatus
  initialFriendshipId?: string | null
  isAuthenticated: boolean
  isSelf: boolean
}

const BASE_BTN =
  'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'

export function FriendButton({
  targetUserId,
  locale,
  initialStatus,
  initialFriendshipId,
  isAuthenticated,
  isSelf,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<FriendshipStatus>(initialStatus)
  const [friendshipId, setFriendshipId] = useState<string | null>(initialFriendshipId ?? null)
  const [isPending, startTransition] = useTransition()

  if (isSelf) return null

  if (!isAuthenticated) {
    return (
      <Link
        href={`/${locale}/sign-in`}
        className={`${BASE_BTN} border border-[#2a2a2a] text-[#888] hover:text-white no-underline`}
      >
        <UserPlus size={12} /> Sign in to add friend
      </Link>
    )
  }

  function handleSend() {
    startTransition(async () => {
      const result = await sendFriendRequestAction({ recipientId: targetUserId })
      if (!result.success) {
        toast.error(humanize(result.error))
        return
      }
      if (result.data.autoAccepted) {
        setStatus('ACCEPTED')
        toast.success('You are now friends!')
      } else {
        setStatus('PENDING_OUTGOING')
        toast.success('Friend request sent')
      }
      router.refresh()
    })
  }

  function handleCancel() {
    if (!friendshipId) {
      // We don't have the id from this surface — fall back to refresh.
      router.refresh()
      return
    }
    startTransition(async () => {
      const result = await cancelFriendRequestAction({ friendshipId })
      if (!result.success) {
        toast.error(humanize(result.error))
        return
      }
      setStatus('NONE')
      setFriendshipId(null)
      toast.success('Request cancelled')
      router.refresh()
    })
  }

  function handleAccept() {
    if (!friendshipId) {
      router.refresh()
      return
    }
    startTransition(async () => {
      const result = await acceptFriendRequestAction({ friendshipId })
      if (!result.success) {
        toast.error(humanize(result.error))
        return
      }
      setStatus('ACCEPTED')
      toast.success('Friend request accepted')
      router.refresh()
    })
  }

  function handleReject() {
    if (!friendshipId) {
      router.refresh()
      return
    }
    startTransition(async () => {
      const result = await rejectFriendRequestAction({ friendshipId })
      if (!result.success) {
        toast.error(humanize(result.error))
        return
      }
      setStatus('NONE')
      setFriendshipId(null)
      toast.success('Request declined')
      router.refresh()
    })
  }

  function handleUnfriend() {
    startTransition(async () => {
      const result = await unfriendAction({ otherUserId: targetUserId })
      if (!result.success) {
        toast.error(humanize(result.error))
        return
      }
      setStatus('NONE')
      setFriendshipId(null)
      toast.success('Removed friend')
      router.refresh()
    })
  }

  if (status === 'NONE') {
    return (
      <button
        onClick={handleSend}
        disabled={isPending}
        className={`${BASE_BTN}`}
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        <UserPlus size={12} /> Add Friend
      </button>
    )
  }

  if (status === 'PENDING_OUTGOING') {
    return (
      <button
        onClick={handleCancel}
        disabled={isPending}
        className={`${BASE_BTN} border border-[#2a2a2a] text-[#888] hover:text-white`}
      >
        <X size={12} /> Cancel Request
      </button>
    )
  }

  if (status === 'PENDING_INCOMING') {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={handleAccept}
          disabled={isPending}
          className={`${BASE_BTN}`}
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <Check size={12} /> Accept
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className={`${BASE_BTN} border border-[#2a2a2a] text-[#888] hover:text-white`}
        >
          <X size={12} /> Decline
        </button>
      </div>
    )
  }

  // ACCEPTED
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isPending}
          className={`${BASE_BTN} bg-[#2a2a2a] text-[#aaa] hover:text-white`}
        >
          <Check size={12} /> Friends <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
      >
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); handleUnfriend() }}
          variant="destructive"
          className="cursor-pointer"
        >
          <UserMinus size={14} /> Unfriend
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function humanize(code: string): string {
  switch (code) {
    case 'ALREADY_FRIENDS': return 'You are already friends'
    case 'ALREADY_REQUESTED': return 'Request already sent'
    case 'CANNOT_FRIEND_SELF': return 'You cannot friend yourself'
    case 'NOT_AUTHORIZED': return "You can't do that"
    case 'NOT_PENDING': return 'Request is no longer pending'
    case 'NOT_FOUND': return 'Request not found'
    case 'NOT_FRIENDS': return 'You are not friends with this user'
    default: return 'Something went wrong'
  }
}
