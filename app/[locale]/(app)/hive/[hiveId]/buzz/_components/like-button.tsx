'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { toggleBuzzLikeAction } from '@/lib/actions/hive-buzz.actions'
import { cn } from '@/lib/utils'

export function LikeButton({
  buzzId,
  initialLiked,
  initialCount,
}: {
  buzzId: string
  initialLiked: boolean
  initialCount: number
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  function onClick() {
    if (pending) return
    const prevLiked = liked
    const prevCount = count
    // Optimistic toggle
    setLiked(!prevLiked)
    setCount(prevCount + (prevLiked ? -1 : 1))
    startTransition(async () => {
      const res = await toggleBuzzLikeAction({ buzzId })
      if (!res.success) {
        setLiked(prevLiked)
        setCount(prevCount)
        toast.error('Could not update like')
      } else {
        // Replace with server-truth (handles serialized races)
        setLiked(res.data.liked)
        setCount(res.data.likeCount)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        liked
          ? 'text-brand'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}
    >
      <Heart
        size={14}
        className={liked ? 'fill-current' : ''}
        strokeWidth={liked ? 2 : 1.75}
      />
      <span>{count}</span>
    </button>
  )
}
