import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
  AuthError: class extends Error {},
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Drizzle query chain stub mirroring discover-actions.test.ts. Each builder
// method returns `this`; the chain is thenable (resolves to []).
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

import * as discoverSparksActions from '@/lib/actions/discover-sparks.actions'

describe('discover-sparks actions surface', () => {
  it('exports all 10 D2a actions', () => {
    expect(typeof discoverSparksActions.getFeaturedSparkAction).toBe('function')
    expect(typeof discoverSparksActions.getLiveNowSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getVotingNowSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getHeatingUpSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getNewlyOpenedSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getFollowingSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getRecentlyWonSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getSparkBackfillAction).toBe('function')
    expect(typeof discoverSparksActions.searchSparksDiscoverAction).toBe('function')
    expect(typeof discoverSparksActions.getSparkGenreCountsAction).toBe('function')
  })

  it('rail actions accept zero-arg-ish object (smoke shape only)', async () => {
    // Sanity: rail actions are callable. We don't assert return shape — the db
    // proxy resolves to [] so they should return success-shaped results.
    const live = await discoverSparksActions.getLiveNowSparksAction({})
    expect(live.success).toBe(true)
  })
})
