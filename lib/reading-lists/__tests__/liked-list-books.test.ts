import { describe, it, expect, vi, beforeEach } from 'vitest';

const { selectMock, fromMock, innerJoinMock, leftJoinMock, whereMock, orderByMock } = vi.hoisted(() => {
  const orderByMock = vi.fn();
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
  const leftJoinMock = vi.fn(() => ({ where: whereMock }));
  const innerJoinMock = vi.fn(() => ({ leftJoin: leftJoinMock }));
  const fromMock = vi.fn(() => ({ innerJoin: innerJoinMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  return { selectMock, fromMock, innerJoinMock, leftJoinMock, whereMock, orderByMock };
});

vi.mock('@/db', () => ({
  db: {
    select: selectMock,
  },
}));

import { getLikedListBooks } from '../liked-list-books';

beforeEach(() => {
  selectMock.mockClear();
  fromMock.mockClear();
  innerJoinMock.mockClear();
  leftJoinMock.mockClear();
  whereMock.mockClear();
  orderByMock.mockReset();
});

describe('getLikedListBooks', () => {
  it('returns empty array when user has no likes', async () => {
    orderByMock.mockResolvedValue([]);
    const result = await getLikedListBooks('user-1', 'list-liked');
    expect(result).toEqual([]);
  });

  it('projects rows with synthetic ids + recency-ordered indexes', async () => {
    const now = new Date('2026-06-04T12:00:00Z');
    const earlier = new Date('2026-06-03T12:00:00Z');
    orderByMock.mockResolvedValue([
      {
        bookId: 'book-1',
        likedAt: now,
        bookTitle: 'Book One',
        bookCoverUrl: 'https://example.com/1.png',
        authorUserId: 'author-1',
        authorUsername: 'alice',
        authorDisplayName: 'Alice A.',
      },
      {
        bookId: 'book-2',
        likedAt: earlier,
        bookTitle: 'Book Two',
        bookCoverUrl: null,
        authorUserId: 'author-2',
        authorUsername: 'bob',
        authorDisplayName: null,
      },
    ]);

    const result = await getLikedListBooks('user-1', 'list-liked');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'liked-book-1',
      listId: 'list-liked',
      bookId: 'book-1',
      title: 'Book One',
      author: 'Alice A.', // displayName wins
      coverUrl: 'https://example.com/1.png',
      isRead: false,
      rating: null,
      commentary: null,
      order: 0,
      addedAt: now,
    });
    expect(result[1]).toMatchObject({
      id: 'liked-book-2',
      bookId: 'book-2',
      author: 'bob', // displayName null → falls through to username
      coverUrl: null,
      order: 1,
    });
  });

  it("falls back to 'Unknown author' when no profile", async () => {
    orderByMock.mockResolvedValue([
      {
        bookId: 'book-3',
        likedAt: new Date(),
        bookTitle: 'Orphan Book',
        bookCoverUrl: null,
        authorUserId: 'author-3',
        authorUsername: null,
        authorDisplayName: null,
      },
    ]);

    const result = await getLikedListBooks('user-1', 'list-liked');
    expect(result[0].author).toBe('Unknown author');
  });
});
