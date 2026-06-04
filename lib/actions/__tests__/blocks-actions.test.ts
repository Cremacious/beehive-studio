import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
}))

vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: async () => undefined,
        onConflictDoUpdate: async () => undefined,
      }),
    }),
    delete: () => ({ where: async () => undefined }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: () => ({
          values: () => ({ onConflictDoNothing: async () => undefined }),
        }),
        delete: () => ({ where: async () => undefined }),
      }),
    query: {
      userBlocks: { findMany: async () => [] },
    },
  },
}))

import * as blocksActions from '@/lib/actions/blocks.actions'

describe('blocks actions surface', () => {
  it('exports blockUserAction, unblockUserAction, getBlockedUsersAction', () => {
    expect(typeof blocksActions.blockUserAction).toBe('function')
    expect(typeof blocksActions.unblockUserAction).toBe('function')
    expect(typeof blocksActions.getBlockedUsersAction).toBe('function')
  })

  it('blockUserAction takes 1 arg (input)', () => {
    expect(blocksActions.blockUserAction.length).toBe(1)
  })

  it('unblockUserAction takes 1 arg (input)', () => {
    expect(blocksActions.unblockUserAction.length).toBe(1)
  })

  it('getBlockedUsersAction takes 0 args', () => {
    expect(blocksActions.getBlockedUsersAction.length).toBe(0)
  })
})
