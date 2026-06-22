'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { toggleSparkLikeAction } from '@/lib/actions/social.actions'

type Props = {
  sparkId: string
  initialLiked: boolean
  initialCount: number
  /** Hint: when known to be a guest, click short-circuits to a sign-in nudge.
   *  When true OR omitted, the action is called and AUTH_REQUIRED is handled
   *  reactively so SSR'd auth state can lag without false-negative toasts. */
  isAuthenticated?: boolean
  locale?: string
  size?: 'sm' | 'md'
}

export function SparkLikeButton({
  sparkId,
  initialLiked,
  initialCount,
  isAuthenticated,
  locale,
  size = 'sm',
}: Props) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Only short-circuit when we KNOW the viewer is a guest. When auth state
    // is unknown (prop omitted), call the action and let AUTH_REQUIRED bubble.
    if (isAuthenticated === false) {
      toast.info('Sign in to like sparks')
      if (locale) router.push(`/${locale}/sign-in`)
      return
    }

    const prevLiked = liked
    const prevCount = count
    setLiked(!liked)
    setCount(liked ? Math.max(count - 1, 0) : count + 1)

    startTransition(async () => {
      const result = await toggleSparkLikeAction(sparkId)
      if (!result.success) {
        setLiked(prevLiked)
        setCount(prevCount)
        if (result.error === 'AUTH_REQUIRED') {
          toast.info('Sign in to like sparks')
          if (locale) router.push(`/${locale}/sign-in`)
        } else {
          toast.error('Could not update like')
        }
        return
      }
      setLiked(result.data.liked)
      setCount(result.data.likeCount)
    })
  }

  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike spark' : 'Like spark'}
      className={`inline-flex items-center gap-1 ${textSize} text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] transition disabled:opacity-60`}
    >
      <Heart
        className={`${iconSize} ${liked ? 'fill-current text-[var(--brand)]' : ''}`}
      />
      <span className={liked ? 'text-[var(--brand)]' : ''}>{count}</span>
    </button>
  )
}
