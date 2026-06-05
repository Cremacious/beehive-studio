import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}))

vi.mock('@/lib/reading-lists/predicates', () => ({
  canViewList: vi.fn(async () => true),
  canEditList: vi.fn(() => true),
  canFollowList: vi.fn(async () => true),
}))

vi.mock('@/lib/social/record-activity', () => ({
  recordSocialActivityTx: vi.fn(async () => undefined),
}))

vi.mock('@/lib/reading-lists/liked-list-books', () => ({
  getLikedListBooks: vi.fn(async () => []),
}))

vi.mock('@/lib/books/can-read', () => ({
  canReadBook: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/db', () => {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => Promise.resolve([]),
    groupBy: () => chain,
    set: () => chain,
    values: () => ({
      onConflictDoNothing: () => ({ returning: async () => [] }),
      returning: async () => [],
    }),
    returning: async () => [],
  }
  return {
    db: {
      select: () => chain,
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => chain,
          update: () => chain,
          delete: () => chain,
          select: () => chain,
          query: {
            socialActivity: { findFirst: async () => null },
          },
        }),
      query: {
        readingLists: { findFirst: async () => null },
        readingListBooks: { findFirst: async () => null },
        readingListFollows: { findFirst: async () => null },
        socialActivity: { findFirst: async () => null },
      },
    },
  }
})

import * as actions from '@/lib/actions/reading-lists.actions'

describe('reading-lists actions surface', () => {
  it('exports createListAction', () => {
    expect(typeof actions.createListAction).toBe('function')
  })

  it('exports getListsAction', () => {
    expect(typeof actions.getListsAction).toBe('function')
  })

  it('exports getListAction', () => {
    expect(typeof actions.getListAction).toBe('function')
  })

  it('exports updateListAction', () => {
    expect(typeof actions.updateListAction).toBe('function')
  })

  it('exports deleteListAction', () => {
    expect(typeof actions.deleteListAction).toBe('function')
  })

  it('exports addBookToListAction', () => {
    expect(typeof actions.addBookToListAction).toBe('function')
  })

  it('exports updateListBookAction', () => {
    expect(typeof actions.updateListBookAction).toBe('function')
  })

  it('exports removeBookFromListAction', () => {
    expect(typeof actions.removeBookFromListAction).toBe('function')
  })

  it('exports reorderListBooksAction', () => {
    expect(typeof actions.reorderListBooksAction).toBe('function')
  })

  it('exports followListAction', () => {
    expect(typeof actions.followListAction).toBe('function')
  })

  it('exports unfollowListAction', () => {
    expect(typeof actions.unfollowListAction).toBe('function')
  })

  it('exports getListFollowersCountAction', () => {
    expect(typeof actions.getListFollowersCountAction).toBe('function')
  })

  it('exports getDiscoverableListsAction', () => {
    expect(typeof actions.getDiscoverableListsAction).toBe('function')
  })

  it('arity sanity: 1-arg actions take 1 input', () => {
    expect(actions.createListAction.length).toBe(1)
    expect(actions.updateListAction.length).toBe(1)
    expect(actions.deleteListAction.length).toBe(1)
    expect(actions.addBookToListAction.length).toBe(1)
    expect(actions.updateListBookAction.length).toBe(1)
    expect(actions.removeBookFromListAction.length).toBe(1)
    expect(actions.reorderListBooksAction.length).toBe(1)
    expect(actions.followListAction.length).toBe(1)
    expect(actions.unfollowListAction.length).toBe(1)
    expect(actions.getListsAction.length).toBe(1)
    expect(actions.getDiscoverableListsAction.length).toBe(1)
    expect(actions.getListAction.length).toBe(1)
    expect(actions.getListFollowersCountAction.length).toBe(1)
  })
})

describe('discover actions — searchBooksAction surface', () => {
  it('searchBooksAction is exported and is a function', async () => {
    const discover = await import('@/lib/actions/discover.actions')
    expect(typeof discover.searchBooksAction).toBe('function')
    expect(discover.searchBooksAction.length).toBe(1)
  })
})
