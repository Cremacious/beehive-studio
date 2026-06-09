import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mocking ─────────────────────────────────────────────────────────────
const insertCalls: Array<{ table: string; values: any }> = []
const updateCalls: Array<{ table: string; values: any }> = []

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name')
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

// Tx insert returns a chainable {values, returning} mock.
const txInsert = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    values: vi.fn((values: any) => {
      insertCalls.push({ table: tName, values })
      const returningFn = vi.fn(async () => [{ id: 'new-sug-id' }])
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
        where: vi.fn(async () => undefined),
      }
    }),
  }
})

const hivesFindFirst = vi.fn<(a: any) => any>()
const chaptersFindFirst = vi.fn<(a: any) => any>()
const booksFindFirst = vi.fn<(a: any) => any>()
const suggestionsFindFirst = vi.fn<(a: any) => any>()
const suggestionsFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const profilesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const chapterSnapshotsFindFirst = vi.fn<(a: any) => any>(async () => null)

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: { findFirst: (a: any) => hivesFindFirst(a) },
      chapters: { findFirst: (a: any) => chaptersFindFirst(a) },
      books: { findFirst: (a: any) => booksFindFirst(a) },
      hiveSuggestions: {
        findFirst: (a: any) => suggestionsFindFirst(a),
        findMany: (a: any) => suggestionsFindMany(a),
      },
      userProfiles: {
        findMany: (a: any) => profilesFindMany(a),
      },
      chapterSnapshots: {
        findFirst: (a: any) => chapterSnapshotsFindFirst(a),
      },
      notificationPreferences: {
        findFirst: async () => undefined,
      },
    },
    insert: (table: any) => {
      const tName = tableName(table)
      return {
        values: vi.fn((values: any) => {
          insertCalls.push({ table: tName, values })
          return {
            returning: vi.fn(async () => [{ id: 'new-sug-id' }]),
          }
        }),
      }
    },
    update: (table: any) => txUpdate(table),
    transaction: vi.fn(async (fn: any) => {
      return await fn({ insert: txInsert, update: txUpdate })
    }),
    select: vi.fn(),
  },
}))

const requireAuthMock = vi.fn(async () => 'user-1')
vi.mock('@/lib/require-auth', () => ({
  requireAuth: () => requireAuthMock(),
}))

const requireHiveMemberMock = vi.fn<(h: string, u: string) => Promise<string>>(async () => 'OWNER')
vi.mock('@/lib/hive/permissions', async () => {
  const actual: any = await vi.importActual('@/lib/hive/permissions')
  return {
    ...actual,
    requireHiveMember: (hiveId: string, userId: string) =>
      requireHiveMemberMock(hiveId, userId),
  }
})

// Mock applySuggestionToDoc so we can control the found / drift behavior.
const applySuggestionToDocMock = vi.fn()
vi.mock('@/lib/tiptap-extensions/apply-suggestion', () => ({
  applySuggestionToDoc: (doc: any, id: string, replacement: string) =>
    applySuggestionToDocMock(doc, id, replacement),
}))

const getUserPremiumStatusMock = vi.fn(async (_: string) => false)
vi.mock('@/lib/premium', () => ({
  getUserPremiumStatus: (userId: string) => getUserPremiumStatusMock(userId),
}))

// ── Imports under test ──────────────────────────────────────────────────────
import {
  createSuggestionAction,
  acceptSuggestionAction,
  rejectSuggestionAction,
} from '../hive-suggestions.actions'
import { canReviewSuggestion, type HiveRole } from '@/lib/hive/permissions'

const FIXTURE_DOC = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world this is prose.' }],
    },
  ],
}

const FIXTURE_NEXT_DOC = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hi world this is prose.' }],
    },
  ],
}

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue('user-1')
  requireHiveMemberMock.mockResolvedValue('OWNER')
  hivesFindFirst.mockResolvedValue({ bookId: 'book-1' })
  chaptersFindFirst.mockResolvedValue({
    id: 'ch-1',
    bookId: 'book-1',
    content: FIXTURE_DOC,
  })
  booksFindFirst.mockResolvedValue({ id: 'book-1', userId: 'author-user' })
  suggestionsFindFirst.mockResolvedValue(null)
  suggestionsFindMany.mockResolvedValue([])
  profilesFindMany.mockResolvedValue([])
  chapterSnapshotsFindFirst.mockResolvedValue(null)
  applySuggestionToDocMock.mockReturnValue({ doc: FIXTURE_NEXT_DOC, found: true })
  getUserPremiumStatusMock.mockResolvedValue(false)
})

// ── createSuggestionAction ──────────────────────────────────────────────────

describe('createSuggestionAction — H3 T7', () => {
  it('happy path: writes row, patches doc, fires suggestion_proposed', async () => {
    const r = await createSuggestionAction({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      selectionStart: 0,
      selectionEnd: 5,
      originalExcerpt: 'Hello',
      suggestedText: 'Hi',
      body: 'shorter please',
    })
    expect(r.success).toBe(true)

    const sugInsert = insertCalls.find((c) => c.table === 'hive_suggestions')
    const actInsert = insertCalls.find((c) => c.table === 'hive_activity')
    expect(sugInsert).toBeDefined()
    expect(actInsert).toBeDefined()
    expect(sugInsert!.values).toMatchObject({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      authorId: 'user-1',
      parentId: null,
      originalExcerpt: 'Hello',
      suggestedText: 'Hi',
      body: 'shorter please',
    })
    expect(actInsert!.values.type).toBe('suggestion_proposed')
    expect(actInsert!.values.payload).toMatchObject({
      chapterId: 'ch-1',
      originalExcerpt: 'Hello',
      suggestedText: 'Hi',
    })

    // chapter content updated
    const chUpdate = updateCalls.find((c) => c.table === 'chapters')
    expect(chUpdate).toBeDefined()
    expect(chUpdate!.values.content).toBeDefined()
  })

  it('non-member is blocked — returns NOT_AUTHORIZED, no inserts', async () => {
    requireHiveMemberMock.mockRejectedValueOnce(new Error('NOT_HIVE_MEMBER'))
    const r = await createSuggestionAction({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      selectionStart: 0,
      selectionEnd: 5,
      originalExcerpt: 'Hello',
      suggestedText: 'Hi',
    })
    expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
    expect(insertCalls.find((c) => c.table === 'hive_suggestions')).toBeUndefined()
    expect(insertCalls.find((c) => c.table === 'hive_activity')).toBeUndefined()
  })
})

// ── acceptSuggestionAction ──────────────────────────────────────────────────

describe('acceptSuggestionAction — H3 T7', () => {
  function mockTopLevelSuggestion(overrides: Partial<any> = {}) {
    suggestionsFindFirst.mockResolvedValueOnce({
      id: 'sug-1',
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      suggestedText: 'Hi',
      originalExcerpt: 'Hello',
      parentId: null,
      resolved: false,
      ...overrides,
    })
  }

  it('happy path: applies doc, recomputes word count, resolves, fires suggestion_accepted', async () => {
    mockTopLevelSuggestion()
    applySuggestionToDocMock.mockReturnValueOnce({ doc: FIXTURE_NEXT_DOC, found: true })
    const r = await acceptSuggestionAction('sug-1')
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data.orphan).toBe(false)
    expect(r.data.acceptedAt).toBeInstanceOf(Date)
    expect(r.data.newWordCount).toBeGreaterThan(0)

    // chapter.content updated to whatever applySuggestionToDoc returned
    const chUpdate = updateCalls.find((c) => c.table === 'chapters')
    expect(chUpdate).toBeDefined()
    expect(chUpdate!.values.content).toBe(FIXTURE_NEXT_DOC)
    expect(typeof chUpdate!.values.wordCount).toBe('number')

    // suggestion update (resolved + acceptedAt set)
    const sugUpdate = updateCalls.find((c) => c.table === 'hive_suggestions')
    expect(sugUpdate).toBeDefined()
    expect(sugUpdate!.values).toMatchObject({
      resolved: true,
      resolvedBy: 'user-1',
    })
    expect(sugUpdate!.values.acceptedAt).toBeInstanceOf(Date)

    // book.updatedAt bump
    const bookUpdate = updateCalls.find((c) => c.table === 'books')
    expect(bookUpdate).toBeDefined()

    // activity event
    const actInsert = insertCalls.find((c) => c.table === 'hive_activity')
    expect(actInsert).toBeDefined()
    expect(actInsert!.values.type).toBe('suggestion_accepted')
  })

  it('drifted mark: chapter.content equals whatever applySuggestionToDoc returns', async () => {
    mockTopLevelSuggestion()
    const driftedDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some completely shifted prose.' }],
        },
      ],
    }
    applySuggestionToDocMock.mockReturnValueOnce({ doc: driftedDoc, found: true })
    const r = await acceptSuggestionAction('sug-1')
    expect(r.success).toBe(true)
    const chUpdate = updateCalls.find((c) => c.table === 'chapters')
    expect(chUpdate!.values.content).toBe(driftedDoc)
  })

  it('orphan: chapter NOT updated; suggestion resolved; event type suggestion_rejected with payload.orphan=true', async () => {
    mockTopLevelSuggestion()
    applySuggestionToDocMock.mockReturnValueOnce({ doc: FIXTURE_DOC, found: false })

    const r = await acceptSuggestionAction('sug-1')
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data.orphan).toBe(true)
    expect(r.data.acceptedAt).toBeNull()

    // Chapter NOT updated
    expect(updateCalls.find((c) => c.table === 'chapters')).toBeUndefined()

    // Suggestion resolved (no acceptedAt)
    const sugUpdate = updateCalls.find((c) => c.table === 'hive_suggestions')
    expect(sugUpdate).toBeDefined()
    expect(sugUpdate!.values).toMatchObject({
      resolved: true,
      resolvedBy: 'user-1',
    })
    expect(sugUpdate!.values.acceptedAt).toBeUndefined()

    // Activity event = rejected w/ orphan flag
    const actInsert = insertCalls.find((c) => c.table === 'hive_activity')
    expect(actInsert).toBeDefined()
    expect(actInsert!.values.type).toBe('suggestion_rejected')
    expect(actInsert!.values.payload).toMatchObject({ orphan: true })
  })

  it('snapshot: writes one snapshot when book owner is premium + no recent snapshot', async () => {
    mockTopLevelSuggestion()
    getUserPremiumStatusMock.mockResolvedValueOnce(true)
    chapterSnapshotsFindFirst.mockResolvedValueOnce(null)

    await acceptSuggestionAction('sug-1')

    const snapInsert = insertCalls.find((c) => c.table === 'chapter_snapshots')
    expect(snapInsert).toBeDefined()
    expect(getUserPremiumStatusMock).toHaveBeenCalledWith('author-user')
  })

  it('snapshot: skipped when book owner is NOT premium', async () => {
    mockTopLevelSuggestion()
    getUserPremiumStatusMock.mockResolvedValueOnce(false)

    await acceptSuggestionAction('sug-1')

    expect(insertCalls.find((c) => c.table === 'chapter_snapshots')).toBeUndefined()
  })

  it('snapshot: skipped when most recent snapshot is inside the 60s throttle window', async () => {
    mockTopLevelSuggestion()
    getUserPremiumStatusMock.mockResolvedValueOnce(true)
    chapterSnapshotsFindFirst.mockResolvedValueOnce({
      createdAt: new Date(Date.now() - 10_000), // 10s ago
    })

    await acceptSuggestionAction('sug-1')
    expect(insertCalls.find((c) => c.table === 'chapter_snapshots')).toBeUndefined()
  })

  it('snapshot: skipped on orphan path even when premium', async () => {
    mockTopLevelSuggestion()
    getUserPremiumStatusMock.mockResolvedValueOnce(true)
    applySuggestionToDocMock.mockReturnValueOnce({ doc: FIXTURE_DOC, found: false })

    await acceptSuggestionAction('sug-1')
    expect(insertCalls.find((c) => c.table === 'chapter_snapshots')).toBeUndefined()
  })
})

// ── rejectSuggestionAction ──────────────────────────────────────────────────

describe('rejectSuggestionAction — H3 T7', () => {
  it('does NOT mutate chapter doc; writes suggestion_rejected event', async () => {
    suggestionsFindFirst.mockResolvedValueOnce({
      id: 'sug-1',
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      parentId: null,
      originalExcerpt: 'Hello',
    })

    const r = await rejectSuggestionAction({ id: 'sug-1', note: 'no thanks' })
    expect(r.success).toBe(true)

    // No chapter update
    expect(updateCalls.find((c) => c.table === 'chapters')).toBeUndefined()

    // Suggestion update — resolved + no acceptedAt
    const sugUpdate = updateCalls.find((c) => c.table === 'hive_suggestions')
    expect(sugUpdate).toBeDefined()
    expect(sugUpdate!.values).toMatchObject({
      resolved: true,
      resolvedBy: 'user-1',
    })
    expect(sugUpdate!.values.acceptedAt).toBeUndefined()

    // Activity event
    const actInsert = insertCalls.find((c) => c.table === 'hive_activity')
    expect(actInsert).toBeDefined()
    expect(actInsert!.values.type).toBe('suggestion_rejected')
    expect(actInsert!.values.payload).toMatchObject({ note: 'no thanks' })
  })
})

// ── Permission gate sentinels ───────────────────────────────────────────────

describe('canReviewSuggestion gate — H3 T7', () => {
  it('predicate truth table: OWNER + MODERATOR allowed, CONTRIBUTOR + BETA_READER denied', () => {
    expect(canReviewSuggestion('OWNER' as HiveRole)).toBe(true)
    expect(canReviewSuggestion('MODERATOR' as HiveRole)).toBe(true)
    expect(canReviewSuggestion('CONTRIBUTOR' as HiveRole)).toBe(false)
    expect(canReviewSuggestion('BETA_READER' as HiveRole)).toBe(false)
  })

  it.each([
    ['OWNER', true],
    ['MODERATOR', true],
    ['CONTRIBUTOR', false],
    ['BETA_READER', false],
  ] as const)('acceptSuggestionAction with role %s → allowed=%s', async (role, allowed) => {
    requireHiveMemberMock.mockResolvedValueOnce(role)
    suggestionsFindFirst.mockResolvedValueOnce({
      id: 'sug-1',
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      suggestedText: 'Hi',
      originalExcerpt: 'Hello',
      parentId: null,
      resolved: false,
    })

    const r = await acceptSuggestionAction('sug-1')
    if (allowed) {
      expect(r.success).toBe(true)
    } else {
      expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
    }
  })

  it.each([
    ['OWNER', true],
    ['MODERATOR', true],
    ['CONTRIBUTOR', false],
    ['BETA_READER', false],
  ] as const)('rejectSuggestionAction with role %s → allowed=%s', async (role, allowed) => {
    requireHiveMemberMock.mockResolvedValueOnce(role)
    suggestionsFindFirst.mockResolvedValueOnce({
      id: 'sug-1',
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      parentId: null,
      originalExcerpt: 'Hello',
    })

    const r = await rejectSuggestionAction({ id: 'sug-1' })
    if (allowed) {
      expect(r.success).toBe(true)
    } else {
      expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
    }
  })
})
