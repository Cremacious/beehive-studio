'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import type { BookClubMemberRole } from '@/db/schema/social'
import type { ClubCurrentBook } from '@/lib/actions/book-clubs.actions'
import type { ClubProgressData, MemberProgressRow } from '@/lib/actions/club-progress.actions'
import {
  updateGroupProgressAction,
  clearGroupProgressAction,
  toggleMemberOnTrackAction,
} from '@/lib/actions/club-progress.actions'

// ─── Cell chrome ─────────────────────────────────────────────────────────────

const CELL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 14px',
  boxSizing: 'border-box',
}

// ─── Avatar gradient ──────────────────────────────────────────────────────────

function avatarGradient(userId: string): string {
  const hash = [...userId].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue = hash % 360
  return `linear-gradient(135deg, oklch(0.3 0.12 ${hue}), oklch(0.45 0.15 ${(hue + 40) % 360}))`
}

// ─── Member avatar strip ──────────────────────────────────────────────────────

function MemberAvatarStrip({
  members,
  totalCount,
}: {
  members: MemberProgressRow[]
  totalCount: number
}) {
  const slots = members.slice(0, 4)
  const overflow = totalCount - slots.length

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {slots.map((m, i) => {
        const label = m.displayName ?? m.username ?? 'M'
        return (
          <div
            key={m.userId}
            title={label}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '1.5px solid var(--canvas-dark-200)',
              marginLeft: i === 0 ? 0 : -6,
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative',
              zIndex: slots.length - i,
            }}
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: avatarGradient(m.userId),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                {label[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
        )
      })}
      {overflow > 0 && (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1.5px solid var(--canvas-dark-200)',
            marginLeft: -6,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 7,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 700,
            position: 'relative',
            zIndex: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  current,
  total,
  unit,
}: {
  current: number
  total: number
  unit: 'page' | 'chapter' | null
}) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const unitLabel = unit === 'chapter' ? 'Ch.' : 'p.'
  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--brand)',
            borderRadius: 999,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>
          {unitLabel} {current} of {total}
        </span>
        <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{pct}%</span>
      </div>
    </div>
  )
}

// ─── Empty progress bar (no progress set) ────────────────────────────────────

function EmptyProgressBar() {
  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          marginBottom: 4,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
          fontStyle: 'italic',
        }}
      >
        <span>No progress yet</span>
        <span>—</span>
      </div>
    </div>
  )
}

// ─── On-track toggle ──────────────────────────────────────────────────────────

function OnTrackToggle({
  clubId,
  viewerProgress,
}: {
  clubId: string
  viewerProgress: MemberProgressRow | undefined
}) {
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const router = useRouter()

  const isOnTrack = optimistic ?? viewerProgress?.isOnTrack ?? true

  function toggle() {
    const next = !isOnTrack
    setOptimistic(next)
    startTransition(async () => {
      const result = await toggleMemberOnTrackAction({ clubId, isOnTrack: next })
      if (!result.success) {
        setOptimistic(isOnTrack)
        toast.error('Could not update progress')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isOnTrack}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        background: 'transparent',
        transition: 'all 0.15s',
        opacity: pending ? 0.6 : 1,
        flexShrink: 0,
        ...(isOnTrack
          ? {
              border: '1px solid rgba(255,195,0,0.45)',
              color: 'var(--brand)',
            }
          : {
              border: '1px dashed rgba(255,255,255,0.20)',
              color: 'var(--canvas-dark-ink-muted)',
            }),
      }}
    >
      <CheckCircle2 aria-hidden="true" style={{ width: 9, height: 9 }} />
      {isOnTrack ? 'On track' : 'Behind'}
    </button>
  )
}

// ─── Update progress modal ────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--canvas-dark-ink-muted)',
  marginBottom: 5,
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 'var(--r-row)',
  background: 'var(--canvas-dark-100)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

function UpdateProgressModal({
  clubId,
  currentBook,
  progress,
  onClose,
}: {
  clubId: string
  currentBook: ClubCurrentBook
  progress: ClubProgressData
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [current, setCurrent] = useState(progress.currentProgressValue?.toString() ?? '')
  const [total, setTotal] = useState(progress.totalProgressValue?.toString() ?? '')
  const [unit, setUnit] = useState<'page' | 'chapter'>(
    progress.progressUnit === 'chapter' ? 'chapter' : 'page',
  )
  const [goalDesc, setGoalDesc] = useState(progress.currentReadingGoalDescription ?? '')
  const [goalDeadline, setGoalDeadline] = useState(
    progress.currentReadingGoalDeadline
      ? new Date(progress.currentReadingGoalDeadline).toISOString().split('T')[0]
      : '',
  )

  function handleSave() {
    const curVal = parseInt(current, 10)
    const totVal = parseInt(total, 10)
    if (isNaN(curVal) || isNaN(totVal) || totVal < 1 || curVal < 0) {
      toast.error('Please enter valid numbers.')
      return
    }
    startTransition(async () => {
      const result = await updateGroupProgressAction({
        clubId,
        currentProgressValue: curVal,
        totalProgressValue: totVal,
        progressUnit: unit,
        goalDescription: goalDesc.trim() || null,
        goalDeadline: goalDeadline || null,
      })
      if (result.success) {
        toast.success('Reading progress updated.')
        router.refresh()
        onClose()
      } else {
        toast.error('Could not update progress')
      }
    })
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearGroupProgressAction({ clubId })
      if (result.success) {
        toast.success('Progress cleared.')
        router.refresh()
        onClose()
      } else {
        toast.error('Could not clear progress')
      }
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Update reading progress"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 400,
          borderRadius: 'var(--r-card)',
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          padding: 24,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--canvas-dark-ink-strong)',
            margin: '0 0 4px',
          }}
        >
          Update group progress
        </h3>
        <p style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)', margin: '0 0 18px' }}>
          {currentBook.title}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabelStyle}>Measure by</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['page', 'chapter'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 999,
                  border: '1px solid',
                  fontSize: 12,
                  cursor: 'pointer',
                  ...(unit === u
                    ? {
                        background: 'var(--brand)',
                        borderColor: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        fontWeight: 600,
                      }
                    : {
                        background: 'var(--canvas-dark-350)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'var(--canvas-dark-ink)',
                      }),
                }}
              >
                {u === 'page' ? 'Pages' : 'Chapters'}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}
        >
          <div>
            <label style={fieldLabelStyle}>Current {unit}</label>
            <input
              type="number"
              min={0}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="0"
              style={fieldInputStyle}
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Total {unit}s</label>
            <input
              type="number"
              min={1}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="300"
              style={fieldInputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabelStyle}>Reading goal (optional)</label>
          <input
            type="text"
            value={goalDesc}
            onChange={(e) => setGoalDesc(e.target.value)}
            placeholder="Finish by the end of the month..."
            maxLength={120}
            style={fieldInputStyle}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabelStyle}>Goal deadline (optional)</label>
          <input
            type="date"
            value={goalDeadline}
            onChange={(e) => setGoalDeadline(e.target.value)}
            style={fieldInputStyle}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {progress.currentProgressValue !== null && (
            <button
              type="button"
              onClick={handleClear}
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
              Clear progress
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '6px 16px',
                borderRadius: 999,
                background: 'none',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--canvas-dark-ink)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              style={{
                padding: '6px 16px',
                borderRadius: 999,
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main cell ────────────────────────────────────────────────────────────────

export function ClubReadingCell({
  clubId,
  currentBook,
  progress,
  viewerRole,
  viewerUserId,
  memberCount,
}: {
  clubId: string
  currentBook: ClubCurrentBook
  progress: ClubProgressData
  viewerRole: BookClubMemberRole | null
  viewerUserId: string | null
  memberCount: number
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const isMember = viewerRole !== null

  const viewerProgress = viewerUserId
    ? progress.memberProgress.find((m) => m.userId === viewerUserId)
    : undefined

  const hasProgress =
    progress.currentProgressValue !== null && progress.totalProgressValue !== null

  const hasGoal = Boolean(progress.currentReadingGoalDescription)

  return (
    <div style={CELL_STYLE}>
      {modalOpen && (
        <UpdateProgressModal
          clubId={clubId}
          currentBook={currentBook}
          progress={progress}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Row: cover left + info column right */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Cover */}
        <div style={{ flexShrink: 0, alignSelf: 'center' }}>
          <div
            style={{
              width: 62,
              height: 90,
              borderRadius: 5,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: '2px 3px 8px rgba(0,0,0,0.35)',
            }}
          >
            {currentBook.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentBook.coverUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen
                  aria-hidden="true"
                  style={{ width: 18, height: 18, color: 'var(--canvas-dark-ink-muted)' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: 'var(--brand)',
                fontWeight: 700,
              }}
            >
              Currently Reading
            </span>
            {isModOrOwner && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                  background: 'var(--brand)',
                  border: 'none',
                  color: 'var(--brand-ink)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {hasProgress ? 'Update' : '+ Set progress'}
              </button>
            )}
          </div>

          {/* Title */}
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--canvas-dark-ink-strong)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.25,
              marginBottom: 2,
              flexShrink: 0,
            }}
          >
            {currentBook.title}
          </p>

          {/* Author */}
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--canvas-dark-ink-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {currentBook.author}
          </p>

          {/* Goal banner */}
          {hasGoal && (
            <div
              style={{
                marginTop: 6,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'rgba(255,195,0,0.07)',
                border: '1px solid rgba(255,195,0,0.14)',
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  margin: '0 0 1px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'rgba(255,195,0,0.55)',
                  lineHeight: 1,
                }}
              >
                Goal
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {progress.currentReadingGoalDescription}
              </p>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Progress bar — always rendered (empty when no progress) */}
          {hasProgress ? (
            <ProgressBar
              current={progress.currentProgressValue!}
              total={progress.totalProgressValue!}
              unit={(progress.progressUnit as 'page' | 'chapter' | null)}
            />
          ) : (
            <EmptyProgressBar />
          )}

          {/* Bottom row: member avatars + on-track count + viewer toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {progress.memberProgress.length > 0 && (
                <MemberAvatarStrip
                  members={progress.memberProgress}
                  totalCount={memberCount}
                />
              )}
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--canvas-dark-ink-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: 'var(--canvas-dark-ink)' }}>
                  {progress.onTrackCount}/{memberCount}
                </span>{' '}
                on track
              </span>
            </div>
            {isMember && (
              <OnTrackToggle clubId={clubId} viewerProgress={viewerProgress} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
