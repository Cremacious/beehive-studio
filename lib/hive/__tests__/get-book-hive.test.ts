import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/db', () => ({
  db: { query: { hives: { findFirst: vi.fn() } } },
}))
// React cache() unwrap: just identity in tests
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T extends (...a: any[]) => any>(fn: T) => fn }
})

import { getBookHive } from '../get-book-hive'
import { db } from '@/db'

describe('getBookHive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { hiveId } when a hive exists for the book', async () => {
    ;(db.query.hives.findFirst as any).mockResolvedValue({ id: 'hive-1' })
    const r = await getBookHive('book-1')
    expect(r).toEqual({ hiveId: 'hive-1' })
  })

  it('returns null when no hive exists for the book', async () => {
    ;(db.query.hives.findFirst as any).mockResolvedValue(null)
    const r = await getBookHive('book-1')
    expect(r).toBe(null)
  })
})
