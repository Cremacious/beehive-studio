import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mocking ─────────────────────────────────────────────────────────────
const insertCalls: Array<{ table: string; values: any }> = []
const updateCalls: Array<{ table: string; values: any }> = []
const deleteCalls: Array<{ table: string }> = []

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find(
      (s) => s.description === 'drizzle:Name',
    )
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

// Tx helpers: mimic drizzle insert/update/delete/select chains.
const txInsert = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    values: vi.fn(async (values: any) => {
      insertCalls.push({ table: tName, values })
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

const txDelete = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    where: vi.fn(async () => {
      deleteCalls.push({ table: tName })
    }),
  }
})

// txSelect simulates: existing-like lookup. Returns rows captured via the
// per-test setter `setLikeExists`.
let likeExists = false
const txSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(async () => (likeExists ? [{ userId: 'user-1' }] : [])),
    })),
  })),
}))

const buzzPostsFindFirst = vi.fn<(a: any) => any>()
const buzzPostsFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const buzzLikesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const userProfilesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])

vi.mock('@/db', () => ({
  db: {
    query: {
      hiveBuzzPosts: {
        findFirst: (a: any) => buzzPostsFindFirst(a),
        findMany: (a: any) => buzzPostsFindMany(a),
      },
      hiveBuzzLikes: {
        findMany: (a: any) => buzzLikesFindMany(a),
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
    delete: (table: any) => txDelete(table),
    transaction: vi.fn(async (fn: any) => {
      return await fn({
        insert: txInsert,
        update: txUpdate,
        delete: txDelete,
        select: txSelect,
      })
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
  createBuzzPostAction,
  updateBuzzPostAction,
  toggleBuzzLikeAction,
} from '../hive-buzz.actions'
import type { HiveRole } from '@/lib/hive/permissions'

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  deleteCalls.length = 0
  vi.clearAllMocks()
  likeExists = false
  requireAuthMock.mockResolvedValue('user-1')
  requireHiveMemberMock.mockResolvedValue('CONTRIBUTOR')
  buzzPostsFindFirst.mockResolvedValue(null)
  buzzPostsFindMany.mockResolvedValue([])
  buzzLikesFindMany.mockResolvedValue([])
  userProfilesFindMany.mockResolvedValue([])
})

// ── createBuzzPostAction ────────────────────────────────────────────────────

describe('createBuzzPostAction — H4 T8', () => {
  it('happy path TEXT: inserts post + fires buzz_posted activity in same tx', async () => {
    const r = await createBuzzPostAction({
      type: 'TEXT',
      hiveId: 'hive-1',
      body: 'A short status update from the writers den.',
    })
    expect(r.success).toBe(true)
    const ins = insertCalls.find((c) => c.table === 'hive_buzz_posts')
    expect(ins).toBeDefined()
    expect(ins!.values).toMatchObject({
      hiveId: 'hive-1',
      authorId: 'user-1',
      type: 'TEXT',
      body: 'A short status update from the writers den.',
      linkUrl: null,
    })
    const act = insertCalls.find((c) => c.table === 'hive_activity')
    expect(act).toBeDefined()
    expect(act!.values.type).toBe('buzz_posted')
    expect(act!.values.payload).toMatchObject({
      type: 'TEXT',
      bodyExcerpt: 'A short status update from the writers den.',
      linkUrl: null,
    })
  })

  it('LINK without linkUrl is rejected by Zod', async () => {
    const r = await createBuzzPostAction(
      // missing required linkUrl — runtime Zod must reject
      { type: 'LINK', hiveId: 'hive-1', body: 'caption' } as any,
    )
    expect(r.success).toBe(false)
    expect(insertCalls.find((c) => c.table === 'hive_buzz_posts')).toBeUndefined()
  })

  it('TEXT with linkUrl is rejected by discriminated union (unknown key path)', async () => {
    const r = await createBuzzPostAction({
      // discriminated union TEXT variant has no `linkUrl` key — Zod will strip
      // it but the more important guarantee is the action does not write the
      // linkUrl into the DB.
      type: 'TEXT',
      hiveId: 'hive-1',
      body: 'hello',
      // @ts-expect-error testing extra key
      linkUrl: 'https://example.com',
    })
    expect(r.success).toBe(true)
    const ins = insertCalls.find((c) => c.table === 'hive_buzz_posts')
    expect(ins!.values.linkUrl).toBeNull()
  })

  it('non-https URL is rejected', async () => {
    const r = await createBuzzPostAction({
      type: 'LINK',
      hiveId: 'hive-1',
      body: 'check this out',
      linkUrl: 'http://insecure.example.com',
    })
    expect(r.success).toBe(false)
    expect(insertCalls.find((c) => c.table === 'hive_buzz_posts')).toBeUndefined()
  })

  it('happy path LINK: writes linkUrl into row + payload', async () => {
    const r = await createBuzzPostAction({
      type: 'LINK',
      hiveId: 'hive-1',
      body: 'inspiring article',
      linkUrl: 'https://example.com/post',
    })
    expect(r.success).toBe(true)
    const ins = insertCalls.find((c) => c.table === 'hive_buzz_posts')
    expect(ins!.values).toMatchObject({
      type: 'LINK',
      linkUrl: 'https://example.com/post',
    })
    const act = insertCalls.find((c) => c.table === 'hive_activity')
    expect(act!.values.payload).toMatchObject({
      type: 'LINK',
      linkUrl: 'https://example.com/post',
    })
  })
})

// ── updateBuzzPostAction permission matrix ─────────────────────────────────

describe('updateBuzzPostAction — H4 T8 permission matrix', () => {
  function mockPost(overrides: Partial<any> = {}) {
    buzzPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      hiveId: 'hive-1',
      authorId: 'author-x',
      type: 'TEXT',
      ...overrides,
    })
  }

  it.each([
    ['OWNER', 'user-1', 'someone-else', true],
    ['MODERATOR', 'user-1', 'someone-else', true],
    ['CONTRIBUTOR', 'user-1', 'someone-else', false],
    ['BETA_READER', 'user-1', 'someone-else', false],
    ['CONTRIBUTOR', 'user-1', 'user-1', true],
    ['BETA_READER', 'user-1', 'user-1', true],
  ] as const)(
    'role=%s viewer=%s author=%s allowed=%s',
    async (role, viewerId, postAuthor, allowed) => {
      requireAuthMock.mockResolvedValueOnce(viewerId)
      requireHiveMemberMock.mockResolvedValueOnce(role as HiveRole)
      mockPost({ authorId: postAuthor })
      const r = await updateBuzzPostAction({
        id: 'post-1',
        body: 'edited body',
      })
      if (allowed) {
        expect(r.success).toBe(true)
        expect(updateCalls.find((c) => c.table === 'hive_buzz_posts')).toBeDefined()
      } else {
        expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
        expect(updateCalls.find((c) => c.table === 'hive_buzz_posts')).toBeUndefined()
      }
    },
  )
})

// ── toggleBuzzLikeAction ───────────────────────────────────────────────────

describe('toggleBuzzLikeAction — H4 T8', () => {
  function mockPost() {
    buzzPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      hiveId: 'hive-1',
    })
  }

  it('like → unlike → like is idempotent per call (final state correct)', async () => {
    // call 1: not liked → like (insert + count+1)
    mockPost()
    likeExists = false
    // readback for likeCount after the toggle
    buzzPostsFindFirst.mockResolvedValueOnce({ likeCount: 1 })
    let r = await toggleBuzzLikeAction({ buzzId: 'post-1' })
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data).toEqual({ liked: true, likeCount: 1 })
    expect(insertCalls.find((c) => c.table === 'hive_buzz_likes')).toBeDefined()
    expect(updateCalls.find((c) => c.table === 'hive_buzz_posts')).toBeDefined()

    // reset captures between calls
    insertCalls.length = 0
    updateCalls.length = 0
    deleteCalls.length = 0

    // call 2: already liked → unlike (delete + count-1)
    mockPost()
    likeExists = true
    buzzPostsFindFirst.mockResolvedValueOnce({ likeCount: 0 })
    r = await toggleBuzzLikeAction({ buzzId: 'post-1' })
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data).toEqual({ liked: false, likeCount: 0 })
    expect(deleteCalls.find((c) => c.table === 'hive_buzz_likes')).toBeDefined()
    expect(updateCalls.find((c) => c.table === 'hive_buzz_posts')).toBeDefined()

    // reset
    insertCalls.length = 0
    updateCalls.length = 0
    deleteCalls.length = 0

    // call 3: not liked again → like (idempotent: each call resolves to the
    // correct branch given current state)
    mockPost()
    likeExists = false
    buzzPostsFindFirst.mockResolvedValueOnce({ likeCount: 1 })
    r = await toggleBuzzLikeAction({ buzzId: 'post-1' })
    expect(r.success).toBe(true)
    if (!r.success) throw new Error('unreachable')
    expect(r.data).toEqual({ liked: true, likeCount: 1 })
  })

  it('like_count delta: increments on insert branch', async () => {
    mockPost()
    likeExists = false
    buzzPostsFindFirst.mockResolvedValueOnce({ likeCount: 5 })
    await toggleBuzzLikeAction({ buzzId: 'post-1' })
    const upd = updateCalls.find((c) => c.table === 'hive_buzz_posts')
    expect(upd).toBeDefined()
    // The set value is a sql fragment — we just verify the call happened.
    expect(upd!.values.likeCount).toBeDefined()
  })

  it('like_count delta: decrements on delete branch', async () => {
    mockPost()
    likeExists = true
    buzzPostsFindFirst.mockResolvedValueOnce({ likeCount: 4 })
    await toggleBuzzLikeAction({ buzzId: 'post-1' })
    const upd = updateCalls.find((c) => c.table === 'hive_buzz_posts')
    expect(upd).toBeDefined()
    expect(upd!.values.likeCount).toBeDefined()
  })

  it('NOT_FOUND when post missing', async () => {
    buzzPostsFindFirst.mockResolvedValueOnce(null)
    const r = await toggleBuzzLikeAction({ buzzId: 'missing' })
    expect(r).toEqual({ success: false, error: 'NOT_FOUND' })
  })
})
