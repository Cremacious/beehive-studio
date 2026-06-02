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

describe('reading actions surface', () => {
  it('exports markChapterReadAction, unmarkChapterReadAction, getReadingProgressAction', async () => {
    const mod = await import('@/lib/actions/reading.actions')
    expect(typeof mod.markChapterReadAction).toBe('function')
    expect(typeof mod.unmarkChapterReadAction).toBe('function')
    expect(typeof mod.getReadingProgressAction).toBe('function')
  })

  it('markChapterReadAction is async and takes 2 args (bookId, chapterBinderItemId)', async () => {
    const mod = await import('@/lib/actions/reading.actions')
    expect(mod.markChapterReadAction.length).toBe(2)
  })

  it('unmarkChapterReadAction is async and takes 2 args (bookId, chapterBinderItemId)', async () => {
    const mod = await import('@/lib/actions/reading.actions')
    expect(mod.unmarkChapterReadAction.length).toBe(2)
  })
})
