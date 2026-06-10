'use client'

import type { WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'
import type { WordGoalType } from '@/lib/hive/goal-progress'
import { HivePill } from '../../_components/hive-pill'

type Props = {
  archived: WordGoalRecord[]
}

const GOAL_TOKEN: Record<WordGoalType, string> = {
  DAILY: '--goal-daily',
  WEEKLY: '--goal-weekly',
  MONTHLY: '--goal-monthly',
  TOTAL: '--goal-custom',
}

const TYPE_LABEL: Record<WordGoalType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  TOTAL: 'Total',
}

export function GoalHistory({ archived }: Props) {
  if (archived.length === 0) return null

  return (
    <div className="flex flex-col">
      {archived.map((g, i) => {
        // We don't have a `final progress count` stored on the row; archived only
        // exposes target + dates. Display target with no "met/missed" suffix.
        const dateLabel = `${g.startDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })} → ${
          g.endDate
            ? g.endDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : '–'
        }`
        return (
          <div
            key={g.id}
            className="grid items-center gap-3 py-3"
            style={{
              gridTemplateColumns: '1fr 120px 180px',
              borderTop:
                i > 0
                  ? '1px solid oklch(from var(--canvas-dark-300) l c h / 0.4)'
                  : undefined,
            }}
          >
            <span
              className="font-comfortaa font-medium text-sm"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              {TYPE_LABEL[g.type]} goal
            </span>
            <span>
              <HivePill token={GOAL_TOKEN[g.type]}>{TYPE_LABEL[g.type]}</HivePill>
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="font-mono text-[12px]"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                target {g.targetWords.toLocaleString()}
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--canvas-dark-ink-faint)' }}
              >
                {dateLabel}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
