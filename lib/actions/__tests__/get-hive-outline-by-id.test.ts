import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}))

vi.mock('@/lib/hive/permissions', () => ({
  requireHiveMember: vi.fn(async () => 'CONTRIBUTOR'),
  type: {},
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: {
        findFirst: vi.fn(),
      },
      binderItems: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      userProfiles: {
        findFirst: vi.fn(),
      },
    },
  },
}))

import * as actions from '../hive-content.actions'

describe('getHiveOutlineByIdAction', () => {
  it('exports the action', () => {
    expect(typeof actions.getHiveOutlineByIdAction).toBe('function')
  })

  it('takes two string args', () => {
    expect(actions.getHiveOutlineByIdAction.length).toBe(2)
  })
})
