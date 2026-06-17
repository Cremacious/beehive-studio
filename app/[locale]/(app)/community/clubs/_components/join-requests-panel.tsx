'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import {
  listClubJoinRequestsAction,
  respondToJoinRequestAction,
  type ClubJoinRequestRow,
} from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import { Avatar, relTime } from '@/app/[locale]/(app)/community/friends/_components/shared'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
}

export function JoinRequestsPanel({ clubId, viewerRole }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ClubJoinRequestRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  const canApprove = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  useEffect(() => {
    if (!canApprove) return
    let cancelled = false
    startTransition(async () => {
      const r = await listClubJoinRequestsAction({ clubId })
      if (cancelled) return
      if (r.success) {
        setRows(r.data.rows)
        setLoadError(null)
      } else {
        setRows([])
        setLoadError(r.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [clubId, canApprove])

  function handleRespond(requestId: string, accept: boolean) {
    setRemoved((prev) => new Set(prev).add(requestId))
    startTransition(async () => {
      const r = await respondToJoinRequestAction({ requestId, accept })
      if (!r.success) {
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(requestId)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success(accept ? 'Request approved' : 'Request rejected')
        router.refresh()
      }
    })
  }

  if (!canApprove) return null

  if (rows === null) {
    return (
      <div
        className="rounded-[var(--r-row)] p-4 text-[12px] italic"
        style={{
          background: 'var(--canvas-dark-100)',
          color: 'var(--canvas-dark-ink-muted)',
          boxShadow: 'var(--sh-inset)',
        }}
      >
        Loading join requests…
      </div>
    )
  }

  if (loadError) {
    return (
      <div
        className="rounded-[var(--r-row)] p-4 text-[12px] italic"
        style={{
          background: 'var(--canvas-dark-100)',
          color: 'var(--canvas-dark-ink-muted)',
          boxShadow: 'var(--sh-inset)',
        }}
      >
        Couldn&apos;t load requests ({loadError}).
      </div>
    )
  }

  const visible = rows.filter((r) => !removed.has(r.requestId))

  if (visible.length === 0) {
    return (
      <div
        className="rounded-[var(--r-row)] p-4 text-[12px] italic"
        style={{
          background: 'var(--canvas-dark-100)',
          color: 'var(--canvas-dark-ink-muted)',
          boxShadow: 'var(--sh-inset)',
        }}
      >
        No pending join requests.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {visible.map((row) => {
        const handle =
          row.requester.username ?? row.requester.displayName ?? 'Unknown'
        return (
          <li
            key={row.requestId}
            className="flex items-center gap-3 rounded-[var(--r-row)] p-3"
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            <Avatar url={row.requester.avatarUrl} label={handle} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">
                @{handle}
              </div>
              <div
                className="text-[11px] truncate"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Requested {relTime(row.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRespond(row.requestId, true)}
                className="flex items-center gap-1 rounded-[var(--r-btn)] px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
                aria-label={`Approve @${handle}`}
              >
                <Check size={12} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleRespond(row.requestId, false)}
                className="flex items-center gap-1 rounded-[var(--r-btn)] px-3 py-1.5 text-[12px] font-medium"
                style={{
                  background: 'var(--canvas-dark-100)',
                  color: 'var(--canvas-dark-ink)',
                  boxShadow: 'var(--sh-inset)',
                }}
                aria-label={`Reject @${handle}`}
              >
                <X size={12} />
                Reject
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
