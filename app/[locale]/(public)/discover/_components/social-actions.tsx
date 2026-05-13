'use client'

import { useState, useTransition } from 'react'
import { toggleBookLikeAction, toggleBookmarkAction, toggleFollowAction } from '@/lib/actions/social.actions'

type Props = {
  bookId: string
  authorUserId: string
  locale: string
  initialLiked: boolean
  initialBookmarked: boolean
  initialFollowing: boolean
  initialLikeCount: number
  isAuthenticated: boolean
}

export function SocialActions({
  bookId,
  authorUserId,
  locale,
  initialLiked,
  initialBookmarked,
  initialFollowing,
  initialLikeCount,
  isAuthenticated,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [following, setFollowing] = useState(initialFollowing)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [isPending, startTransition] = useTransition()

  const handleLike = () => {
    const next = !liked
    setLiked(next)
    setLikeCount(c => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = await toggleBookLikeAction(bookId)
      if (!result.success) {
        setLiked(!next)
        setLikeCount(c => c + (next ? -1 : 1))
      }
    })
  }

  const handleBookmark = () => {
    const next = !bookmarked
    setBookmarked(next)
    startTransition(async () => {
      const result = await toggleBookmarkAction(bookId)
      if (!result.success) setBookmarked(!next)
    })
  }

  const handleFollow = () => {
    const next = !following
    setFollowing(next)
    startTransition(async () => {
      const result = await toggleFollowAction(authorUserId)
      if (!result.success) setFollowing(!next)
    })
  }

  if (!isAuthenticated) {
    return (
      <p className="text-[#555] text-xs">
        <a href={`/${locale}/sign-in`} className="text-[#FFC300] hover:underline">Sign in</a>
        {' '}to like, bookmark, and follow
      </p>
    )
  }

  return (
    <div className="flex gap-2.5 items-center flex-wrap">
      <button
        onClick={handleLike}
        disabled={isPending}
        className={`px-4 py-2 rounded-md text-sm transition-colors cursor-pointer ${
          liked ? 'bg-[#FFC300] text-black font-semibold' : 'bg-transparent border border-[#2a2a2a] text-[#aaa] hover:text-white'
        }`}
      >
        ♥ {liked ? 'Liked' : 'Like'} · {likeCount}
      </button>
      <button
        onClick={handleBookmark}
        disabled={isPending}
        className={`px-4 py-2 rounded-md text-sm transition-colors cursor-pointer ${
          bookmarked ? 'bg-[#2a2a2a] text-[#FFC300]' : 'bg-transparent border border-[#2a2a2a] text-[#aaa] hover:text-white'
        }`}
      >
        🔖 {bookmarked ? 'Bookmarked' : 'Bookmark'}
      </button>
      <button
        onClick={handleFollow}
        disabled={isPending}
        className={`px-4 py-2 rounded-md text-sm transition-colors cursor-pointer ${
          following ? 'bg-[#2a2a2a] text-[#FFC300]' : 'bg-transparent border border-[#2a2a2a] text-[#aaa] hover:text-white'
        }`}
      >
        {following ? '✓ Following' : '+ Follow'}
      </button>
    </div>
  )
}
