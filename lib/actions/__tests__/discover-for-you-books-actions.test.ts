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

import * as forYouActions from '@/lib/actions/discover-for-you-books.actions'

describe('discover for-you actions surface', () => {
  it('hasAnyDiscoverySignalAction is exported as a function', () => {
    expect(typeof forYouActions.hasAnyDiscoverySignalAction).toBe('function')
  })

  it('hasAnyDiscoverySignalAction returns a boolean', async () => {
    const r = await forYouActions.hasAnyDiscoverySignalAction('user-1')
    expect(typeof r).toBe('boolean')
  })
})
