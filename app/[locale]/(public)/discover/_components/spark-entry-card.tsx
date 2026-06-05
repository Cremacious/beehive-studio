'use client'
import Link from 'next/link'
import { useTransition } from 'react'
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

export function SparkEntryCard({ entry, sparkId, locale, sparkStatus, currentUserId, isSparkCreator }: Props) {
  const isOwnEntry = currentUserId === entry.authorUserId
  const [isPendingChoice, startChoiceTransition] = useTransition()

  const handleCreatorChoice = () => {
    startChoiceTransition(async () => {
      await setCreatorChoiceAction(sparkId, entry.id)
    })
  }

  const displayTitle = deriveTitle(entry.title, entry.contentPreview)

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-[#2a2a2a] shrink-0" />
        <span className="text-[#aaa] text-[12px] font-semibold">{entry.authorDisplayName ?? entry.authorUsername ?? 'Anonymous'}</span>
        <span className="text-[#444] text-[11px]">· {entry.wordCount} words</span>
      </div>
      <h3 className="font-bold text-[var(--canvas-dark-ink-strong)] text-base mb-1.5" style={{ fontFamily: 'var(--font-comfortaa)' }}>
        {displayTitle}
      </h3>
      <p className="text-[#888] text-[13px] leading-relaxed mb-3 line-clamp-3">{entry.contentPreview}</p>
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
            onClick={handleCreatorChoice}
            disabled={isPendingChoice}
            className="text-[11px] text-[#666] hover:text-[#FFC300] transition-colors cursor-pointer ml-1 disabled:opacity-40"
          >
            ★ Creator's choice
          </button>
        )}
        <div className="flex-1" />
        <Link
          href={`/${locale}/sparks/${sparkId}/entry/${entry.id}`}
          className="text-[11px] text-[#666] border border-[#2a2a2a] px-3 py-1 rounded hover:text-white hover:border-[#3a3a3a] transition-colors"
        >
          View full entry →
        </Link>
      </div>
    </div>
  )
}
