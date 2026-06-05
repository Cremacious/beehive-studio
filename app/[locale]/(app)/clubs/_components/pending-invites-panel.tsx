'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import {
  cancelClubInviteAction,
  listClubPendingInvitesAction,
  type ClubPendingInviteRow,
} from '@/lib/actions/book-clubs.actions'
import { Avatar, relTime } from '@/app/[locale]/(app)/friends/_components/shared'

type Props = {
  clubId: string
}

export function PendingInvitesPanel({ clubId }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ClubPendingInviteRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    startTransition(async () => {
      const r = await listClubPendingInvitesAction({ clubId })
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
  }, [clubId])

  function handleCancel(inviteId: string) {
    setRemoved((prev) => new Set(prev).add(inviteId))
    startTransition(async () => {
      const r = await cancelClubInviteAction({ inviteId })
      if (!r.success) {
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(inviteId)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success('Invite canceled')
        router.refresh()
      }
    })
  }

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
        Loading invites…
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
        Couldn&apos;t load invites ({loadError}).
      </div>
    )
  }

  const visible = rows.filter((r) => !removed.has(r.inviteId))

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
        No pending invites.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {visible.map((row) => {
        const recipientHandle =
          row.recipient.username ?? row.recipient.displayName ?? 'Unknown'
        const inviterHandle =
          row.inviter.username ?? row.inviter.displayName ?? 'Unknown'
        return (
          <li
            key={row.inviteId}
            className="flex items-center gap-3 rounded-[var(--r-row)] p-3"
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            <Avatar
              url={row.recipient.avatarUrl}
              label={recipientHandle}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">
                @{recipientHandle}
              </div>
              <div
                className="text-[11px] truncate"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Invited by @{inviterHandle} · {relTime(row.createdAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCancel(row.inviteId)}
              className="flex items-center gap-1 rounded-[var(--r-btn)] px-3 py-1.5 text-[12px] font-medium"
              style={{
                background: 'var(--canvas-dark-100)',
                color: 'var(--canvas-dark-ink)',
                boxShadow: 'var(--sh-inset)',
              }}
              aria-label={`Cancel invite to @${recipientHandle}`}
            >
              <X size={12} />
              Cancel
            </button>
          </li>
        )
      })}
    </ul>
  )
}
