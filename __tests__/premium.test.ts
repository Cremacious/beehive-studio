vi.mock('@/db', () => ({
  db: { query: { userBilling: { findFirst: vi.fn() } } },
}))

import { FREE_BOOK_LIMIT, getBookLimitForTier } from '@/lib/premium'

describe('getBookLimitForTier', () => {
  it('returns FREE_BOOK_LIMIT for free users', () => {
    expect(getBookLimitForTier(false)).toBe(FREE_BOOK_LIMIT)
  })

  it('returns Infinity for premium users', () => {
    expect(getBookLimitForTier(true)).toBe(Infinity)
  })
})

describe('FREE_BOOK_LIMIT', () => {
  it('is 3', () => {
    expect(FREE_BOOK_LIMIT).toBe(3)
  })
})
