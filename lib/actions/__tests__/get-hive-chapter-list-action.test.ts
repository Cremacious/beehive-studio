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
      hives: { findFirst: vi.fn() },
      binderItems: { findMany: vi.fn() },
      chapters: { findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => []),
        })),
      })),
    })),
  },
}))

import * as actions from '../hive-content.actions'

describe('getHiveChapterListAction', () => {
  it('exports the action', () => {
    expect(typeof actions.getHiveChapterListAction).toBe('function')
  })

  it('takes one string arg (hiveId)', () => {
    expect(actions.getHiveChapterListAction.length).toBe(1)
  })
})
