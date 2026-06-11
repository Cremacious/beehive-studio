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
  it('exports all 10 new D1 actions', () => {
    expect(typeof discoverActions.getFeaturedFreshBookAction).toBe('function')
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
