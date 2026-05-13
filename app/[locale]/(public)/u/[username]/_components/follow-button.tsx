'use client'
import { useState, useTransition } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
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
      <Link href={`/${locale}/sign-in`} className="px-4 py-1.5 border border-[#2a2a2a] text-[#888] rounded-md text-[12px] hover:text-white transition-colors">
        Sign in to follow
      </Link>
    )
  }

  const handle = () => {
    const next = !following
    setFollowing(next)
    startTransition(async () => {
      const result = await toggleFollowAction(targetUserId)
      if (!result.success) setFollowing(!next)
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`px-4 py-1.5 rounded-md text-[12px] transition-colors cursor-pointer ${
        following
          ? 'bg-[#2a2a2a] text-[#aaa] hover:text-white'
          : 'border border-[#2a2a2a] text-[#888] hover:text-white'
      }`}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  )
}
