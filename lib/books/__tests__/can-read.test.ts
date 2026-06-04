import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canReadBook } from '../can-read'

vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}))

const areFriendsMock = vi.fn(async () => false)
vi.mock('@/lib/social/are-friends', () => ({
  areFriends: (a: string, b: string) => areFriendsMock(),
}))

const isBlockedMock = vi.fn(async () => false)
vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: (a: string, b: string) => isBlockedMock(),
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
  beforeEach(() => {
    vi.clearAllMocks()
    areFriendsMock.mockResolvedValue(false)
    isBlockedMock.mockResolvedValue(false)
  })

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

  it('returns FRIENDS_ONLY for FRIENDS book viewed by non-friend stranger', async () => {
    await mockBook({ userId: 'u1', visibility: 'FRIENDS' })
    areFriendsMock.mockResolvedValue(false)
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'FRIENDS_ONLY' })
  })

  it('returns ok for FRIENDS book when viewer is a friend', async () => {
    await mockBook({ userId: 'u1', visibility: 'FRIENDS' })
    areFriendsMock.mockResolvedValue(true)
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: true })
  })

  it('returns FRIENDS_ONLY for FRIENDS book viewed by anon', async () => {
    await mockBook({ userId: 'u1', visibility: 'FRIENDS' })
    expect(await canReadBook('b1', null)).toEqual({ ok: false, reason: 'FRIENDS_ONLY' })
  })

  it('returns PRIVATE for PRIVATE book viewed by stranger', async () => {
    await mockBook({ userId: 'u1', visibility: 'PRIVATE' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'PRIVATE' })
  })

  it('returns NOT_FOUND (block masquerade) when viewer blocked author on a PUBLIC book', async () => {
    await mockBook({ userId: 'u1', visibility: 'PUBLIC' })
    isBlockedMock.mockResolvedValue(true)
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'NOT_FOUND' })
  })

  it('returns NOT_FOUND (block masquerade) when author blocked viewer on a PUBLIC book', async () => {
    // isBlocked is symmetric (checks either direction); single mock covers both
    await mockBook({ userId: 'u1', visibility: 'PUBLIC' })
    isBlockedMock.mockResolvedValue(true)
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'NOT_FOUND' })
  })

  it('returns NOT_FOUND when blocked even if friendship would otherwise grant access', async () => {
    await mockBook({ userId: 'u1', visibility: 'FRIENDS' })
    isBlockedMock.mockResolvedValue(true)
    areFriendsMock.mockResolvedValue(true)
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'NOT_FOUND' })
  })
})
