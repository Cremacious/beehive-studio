'use client'
import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { SparkVoteButton } from './spark-vote-button'
import { setCreatorChoiceAction } from '@/lib/actions/sparks.actions'
import type { SparkEntrySummary } from '@/lib/actions/sparks.actions'
import type { SparkStatus } from '@/db/schema/social'
import { deriveTitle } from '@/lib/sparks/derive-title'

type Props = {
  entry: SparkEntrySummary
  sparkId: string
  locale: string
  sparkStatus: SparkStatus
  currentUserId: string | null
  isSparkCreator: boolean
}

export function SparkEntryCard({
  entry,
  sparkId,
  locale,
  sparkStatus,
  currentUserId,
  isSparkCreator,
}: Props) {
  const isOwnEntry = currentUserId === entry.authorUserId
  const [isPendingChoice, startChoiceTransition] = useTransition()

  const handleCreatorChoice = () => {
    startChoiceTransition(async () => {
      try {
        const result = await setCreatorChoiceAction(sparkId, entry.id)
        if (!result.success) {
          toastActionError(result.error)
          return
        }
        toast.success("Marked as creator's choice")
      } catch {
        toastNetworkError()
      }
    })
  }

  const displayTitle = deriveTitle(entry.title, entry.contentPreview)

  return (
    <div
      className="p-4"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        borderTop: 'var(--br-card)',
        borderRadius: 'var(--r-row)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-5 h-5 rounded-full shrink-0"
          style={{ background: 'var(--canvas-dark-200)' }}
        />
        <span
          className="text-[12px] font-semibold"
          style={{
            color: 'var(--canvas-dark-ink-strong)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {entry.authorDisplayName ?? entry.authorUsername ?? 'Anonymous'}
        </span>
        <span
          className="text-[11px]"
          style={{ color: 'var(--canvas-dark-ink-faint)' }}
        >
          · {entry.wordCount} words
        </span>
      </div>
      <h3
        className="font-bold text-base mb-2"
        style={{
          color: 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {displayTitle}
      </h3>
      <p
        className="text-[13px] leading-relaxed mb-3 line-clamp-3"
        style={{ color: 'var(--canvas-dark-ink)' }}
      >
        {entry.contentPreview}
      </p>
      <div className="flex items-center gap-2">
        <SparkVoteButton
          entryId={entry.id}
          initialVoted={entry.userHasVoted}
          initialCount={entry.voteCount}
          status={sparkStatus}
          isOwnEntry={isOwnEntry}
          isAuthenticated={!!currentUserId}
        />
        {isSparkCreator && sparkStatus !== 'OPEN' && !isOwnEntry && (
          <button
            type="button"
            onClick={handleCreatorChoice}
            disabled={isPendingChoice}
            className="text-[11px] transition-colors cursor-pointer ml-1 disabled:opacity-40"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--brand)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)'
            }}
          >
            ★ Creator&apos;s choice
          </button>
        )}
        <div className="flex-1" />
        <Link
          href={`/${locale}/community/sparks/${sparkId}/entry/${entry.id}`}
          className="inline-flex items-center text-[11px] h-7 px-3 rounded-[var(--r-pill)] transition-colors"
          style={{
            background: 'var(--canvas-dark-200)',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          View full entry →
        </Link>
      </div>
    </div>
  )
}
