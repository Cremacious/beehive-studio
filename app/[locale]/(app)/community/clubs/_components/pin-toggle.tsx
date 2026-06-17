'use client'

import { useState, useTransition } from 'react'
import { Pin, PinOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { BookClubMemberRole } from '@/db/schema/social'
import { pinClubDiscussionAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  discussionId: string
  initialPinned: boolean
  viewerRole: BookClubMemberRole | null
}

export function PinToggle({ discussionId, initialPinned, viewerRole }: Props) {
  const [pinned, setPinned] = useState(initialPinned)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (viewerRole !== 'OWNER' && viewerRole !== 'MODERATOR') return null

  const handleClick = () => {
    const next = !pinned
    setPinned(next)
    startTransition(async () => {
      const result = await pinClubDiscussionAction({
        discussionId,
        pin: next,
      })
      if (!result.success) {
        setPinned(!next)
        toast.error('Could not update pin')
        return
      }
      toast.success(next ? 'Discussion pinned' : 'Discussion unpinned')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={pinned}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-btn)] text-xs font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] border border-[var(--br-card)] hover:border-[var(--brand)] transition disabled:opacity-60"
    >
      {pinned ? (
        <>
          <PinOff className="h-3.5 w-3.5" /> Unpin
        </>
      ) : (
        <>
          <Pin className="h-3.5 w-3.5" /> Pin
        </>
      )}
    </button>
  )
}
