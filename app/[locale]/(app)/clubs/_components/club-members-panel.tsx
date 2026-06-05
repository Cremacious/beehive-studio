'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import type { BookClubMemberRole } from '@/db/schema/social'
import {
  listClubMembersAction,
  removeClubMemberAction,
  leaveClubAction,
  type ClubMemberListItem,
} from '@/lib/actions/book-clubs.actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RoleChangeDialog } from './role-change-dialog'
import { TransferOwnershipDialog } from './transfer-ownership-dialog'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

const ROLE_PILL: Record<BookClubMemberRole, { label: string; cls: string }> = {
  OWNER: {
    label: 'Owner',
    cls: 'bg-[var(--brand)] text-[var(--brand-ink)]',
  },
  MODERATOR: {
    label: 'Mod',
    cls: 'bg-[oklch(0.55_0.12_240_/_0.18)] text-[oklch(0.78_0.12_240)] border border-[oklch(0.55_0.12_240_/_0.3)]',
  },
  MEMBER: {
    label: 'Member',
    cls: 'border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]',
  },
}

function relTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const diffMs = Date.now() - date.getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function ClubMembersPanel({ clubId, viewerRole, locale }: Props) {
  const [members, setMembers] = useState<ClubMemberListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [openKebabId, setOpenKebabId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClubMemberListItem | null>(
    null,
  )
  const [roleTarget, setRoleTarget] = useState<ClubMemberListItem | null>(null)
  const [transferTarget, setTransferTarget] =
    useState<ClubMemberListItem | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const result = await listClubMembersAction({ clubId })
      if (cancelled) return
      if (result.success) {
        setMembers(result.data.members)
        setError(null)
      } else {
        setError(result.error)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clubId])

  if (error) {
    return (
      <p className="text-sm text-[var(--canvas-dark-ink-muted)] italic">
        Could not load members.
      </p>
    )
  }
  if (members === null) {
    return (
      <p className="text-sm text-[var(--canvas-dark-ink-muted)] italic">
        Loading members…
      </p>
    )
  }

  const isOwner = viewerRole === 'OWNER'
  const isMod = viewerRole === 'MODERATOR'
  const isModOrOwner = isOwner || isMod

  function handleRemove(target: ClubMemberListItem) {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await removeClubMemberAction({
          clubId,
          targetUserId: target.userId,
        })
        if (result.success) {
          toast.success(
            target.username
              ? `Removed @${target.username}.`
              : 'Member removed.',
          )
          setMembers((prev) =>
            prev ? prev.filter((m) => m.userId !== target.userId) : prev,
          )
          router.refresh()
        } else {
          toast.error('Could not remove member')
        }
        resolve()
      })
    })
  }

  function handleLeave() {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await leaveClubAction({ clubId })
        if (result.success) {
          toast.success('Left club.')
          router.refresh()
        } else if (result.error === 'OWNER_CANNOT_LEAVE') {
          toast.error('Transfer ownership before leaving.')
        } else {
          toast.error('Could not leave club')
        }
        resolve()
      })
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
          Members ({members.length})
        </h2>
        {viewerRole !== null && viewerRole !== 'OWNER' && (
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="text-xs text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]"
          >
            Leave club
          </button>
        )}
      </div>

      <ul
        className="divide-y divide-[var(--br-card)] rounded-[var(--r-card)] border border-[var(--br-card)] overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        }}
      >
        {members.map((member) => {
          const rolePill = ROLE_PILL[member.role]
          const canChangeThisMember =
            isOwner && member.role !== 'OWNER'
          const canRemoveThisMember =
            (isOwner && member.role !== 'OWNER') ||
            (isMod && member.role === 'MEMBER')
          const canTransferToThisMember =
            isOwner && member.role !== 'OWNER'
          const hasKebabAction =
            canChangeThisMember || canRemoveThisMember || canTransferToThisMember

          return (
            <li
              key={member.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="h-8 w-8 rounded-full"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                {member.username ? (
                  <Link
                    href={`/${locale}/u/${member.username}`}
                    className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)] hover:text-[var(--brand)] truncate block"
                  >
                    @{member.username}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)] truncate block">
                    {member.displayName ?? 'Unknown'}
                  </span>
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
                  Joined {relTime(member.joinedAt)}
                </span>
              </div>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${rolePill.cls}`}
              >
                {rolePill.label}
              </span>
              {isModOrOwner && hasKebabAction && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenKebabId((id) => (id === member.id ? null : member.id))
                    }
                    aria-label="Member actions"
                    aria-haspopup="menu"
                    aria-expanded={openKebabId === member.id}
                    className="p-1.5 rounded-[var(--r-btn)] text-[var(--canvas-dark-ink-muted)] hover:bg-[var(--canvas-dark-300)] hover:text-[var(--canvas-dark-ink-strong)]"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {openKebabId === member.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenKebabId(null)}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="fixed inset-0 z-10 cursor-default"
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-[var(--r-card)] border border-[var(--br-card)] py-1"
                        style={{
                          background: 'var(--canvas-dark-250)',
                          boxShadow: 'var(--sh-card)',
                        }}
                      >
                        {canChangeThisMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenKebabId(null)
                              setRoleTarget(member)
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-[var(--canvas-dark-ink)] hover:bg-[var(--canvas-dark-300)]"
                            role="menuitem"
                          >
                            Change role
                          </button>
                        )}
                        {canTransferToThisMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenKebabId(null)
                              setTransferTarget(member)
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-[var(--canvas-dark-ink)] hover:bg-[var(--canvas-dark-300)]"
                            role="menuitem"
                          >
                            Transfer ownership
                          </button>
                        )}
                        {canRemoveThisMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenKebabId(null)
                              setRemoveTarget(member)
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-destructive hover:bg-[var(--canvas-dark-300)]"
                            role="menuitem"
                          >
                            Remove from club
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {removeTarget && (
        <ConfirmDialog
          open={!!removeTarget}
          onOpenChange={(o) => !o && setRemoveTarget(null)}
          title={`Remove @${removeTarget.username ?? 'member'}?`}
          description="They will lose access to club discussions and content. They can be re-invited later."
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={() => handleRemove(removeTarget)}
        />
      )}
      {roleTarget && (roleTarget.role === 'MODERATOR' || roleTarget.role === 'MEMBER') && (
        <RoleChangeDialog
          clubId={clubId}
          memberId={roleTarget.userId}
          memberUsername={roleTarget.username}
          currentRole={roleTarget.role}
          open={!!roleTarget}
          onOpenChange={(o) => !o && setRoleTarget(null)}
        />
      )}
      {transferTarget && (
        <TransferOwnershipDialog
          clubId={clubId}
          newOwnerId={transferTarget.userId}
          newOwnerUsername={transferTarget.username}
          open={!!transferTarget}
          onOpenChange={(o) => !o && setTransferTarget(null)}
        />
      )}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this club?"
        description="You'll need to be re-invited or request to join again."
        confirmLabel="Leave club"
        variant="destructive"
        onConfirm={handleLeave}
      />
    </div>
  )
}
