import { vi, beforeEach } from 'vitest'

const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/db', () => ({
  db: {
    query: {
      userBilling: {
        findFirst: mockFindFirst,
      },
    },
  },
}))

import {
  FREE_BOOK_LIMIT,
  getBookLimitForTier,
  getHiveLimitForTier,
  getHiveMemberLimitForTier,
  getUserPremiumStatus,
  requirePremium,
} from '@/lib/premium'

beforeEach(() => {
  mockFindFirst.mockReset()
})

describe('getBookLimitForTier', () => {
  it('returns FREE_BOOK_LIMIT for free users', () => {
    expect(getBookLimitForTier(false)).toBe(FREE_BOOK_LIMIT)
  })

  it('returns Infinity for premium users', () => {
    expect(getBookLimitForTier(true)).toBe(Infinity)
  })
})

describe('getHiveLimitForTier', () => {
  it('returns Infinity for premium users', () => {
    expect(getHiveLimitForTier(true)).toBe(Infinity)
  })

  it('returns FREE_HIVE_LIMIT for free users', () => {
    expect(getHiveLimitForTier(false)).toBeLessThan(Infinity)
  })
})

describe('getHiveMemberLimitForTier', () => {
  it('returns Infinity for premium users', () => {
    expect(getHiveMemberLimitForTier(true)).toBe(Infinity)
  })

  it('returns a finite limit for free users', () => {
    expect(getHiveMemberLimitForTier(false)).toBeLessThan(Infinity)
  })
})

describe('getUserPremiumStatus', () => {
  it('returns true when billing row has premium=true', async () => {
    mockFindFirst.mockResolvedValue({ premium: true })
    expect(await getUserPremiumStatus('user-1')).toBe(true)
  })

  it('returns false when billing row has premium=false', async () => {
    mockFindFirst.mockResolvedValue({ premium: false })
    expect(await getUserPremiumStatus('user-1')).toBe(false)
  })

  it('returns false when no billing row exists', async () => {
    mockFindFirst.mockResolvedValue(undefined)
    expect(await getUserPremiumStatus('user-1')).toBe(false)
  })
})

describe('requirePremium', () => {
  it('does not throw when isPremium is true', () => {
    expect(() => requirePremium(true, 'version_history')).not.toThrow()
  })

  it('throws PREMIUM_REQUIRED:<featureName> when isPremium is false', () => {
    expect(() => requirePremium(false, 'version_history')).toThrow(
      'PREMIUM_REQUIRED:version_history',
    )
  })
})
