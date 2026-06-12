import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
  AuthError: class extends Error {},
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Drizzle query chain stub mirroring discover-hives-actions.test.ts. Each
// builder method returns `this`; the chain is thenable (resolves to []).
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
      query: {
        userBlocks: { findFirst: async () => undefined },
      },
    },
  }
})

import * as discoverListsActions from '@/lib/actions/discover-lists.actions'

describe('discover-lists actions surface', () => {
  it('exports all 9 D3a actions', () => {
    expect(typeof discoverListsActions.getFeaturedListAction).toBe('function')
    expect(typeof discoverListsActions.getTrendingListsAction).toBe('function')
    expect(typeof discoverListsActions.getRecentlyUpdatedListsAction).toBe(
      'function',
    )
    expect(typeof discoverListsActions.getNewListsAction).toBe('function')
    expect(typeof discoverListsActions.getMostFollowedListsAction).toBe(
      'function',
    )
    expect(typeof discoverListsActions.getFollowingListsAction).toBe('function')
    expect(typeof discoverListsActions.getListBackfillAction).toBe('function')
    expect(typeof discoverListsActions.searchListsDiscoverAction).toBe(
      'function',
    )
    expect(typeof discoverListsActions.getListGenreCountsAction).toBe(
      'function',
    )
  })

  it('rail actions accept zero-arg-ish object (smoke shape only)', async () => {
    const recent = await discoverListsActions.getRecentlyUpdatedListsAction({})
    expect(recent.success).toBe(true)
  })
})
