import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mocking ─────────────────────────────────────────────────────────────
const insertCalls: Array<{ table: string; values: any }> = []
const updateCalls: Array<{ table: string; values: any; where?: any }> = []

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find(
      (s) => s.description === 'drizzle:Name',
    )
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

// Tx insert returns a chainable {values, returning}.
const txInsert = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    values: vi.fn((values: any) => {
      insertCalls.push({ table: tName, values })
      const returningFn = vi.fn(async () => [{ id: 'new-goal-id' }])
      return { returning: returningFn, then: (cb: any) => cb(undefined) }
    }),
  }
})

const txUpdate = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    set: vi.fn((values: any) => {
      updateCalls.push({ table: tName, values })
      return {
        where: vi.fn(async (where: any) => {
          updateCalls[updateCalls.length - 1].where = where
        }),
      }
    }),
  }
})

// db.select(...).from(...).where(...).orderBy(...) — controllable per-call.
const selectResults: any[][] = []
const selectFrom = vi.fn((table: any) => {
  const result = selectResults.shift() ?? []
  const chain: any = {
    where: vi.fn(() => chain),
    orderBy: vi.fn(async () => result),
    then: (cb: any) => Promise.resolve(result).then(cb),
  }
  // When awaited directly without orderBy:
  chain[Symbol.toPrimitive] = undefined
  return chain
})

function makeSelectChain(rows: any[]) {
  selectResults.push(rows)
}

const goalsFindFirst = vi.fn<(a: any) => any>(async () => null)
const profilesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])

vi.mock('@/db', () => ({
  db: {
    query: {
      hiveWordGoals: {
        findFirst: (a: any) => goalsFindFirst(a),
      },
      userProfiles: {
        findMany: (a: any) => profilesFindMany(a),
      },
    },
    select: vi.fn((_proj?: any) => ({
      from: (t: any) => selectFrom(t),
    })),
    insert: (table: any) => {
      const tName = tableName(table)
      return {
        values: vi.fn((values: any) => {
          insertCalls.push({ table: tName, values })
          return {
            returning: vi.fn(async () => [{ id: 'new-goal-id' }]),
          }
        }),
      }
    },
    update: (table: any) => txUpdate(table),
    transaction: vi.fn(async (fn: any) => {
      return await fn({ insert: txInsert, update: txUpdate })
    }),
  },
}))

const requireAuthMock = vi.fn(async () => 'user-1')
vi.mock('@/lib/require-auth', () => ({
  requireAuth: () => requireAuthMock(),
}))

const requireHiveMemberMock = vi.fn<(h: string, u: string) => Promise<string>>(
  async () => 'OWNER',
)
vi.mock('@/lib/hive/permissions', async () => {
  const actual: any = await vi.importActual('@/lib/hive/permissions')
  return {
    ...actual,
    requireHiveMember: (hiveId: string, userId: string) =>
      requireHiveMemberMock(hiveId, userId),
  }
})

// ── Imports under test ──────────────────────────────────────────────────────
import {
  createWordGoalAction,
  updateWordGoalAction,
  archiveWordGoalAction,
  listHiveWordGoalsAction,
  getWordGoalProgressAction,
  getActiveWordGoalSummaryAction,
} from '../hive-word-goals.actions'

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  selectResults.length = 0
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue('user-1')
  requireHiveMemberMock.mockResolvedValue('OWNER')
  goalsFindFirst.mockResolvedValue(null)
  profilesFindMany.mockResolvedValue([])
})

function makeGoalRow(over: Partial<any> = {}) {
  const now = new Date('2026-06-01T00:00:00Z')
  return {
    id: 'goal-1',
    hiveId: 'hive-1',
    createdBy: 'user-1',
    type: 'DAILY',
    targetWords: 1000,
    startDate: now,
    endDate: new Date(now.getTime() + 86_400_000),
    isActive: true,
    createdAt: now,
    ...over,
  }
}

// ── createWordGoalAction ────────────────────────────────────────────────────

describe('createWordGoalAction — H4 T6', () => {
  it('archives prior active of same type inside the tx, then inserts', async () => {
    const r = await createWordGoalAction({
      hiveId: 'hive-1',
      type: 'DAILY',
      targetWords: 1000,
    })
    expect(r.success).toBe(true)
    // Update fires against hive_word_goals (archive sweep), then insert.
    const archive = updateCalls.find((u) => u.table === 'hive_word_goals')
    expect(archive).toBeDefined()
    expect(archive!.values.isActive).toBe(false)
    const ins = insertCalls.find((i) => i.table === 'hive_word_goals')
    expect(ins).toBeDefined()
    expect(ins!.values.type).toBe('DAILY')
    expect(ins!.values.targetWords).toBe(1000)
    expect(ins!.values.isActive).toBe(true)
  })

  it('denies BETA_READER with NOT_AUTHORIZED', async () => {
    requireHiveMemberMock.mockResolvedValue('BETA_READER')
    const r = await createWordGoalAction({
      hiveId: 'hive-1',
      type: 'DAILY',
      targetWords: 1000,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('NOT_AUTHORIZED')
  })

  it('denies CONTRIBUTOR with NOT_AUTHORIZED', async () => {
    requireHiveMemberMock.mockResolvedValue('CONTRIBUTOR')
    const r = await createWordGoalAction({
      hiveId: 'hive-1',
      type: 'WEEKLY',
      targetWords: 5000,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('NOT_AUTHORIZED')
  })

  it('returns GOAL_ALREADY_ACTIVE on partial-unique violation', async () => {
    // First call inside the transaction (update) succeeds; insert throws 23505.
    // Easiest path: mock the whole transaction to throw a 23505-shaped error.
    const { db } = await import('@/db')
    ;(db.transaction as any).mockImplementationOnce(async () => {
      const err: any = new Error('duplicate key value violates unique constraint')
      err.code = '23505'
      throw err
    })
    const r = await createWordGoalAction({
      hiveId: 'hive-1',
      type: 'DAILY',
      targetWords: 1000,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('GOAL_ALREADY_ACTIVE')
  })

  it('rejects targetWords < 1 (Zod)', async () => {
    const r = await createWordGoalAction({
      hiveId: 'hive-1',
      type: 'DAILY',
      targetWords: 0,
    })
    expect(r.success).toBe(false)
  })
})

// ── listHiveWordGoalsAction ────────────────────────────────────────────────

describe('listHiveWordGoalsAction — H4 T6', () => {
  it('runs the lazy-archive sweep before SELECT', async () => {
    makeSelectChain([makeGoalRow()])

    const r = await listHiveWordGoalsAction('hive-1')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toHaveLength(1)

    // First call: update sweep on hive_word_goals (isActive: false).
    const archive = updateCalls.find(
      (u) => u.table === 'hive_word_goals' && u.values.isActive === false,
    )
    expect(archive).toBeDefined()
  })

  it('returns NOT_AUTHORIZED for non-members', async () => {
    requireHiveMemberMock.mockRejectedValue(new Error('NOT_HIVE_MEMBER'))
    const r = await listHiveWordGoalsAction('hive-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('NOT_AUTHORIZED')
  })
})

// ── getWordGoalProgressAction ───────────────────────────────────────────────

describe('getWordGoalProgressAction — H4 T6', () => {
  it('returns correct contributor breakdown for 3-member logs', async () => {
    const start = new Date('2026-06-01T00:00:00Z')
    const end = new Date(start.getTime() + 7 * 86_400_000)
    goalsFindFirst.mockResolvedValue(
      makeGoalRow({ id: 'goal-1', type: 'WEEKLY', startDate: start, endDate: end }),
    )

    // Logs query result
    makeSelectChain([
      { id: 'l1', userId: 'u-a', chapterId: 'c-1', wordsAdded: 500, loggedAt: new Date(start.getTime() + 1000) },
      { id: 'l2', userId: 'u-b', chapterId: 'c-1', wordsAdded: 300, loggedAt: new Date(start.getTime() + 2000) },
      { id: 'l3', userId: 'u-a', chapterId: 'c-2', wordsAdded: 200, loggedAt: new Date(start.getTime() + 3000) },
      { id: 'l4', userId: 'u-c', chapterId: 'c-2', wordsAdded: 100, loggedAt: new Date(start.getTime() + 4000) },
    ])

    profilesFindMany.mockResolvedValue([
      { userId: 'u-a', username: 'alice', avatarUrl: null },
      { userId: 'u-b', username: 'bob', avatarUrl: null },
      { userId: 'u-c', username: 'cara', avatarUrl: null },
    ])

    const r = await getWordGoalProgressAction({ goalId: 'goal-1' })
    expect(r.success).toBe(true)
    if (!r.success) return

    expect(r.data.progress).toBe(1100)
    expect(r.data.contributors).toHaveLength(3)
    // Sorted DESC by wordsContributed: alice 700, bob 300, cara 100.
    expect(r.data.contributors[0]).toMatchObject({ userId: 'u-a', wordsContributed: 700 })
    expect(r.data.contributors[1]).toMatchObject({ userId: 'u-b', wordsContributed: 300 })
    expect(r.data.contributors[2]).toMatchObject({ userId: 'u-c', wordsContributed: 100 })
    expect(r.data.recentLogs).toHaveLength(4)
  })

  it('returns NOT_FOUND when goal does not exist', async () => {
    goalsFindFirst.mockResolvedValue(null)
    const r = await getWordGoalProgressAction({ goalId: 'missing' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('NOT_FOUND')
  })
})

// ── getActiveWordGoalSummaryAction ──────────────────────────────────────────

describe('getActiveWordGoalSummaryAction — H4 T6', () => {
  it('returns null when no active goals exist', async () => {
    makeSelectChain([]) // active-goal query returns no rows
    const r = await getActiveWordGoalSummaryAction('hive-empty-1')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBeNull()
  })

  it('picks DAILY when both DAILY + WEEKLY are active', async () => {
    const start = new Date('2026-06-01T00:00:00Z')
    makeSelectChain([
      makeGoalRow({ id: 'g-weekly', type: 'WEEKLY', targetWords: 5000, startDate: start }),
      makeGoalRow({ id: 'g-daily', type: 'DAILY', targetWords: 1000, startDate: start }),
    ])
    makeSelectChain([
      { userId: 'u-1', wordsAdded: 400, loggedAt: new Date(start.getTime() + 1000) },
    ])

    const r = await getActiveWordGoalSummaryAction('hive-pick-1')
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).not.toBeNull()
    expect(r.data!.goal.type).toBe('DAILY')
    expect(r.data!.goal.id).toBe('g-daily')
    expect(r.data!.progress).toBe(400)
  })
})
