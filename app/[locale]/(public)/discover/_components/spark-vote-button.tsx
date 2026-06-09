'use client'
import { useState, useTransition } from 'react'
import { voteSparkEntryAction } from '@/lib/actions/sparks.actions'
import type { SparkStatus } from '@/db/schema/social'

type Props = {
  entryId: string
  initialVoted: boolean
  initialCount: number
  status: SparkStatus
  isOwnEntry: boolean
  isAuthenticated: boolean
}

export function SparkVoteButton({ entryId, initialVoted, initialCount, status, isOwnEntry, isAuthenticated }: Props) {
  const [voted, setVoted] = useState(initialVoted)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  const muted = 'text-[11px] text-[var(--canvas-dark-ink-muted)]'
  if (status === 'OPEN') {
    return <span className={muted}>▲ voting opens after deadline</span>
  }
  if (status === 'CLOSED') {
    return <span className={muted}>▲ {count} votes</span>
  }
  if (!isAuthenticated) {
    return <span className={`${muted} cursor-not-allowed`}>Sign in to vote</span>
  }
  if (isOwnEntry) {
    return <span className={muted}>▲ {count} votes (your entry)</span>
  }

  const handleVote = () => {
    const next = !voted
    setVoted(next)
    setCount(c => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = await voteSparkEntryAction(entryId)
      if (!result.success) { setVoted(!next); setCount(c => c + (next ? -1 : 1)) }
    })
  }

  return (
    <button
      onClick={handleVote}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold h-7 px-3 rounded-[var(--r-pill)] transition-colors cursor-pointer disabled:opacity-50 ${
        voted
          ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
          : 'bg-[var(--canvas-dark-300)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
      }`}
    >
      ▲ {count} {voted ? 'Voted' : 'Vote'}
    </button>
  )
}
