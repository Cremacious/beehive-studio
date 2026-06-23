'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, CheckCircle2, Clock } from 'lucide-react'
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url'
import type { ClubCurrentBook } from '@/lib/actions/book-clubs.actions'
import type {
  ClubProgressData,
  MemberProgressRow,
} from '@/lib/actions/club-progress.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import {
  updateGroupProgressAction,
  clearGroupProgressAction,
  toggleMemberOnTrackAction,
} from '@/lib/actions/club-progress.actions'

// ─── Sub-types ────────────────────────────────────────────────────────────────

type Props = {
  clubId: string
  currentBook: ClubCurrentBook | null
  progress: ClubProgressData
  viewerRole: BookClubMemberRole | null
  viewerUserId: string | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClubCurrentlyReading({
  clubId,
  currentBook,
  progress,
  viewerRole,
  viewerUserId,
}: Props) {
  const [progressModalOpen, setProgressModalOpen] = useState(false)

  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const isMember = viewerRole !== null

  const pct =
    progress.currentProgressValue !== null && progress.totalProgressValue
      ? Math.min(100, Math.round((progress.currentProgressValue / progress.totalProgressValue) * 100))
      : null

  const memberCount = progress.memberProgress.length
  const onTrackCount = progress.onTrackCount

  const viewerProgress = viewerUserId
    ? progress.memberProgress.find((m) => m.userId === viewerUserId)
    : undefined

  return (
    <section
      style={{
        borderRadius: 'var(--r-card)',
        background: 'linear-gradient(180deg, var(--canvas-dark-250) 0%, var(--canvas-dark-200) 100%)',
        boxShadow: 'var(--sh-card)',
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--brand)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BookOpen aria-hidden="true" style={{ width: 15, height: 15 }} />
          Currently reading
        </h2>
        {isModOrOwner && currentBook && (
          <button
            type="button"
            onClick={() => setProgressModalOpen(true)}
            style={{
              background: 'var(--brand)',
              border: 'none',
              borderRadius: 999,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--brand-ink)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {pct !== null ? 'Update' : '+ Set progress'}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px' }}>
        {!currentBook ? (
          <p style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
            No book selected yet.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* Cover */}
            {currentBook.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={optimizeCloudinaryUrl(currentBook.coverUrl, BOOK_COVER_TRANSFORMS)}
                alt=""
                style={{
                  width: 72,
                  height: 108,
                  objectFit: 'cover',
                  borderRadius: 6,
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 108,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen style={{ width: 24, height: 24, color: 'var(--canvas-dark-ink-muted)' }} />
              </div>
            )}

            {/* Right column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'var(--canvas-dark-ink-strong)',
                  margin: '0 0 2px',
                  lineHeight: 1.3,
                }}
              >
                {currentBook.title}
              </p>
              {currentBook.author && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--canvas-dark-ink-muted)',
                    margin: '0 0 12px',
                  }}
                >
                  {currentBook.author}
                </p>
              )}

              {/* Group progress — always renders bar (empty when no progress) */}
              {pct !== null ? (
                <GroupProgressBar
                  pct={pct}
                  currentProgressValue={progress.currentProgressValue!}
                  totalProgressValue={progress.totalProgressValue!}
                  progressUnit={progress.progressUnit!}
                  goalDescription={progress.currentReadingGoalDescription}
                  goalDeadline={progress.currentReadingGoalDeadline}
                />
              ) : (
                <EmptyProgressBar />
              )}

              {/* Member on-track grid */}
              {isMember && (
                <MemberOnTrackSection
                  clubId={clubId}
                  memberProgress={progress.memberProgress}
                  onTrackCount={onTrackCount}
                  memberCount={memberCount}
                  viewerUserId={viewerUserId}
                  viewerProgress={viewerProgress}
                  hasCurrentBook={!!currentBook}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress update modal */}
      {progressModalOpen && currentBook && (
        <UpdateProgressModal
          clubId={clubId}
          currentBook={currentBook}
          progress={progress}
          onClose={() => setProgressModalOpen(false)}
        />
      )}
    </section>
  )
}

// ─── Empty progress bar (no progress set yet) ─────────────────────────────────

function EmptyProgressBar() {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--canvas-dark-350)',
          boxShadow: 'var(--sh-inset)',
          marginBottom: 4,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
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

// ─── Group progress bar ───────────────────────────────────────────────────────

function GroupProgressBar({
  pct,
  currentProgressValue,
  totalProgressValue,
  progressUnit,
  goalDescription,
  goalDeadline,
}: {
  pct: number
  currentProgressValue: number
  totalProgressValue: number
  progressUnit: string
  goalDescription: string | null
  goalDeadline: Date | null
}) {
  const unitLabel = progressUnit === 'chapter' ? 'ch.' : 'p.'
  const deadlineStr = goalDeadline
    ? new Date(goalDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div style={{ marginBottom: 12 }}>
      {goalDescription && (
        <div style={{ marginBottom: 10 }}>
          <p
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--canvas-dark-ink-muted)',
              margin: '0 0 3px',
            }}
          >
            Goal
          </p>
          <p
            style={{
              fontSize: 13,
              color: 'var(--canvas-dark-ink)',
              margin: 0,
            }}
          >
            {goalDescription}
            {deadlineStr && (
              <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--canvas-dark-ink-muted)' }}>
                <Clock aria-hidden="true" style={{ width: 10, height: 10 }} />
                by {deadlineStr}
              </span>
            )}
          </p>
        </div>
      )}
      {/* Track */}
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--canvas-dark-350)',
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
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>
          {unitLabel} {currentProgressValue} of {totalProgressValue}
        </span>
        <span style={{ color: 'var(--brand)' }}>{pct}%</span>
      </div>
    </div>
  )
}

// ─── Member on-track section ──────────────────────────────────────────────────

function MemberOnTrackSection({
  clubId,
  memberProgress,
  onTrackCount,
  memberCount,
  viewerUserId,
  viewerProgress,
  hasCurrentBook,
}: {
  clubId: string
  memberProgress: MemberProgressRow[]
  onTrackCount: number
  memberCount: number
  viewerUserId: string | null
  viewerProgress: MemberProgressRow | undefined
  hasCurrentBook: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [optimisticOnTrack, setOptimisticOnTrack] = useState<boolean | null>(null)
  const router = useRouter()

  const viewerIsOnTrack = optimisticOnTrack ?? viewerProgress?.isOnTrack ?? true

  function toggle() {
    const next = !viewerIsOnTrack
    setOptimisticOnTrack(next)
    startTransition(async () => {
      const result = await toggleMemberOnTrackAction({ clubId, isOnTrack: next })
      if (!result.success) {
        setOptimisticOnTrack(viewerIsOnTrack) // rollback
        toast.error('Could not update progress')
      } else {
        router.refresh()
      }
    })
  }

  if (!hasCurrentBook) return null

  return (
    <div>
      {/* Summary + viewer toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
          <strong
            style={{ color: 'var(--canvas-dark-ink)', fontFamily: 'var(--font-mono)' }}
          >
            {onTrackCount}/{memberCount}
          </strong>{' '}
          on track
        </span>
        {viewerUserId && (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={viewerIsOnTrack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 11px',
              borderRadius: 999,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              background: 'transparent',
              transition: 'all 0.15s',
              opacity: pending ? 0.6 : 1,
              ...(viewerIsOnTrack
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
            <CheckCircle2 aria-hidden="true" style={{ width: 10, height: 10 }} />
            {viewerIsOnTrack ? "I'm on track" : 'Mark me on track'}
          </button>
        )}
      </div>

      {/* Avatar grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {memberProgress.map((m) => {
          const isViewer = m.userId === viewerUserId
          const onTrack = isViewer ? viewerIsOnTrack : m.isOnTrack
          return (
            <div
              key={m.userId}
              title={`${m.username ?? m.displayName ?? 'Member'}: ${onTrack ? 'on track' : 'behind'}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                overflow: 'hidden',
                border: `2px solid ${onTrack ? 'var(--brand)' : 'rgba(255,255,255,0.15)'}`,
                opacity: onTrack ? 1 : 0.45,
                flexShrink: 0,
                position: 'relative',
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
                    background:
                      'linear-gradient(135deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: 'var(--canvas-dark-ink-muted)',
                    fontWeight: 600,
                  }}
                >
                  {(m.username ?? m.displayName ?? '?')[0]?.toUpperCase()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Update progress modal ────────────────────────────────────────────────────

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
      toast.error('Please enter valid page/chapter numbers.')
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
      {/* Backdrop */}
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

      {/* Dialog */}
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

        {/* Unit toggle */}
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              color: 'var(--canvas-dark-ink-muted)',
              marginBottom: 6,
            }}
          >
            Measure by
          </label>
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

        {/* Current / total inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={fieldLabelStyle}>
              Current {unit}
            </label>
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
            <label style={fieldLabelStyle}>
              Total {unit}s
            </label>
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

        {/* Optional goal description */}
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

        {/* Optional deadline */}
        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabelStyle}>Goal deadline (optional)</label>
          <input
            type="date"
            value={goalDeadline}
            onChange={(e) => setGoalDeadline(e.target.value)}
            style={fieldInputStyle}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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

// ─── Shared field styles ──────────────────────────────────────────────────────

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
  boxSizing: 'border-box' as const,
}
