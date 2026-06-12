import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
  AuthError: class extends Error {},
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Drizzle query chain stub mirroring discover-sparks-actions.test.ts. Each
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

import * as discoverHivesActions from '@/lib/actions/discover-hives.actions'

describe('discover-hives actions surface', () => {
  it('exports all 9 D2b actions', () => {
    expect(typeof discoverHivesActions.getFeaturedHiveAction).toBe('function')
    expect(typeof discoverHivesActions.getTrendingHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getRecentlyActiveHivesAction).toBe(
      'function',
    )
    expect(typeof discoverHivesActions.getNewHivesAction).toBe('function')
    expect(
      typeof discoverHivesActions.getLookingForCollaboratorsHivesAction,
    ).toBe('function')
    expect(typeof discoverHivesActions.getFollowingHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getHiveBackfillAction).toBe('function')
    expect(typeof discoverHivesActions.searchHivesDiscoverAction).toBe(
      'function',
    )
    expect(typeof discoverHivesActions.getHiveGenreCountsAction).toBe(
      'function',
    )
  })

  it('rail actions accept zero-arg-ish object (smoke shape only)', async () => {
    const recent = await discoverHivesActions.getRecentlyActiveHivesAction({})
    expect(recent.success).toBe(true)
  })
})
