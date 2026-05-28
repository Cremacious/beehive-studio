import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canReadBook } from '../can-read'

vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}))

async function mockBook(book: { userId: string; visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS' } | null) {
  const { db } = await import('@/db')
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => (book ? [{ id: 'b1', userId: book.userId, visibility: book.visibility }] : []),
      }),
    }),
  })
}

describe('canReadBook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns NOT_FOUND when book missing', async () => {
    await mockBook(null)
    const result = await canReadBook('b1', 'viewer')
    expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' })
  })

  it('returns ok when viewer is author', async () => {
    await mockBook({ userId: 'u1', visibility: 'PRIVATE' })
    expect(await canReadBook('b1', 'u1')).toEqual({ ok: true })
  })

  it('returns ok for PUBLIC with signed-out viewer', async () => {
    await mockBook({ userId: 'u1', visibility: 'PUBLIC' })
    expect(await canReadBook('b1', null)).toEqual({ ok: true })
  })

  it('returns ok for PUBLIC with signed-in stranger', async () => {
    await mockBook({ userId: 'u1', visibility: 'PUBLIC' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: true })
  })

  it('returns FRIENDS_ONLY for FRIENDS book viewed by stranger (SP-A: author only)', async () => {
    await mockBook({ userId: 'u1', visibility: 'FRIENDS' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'FRIENDS_ONLY' })
  })

  it('returns PRIVATE for PRIVATE book viewed by stranger', async () => {
    await mockBook({ userId: 'u1', visibility: 'PRIVATE' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'PRIVATE' })
  })
})
