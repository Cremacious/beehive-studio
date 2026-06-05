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

  if (status === 'OPEN') {
    return <span className="text-[#555] text-[11px]">▲ voting opens after deadline</span>
  }
  if (status === 'CLOSED') {
    return <span className="text-[#555] text-[11px]">▲ {count} votes</span>
  }
  if (!isAuthenticated) {
    return <span className="text-[#555] text-[11px] cursor-not-allowed">Sign in to vote</span>
  }
  if (isOwnEntry) {
    return <span className="text-[#555] text-[11px]">▲ {count} votes (your entry)</span>
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
      className={`text-[11px] px-3 py-1 rounded transition-colors cursor-pointer ${
        voted ? 'bg-[#FFC300] text-black font-semibold' : 'bg-[#2a2a2a] text-[#888] hover:text-white'
      }`}
    >
      ▲ {count} {voted ? 'Voted' : 'Vote'}
    </button>
  )
}
