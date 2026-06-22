import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
  AuthError: class extends Error {},
}))

vi.mock('@/lib/books/can-read', () => ({
  canReadBook: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Drizzle query chain stub. Each builder method returns `this` so any chain of
// `.from().where().leftJoin().innerJoin().groupBy().orderBy().limit().offset()`
// resolves to an empty array via the trailing `then`-like `await` — Drizzle's
// builders are thenable, so we expose `then` on the proxy.
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

import * as discoverActions from '@/lib/actions/discover.actions'

describe('discover actions surface', () => {
  it('exports the post-#32 D1 action surface (Featured Fresh removed)', () => {
    expect(typeof discoverActions.getTrendingBooksAction).toBe('function')
    expect(typeof discoverActions.getRisingStarsBooksAction).toBe('function')
    expect(typeof discoverActions.getRecentlyUpdatedBooksAction).toBe('function')
    expect(typeof discoverActions.getNewReleasesBooksAction).toBe('function')
    expect(typeof discoverActions.getBestOngoingBooksAction).toBe('function')
    expect(typeof discoverActions.getFollowingFeedAction).toBe('function')
    expect(typeof discoverActions.getBackfillBooksAction).toBe('function')
    expect(typeof discoverActions.searchBooksDiscoverAction).toBe('function')
    expect(typeof discoverActions.getGenreBookCountsAction).toBe('function')
  })

  it('exports getFeaturedFreshBookAction (issue #32 redo — featured banner restored on All + For You)', () => {
    expect(typeof discoverActions.getFeaturedFreshBookAction).toBe('function')
  })

  it('no longer exports legacy getDiscoverFeedAction / getDiscoverWritersAction', () => {
    expect(
      (discoverActions as Record<string, unknown>).getDiscoverFeedAction,
    ).toBeUndefined()
    expect(
      (discoverActions as Record<string, unknown>).getDiscoverWritersAction,
    ).toBeUndefined()
  })

  it('preserves still-consumed legacy exports', () => {
    expect(typeof discoverActions.getPublicBookAction).toBe('function')
    expect(typeof discoverActions.getBookCommentsAction).toBe('function')
    expect(typeof discoverActions.getMoreByAuthorAction).toBe('function')
    expect(typeof discoverActions.searchBooksAction).toBe('function')
  })
})

describe('searchBooksDiscoverAction — W2.1 extended filter inputs', () => {
  it('accepts empty input (no q, no filters) and returns success', async () => {
    const r = await discoverActions.searchBooksDiscoverAction({})
    expect(r.success).toBe(true)
  })

  it('accepts multi-genre via genres[]', async () => {
    const r = await discoverActions.searchBooksDiscoverAction({
      genres: ['fantasy', 'sci-fi'],
    })
    expect(r.success).toBe(true)
  })

  it('drops unknown genres from genres[] (silently filtered)', async () => {
    const r = await discoverActions.searchBooksDiscoverAction({
      genres: ['fantasy', 'not-a-real-genre'],
    })
    expect(r.success).toBe(true)
  })

  it.each(['short', 'novella', 'novel', 'epic'] as const)(
    'accepts length=%s',
    async (len) => {
      const r = await discoverActions.searchBooksDiscoverAction({ length: len })
      expect(r.success).toBe(true)
    },
  )

  it.each(['ongoing', 'completed'] as const)(
    'accepts status=%s',
    async (st) => {
      const r = await discoverActions.searchBooksDiscoverAction({ status: st })
      expect(r.success).toBe(true)
    },
  )

  it.each(['standalone', 'in-series'] as const)(
    'accepts series=%s',
    async (s) => {
      const r = await discoverActions.searchBooksDiscoverAction({ series: s })
      expect(r.success).toBe(true)
    },
  )

  it.each(['week', 'month'] as const)('accepts updated=%s', async (u) => {
    const r = await discoverActions.searchBooksDiscoverAction({ updated: u })
    expect(r.success).toBe(true)
  })

  it('composes all new filters together', async () => {
    const r = await discoverActions.searchBooksDiscoverAction({
      q: 'crown',
      genres: ['fantasy'],
      length: 'novel',
      status: 'ongoing',
      series: 'in-series',
      updated: 'week',
      sort: 'popular',
    })
    expect(r.success).toBe(true)
  })

  it('still accepts the legacy single genre input', async () => {
    const r = await discoverActions.searchBooksDiscoverAction({
      q: 'crown',
      genre: 'fantasy',
    })
    expect(r.success).toBe(true)
  })
})
