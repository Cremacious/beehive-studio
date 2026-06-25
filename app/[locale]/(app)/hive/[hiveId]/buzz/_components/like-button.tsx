'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { toggleBuzzLikeAction } from '@/lib/actions/hive-buzz.actions'
import { toastNetworkError } from '@/lib/errors/notify'

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
      try {
        const res = await toggleBuzzLikeAction({ buzzId })
        if (!res.success) {
          setLiked(prevLiked)
          setCount(prevCount)
          toast.error('Could not update like')
        } else {
          setLiked(res.data.liked)
          setCount(res.data.likeCount)
        }
      } catch {
        setLiked(prevLiked)
        setCount(prevCount)
        toastNetworkError()
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
        color: liked ? 'var(--status-success)' : 'var(--canvas-dark-ink-muted)',
      }}
      className="inline-flex items-center gap-[7px] bg-transparent border-0 cursor-pointer font-mono text-[12px] tracking-wider p-0 disabled:opacity-60"
    >
      <Heart
        size={16}
        fill={liked ? 'var(--status-success)' : 'none'}
        stroke={liked ? 'var(--status-success)' : 'currentColor'}
        strokeWidth={1.9}
      />
      <span>{count}</span>
    </button>
  )
}
