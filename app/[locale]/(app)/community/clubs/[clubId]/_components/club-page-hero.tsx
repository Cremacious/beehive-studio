'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings, UserPlus, Globe, Lock, Users } from 'lucide-react'
import type {
  ClubSummary,
  ClubJoinRequestRow,
} from '@/lib/actions/book-clubs.actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  joinClubAction,
  leaveClubAction,
  cancelMyPendingJoinRequestAction,
} from '@/lib/actions/book-clubs.actions'
import { JoinRequestsBadge } from './join-requests-badge'

type Props = {
  club: ClubSummary
  locale: string
  joinRequests?: ClubJoinRequestRow[]
}

function fmt(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function ClubPageHero({ club, locale, joinRequests }: Props) {
  const [isPending, startTransition] = useTransition()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const router = useRouter()

  const { owner, viewerMembership, memberCount } = club
  const viewerRole = viewerMembership.role
  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const isMember = viewerRole !== null
  const description = club.description ?? ''
  const descLong = description.length > 160

  function handleJoin() {
    startTransition(async () => {
      const result = await joinClubAction({ clubId: club.id })
      if (result.success) {
        toast.success(result.data.joined ? `Joined ${club.name}.` : 'Request sent.')
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

  function handleCancelRequest() {
    startTransition(async () => {
      const result = await cancelMyPendingJoinRequestAction({ clubId: club.id })
      if (result.success) {
        toast.success('Request canceled')
        router.refresh()
      } else {
        toast.error('Could not cancel request')
      }
    })
  }

  const VisibilityIcon =
    club.visibility === 'PUBLIC' ? Globe : club.visibility === 'FRIENDS' ? Users : Lock
  const visibilityLabel =
    club.visibility === 'PUBLIC'
      ? 'Public'
      : club.visibility === 'FRIENDS'
        ? 'Friends'
        : 'Private'

  return (
    <div
      style={{
        borderRadius: 'var(--r-card)',
        overflow: 'hidden',
        boxShadow: 'var(--sh-card)',
        marginBottom: 24,
      }}
    >
      {/* ── Hero band ─────────────────────────────────── */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        {club.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.coverImageUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, var(--canvas-dark-400) 0%, var(--canvas-dark-200) 60%, oklch(0.42 0.08 250) 100%)',
            }}
          />
        )}

        {/* Legibility gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.82) 100%)',
          }}
        />

        {/* Text overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '20px 24px',
          }}
        >
          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(4px)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <VisibilityIcon aria-hidden="true" style={{ width: 10, height: 10 }} />
              {visibilityLabel}
            </span>
            {club.openJoin && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,195,0,0.22)',
                  backdropFilter: 'blur(4px)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: 'var(--brand)',
                }}
              >
                Open to join
              </span>
            )}
          </div>

          {/* Club name */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              color: '#fff',
              margin: 0,
              lineHeight: 1.2,
              textShadow: '0 1px 8px rgba(0,0,0,0.6)',
            }}
          >
            {club.name}
          </h1>

          {/* Description */}
          {description && (
            <div style={{ marginTop: 6, maxWidth: 580 }}>
              <p
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.78)',
                  margin: 0,
                  lineHeight: 1.55,
                  overflow: 'hidden',
                  display: descExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: descExpanded ? undefined : 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {description}
              </p>
              {descLong && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--brand)',
                    fontSize: 12,
                    padding: 0,
                    marginTop: 3,
                  }}
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Metadata bar ──────────────────────────────── */}
      <div
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-300) 0%, var(--canvas-dark-250) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '11px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: owner + stats */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}
        >
          {/* Owner avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {owner.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={owner.avatarUrl}
                alt=""
                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background:
                    'linear-gradient(135deg, var(--canvas-dark-350), var(--canvas-dark-200))',
                }}
              />
            )}
            {owner.username ? (
              <Link
                href={`/${locale}/u/${owner.username}`}
                style={{ fontSize: 12, color: 'var(--canvas-dark-ink)', textDecoration: 'none' }}
              >
                @{owner.username}
              </Link>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink)' }}>
                {owner.displayName ?? 'Unknown'}
              </span>
            )}
          </div>

          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)', whiteSpace: 'nowrap' }}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)', whiteSpace: 'nowrap' }}>
            Est. {fmt(club.createdAt)}
          </span>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Non-member open join */}
          {!isMember && club.openJoin && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={isPending}
              style={pillBtn(isPending)}
            >
              Join club
            </button>
          )}
          {/* Non-member closed join */}
          {!isMember && !club.openJoin && !viewerMembership.pendingJoinRequest && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={isPending}
              style={pillBtn(isPending)}
            >
              Request to join
            </button>
          )}
          {/* Non-member pending */}
          {!isMember && !club.openJoin && viewerMembership.pendingJoinRequest && (
            <>
              <span
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'var(--canvas-dark-350)',
                  color: 'var(--canvas-dark-ink-muted)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                Request pending
              </span>
              <button
                type="button"
                onClick={handleCancelRequest}
                disabled={isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--canvas-dark-ink-muted)',
                  textDecoration: 'underline',
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
            </>
          )}

          {/* MEMBER: leave */}
          {viewerRole === 'MEMBER' && (
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              disabled={isPending}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                background: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--canvas-dark-ink)',
                fontSize: 13,
                cursor: 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              Leave club
            </button>
          )}

          {/* MOD/OWNER: pending join requests */}
          {isModOrOwner && joinRequests && joinRequests.length > 0 && (
            <JoinRequestsBadge initialRows={joinRequests} />
          )}

          {/* MOD/OWNER: invite */}
          {isModOrOwner && (
            <Link
              href={`/${locale}/community/clubs/${club.id}/settings`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 13px',
                borderRadius: 999,
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <UserPlus aria-hidden="true" style={{ width: 13, height: 13 }} />
              Invite
            </Link>
          )}

          {/* MOD/OWNER: settings */}
          {isModOrOwner && (
            <Link
              href={`/${locale}/community/clubs/${club.id}/settings`}
              aria-label="Club settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 'var(--r-btn)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--canvas-dark-ink-muted)',
                textDecoration: 'none',
              }}
            >
              <Settings aria-hidden="true" style={{ width: 14, height: 14 }} />
            </Link>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${club.name}?`}
        description="You will need to be re-invited or request to join again."
        confirmLabel="Leave club"
        variant="destructive"
        onConfirm={handleLeaveConfirm}
      />
    </div>
  )
}

function pillBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 16px',
    borderRadius: 999,
    background: 'var(--brand)',
    color: 'var(--brand-ink)',
    fontWeight: 600,
    fontSize: 13,
    border: 'none',
    cursor: 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
  }
}
