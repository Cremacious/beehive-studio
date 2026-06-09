'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import {
  acceptFriendRequestAction,
  rejectFriendRequestAction,
} from '@/lib/actions/friendships.actions'

export type RequestsSample = {
  friendshipId: string
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

// Deterministic avatar tone picker matching the activity-event-row palette.
const AVATAR_TONES = ['blue', 'mint', 'lilac', 'coral', 'slate'] as const
function pickTone(seed: string): (typeof AVATAR_TONES)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

export function RequestsCard({
  locale,
  count,
  samples,
}: {
  locale: string
  count: number
  samples: RequestsSample[]
}) {
  // Hide row instantly on accept/decline (optimistic remove).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const visible = samples.filter((s) => !dismissed.has(s.friendshipId)).slice(0, 5)
  const remaining = count - dismissed.size
  if (remaining <= 0) return null
  const hasMore = remaining > visible.length

  function handleAccept(friendshipId: string) {
    setBusyId(friendshipId)
    startTransition(async () => {
      const r = await acceptFriendRequestAction({ friendshipId })
      if (r.success) {
        setDismissed((prev) => new Set(prev).add(friendshipId))
        toast.success('Friend request accepted')
        router.refresh()
      } else {
        toast.error(`Could not accept (${r.error})`)
      }
      setBusyId(null)
    })
  }

  function handleDecline(friendshipId: string) {
    setBusyId(friendshipId)
    startTransition(async () => {
      const r = await rejectFriendRequestAction({ friendshipId })
      if (r.success) {
        setDismissed((prev) => new Set(prev).add(friendshipId))
        toast.success('Request declined')
        router.refresh()
      } else {
        toast.error(`Could not decline (${r.error})`)
      }
      setBusyId(null)
    })
  }

  return (
    <section className="panel rail-card" aria-label="Friend requests">
      <div className="sec-head" style={{ margin: '14px 18px 4px' }}>
        <h2 style={{ fontSize: 15 }}>Requests</h2>
        <span className="count">{remaining}</span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visible.map((s) => {
          const initial = (s.username ?? s.displayName ?? '?')[0]?.toUpperCase() ?? '?'
          const tone = pickTone(s.userId)
          const display = s.displayName ?? (s.username ? `@${s.username}` : 'Someone')
          const handle = s.username ? `@${s.username}` : null
          const busy = busyId === s.friendshipId
          return (
            <li key={s.friendshipId} className="rail-row">
              <div className="top">
                {s.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.avatarUrl}
                    alt=""
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span
                    className={`avatar s40 a-${tone}`}
                    style={{ width: 40, height: 40, fontSize: 15 }}
                  >
                    {initial}
                  </span>
                )}
                <div>
                  <p className="name">{display}</p>
                  {handle ? <p className="sub">{handle}</p> : null}
                </div>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn-pill brand"
                  onClick={() => handleAccept(s.friendshipId)}
                  disabled={busy}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn-pill tile"
                  onClick={() => handleDecline(s.friendshipId)}
                  disabled={busy}
                >
                  Decline
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <Link
        className="see-all"
        href={`/${locale}/friends?tab=pending&seg=received`}
        style={{ margin: '4px 18px 14px' }}
      >
        {hasMore ? `See all ${remaining} requests` : 'Manage requests'}
        <ArrowRight />
      </Link>
    </section>
  )
}
