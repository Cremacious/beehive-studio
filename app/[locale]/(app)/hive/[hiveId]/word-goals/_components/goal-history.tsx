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
    <section
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--canvas-dark-ink-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--canvas-dark-ink-muted)]" />
          )}
          <h2
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-semibold text-sm"
          >
            History
          </h2>
          <span className="text-xs text-[var(--canvas-dark-ink-muted)]">({archived.length})</span>
        </div>
      </button>
      {expanded && (
        <ul style={{ borderTop: 'var(--br-card)' }}>
          {archived.map((g, i) => (
            <li
              key={g.id}
              className="px-4 py-2.5 text-sm flex items-center justify-between gap-3"
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
      )}
    </section>
  )
}
