// lib/hive/goal-progress.ts

export type WordGoalType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TOTAL'

export interface WordGoalRow {
  id: string
  type: WordGoalType
  targetWords: number
  startDate: Date
  endDate: Date | null
  isActive: boolean
}

/**
 * Compute the end-date for a goal based on its type + start.
 * - DAILY: start + 1 day
 * - WEEKLY: start + 7 days
 * - MONTHLY: start + 30 days (calendar-month if you prefer; spec keeps it 30 days flat)
 * - TOTAL: no end-date (null)
 */
export function computeGoalEndDate(type: WordGoalType, start: Date): Date | null {
  const ms = { DAILY: 86_400_000, WEEKLY: 7 * 86_400_000, MONTHLY: 30 * 86_400_000 }
  if (type === 'TOTAL') return null
  return new Date(start.getTime() + ms[type])
}

/**
 * Pick the highest-priority active goal: DAILY > WEEKLY > MONTHLY > TOTAL.
 * Returns null when no active goal in the list.
 */
export function pickPrimaryActiveGoal(goals: WordGoalRow[]): WordGoalRow | null {
  const order: WordGoalType[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL']
  for (const type of order) {
    const g = goals.find((g) => g.isActive && g.type === type)
    if (g) return g
  }
  return null
}

/**
 * Aggregate progress for a goal from a flat array of word-log rows.
 * Logs are filtered to those falling within [startDate, endDate) (endDate exclusive).
 * Negative deltas are honored (deletion rolls the bar backwards).
 *
 * Returns words contributed (signed sum), not capped at target.
 */
export interface WordLogRow {
  userId: string
  wordsAdded: number
  loggedAt: Date
}

export function aggregateGoalProgress(goal: WordGoalRow, logs: WordLogRow[]): number {
  return logs.reduce((acc, l) => {
    if (l.loggedAt < goal.startDate) return acc
    if (goal.endDate && l.loggedAt >= goal.endDate) return acc
    return acc + l.wordsAdded
  }, 0)
}

/**
 * Per-contributor breakdown within a goal window. Keys are userIds; values
 * are signed sums. Empty map when no in-window logs.
 */
export function aggregateContributorBreakdown(
  goal: WordGoalRow,
  logs: WordLogRow[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of logs) {
    if (l.loggedAt < goal.startDate) continue
    if (goal.endDate && l.loggedAt >= goal.endDate) continue
    out.set(l.userId, (out.get(l.userId) ?? 0) + l.wordsAdded)
  }
  return out
}
