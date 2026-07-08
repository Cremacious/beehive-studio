'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, X } from 'lucide-react'
import type { HivePendingInvite } from '@/lib/actions/hive.actions'
import { revokeHiveInviteAction } from '@/lib/actions/hive.actions'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { relTime } from '@/lib/utils/rel-time'

type Props = {
  hiveId: string
  invites: HivePendingInvite[]
  canManage: boolean
}

/**
 * Shows outstanding person-invites so an inviter can confirm their invite
 * landed. Renders straight from the `invites` prop (server-fetched), so a
 * `router.refresh()` after a new invite flows a fresh list in. A local
 * `revoked` set gives an instant optimistic hide on cancel.
 */
export function PendingInvitesPanel({ hiveId, invites, canManage }: Props) {
  const router = useRouter()
  const [revoked, setRevoked] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const visible = invites.filter((i) => !revoked.has(i.inviteId))
  if (visible.length === 0) return null

  function handleRevoke(inviteId: string) {
    setRevoked((prev) => new Set(prev).add(inviteId))
    startTransition(async () => {
      try {
        const result = await revokeHiveInviteAction(hiveId, inviteId)
        if (result.success) {
          toast.success('Invite revoked')
          router.refresh()
        } else {
          setRevoked((prev) => {
            const next = new Set(prev)
            next.delete(inviteId)
            return next
          })
          toastActionError(result.error)
        }
      } catch {
        setRevoked((prev) => {
          const next = new Set(prev)
          next.delete(inviteId)
          return next
        })
        toastNetworkError()
      }
    })
  }

  return (
    <div className="px-6 pt-5 pb-1 flex flex-col gap-2.5 max-md:px-4 max-md:pt-4">
      <span
        className="font-mono uppercase"
        style={{
          fontSize: '10px',
          letterSpacing: '0.14em',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        Pending invites · {visible.length}
      </span>

      <ul
        className="flex flex-col"
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          borderRadius: 'var(--r-row)',
          padding: 4,
        }}
      >
        {visible.map((invite) => {
          const handle = invite.username ? `@${invite.username}` : null
          const name = invite.displayName ?? handle ?? 'Pending member'
          const initial = (invite.displayName ?? invite.username ?? '?')
            .charAt(0)
            .toUpperCase()
          return (
            <li
              key={invite.inviteId}
              className="flex items-center gap-2.5 px-2.5 py-2"
              style={{ borderRadius: 'var(--r-btn)' }}
            >
              <div
                className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 font-comfortaa font-semibold"
                style={{
                  width: 30,
                  height: 30,
                  fontSize: 12,
                  background: 'oklch(from var(--brand) l c h / 0.18)',
                  color: 'var(--brand)',
                }}
              >
                {invite.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={invite.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className="font-comfortaa font-semibold truncate"
                  style={{ fontSize: 13, color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {name}
                </div>
                <div
                  className="font-mono truncate flex items-center gap-1.5"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: '0.04em',
                    color: 'var(--canvas-dark-ink-muted)',
                    marginTop: 1,
                  }}
                >
                  <Clock size={10} strokeWidth={2} />
                  Invited {relTime(invite.createdAt)}
                  {handle && invite.displayName ? ` · ${handle}` : ''}
                </div>
              </div>

              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 font-mono uppercase flex-shrink-0"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  color: 'var(--role-reader)',
                  background: 'oklch(from var(--role-reader) l c h / 0.14)',
                  border: '1px solid oklch(from var(--role-reader) l c h / 0.3)',
                  borderRadius: 'var(--r-pill)',
                }}
              >
                Pending
              </span>

              {canManage ? (
                <button
                  type="button"
                  onClick={() => handleRevoke(invite.inviteId)}
                  aria-label={`Revoke invite for ${name}`}
                  style={{
                    color: 'var(--canvas-dark-ink-muted)',
                    borderRadius: 'var(--r-btn)',
                    background: 'transparent',
                    border: 0,
                    width: 30,
                    height: 30,
                  }}
                  className="inline-flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.05] hover:text-[var(--canvas-dark-ink-strong)]"
                >
                  <X size={15} />
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
