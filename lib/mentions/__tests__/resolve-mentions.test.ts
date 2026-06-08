import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted pattern for chained DB builder mocks (per C3 T2 lesson)
const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  isBlocked: vi.fn(),
}))

vi.mock('@/db', () => ({ db: { select: mocks.dbSelect } }))
vi.mock('@/lib/social/is-blocked', () => ({ isBlocked: mocks.isBlocked }))

import { resolveMentionedUsers } from '../resolve-mentions'

describe('resolveMentionedUsers', () => {
  beforeEach(() => {
    mocks.dbSelect.mockReset()
    mocks.isBlocked.mockReset()
    mocks.isBlocked.mockResolvedValue(false)
  })

  it('returns empty users when no inputs provided', async () => {
    const result = await resolveMentionedUsers({
      tiptapUserIds: [], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users).toEqual([])
    expect(Array.from(result.alreadyNotified)).toEqual([])
  })

  it('returns MENTION_CAP_EXCEEDED when more than 5 distinct mentions', async () => {
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
      textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    expect(result).toEqual({ ok: false, error: 'MENTION_CAP_EXCEEDED' })
  })

  it('filters out self-mentions', async () => {
    mocks.dbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { id: 'u_actor', username: 'me' },
        { id: 'u_bob', username: 'bob' },
      ]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u_actor', 'u_bob'], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users.map((u) => u.userId)).toEqual(['u_bob'])
  })

  it('filters out blocked users (either direction)', async () => {
    mocks.dbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { id: 'u_bob', username: 'bob' },
        { id: 'u_carol', username: 'carol' },
      ]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
    mocks.isBlocked.mockImplementation(async (a, b) =>
      (a === 'u_actor' && b === 'u_bob') || (a === 'u_bob' && b === 'u_actor'))
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u_bob', 'u_carol'], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users.map((u) => u.userId)).toEqual(['u_carol'])
  })

  it('returns alreadyNotified set from prior MENTION notifications within 24h', async () => {
    mocks.dbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { id: 'u_bob', username: 'bob' },
        { id: 'u_carol', username: 'carol' },
      ]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { userId: 'u_bob' },
      ]) }) })
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u_bob', 'u_carol'], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users.map((u) => u.userId).sort()).toEqual(['u_bob', 'u_carol'])
    expect(Array.from(result.alreadyNotified)).toEqual(['u_bob'])
  })
})
