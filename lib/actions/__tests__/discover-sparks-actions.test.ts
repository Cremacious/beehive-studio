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
  it('exports the post-#32 D2a action surface (Featured Spark removed)', () => {
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

describe('searchSparksDiscoverAction — W2.2 extended filter inputs', () => {
  it('accepts empty input (no q, no filters)', async () => {
    const r = await discoverSparksActions.searchSparksDiscoverAction({})
    expect(r.success).toBe(true)
  })

  it('accepts multi-genre via genres[]', async () => {
    const r = await discoverSparksActions.searchSparksDiscoverAction({
      genres: ['fantasy', 'sci-fi'],
    })
    expect(r.success).toBe(true)
  })

  it.each(['live', 'voting', 'ended', 'all'] as const)(
    'accepts state=%s',
    async (s) => {
      const r = await discoverSparksActions.searchSparksDiscoverAction({
        state: s,
      })
      expect(r.success).toBe(true)
    },
  )

  it.each(['flash', 'medium', 'long'] as const)(
    'accepts wordLimit=%s',
    async (w) => {
      const r = await discoverSparksActions.searchSparksDiscoverAction({
        wordLimit: w,
      })
      expect(r.success).toBe(true)
    },
  )

  it.each(['24h', 'week'] as const)('accepts timeLeft=%s', async (t) => {
    const r = await discoverSparksActions.searchSparksDiscoverAction({
      timeLeft: t,
    })
    expect(r.success).toBe(true)
  })

  it.each(['anyone', 'following'] as const)(
    'accepts creator=%s (guest treated as anyone)',
    async (c) => {
      const r = await discoverSparksActions.searchSparksDiscoverAction({
        creator: c,
      })
      expect(r.success).toBe(true)
    },
  )

  it('composes all new filters together', async () => {
    const r = await discoverSparksActions.searchSparksDiscoverAction({
      q: 'heist',
      genres: ['fantasy'],
      state: 'live',
      wordLimit: 'medium',
      timeLeft: '24h',
      creator: 'following',
      sort: 'urgent',
    })
    expect(r.success).toBe(true)
  })

  it('preserves legacy status enum input', async () => {
    const r = await discoverSparksActions.searchSparksDiscoverAction({
      q: 'heist',
      status: 'OPEN',
    })
    expect(r.success).toBe(true)
  })
})
