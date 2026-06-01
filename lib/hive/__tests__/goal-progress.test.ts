import { describe, it, expect } from 'vitest'
import {
  computeGoalEndDate,
  pickPrimaryActiveGoal,
  aggregateGoalProgress,
  aggregateContributorBreakdown,
  type WordGoalRow,
} from '../goal-progress'

const goalAt = (overrides: Partial<WordGoalRow> = {}): WordGoalRow => ({
  id: 'g1',
  type: 'WEEKLY' as const,
  targetWords: 5000,
  startDate: new Date('2026-05-01T00:00:00Z'),
  endDate: new Date('2026-05-08T00:00:00Z'),
  isActive: true,
  ...overrides,
})

describe('computeGoalEndDate', () => {
  const start = new Date('2026-05-01T00:00:00Z')
  it('DAILY = +1 day', () =>
    expect(computeGoalEndDate('DAILY', start)?.toISOString()).toBe(
      '2026-05-02T00:00:00.000Z',
    ))
  it('WEEKLY = +7 days', () =>
    expect(computeGoalEndDate('WEEKLY', start)?.toISOString()).toBe(
      '2026-05-08T00:00:00.000Z',
    ))
  it('MONTHLY = +30 days', () =>
    expect(computeGoalEndDate('MONTHLY', start)?.toISOString()).toBe(
      '2026-05-31T00:00:00.000Z',
    ))
  it('TOTAL = null', () => expect(computeGoalEndDate('TOTAL', start)).toBeNull())
})

describe('pickPrimaryActiveGoal', () => {
  it('picks DAILY over WEEKLY+MONTHLY+TOTAL', () => {
    const goals = (['DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL'] as const).map((t, i) => ({
      ...goalAt(),
      id: `g${i}`,
      type: t,
      isActive: true,
    }))
    expect(pickPrimaryActiveGoal(goals)?.type).toBe('DAILY')
  })
  it('skips inactive', () => {
    const goals = [goalAt({ type: 'DAILY', isActive: false }), goalAt({ type: 'WEEKLY' })]
    expect(pickPrimaryActiveGoal(goals)?.type).toBe('WEEKLY')
  })
  it('null when no active', () => {
    expect(pickPrimaryActiveGoal([goalAt({ isActive: false })])).toBeNull()
  })
})

describe('aggregateGoalProgress', () => {
  const g = goalAt()
  it('sums positive deltas within window', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2026-05-04T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(800)
  })
  it('honors negative deltas (deletion)', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: -200, loggedAt: new Date('2026-05-03T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(300)
  })
  it('excludes logs before startDate', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-04-30T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2026-05-02T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(300)
  })
  it('excludes logs after endDate', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2026-05-09T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(500)
  })
  it('TOTAL goal counts all logs after startDate', () => {
    const total = goalAt({ type: 'TOTAL', endDate: null })
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2030-01-01T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(total, logs)).toBe(800)
  })
})

describe('aggregateContributorBreakdown', () => {
  const g = goalAt()
  it('groups by userId', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u2', wordsAdded: 300, loggedAt: new Date('2026-05-03T10:00:00Z') },
      { userId: 'u1', wordsAdded: 200, loggedAt: new Date('2026-05-04T10:00:00Z') },
    ]
    const out = aggregateContributorBreakdown(g, logs)
    expect(out.get('u1')).toBe(700)
    expect(out.get('u2')).toBe(300)
  })
})
