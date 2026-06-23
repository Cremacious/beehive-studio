// lib/plans/__tests__/limits.test.ts
import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS, PRICING_DISPLAY } from '@/lib/plans/limits'
import { FREE_BOOK_LIMIT, getBookLimitForTier, getHiveMemberLimitForTier } from '@/lib/premium'

describe('plan limits config', () => {
  it('premium numeric limits are >= free limits', () => {
    expect(PLAN_LIMITS.premium.books).toBeGreaterThanOrEqual(PLAN_LIMITS.free.books)
    expect(PLAN_LIMITS.premium.hiveMembers).toBeGreaterThanOrEqual(PLAN_LIMITS.free.hiveMembers)
  })

  it('lib/premium constants derive from the config', () => {
    expect(FREE_BOOK_LIMIT).toBe(PLAN_LIMITS.free.books)
  })

  it('tier helpers return config values', () => {
    expect(getBookLimitForTier(false)).toBe(PLAN_LIMITS.free.books)
    expect(getBookLimitForTier(true)).toBe(PLAN_LIMITS.premium.books)
    expect(getHiveMemberLimitForTier(true)).toBe(Infinity)
  })

  it('display pricing matches locked decision', () => {
    expect(PRICING_DISPLAY.monthlyUsd).toBe(7.99)
    expect(PRICING_DISPLAY.annualUsd).toBe(59.99)
  })
})
