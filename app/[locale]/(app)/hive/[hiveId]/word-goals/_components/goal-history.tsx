'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'

type Props = {
  archived: WordGoalRecord[]
}

export function GoalHistory({ archived }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (archived.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <h2 className="font-comfortaa font-bold text-base text-foreground">History</h2>
          <span className="text-xs text-muted-foreground">({archived.length})</span>
        </div>
      </button>
      {expanded && (
        <ul className="border-t border-border divide-y divide-border">
          {archived.map((g) => (
            <li key={g.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.type}
                </span>
                <span className="ml-2 text-foreground">
                  {g.targetWords.toLocaleString()} words
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                {g.startDate.toLocaleDateString()} →{' '}
                {g.endDate ? g.endDate.toLocaleDateString() : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
