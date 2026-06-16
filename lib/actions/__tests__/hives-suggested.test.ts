import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'viewer-1'),
  AuthError: class extends Error {},
}))

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(async () => ({ rows: [] })),
  },
}))

import * as suggestedActions from '@/lib/actions/hives-suggested.actions'
import { db } from '@/db'

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] })
})

describe('hives-suggested.actions exports', () => {
  it('exports getSuggestedHivesAction', () => {
    expect(typeof suggestedActions.getSuggestedHivesAction).toBe('function')
  })

  it('returns success shape with array payload', async () => {
    const r = await suggestedActions.getSuggestedHivesAction({ limit: 12 })
    expect(r.success).toBe(true)
    if (r.success) expect(Array.isArray(r.data)).toBe(true)
  })

  it('rows carry suggestionReason field (tier 1 → friend reason)', async () => {
    const tier1Row = {
      id: 'h1',
      bookId: null,
      name: 'Friend Hive',
      description: null,
      visibility: 'PUBLIC' as const,
      status: 'ACTIVE' as const,
      ownerId: 'owner-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      bookTitle: null,
      bookCoverUrl: null,
      memberCount: 5,
      lastActiveAt: null,
      memberPreviews: [],
      friendCount: 1,
      topFriendUsername: 'alice',
    }

    ;(db.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [tier1Row] }) // tier 1
      .mockResolvedValueOnce({ rows: [] }) // tier 2
      .mockResolvedValueOnce({ rows: [] }) // tier 3

    const r = await suggestedActions.getSuggestedHivesAction({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toHaveLength(1)
      expect(r.data[0]).toHaveProperty('suggestionReason')
      expect(r.data[0].suggestionReason).toBe('@alice is a member')
    }
  })

  it('all-empty case returns empty array', async () => {
    const r = await suggestedActions.getSuggestedHivesAction({ limit: 100 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual([])
  })
})
