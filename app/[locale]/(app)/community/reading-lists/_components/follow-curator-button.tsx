'use client'

import { useState, useTransition } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'

type Props = { userId: string }

export function FollowCuratorButton({ userId }: Props) {
  const [following, setFollowing] = useState(false)
  const [pending, startTransition] = useTransition()

  function onClick() {
    // Optimistic flip, rollback on failure.
    setFollowing(true)
    startTransition(async () => {
      try {
        const result = await toggleFollowAction(userId)
        if (!result.success) {
          setFollowing(false)
          toastActionError(result.error)
        } else {
          setFollowing(result.data.following)
        }
      } catch {
        setFollowing(false)
        toastNetworkError()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || following}
      className="shrink-0 text-[10px] font-bold"
      style={{
        background: following
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(255,195,0,0.12)',
        color: following ? 'var(--canvas-dark-ink-muted)' : 'var(--brand)',
        border: following
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(255,195,0,0.3)',
        borderRadius: 'var(--r-pill)',
        padding: '5px 11px',
        cursor: pending || following ? 'default' : 'pointer',
        fontFamily: 'var(--font-mono)',
      }}
      aria-pressed={following}
    >
      {following ? 'Following' : '+ Follow'}
    </button>
  )
}
