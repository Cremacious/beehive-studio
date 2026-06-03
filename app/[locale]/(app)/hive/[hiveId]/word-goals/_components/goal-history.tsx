'use client'

import type { WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'

type Props = {
  archived: WordGoalRecord[]
}

export function GoalHistory({ archived }: Props) {
  if (archived.length === 0) return null

  return (
    <ul className="flex flex-col">
      {archived.map((g, i) => (
        <li
          key={g.id}
          className="py-2.5 text-sm flex items-center justify-between gap-3"
          style={i > 0 ? { borderTop: 'var(--br-card)' } : undefined}
        >
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--canvas-dark-ink-muted)]">
              {g.type}
            </span>
            <span className="ml-2 text-[var(--canvas-dark-ink-strong)]">
              {g.targetWords.toLocaleString()} words
            </span>
          </div>
          <span className="text-xs text-[var(--canvas-dark-ink-muted)] font-mono flex-shrink-0">
            {g.startDate.toLocaleDateString()} →{' '}
            {g.endDate ? g.endDate.toLocaleDateString() : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
