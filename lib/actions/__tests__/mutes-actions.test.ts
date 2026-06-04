import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
}))

vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
    insert: () => ({
      values: () => ({ onConflictDoNothing: async () => undefined }),
    }),
    delete: () => ({ where: async () => undefined }),
    query: {
      userMutes: { findMany: async () => [] },
    },
  },
}))

import * as mutesActions from '@/lib/actions/mutes.actions'

describe('mutes actions surface', () => {
  it('exports muteUserAction, unmuteUserAction, getMutedUsersAction', () => {
    expect(typeof mutesActions.muteUserAction).toBe('function')
    expect(typeof mutesActions.unmuteUserAction).toBe('function')
    expect(typeof mutesActions.getMutedUsersAction).toBe('function')
  })

  it('muteUserAction takes 1 arg (input)', () => {
    expect(mutesActions.muteUserAction.length).toBe(1)
  })

  it('unmuteUserAction takes 1 arg (input)', () => {
    expect(mutesActions.unmuteUserAction.length).toBe(1)
  })

  it('getMutedUsersAction takes 0 args', () => {
    expect(mutesActions.getMutedUsersAction.length).toBe(0)
  })
})
