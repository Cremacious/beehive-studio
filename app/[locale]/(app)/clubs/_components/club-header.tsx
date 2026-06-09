'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Settings, Trash2, UserPlus } from 'lucide-react'
import type { ClubSummary, ClubOwner } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import { VisibilityPill } from '@/app/[locale]/(public)/discover/_components/visibility-pill'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  joinClubAction,
  leaveClubAction,
  deleteClubAction,
  cancelMyPendingJoinRequestAction,
} from '@/lib/actions/book-clubs.actions'

type Props = {
  club: ClubSummary
  owner: ClubOwner
  viewerRole: BookClubMemberRole | null
  viewerMembership: {
    role: BookClubMemberRole | null
    pendingJoinRequest: boolean
  }
  memberCount: number
  isOwner: boolean
  locale: string
}

export function ClubHeader({
  club,
  owner,
  viewerRole,
  viewerMembership,
  memberCount,
  isOwner,
  locale,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [kebabOpen, setKebabOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const router = useRouter()

  function handleJoin() {
    startTransition(async () => {
      const result = await joinClubAction({ clubId: club.id })
      if (result.success) {
        toast.success(
          result.data.joined ? `Joined ${club.name}.` : 'Request sent.',
        )
        router.refresh()
      } else if (result.error === 'REQUEST_ALREADY_PENDING') {
        toast.info('Your join request is still pending.')
      } else {
        toast.error('Could not join club')
      }
    })
  }

  function handleLeaveConfirm() {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await leaveClubAction({ clubId: club.id })
        if (result.success) {
          toast.success(`Left ${club.name}.`)
          router.refresh()
        } else {
          toast.error('Could not leave club')
        }
        resolve()
      })
    })
  }

  function handleDeleteConfirm() {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await deleteClubAction({ clubId: club.id })
        if (result.success) {
          toast.success(`Deleted ${club.name}.`)
          router.push(`/${locale}/clubs`)
        } else {
          toast.error('Could not delete club')
        }
        resolve()
      })
    })
  }

  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const initials = club.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header
      className="panel mb-6"
      style={{
        overflow: 'hidden',
      }}
    >
      <div
        className="cover-grad"
        style={{ height: 100, '--pt': 'var(--brand)' } as React.CSSProperties}
      />
      <div className="panel-pad" style={{ paddingTop: 18 }}>
        <div className="flex items-end justify-between gap-4 -mt-12 flex-wrap">
          <div className="flex items-end gap-4 min-w-0">
            <div
              className="avatar s80 a-blue shrink-0"
              aria-hidden="true"
              style={{
                border: '4px solid var(--canvas-dark-250)',
                boxShadow: 'var(--sh-card)',
              }}
            >
              {initials || 'CL'}
            </div>
            <div className="min-w-0">
              <h1
                className="font-display font-bold text-3xl text-[var(--brand)] truncate"
              >
                {club.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <VisibilityPill visibility={club.visibility} />
                {club.openJoin && (
                  <span className="pill open-join">Open join</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {owner.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={owner.avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
                    }}
                  />
                )}
                <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
                  Owned by{' '}
                  {owner.username ? (
                    <Link
                      href={`/${locale}/u/${owner.username}`}
                      className="text-[var(--canvas-dark-ink-strong)] hover:text-[var(--brand)] transition-colors"
                    >
                      @{owner.username}
                    </Link>
                  ) : (
                    <span className="text-[var(--canvas-dark-ink-strong)]">
                      {owner.displayName ?? 'Unknown'}
                    </span>
                  )}{' '}
                  · {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>

          {/* Smart CTA cluster */}
          <div className="flex items-center gap-2 shrink-0">
          {viewerRole === null && club.openJoin && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={isPending}
              className="px-4 py-2 rounded-[var(--r-pill)] bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:bg-brand-hover disabled:opacity-60"
            >
              Join club
            </button>
          )}
          {viewerRole === null &&
            !club.openJoin &&
            viewerMembership.pendingJoinRequest && (
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1 text-xs rounded-full"
                  style={{
                    background: 'var(--canvas-dark-300)',
                    color: 'var(--canvas-dark-ink-muted)',
                  }}
                >
                  Request pending
                </span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await cancelMyPendingJoinRequestAction({
                        clubId: club.id,
                      })
                      if (result.success) {
                        toast.success('Request canceled')
                        router.refresh()
                      } else {
                        toast.error('Could not cancel request')
                      }
                    })
                  }
                  disabled={isPending}
                  className="text-xs underline text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] disabled:opacity-60"
                >
                  Cancel request
                </button>
              </div>
            )}
          {viewerRole === null &&
            !club.openJoin &&
            !viewerMembership.pendingJoinRequest && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={isPending}
                className="px-4 py-2 rounded-[var(--r-pill)] bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:bg-brand-hover disabled:opacity-60"
              >
                Request to join
              </button>
            )}
          {viewerRole === 'MEMBER' && (
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              disabled={isPending}
              className="px-4 py-2 rounded-[var(--r-pill)] border border-[var(--br-card)] text-sm text-[var(--canvas-dark-ink)] hover:border-[var(--canvas-dark-ink-muted)] disabled:opacity-60"
            >
              Leave club
            </button>
          )}
          {isModOrOwner && (
            <Link
              href={`/${locale}/clubs/${club.id}?tab=settings`}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-[var(--r-pill)] bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:bg-brand-hover"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite
            </Link>
          )}
          {isOwner && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setKebabOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={kebabOpen}
                aria-label="Club actions"
                className="p-2 rounded-[var(--r-btn)] border border-[var(--br-card)] text-[var(--canvas-dark-ink)] hover:border-[var(--canvas-dark-ink-muted)]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {kebabOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => setKebabOpen(false)}
                    aria-hidden="true"
                    tabIndex={-1}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-[var(--r-card)] border border-[var(--br-card)] py-1"
                    style={{
                      background: 'var(--canvas-dark-250)',
                      boxShadow: 'var(--sh-card)',
                    }}
                  >
                    <Link
                      href={`/${locale}/clubs/${club.id}?tab=settings`}
                      onClick={() => setKebabOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--canvas-dark-ink)] hover:bg-[var(--canvas-dark-300)]"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setKebabOpen(false)
                        setDeleteOpen(true)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-[var(--canvas-dark-300)]"
                      role="menuitem"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete club
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${club.name}?`}
        description="You'll need to be re-invited or request to join again."
        confirmLabel="Leave club"
        variant="destructive"
        onConfirm={handleLeaveConfirm}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${club.name}?`}
        description="This permanently removes the club, its members, discussions, books, and schedule. This cannot be undone."
        confirmLabel="Delete club"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </header>
  )
}
