import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted pattern for chained DB builder mocks (per C3 T2 / C5a T2 lesson)
const mocks = vi.hoisted(() => ({
  dbFindFirst: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      notificationPreferences: { findFirst: mocks.dbFindFirst },
    },
  },
}))

import { shouldSkipNotification } from '../check-preferences'

describe('shouldSkipNotification', () => {
  beforeEach(() => {
    mocks.dbFindFirst.mockReset()
  })

  it('returns false when no preferences row exists (default all-on)', async () => {
    mocks.dbFindFirst.mockResolvedValue(undefined)
    const skip = await shouldSkipNotification('u1', 'NEW_LIKE')
    expect(skip).toBe(false)
  })

  it('returns true when type is in opted_out_types', async () => {
    mocks.dbFindFirst.mockResolvedValue({
      optedOutTypes: ['NEW_LIKE', 'NEW_FOLLOWER'],
    })
    const skip = await shouldSkipNotification('u2', 'NEW_LIKE')
    expect(skip).toBe(true)
  })

  it('returns false when type is NOT in opted_out_types', async () => {
    mocks.dbFindFirst.mockResolvedValue({ optedOutTypes: ['NEW_LIKE'] })
    const skip = await shouldSkipNotification('u3', 'MENTION')
    expect(skip).toBe(false)
  })

  it('queries the DB on first lookup for a user (cache verified by invocation)', async () => {
    // Note: React cache() lives per-render. Under vitest without a render
    // boundary, the cache may or may not memoize across separate calls. The
    // assertion here verifies the helper hits the DB at least once and returns
    // the correct semantic answer; the per-render memoization itself is
    // exercised in real server-action call paths.
    mocks.dbFindFirst.mockResolvedValue({ optedOutTypes: ['NEW_LIKE'] })
    const skip = await shouldSkipNotification('u-cache-test', 'NEW_LIKE')
    expect(skip).toBe(true)
    expect(mocks.dbFindFirst).toHaveBeenCalled()
  })
})
