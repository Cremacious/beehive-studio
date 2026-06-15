import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
  AuthError: class extends Error {},
}))

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}))

vi.mock('@/lib/social/are-friends', () => ({
  areFriends: vi.fn(async () => false),
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Drizzle query chain stub — every chained builder returns the proxy; awaiting
// it resolves to an empty array via the thenable.
function makeQueryProxy(): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) => resolve([])
      }
      return () => proxy
    },
  }
  const proxy = new Proxy({}, handler) as unknown
  return proxy
}

vi.mock('@/db', () => {
  const proxy = makeQueryProxy()
  return {
    db: {
      select: () => proxy,
      selectDistinct: () => proxy,
      query: {
        userBlocks: { findFirst: async () => undefined },
      },
    },
  }
})

import * as sparksHubActions from '@/lib/actions/sparks-hub.actions'

describe('sparks-hub actions surface', () => {
  it('exports getCommunitySparksAction as a function', () => {
    expect(typeof sparksHubActions.getCommunitySparksAction).toBe('function')
  })

  it('returns { success: true, data: { sparks, totalCount, bucketCounts } } shape', async () => {
    const r = await sparksHubActions.getCommunitySparksAction({
      viewerId: 'user-1',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(Array.isArray(r.data.sparks)).toBe(true)
      expect(typeof r.data.totalCount).toBe('number')
      expect(r.data.bucketCounts).toMatchObject({
        yours: expect.any(Number),
        following: expect.any(Number),
        friends: expect.any(Number),
        entered: expect.any(Number),
        all: expect.any(Number),
      })
    }
  })

  it.each(['all', 'yours', 'following', 'friends', 'entered'] as const)(
    'accepts tab=%s',
    async (tab) => {
      const r = await sparksHubActions.getCommunitySparksAction({
        viewerId: 'user-1',
        tab,
      })
      expect(r.success).toBe(true)
    },
  )

  it.each(['recent', 'ending', 'entries', 'status'] as const)(
    'accepts sort=%s',
    async (sort) => {
      const r = await sparksHubActions.getCommunitySparksAction({
        viewerId: 'user-1',
        sort,
      })
      expect(r.success).toBe(true)
    },
  )

  it('accepts page param', async () => {
    const r = await sparksHubActions.getCommunitySparksAction({
      viewerId: 'user-1',
      page: 2,
    })
    expect(r.success).toBe(true)
  })

  it('defaults missing tab/sort/page without throwing', async () => {
    const r = await sparksHubActions.getCommunitySparksAction({
      viewerId: 'user-1',
    })
    expect(r.success).toBe(true)
  })
})
