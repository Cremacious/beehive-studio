import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----
const insertCalls: Array<{ table: string; values: any }> = []

const txInsert = vi.fn((table: any) => ({
  values: vi.fn(async (values: any) => {
    insertCalls.push({ table: tableName(table), values })
  }),
}))

const dbInsert = vi.fn((table: any) => ({
  values: vi.fn(async (values: any) => {
    insertCalls.push({ table: tableName(table), values })
  }),
}))

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find(s => s.description === 'drizzle:Name')
    if (sym) return table[sym]
  }
  return '<unknown>'
}

const booksFindFirst = vi.fn()

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: { findFirst: vi.fn() },
      books: { findFirst: (...a: any[]) => booksFindFirst(...a) },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ count: 0 }]),
      })),
    })),
    insert: (table: any) => dbInsert(table),
    transaction: vi.fn(async (fn: any) => {
      await fn({ insert: txInsert })
    }),
  },
}))

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/premium', () => ({
  getUserPremiumStatus: vi.fn(async () => true),
  FREE_HIVE_LIMIT: 3,
  FREE_HIVE_MEMBER_LIMIT: 5,
}))

const getBookHiveMock = vi.fn()
vi.mock('@/lib/hive/get-book-hive', () => ({
  getBookHive: (...a: any[]) => getBookHiveMock(...a),
}))

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => `id-${Math.random().toString(36).slice(2, 8)}`),
}))

import { createHiveAction } from '../hive.actions'

beforeEach(() => {
  insertCalls.length = 0
  vi.clearAllMocks()
})

describe('createHiveAction — H2 T8', () => {
  it('standalone path creates a STANDALONE_HIVE_SHADOW book before the hive', async () => {
    const r = await createHiveAction({ name: 'Standalone Hive', visibility: 'PRIVATE' })
    expect(r.success).toBe(true)

    // Find books insert
    const bookInsert = insertCalls.find(c => c.table === 'books')
    expect(bookInsert).toBeDefined()
    expect(bookInsert!.values).toMatchObject({
      userId: 'user-1',
      title: 'Standalone Hive',
      visibility: 'PRIVATE',
      discoverable: false,
      status: 'STANDALONE_HIVE_SHADOW',
    })

    // Hive insert must reference the shadow book id (non-null)
    const hiveInsert = insertCalls.find(c => c.table === 'hives')
    expect(hiveInsert).toBeDefined()
    expect(hiveInsert!.values.bookId).toBe(bookInsert!.values.id)
    expect(hiveInsert!.values.bookId).toEqual(expect.any(String))

    // Order: book before hive
    const bookIdx = insertCalls.findIndex(c => c.table === 'books')
    const hiveIdx = insertCalls.findIndex(c => c.table === 'hives')
    expect(bookIdx).toBeLessThan(hiveIdx)
  })

  it('linked-book path refuses shadow-book IDs (BOOK_NOT_FOUND)', async () => {
    // findFirst returns nothing because the ne(status, STANDALONE_HIVE_SHADOW) filter excludes it
    booksFindFirst.mockResolvedValue(undefined)

    const r = await createHiveAction({
      name: 'Linked Hive',
      visibility: 'PRIVATE',
      bookId: 'shadow-book-id',
    })
    expect(r).toEqual({ success: false, error: 'BOOK_NOT_FOUND' })
    // No inserts should have happened
    expect(insertCalls.find(c => c.table === 'books')).toBeUndefined()
    expect(insertCalls.find(c => c.table === 'hives')).toBeUndefined()
  })

  it('linked-book path rejects if book already has a hive (BOOK_ALREADY_HAS_HIVE)', async () => {
    booksFindFirst.mockResolvedValue({ id: 'book-1' })
    getBookHiveMock.mockResolvedValue({ hiveId: 'existing-hive' })

    const r = await createHiveAction({
      name: 'Dup Hive',
      visibility: 'PRIVATE',
      bookId: 'book-1',
    })
    expect(r).toEqual({ success: false, error: 'BOOK_ALREADY_HAS_HIVE' })
    expect(insertCalls.find(c => c.table === 'hives')).toBeUndefined()
  })
})
