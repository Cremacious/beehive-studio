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

// Forum-table grid: Member / Role / Joined / kebab
const MROW_COLS = '1fr 120px 110px 40px'

const AVATAR_TONES = ['lilac', 'coral', 'mint', 'blue', 'slate'] as const

function avatarTone(member: ClubMemberListItem): (typeof AVATAR_TONES)[number] {
  // Deterministic hash → tone (matches bundle mockup's per-row avatar variety)
  const key = member.userId
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
}

function initials(member: ClubMemberListItem): string {
  const source = member.displayName ?? member.username ?? '??'
  const parts = source.trim().split(/\s+/).slice(0, 2)
  return parts
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase() || '??'
}

function joinedLabel(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const ROLE_PILL_CLASS: Record<BookClubMemberRole, string> = {
  // .pill.role-owner reads var(--brand) — 13th sanctioned brand-yellow surface
  // (cascade: .pill { background: oklch(from var(--pt) l c h / 0.14); color: var(--pt); ... })
  OWNER: 'pill role-owner',
  MODERATOR: 'pill role-mod',
  MEMBER: 'pill role-member',
}

const ROLE_LABEL: Record<BookClubMemberRole, string> = {
  OWNER: 'Owner',
  MODERATOR: 'Mod',
  MEMBER: 'Member',
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
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

      <section className="panel ftable" aria-label="Members">
        <div className="strip">
          <ul style={{ gridTemplateColumns: MROW_COLS }}>
            <li>Member</li>
            <li>Role</li>
            <li className="ralign">Joined</li>
            <li></li>
          </ul>
        </div>
        <ul className="rows">
          {members.map((member) => {
            const canChangeThisMember = isOwner && member.role !== 'OWNER'
            const canRemoveThisMember =
              (isOwner && member.role !== 'OWNER') ||
              (isMod && member.role === 'MEMBER')
            const canTransferToThisMember = isOwner && member.role !== 'OWNER'
            const hasKebabAction =
              canChangeThisMember || canRemoveThisMember || canTransferToThisMember
            const tone = avatarTone(member)
            const displayName = member.displayName ?? member.username ?? 'Unknown'

            return (
              <li
                key={member.id}
                style={{ gridTemplateColumns: MROW_COLS }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatarUrl}
                      alt=""
                      className="avatar s40 object-cover"
                    />
                  ) : (
                    <span className={`avatar s40 a-${tone}`}>
                      {initials(member)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-[var(--canvas-dark-ink-strong)] truncate">
                      {displayName}
                    </div>
                    {member.username && (
                      <Link
                        href={`/${locale}/u/${member.username}`}
                        className="meta-mono hover:text-[var(--canvas-dark-ink-strong)] truncate block"
                      >
                        @{member.username}
                      </Link>
                    )}
                  </div>
                </div>
                <div>
                  <span className={ROLE_PILL_CLASS[member.role]}>
                    <span className="dot"></span>
                    {ROLE_LABEL[member.role]}
                  </span>
                </div>
                <div className="ralign meta-mono">
                  {joinedLabel(member.joinedAt)}
                </div>
                <div className="ralign">
                  {isModOrOwner && hasKebabAction && (
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenKebabId((id) =>
                            id === member.id ? null : member.id,
                          )
                        }
                        aria-label="Member actions"
                        aria-haspopup="menu"
                        aria-expanded={openKebabId === member.id}
                        className="kebab"
                      >
                        <MoreHorizontal />
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
                </div>
              </li>
            )
          })}
        </ul>
      </section>

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
