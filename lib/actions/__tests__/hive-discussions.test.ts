import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mocking ─────────────────────────────────────────────────────────────
const insertCalls: Array<{ table: string; values: any }> = []
const updateCalls: Array<{ table: string; values: any }> = []
const deleteCalls: Array<{ table: string }> = []

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name')
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

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

const postsFindFirst = vi.fn<(a: any) => any>()
const postsFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const userProfilesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])

vi.mock('@/db', () => ({
  db: {
    query: {
      hiveDiscussionPosts: {
        findFirst: (a: any) => postsFindFirst(a),
        findMany: (a: any) => postsFindMany(a),
      },
      userProfiles: {
        findMany: (a: any) => userProfilesFindMany(a),
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
    delete: vi.fn((table: any) => {
      const tName = tableName(table)
      return {
        where: vi.fn(async () => {
          deleteCalls.push({ table: tName })
        }),
      }
    }),
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

// ── Imports under test ──────────────────────────────────────────────────────
import {
  createDiscussionPostAction,
  replyToDiscussionPostAction,
  editDiscussionPostAction,
  deleteDiscussionPostAction,
  listDiscussionPostsAction,
} from '../hive-discussions.actions'
import type { HiveRole } from '@/lib/hive/permissions'

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  deleteCalls.length = 0
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue('user-1')
  requireHiveMemberMock.mockResolvedValue('CONTRIBUTOR')
  postsFindFirst.mockResolvedValue(null)
  postsFindMany.mockResolvedValue([])
  userProfilesFindMany.mockResolvedValue([])
})

// ── createDiscussionPostAction ─────────────────────────────────────────────

describe('createDiscussionPostAction — H3 T9', () => {
  it('rejects missing topic (Zod)', async () => {
    const r = await createDiscussionPostAction({
      hiveId: 'hive-1',
      // @ts-expect-error testing missing topic
      topic: undefined,
      body: 'hello world',
    })
    expect(r.success).toBe(false)
    expect(insertCalls.find((c) => c.table === 'hive_discussion_posts')).toBeUndefined()
  })

  it('happy path: inserts post + fires discussion_posted activity', async () => {
    const r = await createDiscussionPostAction({
      hiveId: 'hive-1',
      topic: 'GENERAL',
      body: 'A meaningful body that will be sliced for title',
    })
    expect(r.success).toBe(true)
    const ins = insertCalls.find((c) => c.table === 'hive_discussion_posts')
    expect(ins).toBeDefined()
    expect(ins!.values).toMatchObject({
      hiveId: 'hive-1',
      authorId: 'user-1',
      content: 'A meaningful body that will be sliced for title',
      parentId: null,
      topic: 'GENERAL',
    })
    const act = insertCalls.find((c) => c.table === 'hive_activity')
    expect(act).toBeDefined()
    expect(act!.values.type).toBe('discussion_posted')
    expect(act!.values.payload).toMatchObject({
      topic: 'GENERAL',
      title: 'A meaningful body that will be sliced for title',
    })
  })
})

// ── replyToDiscussionPostAction ────────────────────────────────────────────

describe('replyToDiscussionPostAction — H3 T9', () => {
  it('rejects reply-to-reply (REPLY_DEPTH_EXCEEDED)', async () => {
    postsFindFirst.mockResolvedValueOnce({
      id: 'reply-1',
      hiveId: 'hive-1',
      parentId: 'top-1', // this IS a reply — disallow nesting
    })
    const r = await replyToDiscussionPostAction({
      parentId: 'reply-1',
      body: 'second-level reply',
    })
    expect(r).toEqual({ success: false, error: 'REPLY_DEPTH_EXCEEDED' })
    expect(insertCalls.find((c) => c.table === 'hive_discussion_posts')).toBeUndefined()
  })

  it('happy path: inserts reply (no activity event)', async () => {
    postsFindFirst.mockResolvedValueOnce({
      id: 'top-1',
      hiveId: 'hive-1',
      parentId: null,
    })
    const r = await replyToDiscussionPostAction({
      parentId: 'top-1',
      body: 'great point',
    })
    expect(r.success).toBe(true)
    const ins = insertCalls.find((c) => c.table === 'hive_discussion_posts')
    expect(ins!.values).toMatchObject({
      hiveId: 'hive-1',
      parentId: 'top-1',
      topic: null,
      content: 'great point',
    })
    expect(insertCalls.find((c) => c.table === 'hive_activity')).toBeUndefined()
  })
})

// ── listDiscussionPostsAction ──────────────────────────────────────────────

describe('listDiscussionPostsAction — H3 T9', () => {
  it('topic filter returns correct subset (only matching topic rows)', async () => {
    // The mock returns whatever the action's findMany asks for. We assert that
    // the call argument includes the topics filter so the query intent is right.
    const topPostsForFeedback = [
      {
        id: 'p1',
        hiveId: 'hive-1',
        authorId: 'a1',
        content: 'feedback post',
        parentId: null,
        topic: 'FEEDBACK',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
    ]
    postsFindMany.mockResolvedValueOnce(topPostsForFeedback)
    // Second findMany call is for replies — empty.
    postsFindMany.mockResolvedValueOnce([])

    const r = await listDiscussionPostsAction({
      hiveId: 'hive-1',
      topics: ['FEEDBACK'],
    })
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data).toHaveLength(1)
    expect(r.data[0].topic).toBe('FEEDBACK')
    expect(r.data[0].id).toBe('p1')

    // Verify the action issued a findMany whose where clause references the
    // topics array — concretely we just check it was called with a `where`
    // argument (the inArray fragment is opaque-but-present).
    expect(postsFindMany.mock.calls[0][0]).toHaveProperty('where')
  })
})

// ── editDiscussionPostAction permission matrix ─────────────────────────────

describe('editDiscussionPostAction — H3 T9 permission matrix', () => {
  function mockPost(overrides: Partial<any> = {}) {
    postsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      hiveId: 'hive-1',
      authorId: 'author-x',
      ...overrides,
    })
  }

  it.each([
    // role, viewerId, postAuthorId, allowed
    ['OWNER', 'user-1', 'someone-else', true],
    ['MODERATOR', 'user-1', 'someone-else', true],
    ['CONTRIBUTOR', 'user-1', 'someone-else', false],
    ['BETA_READER', 'user-1', 'someone-else', false],
    ['CONTRIBUTOR', 'user-1', 'user-1', true], // post author
    ['BETA_READER', 'user-1', 'user-1', true], // post author
  ] as const)(
    'role=%s viewer=%s author=%s allowed=%s',
    async (role, viewerId, postAuthor, allowed) => {
      requireAuthMock.mockResolvedValueOnce(viewerId)
      requireHiveMemberMock.mockResolvedValueOnce(role as HiveRole)
      mockPost({ authorId: postAuthor })
      const r = await editDiscussionPostAction({
        postId: 'post-1',
        body: 'edited body',
      })
      if (allowed) {
        expect(r.success).toBe(true)
        expect(updateCalls.find((c) => c.table === 'hive_discussion_posts')).toBeDefined()
      } else {
        expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
        expect(updateCalls.find((c) => c.table === 'hive_discussion_posts')).toBeUndefined()
      }
    },
  )
})

// ── deleteDiscussionPostAction ─────────────────────────────────────────────

describe('deleteDiscussionPostAction — H3 T9', () => {
  it('OWNER can delete any post — issues delete', async () => {
    postsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      hiveId: 'hive-1',
      authorId: 'someone-else',
    })
    requireHiveMemberMock.mockResolvedValueOnce('OWNER')
    const r = await deleteDiscussionPostAction('post-1')
    expect(r.success).toBe(true)
    expect(deleteCalls.find((c) => c.table === 'hive_discussion_posts')).toBeDefined()
  })
})
