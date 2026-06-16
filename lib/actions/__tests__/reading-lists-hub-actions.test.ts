import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
  AuthError: class extends Error {},
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Drizzle query chain stub — every chained builder returns the proxy; awaiting
// it resolves to an empty array via the thenable. `db.execute` returns an
// empty rows shape.
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
      execute: async () => ({ rows: [] }),
      query: {},
    },
  }
})

import * as hubActions from '@/lib/actions/reading-lists-hub.actions'

describe('reading-lists-hub actions surface', () => {
  it('exports getCommunityListsAction as a function', () => {
    expect(typeof hubActions.getCommunityListsAction).toBe('function')
  })

  it('exports getViewerListStatsAction as a function', () => {
    expect(typeof hubActions.getViewerListStatsAction).toBe('function')
  })

  it('exports getTrendingListsForRailAction as a function', () => {
    expect(typeof hubActions.getTrendingListsForRailAction).toBe('function')
  })

  it('returns { success: true, data: { rows, totalCount, hasMore } } shape', async () => {
    const r = await hubActions.getCommunityListsAction({ viewerId: 'user-1' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(Array.isArray(r.data.rows)).toBe(true)
      expect(typeof r.data.totalCount).toBe('number')
      expect(typeof r.data.hasMore).toBe('boolean')
    }
  })

  it.each(['all', 'yours', 'following', 'liked'] as const)(
    'accepts tab=%s',
    async (tab) => {
      const r = await hubActions.getCommunityListsAction({
        viewerId: 'user-1',
        tab,
      })
      expect(r.success).toBe(true)
    },
  )

  it.each(['recent', 'most-followed', 'a-z', 'most-books'] as const)(
    'accepts sort=%s',
    async (sort) => {
      const r = await hubActions.getCommunityListsAction({
        viewerId: 'user-1',
        sort,
      })
      expect(r.success).toBe(true)
    },
  )

  it('accepts page param', async () => {
    const r = await hubActions.getCommunityListsAction({
      viewerId: 'user-1',
      page: 2,
    })
    expect(r.success).toBe(true)
  })

  it('defaults missing tab/sort/page without throwing', async () => {
    const r = await hubActions.getCommunityListsAction({ viewerId: 'user-1' })
    expect(r.success).toBe(true)
  })

  it('getViewerListStatsAction returns 4-stat shape', async () => {
    const r = await hubActions.getViewerListStatsAction({ viewerId: 'user-1' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toMatchObject({
        created: expect.any(Number),
        following: expect.any(Number),
        followers: expect.any(Number),
        booksSaved: expect.any(Number),
      })
    }
  })

  it('getTrendingListsForRailAction returns an array', async () => {
    const r = await hubActions.getTrendingListsForRailAction({ limit: 4 })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(Array.isArray(r.data)).toBe(true)
    }
  })

  it('getTrendingListsForRailAction caps limit at 30', async () => {
    // Boundary: pass huge limit, ensure it still resolves without error.
    const r = await hubActions.getTrendingListsForRailAction({ limit: 9999 })
    expect(r.success).toBe(true)
  })

  it('getTrendingListsForRailAction defaults limit when omitted', async () => {
    const r = await hubActions.getTrendingListsForRailAction()
    expect(r.success).toBe(true)
  })
})
