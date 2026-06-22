import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'viewer-1'),
  AuthError: class extends Error {},
}))

const makeQueryProxy = (rows: unknown[] = []) => {
  const p: any = {}
  for (const k of ['select', 'from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'groupBy']) {
    p[k] = vi.fn(() => p)
  }
  p.then = (resolve: any) => resolve(rows)
  return p
}

vi.mock('@/db', () => ({
  db: { select: vi.fn(() => makeQueryProxy([])) },
}))

import * as railActions from '@/lib/actions/sparks-rail.actions'

beforeEach(() => vi.clearAllMocks())

describe('sparks-rail.actions exports', () => {
  it('exports getTrendingSparksForRailAction', () => {
    expect(typeof railActions.getTrendingSparksForRailAction).toBe('function')
  })
  it('exports getViewerSparkStatsAction', () => {
    expect(typeof railActions.getViewerSparkStatsAction).toBe('function')
  })
  it('getTrendingSparksForRailAction returns success shape', async () => {
    const r = await railActions.getTrendingSparksForRailAction({ limit: 3 })
    expect(r.success).toBe(true)
    if (r.success) expect(Array.isArray(r.data)).toBe(true)
  })
  it('getViewerSparkStatsAction returns 4 count keys', async () => {
    const r = await railActions.getViewerSparkStatsAction()
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({
        created: 0,
        entered: 0,
        entriesReceived: 0,
        wins: 0,
      })
    }
  })
})
