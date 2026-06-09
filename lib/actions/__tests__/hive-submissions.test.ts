import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mocking ─────────────────────────────────────────────────────────────
const insertCalls: Array<{ table: string; values: any }> = []
const updateCalls: Array<{ table: string; values: any; where?: any }> = []

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name')
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

// Tx insert: mirrors the hive-suggestions test pattern.
const txInsert = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    values: vi.fn((values: any) => {
      insertCalls.push({ table: tName, values })
      const returningFn = vi.fn(async () => [{ id: 'new-id' }])
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

// tx.select() — used by approveSubmissionAction to compute max(order).
const maxOrderHolder = { value: null as number | null }
const txSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(async () => [{ maxOrder: maxOrderHolder.value }]),
  })),
}))

const hivesFindFirst = vi.fn<(a: any) => any>()
const booksFindFirst = vi.fn<(a: any) => any>()
const submissionsFindFirst = vi.fn<(a: any) => any>()
const submissionsFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const userProfilesFindFirst = vi.fn<(a: any) => any>(async () => null)
const userProfilesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: { findFirst: (a: any) => hivesFindFirst(a) },
      books: { findFirst: (a: any) => booksFindFirst(a) },
      hiveSubmissions: {
        findFirst: (a: any) => submissionsFindFirst(a),
        findMany: (a: any) => submissionsFindMany(a),
      },
      userProfiles: {
        findFirst: (a: any) => userProfilesFindFirst(a),
        findMany: (a: any) => userProfilesFindMany(a),
      },
      notificationPreferences: {
        findFirst: async () => undefined,
      },
    },
    insert: (table: any) => {
      const tName = tableName(table)
      return {
        values: vi.fn(async (values: any) => {
          insertCalls.push({ table: tName, values })
        }),
      }
    },
    update: (table: any) => txUpdate(table),
    transaction: vi.fn(async (fn: any) => {
      return await fn({
        insert: txInsert,
        update: txUpdate,
        select: txSelect,
        query: {
          hiveMembers: { findMany: async () => [] },
        },
      })
    }),
    select: vi.fn(),
  },
}))

const requireAuthMock = vi.fn(async () => 'user-1')
vi.mock('@/lib/require-auth', () => ({
  requireAuth: () => requireAuthMock(),
}))

const requireHiveMemberMock = vi.fn<(h: string, u: string) => Promise<string>>(
  async () => 'CONTRIBUTOR',
)
vi.mock('@/lib/hive/permissions', async () => {
  const actual: any = await vi.importActual('@/lib/hive/permissions')
  return {
    ...actual,
    requireHiveMember: (hiveId: string, userId: string) =>
      requireHiveMemberMock(hiveId, userId),
  }
})

// extractWordCount mock — deterministic count.
vi.mock('@/lib/tiptap-utils', () => ({
  extractWordCount: (_doc: any) => 42,
}))

// ── Imports under test ──────────────────────────────────────────────────────
import {
  saveSubmissionDraftAction,
  submitSubmissionAction,
  approveSubmissionAction,
  rejectSubmissionAction,
  listHiveSubmissionsAction,
} from '../hive-submissions.actions'
import type { HiveRole } from '@/lib/hive/permissions'

const FIXTURE_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
}

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue('user-1')
  requireHiveMemberMock.mockResolvedValue('CONTRIBUTOR')
  hivesFindFirst.mockResolvedValue({ id: 'hive-1', bookId: 'book-1' })
  booksFindFirst.mockResolvedValue({ id: 'book-1', title: 'My Book' })
  submissionsFindFirst.mockResolvedValue(null)
  submissionsFindMany.mockResolvedValue([])
  userProfilesFindFirst.mockResolvedValue(null)
  userProfilesFindMany.mockResolvedValue([])
  maxOrderHolder.value = null
})

// ── saveSubmissionDraftAction ──────────────────────────────────────────────

describe('saveSubmissionDraftAction — H3 T8', () => {
  it('BETA_READER blocked (canSubmitChapter false)', async () => {
    requireHiveMemberMock.mockResolvedValueOnce('BETA_READER')
    const r = await saveSubmissionDraftAction({
      hiveId: 'hive-1',
      title: 'Ch 1',
      content: FIXTURE_DOC,
      targetChapterOrder: null,
    })
    expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
    expect(insertCalls.find((c) => c.table === 'hive_submissions')).toBeUndefined()
  })

  it('existing-row update: PENDING submission cannot be edited (returns SUBMISSION_LOCKED)', async () => {
    submissionsFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      userId: 'user-1',
      draftStatus: 'PENDING',
      hiveId: 'hive-1',
    })
    const r = await saveSubmissionDraftAction({
      submissionId: 'sub-1',
      hiveId: 'hive-1',
      title: 'New title',
      content: FIXTURE_DOC,
      targetChapterOrder: null,
    })
    expect(r).toEqual({ success: false, error: 'SUBMISSION_LOCKED' })
    expect(updateCalls.find((c) => c.table === 'hive_submissions')).toBeUndefined()
  })

  it('new draft inserts row with draftStatus DRAFT + server-computed wordCount', async () => {
    const r = await saveSubmissionDraftAction({
      hiveId: 'hive-1',
      title: 'Ch 1',
      content: FIXTURE_DOC,
      targetChapterOrder: 3,
    })
    expect(r.success).toBe(true)
    const ins = insertCalls.find((c) => c.table === 'hive_submissions')
    expect(ins).toBeDefined()
    expect(ins!.values).toMatchObject({
      hiveId: 'hive-1',
      userId: 'user-1',
      title: 'Ch 1',
      wordCount: 42,
      targetChapterOrder: 3,
      draftStatus: 'DRAFT',
    })
    // No activity event for drafts.
    expect(insertCalls.find((c) => c.table === 'hive_activity')).toBeUndefined()
  })
})

// ── submitSubmissionAction ─────────────────────────────────────────────────

describe('submitSubmissionAction — H3 T8', () => {
  it('happy path: flips DRAFT → PENDING and fires chapter_submitted', async () => {
    submissionsFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      hiveId: 'hive-1',
      userId: 'user-1',
      title: 'Ch 1',
      wordCount: 1200,
      draftStatus: 'DRAFT',
    })
    const r = await submitSubmissionAction({ id: 'sub-1' })
    expect(r.success).toBe(true)
    const upd = updateCalls.find((c) => c.table === 'hive_submissions')
    expect(upd).toBeDefined()
    expect(upd!.values).toMatchObject({ draftStatus: 'PENDING' })
    const act = insertCalls.find((c) => c.table === 'hive_activity')
    expect(act).toBeDefined()
    expect(act!.values.type).toBe('chapter_submitted')
    expect(act!.values.payload).toMatchObject({
      submissionId: 'sub-1',
      title: 'Ch 1',
      wordCount: 1200,
    })
  })

  it('blocks when not submitter', async () => {
    submissionsFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      hiveId: 'hive-1',
      userId: 'someone-else',
      title: 'Ch 1',
      wordCount: 100,
      draftStatus: 'DRAFT',
    })
    const r = await submitSubmissionAction({ id: 'sub-1' })
    expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
  })
})

// ── approveSubmissionAction ────────────────────────────────────────────────

describe('approveSubmissionAction — H3 T8', () => {
  function mockPendingSubmission(overrides: Partial<any> = {}) {
    submissionsFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      hiveId: 'hive-1',
      userId: 'submitter-1',
      title: 'Ch 1',
      content: FIXTURE_DOC,
      wordCount: 1200,
      targetChapterOrder: null,
      draftStatus: 'PENDING',
      ...overrides,
    })
  }

  it.each([
    ['OWNER', true],
    ['MODERATOR', true],
    ['CONTRIBUTOR', false],
    ['BETA_READER', false],
  ] as const)('role %s → allowed=%s', async (role, allowed) => {
    mockPendingSubmission()
    requireHiveMemberMock.mockResolvedValueOnce(role as HiveRole)
    const r = await approveSubmissionAction({ id: 'sub-1' })
    if (allowed) {
      expect(r.success).toBe(true)
    } else {
      expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
      expect(insertCalls.find((c) => c.table === 'binder_items')).toBeUndefined()
      expect(insertCalls.find((c) => c.table === 'chapters')).toBeUndefined()
    }
  })

  it('happy path (targetChapterOrder=null): inserts binderItem + chapter, sets authorUserId to submitter, fires approved event', async () => {
    mockPendingSubmission()
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')
    maxOrderHolder.value = 4

    const r = await approveSubmissionAction({ id: 'sub-1' })
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data.chapterId).toBeTruthy()
    expect(r.data.binderItemId).toBeTruthy()

    const binderInsert = insertCalls.find((c) => c.table === 'binder_items')
    expect(binderInsert).toBeDefined()
    expect(binderInsert!.values).toMatchObject({
      bookId: 'book-1',
      type: 'chapter',
      title: 'Ch 1',
      order: 5, // max(4) + 1
      authorId: 'submitter-1',
      lastEditedBy: 'submitter-1',
    })

    const chapterInsert = insertCalls.find((c) => c.table === 'chapters')
    expect(chapterInsert).toBeDefined()
    expect(chapterInsert!.values).toMatchObject({
      bookId: 'book-1',
      authorUserId: 'submitter-1',
      wordCount: 1200,
      status: 'FIRST_DRAFT',
    })

    // submission updated with APPROVED + createdChapterId
    const subUpdate = updateCalls.find((c) => c.table === 'hive_submissions')
    expect(subUpdate).toBeDefined()
    expect(subUpdate!.values).toMatchObject({
      draftStatus: 'APPROVED',
      reviewedBy: 'user-1',
    })
    expect(subUpdate!.values.createdChapterId).toBeTruthy()

    // activity event
    const act = insertCalls.find((c) => c.table === 'hive_activity')
    expect(act).toBeDefined()
    expect(act!.values.type).toBe('chapter_submitted_approved')
    expect(act!.values.payload).toMatchObject({
      submissionId: 'sub-1',
      submitterUserId: 'submitter-1',
    })
  })

  it('targetChapterOrder set: shifts siblings at-or-above target by +1', async () => {
    mockPendingSubmission({ targetChapterOrder: 2 })
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')

    const r = await approveSubmissionAction({ id: 'sub-1' })
    expect(r.success).toBe(true)

    // A binder_items update should have fired for the sibling shift, BEFORE
    // the new insert. The shift uses a sql expression on the order column.
    const shiftUpdate = updateCalls.find((c) => c.table === 'binder_items')
    expect(shiftUpdate).toBeDefined()

    // New binder item inserted at the target order.
    const binderInsert = insertCalls.find((c) => c.table === 'binder_items')
    expect(binderInsert!.values.order).toBe(2)
  })

  it('DRAFT submission rejected (INVALID_STATE)', async () => {
    mockPendingSubmission({ draftStatus: 'DRAFT' })
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')
    const r = await approveSubmissionAction({ id: 'sub-1' })
    expect(r).toEqual({ success: false, error: 'INVALID_STATE' })
    expect(insertCalls.find((c) => c.table === 'binder_items')).toBeUndefined()
  })

  it('APPROVED submission rejected (INVALID_STATE)', async () => {
    mockPendingSubmission({ draftStatus: 'APPROVED' })
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')
    const r = await approveSubmissionAction({ id: 'sub-1' })
    expect(r).toEqual({ success: false, error: 'INVALID_STATE' })
  })
})

// ── rejectSubmissionAction ─────────────────────────────────────────────────

describe('rejectSubmissionAction — H3 T8', () => {
  it('requires non-empty reviewNote (Zod schema rejection)', async () => {
    const r = await rejectSubmissionAction({ id: 'sub-1', reviewNote: '' })
    expect(r.success).toBe(false)
    expect(updateCalls.find((c) => c.table === 'hive_submissions')).toBeUndefined()
  })

  it('happy path: PENDING → REJECTED, fires chapter_submitted_rejected with note in payload', async () => {
    submissionsFindFirst.mockResolvedValueOnce({
      id: 'sub-1',
      hiveId: 'hive-1',
      userId: 'submitter-1',
      draftStatus: 'PENDING',
    })
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')
    const r = await rejectSubmissionAction({ id: 'sub-1', reviewNote: 'needs more work' })
    expect(r.success).toBe(true)
    const upd = updateCalls.find((c) => c.table === 'hive_submissions')
    expect(upd!.values).toMatchObject({
      draftStatus: 'REJECTED',
      reviewNote: 'needs more work',
      reviewedBy: 'user-1',
    })
    const act = insertCalls.find((c) => c.table === 'hive_activity')
    expect(act!.values.type).toBe('chapter_submitted_rejected')
    expect(act!.values.payload).toMatchObject({ reviewNote: 'needs more work' })
  })
})

// ── listHiveSubmissionsAction ──────────────────────────────────────────────

describe('listHiveSubmissionsAction — H3 T8', () => {
  it('non-reviewer (CONTRIBUTOR) gets allInHive empty', async () => {
    requireHiveMemberMock.mockResolvedValueOnce('CONTRIBUTOR')
    submissionsFindMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        hiveId: 'hive-1',
        userId: 'user-1',
        title: 'Draft 1',
        content: {},
        wordCount: 0,
        targetChapterOrder: null,
        draftStatus: 'DRAFT',
        createdChapterId: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const r = await listHiveSubmissionsAction('hive-1')
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data.myDrafts).toHaveLength(1)
    expect(r.data.mySubmissions).toHaveLength(0)
    expect(r.data.allInHive).toHaveLength(0)
  })

  it('reviewer (OWNER) gets allInHive populated with PENDING first then reviewed', async () => {
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')
    const now = new Date()
    const earlier = new Date(now.getTime() - 1000)

    const myRowsFixture = [
      {
        id: 'mine-1',
        hiveId: 'hive-1',
        userId: 'user-1',
        title: 'mine pending',
        content: {},
        wordCount: 0,
        targetChapterOrder: null,
        draftStatus: 'PENDING',
        createdChapterId: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: earlier,
        updatedAt: earlier,
      },
    ]
    const allRowsFixture = [
      ...myRowsFixture,
      {
        id: 'other-rej',
        hiveId: 'hive-1',
        userId: 'other-user',
        title: 'rejected',
        content: {},
        wordCount: 0,
        targetChapterOrder: null,
        draftStatus: 'REJECTED',
        createdChapterId: null,
        reviewedBy: 'user-1',
        reviewedAt: now,
        reviewNote: 'no',
        createdAt: earlier,
        updatedAt: now,
      },
      {
        id: 'other-pending',
        hiveId: 'hive-1',
        userId: 'other-user-2',
        title: 'other pending',
        content: {},
        wordCount: 0,
        targetChapterOrder: null,
        draftStatus: 'PENDING',
        createdChapterId: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: now,
        updatedAt: now,
      },
    ]

    submissionsFindMany.mockResolvedValueOnce(myRowsFixture)
    submissionsFindMany.mockResolvedValueOnce(allRowsFixture)

    const r = await listHiveSubmissionsAction('hive-1')
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data.allInHive.length).toBe(3)
    // PENDING come before REJECTED
    expect(r.data.allInHive[0].draftStatus).toBe('PENDING')
    expect(r.data.allInHive[1].draftStatus).toBe('PENDING')
    expect(r.data.allInHive[2].draftStatus).toBe('REJECTED')
  })
})
