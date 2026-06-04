import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockFindFirst = vi.fn();
const fakeTx = {
  query: { socialActivity: { findFirst: mockFindFirst } },
  insert: vi.fn(() => ({ values: mockInsert })),
};

vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'fake-id' }));
vi.mock('@/db', () => ({ db: {} }));

import { recordSocialActivityTx } from '../record-activity';

describe('recordSocialActivityTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue([{ id: 'fake-id' }]);
    mockFindFirst.mockResolvedValue(undefined);
  });

  it('writes a non-dedupe-eligible event without dedupe check', async () => {
    await recordSocialActivityTx(fakeTx as never, {
      actorId: 'u1',
      type: 'book_published',
      subjectType: 'book',
      subjectId: 'b1',
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(fakeTx.insert).toHaveBeenCalled();
  });

  it('writes a dedupe-eligible event when no recent row exists', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await recordSocialActivityTx(fakeTx as never, {
      actorId: 'u1',
      type: 'book_liked',
      subjectType: 'book',
      subjectId: 'b1',
    });
    expect(mockFindFirst).toHaveBeenCalled();
    expect(fakeTx.insert).toHaveBeenCalled();
  });

  it('skips dedupe-eligible event when a recent row exists within window', async () => {
    mockFindFirst.mockResolvedValue({ id: 'prev' });
    await recordSocialActivityTx(fakeTx as never, {
      actorId: 'u1',
      type: 'book_liked',
      subjectType: 'book',
      subjectId: 'b1',
    });
    expect(fakeTx.insert).not.toHaveBeenCalled();
  });
});
