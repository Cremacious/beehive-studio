import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

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
  return { db: { select: () => proxy, selectDistinct: () => proxy } }
})

import { getPlatformTopGenres } from '../platform-top-genres'

describe('getPlatformTopGenres', () => {
  it('is exported as an async function returning string array', async () => {
    const r = await getPlatformTopGenres()
    expect(Array.isArray(r)).toBe(true)
  })
})
