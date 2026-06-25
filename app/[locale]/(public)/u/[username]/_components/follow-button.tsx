'use client'
import { useState, useTransition } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import Link from 'next/link'

type Props = {
  targetUserId: string
  locale: string
  initialFollowing: boolean
  isAuthenticated: boolean
}

export function FollowButton({ targetUserId, locale, initialFollowing, isAuthenticated }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [isPending, startTransition] = useTransition()

  if (!isAuthenticated) {
    return (
      <Link href={`/${locale}/sign-in`} className="btn-tile btn-sm">
        Sign in to follow
      </Link>
    )
  }

  const handle = () => {
    const next = !following
    setFollowing(next)
    startTransition(async () => {
      try {
        const result = await toggleFollowAction(targetUserId)
        if (!result.success) {
          setFollowing(!next)
          toastActionError(result.error)
        }
      } catch {
        setFollowing(!next)
        toastNetworkError()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending}
      className={following ? 'btn-tile btn-sm' : 'btn-brand btn-sm'}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  )
}
