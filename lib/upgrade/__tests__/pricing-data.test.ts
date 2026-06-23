// lib/upgrade/__tests__/pricing-data.test.ts
import { describe, it, expect, vi } from 'vitest'

// server-only and stripe are not available in the test environment;
// mock them so we can import and test the pure computeSavingsPct helper.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/stripe/client', () => ({ stripe: {} }))

import { computeSavingsPct } from '@/lib/upgrade/pricing-data'

describe('computeSavingsPct', () => {
  it('computes 37% for $7.99/mo vs $59.99/yr', () => {
    expect(computeSavingsPct(799, 5999)).toBe(37)
  })
  it('returns 0 when monthly is 0', () => {
    expect(computeSavingsPct(0, 5999)).toBe(0)
  })
})
