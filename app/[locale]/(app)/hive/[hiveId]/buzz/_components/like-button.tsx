'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { toggleBuzzLikeAction } from '@/lib/actions/hive-buzz.actions'

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
      style={{
        color: liked ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
        borderRadius: 'var(--r-pill)',
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))] disabled:opacity-60"
    >
      <Heart
        size={14}
        fill={liked ? 'var(--brand)' : 'none'}
        strokeWidth={liked ? 2 : 1.75}
      />
      <span>{count}</span>
    </button>
  )
}
