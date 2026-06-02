import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/books/can-read', () => ({
  canReadBook: vi.fn(async () => ({ ok: true })),
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
  },
}))

import * as readingActions from '@/lib/actions/reading.actions'

describe('reading actions surface', () => {
  it('exports markChapterReadAction, unmarkChapterReadAction, getReadingProgressAction', () => {
    expect(typeof readingActions.markChapterReadAction).toBe('function')
    expect(typeof readingActions.unmarkChapterReadAction).toBe('function')
    expect(typeof readingActions.getReadingProgressAction).toBe('function')
  })

  it('markChapterReadAction is async and takes 2 args (bookId, chapterBinderItemId)', () => {
    expect(readingActions.markChapterReadAction.length).toBe(2)
  })

  it('unmarkChapterReadAction is async and takes 2 args (bookId, chapterBinderItemId)', () => {
    expect(readingActions.unmarkChapterReadAction.length).toBe(2)
  })
})
