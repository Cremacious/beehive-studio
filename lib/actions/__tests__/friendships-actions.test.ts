import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}))

vi.mock('@/db', () => {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve([]),
    orderBy: () => Promise.resolve([]),
    values: () => ({
      returning: async () => [{ id: 'fr-1' }],
    }),
    set: () => chain,
  }
  return {
    db: {
      select: () => chain,
      insert: () => chain,
      update: () => chain,
      delete: () => ({ where: async () => undefined }),
      transaction: async (fn: any) =>
        fn({
          select: () => chain,
          insert: () => chain,
          update: () => chain,
          delete: () => ({ where: async () => undefined }),
        }),
    },
  }
})

import * as friendshipActions from '@/lib/actions/friendships.actions'

describe('friendship actions surface', () => {
  it('exports the 8 pre-existing actions', () => {
    expect(typeof friendshipActions.sendFriendRequestAction).toBe('function')
    expect(typeof friendshipActions.acceptFriendRequestAction).toBe('function')
    expect(typeof friendshipActions.rejectFriendRequestAction).toBe('function')
    expect(typeof friendshipActions.cancelFriendRequestAction).toBe('function')
    expect(typeof friendshipActions.unfriendAction).toBe('function')
    expect(typeof friendshipActions.getFriendshipStatusAction).toBe('function')
    expect(typeof friendshipActions.listFriendsAction).toBe('function')
    expect(typeof friendshipActions.listPendingFriendRequestsAction).toBe('function')
  })

  it('exports the 2 new actions', () => {
    expect(typeof friendshipActions.getFriendCountAction).toBe('function')
    expect(typeof friendshipActions.searchUsersAction).toBe('function')
  })

  it('getFriendCountAction takes 1 arg (targetUserId)', () => {
    expect(friendshipActions.getFriendCountAction.length).toBe(1)
  })

  it('searchUsersAction takes 1 arg (input object)', () => {
    expect(friendshipActions.searchUsersAction.length).toBe(1)
  })
})
