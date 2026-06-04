import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}))

vi.mock('@/db', () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: 'fr-1' }],
      }),
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: 'fr-1' }],
          }),
        }),
        update: () => ({ set: () => ({ where: async () => undefined }) }),
      }),
    query: {
      friendInvites: { findFirst: async () => null },
      friendships: { findFirst: async () => null },
      userProfiles: { findFirst: async () => null },
    },
  },
}))

import * as friendInvitesActions from '@/lib/actions/friend-invites.actions'

describe('friend-invites actions surface', () => {
  it('exports createFriendInviteAction, claimFriendInviteAction', () => {
    expect(typeof friendInvitesActions.createFriendInviteAction).toBe('function')
    expect(typeof friendInvitesActions.claimFriendInviteAction).toBe('function')
  })

  it('createFriendInviteAction takes 0 args', () => {
    expect(friendInvitesActions.createFriendInviteAction.length).toBe(0)
  })

  it('claimFriendInviteAction takes 1 arg (input)', () => {
    expect(friendInvitesActions.claimFriendInviteAction.length).toBe(1)
  })
})
