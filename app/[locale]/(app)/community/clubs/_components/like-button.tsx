'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import {
  toggleClubDiscussionLikeAction,
  toggleClubReplyLikeAction,
} from '@/lib/actions/book-clubs.actions'

type Props = {
  variant: 'post' | 'reply'
  targetId: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({
  variant,
  targetId,
  initialLiked,
  initialCount,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    const prevLiked = liked
    const prevCount = count
    setLiked(!liked)
    setCount(liked ? count - 1 : count + 1)

    startTransition(async () => {
      const result =
        variant === 'post'
          ? await toggleClubDiscussionLikeAction({ discussionId: targetId })
          : await toggleClubReplyLikeAction({ replyId: targetId })

      if (!result.success) {
        setLiked(prevLiked)
        setCount(prevCount)
        toast.error('Could not update like')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className="inline-flex items-center gap-1 text-xs text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] transition disabled:opacity-60"
    >
      <Heart
        className={`h-3.5 w-3.5 ${liked ? 'fill-current text-[var(--brand)]' : ''}`}
      />
      <span className={liked ? 'text-[var(--brand)]' : ''}>{count}</span>
    </button>
  )
}
