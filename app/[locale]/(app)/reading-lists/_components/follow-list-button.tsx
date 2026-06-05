'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  followListAction,
  unfollowListAction,
} from '@/lib/actions/reading-lists.actions'

type Props = {
  listId: string
  initialFollowing: boolean
}

/**
 * T13 enriched: optimistic flip + rollback + sonner toast.
 */
export function FollowListButton({ listId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !following
    setFollowing(next)
    startTransition(async () => {
      const result = next
        ? await followListAction({ listId })
        : await unfollowListAction({ listId })
      if (!result.success) {
        setFollowing(!next)
        toast.error(result.error)
        return
      }
      toast.success(next ? 'Following' : 'Unfollowed')
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="text-xs px-3 py-1 rounded-[var(--r-pill)] font-semibold transition-colors disabled:opacity-60"
      style={{
        background: following ? 'var(--brand)' : 'transparent',
        color: following ? 'var(--brand-ink)' : 'var(--brand)',
        border: following ? 'none' : '1px solid var(--brand)',
      }}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  )
}
