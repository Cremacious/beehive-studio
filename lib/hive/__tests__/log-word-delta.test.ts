import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/hive/get-book-hive', () => ({ getBookHive: vi.fn() }))
vi.mock('@/lib/hive/permissions', async (orig) => ({
  ...(await orig() as Record<string, unknown>),
  requireHiveMember: vi.fn(),
}))
vi.mock('@/db', () => ({
  db: {
    query: { hiveWordLogs: { findFirst: vi.fn() } },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ sum: 0 }]) })) })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  },
}))

import { logHiveWordDelta } from '../log-word-delta'
import { getBookHive } from '../get-book-hive'
import { requireHiveMember } from '../permissions'
import { db } from '@/db'

beforeEach(() => vi.clearAllMocks())

describe('logHiveWordDelta', () => {
  it('no-ops when book has no hive', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 500 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('no-ops when user is not a hive member', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hiveId: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not-member'))
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 500 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('throttles when prior log is within 60s', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hiveId: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      loggedAt: new Date(Date.now() - 30_000),
    })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('inserts when last log is older than 60s (steady growth)', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hiveId: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      loggedAt: new Date(Date.now() - 120_000),
    })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(db.insert).toHaveBeenCalled()
  })

  it('inserts negative delta on deletion', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hiveId: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ sum: 1000 }]) })),
    })
    const valuesMock = vi.fn(async () => undefined)
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({ values: valuesMock })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ wordsAdded: -200 }))
  })

  it('skips zero-delta rows', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hiveId: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ sum: 800 }]) })),
    })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('swallows errors silently', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    await expect(
      logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 500 }),
    ).resolves.toBeUndefined()
  })
})
