import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    query: { friendships: { findMany: vi.fn() } },
    select: vi.fn(),
  },
}));

import { db } from '@/db';
import { getMutualFriends } from '../get-mutual-friends';

describe('getMutualFriends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty when neither user has friends', async () => {
    (db.query.friendships.findMany as any).mockResolvedValue([]);
    const result = await getMutualFriends('u1', 'u2', 10);
    expect(result.mutuals).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns mutuals limited and with total count separate', async () => {
    // u1 friends: [a, b, c, d]; u2 friends: [a, b, c, e] → intersect [a, b, c], total=3
    (db.query.friendships.findMany as any)
      .mockResolvedValueOnce([
        { requesterId: 'u1', recipientId: 'a' },
        { requesterId: 'u1', recipientId: 'b' },
        { requesterId: 'u1', recipientId: 'c' },
        { requesterId: 'd', recipientId: 'u1' },
      ])
      .mockResolvedValueOnce([
        { requesterId: 'u2', recipientId: 'a' },
        { requesterId: 'u2', recipientId: 'b' },
        { requesterId: 'c', recipientId: 'u2' },
        { requesterId: 'u2', recipientId: 'e' },
      ]);
    const sampleMutuals = [
      { userId: 'a', username: 'alice', displayName: 'Alice', avatarUrl: null },
      { userId: 'b', username: 'bob', displayName: 'Bob', avatarUrl: null },
    ];
    const mock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(sampleMutuals),
    };
    (db.select as any).mockReturnValue(mock);
    const result = await getMutualFriends('u1', 'u2', 3);
    expect(result.mutuals).toHaveLength(2);
    expect(result.mutuals[0].username).toBe('alice');
    expect(result.total).toBe(3);
  });
});
