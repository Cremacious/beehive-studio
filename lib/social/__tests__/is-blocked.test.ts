import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: { query: { userBlocks: { findFirst: vi.fn() } } },
}));

import { db } from '@/db';
import { isBlocked } from '../is-blocked';

describe('isBlocked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false for self', async () => {
    expect(await isBlocked('u1', 'u1')).toBe(false);
  });

  it('returns true when viewer blocked target', async () => {
    (db.query.userBlocks.findFirst as any).mockResolvedValue({ blockerId: 'u1' });
    expect(await isBlocked('u1', 'u2')).toBe(true);
  });

  it('returns true when target blocked viewer (reverse)', async () => {
    (db.query.userBlocks.findFirst as any).mockResolvedValue({ blockerId: 'u2' });
    expect(await isBlocked('u1', 'u2')).toBe(true);
  });

  it('returns false when no block in either direction', async () => {
    (db.query.userBlocks.findFirst as any).mockResolvedValue(undefined);
    expect(await isBlocked('u1', 'u2')).toBe(false);
  });
});
