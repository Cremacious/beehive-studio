import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: { query: { friendships: { findFirst: vi.fn() } } },
}));

import { db } from '@/db';
import { areFriends } from '../are-friends';

describe('areFriends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false for self', async () => {
    expect(await areFriends('u1', 'u1')).toBe(false);
  });

  it('returns true when ACCEPTED row exists requester→recipient', async () => {
    (db.query.friendships.findFirst as any).mockResolvedValue({ id: 'f1' });
    expect(await areFriends('u1', 'u2')).toBe(true);
  });

  it('returns true when ACCEPTED row exists recipient→requester (reverse direction)', async () => {
    (db.query.friendships.findFirst as any).mockResolvedValue({ id: 'f1' });
    expect(await areFriends('u2', 'u1')).toBe(true);
  });

  it('returns false when no row found', async () => {
    (db.query.friendships.findFirst as any).mockResolvedValue(undefined);
    expect(await areFriends('u1', 'u2')).toBe(false);
  });
});
