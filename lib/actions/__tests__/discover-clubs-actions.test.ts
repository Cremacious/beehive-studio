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

import * as discoverClubsActions from '@/lib/actions/discover-clubs.actions'

describe('discover-clubs actions surface', () => {
  it('exports all 9 D3b actions', () => {
    expect(typeof discoverClubsActions.getFeaturedClubAction).toBe('function')
    expect(typeof discoverClubsActions.getTrendingClubsAction).toBe('function')
    expect(typeof discoverClubsActions.getActiveClubsAction).toBe('function')
    expect(typeof discoverClubsActions.getNewClubsAction).toBe('function')
    expect(typeof discoverClubsActions.getOpenToJoinClubsAction).toBe(
      'function',
    )
    expect(typeof discoverClubsActions.getFollowingClubsAction).toBe('function')
    expect(typeof discoverClubsActions.getClubBackfillAction).toBe('function')
    expect(typeof discoverClubsActions.searchClubsDiscoverAction).toBe(
      'function',
    )
    expect(typeof discoverClubsActions.getClubGenreCountsAction).toBe(
      'function',
    )
  })

  it('rail actions accept zero-arg-ish object (smoke shape only)', async () => {
    const recent = await discoverClubsActions.getActiveClubsAction({})
    expect(recent.success).toBe(true)
  })
})
