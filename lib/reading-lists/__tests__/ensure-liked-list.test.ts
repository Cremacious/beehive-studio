import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertMock, valuesMock, onConflictDoNothingMock } = vi.hoisted(() => {
  const onConflictDoNothingMock = vi.fn();
  const valuesMock = vi.fn(() => ({
    onConflictDoNothing: onConflictDoNothingMock,
  }));
  const insertMock = vi.fn(() => ({ values: valuesMock }));
  return { insertMock, valuesMock, onConflictDoNothingMock };
});

vi.mock('@/db', () => ({
  db: {
    insert: insertMock,
  },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'generated-cuid'),
}));

import { ensureLikedListAction } from '../ensure-liked-list';

beforeEach(() => {
  insertMock.mockClear();
  valuesMock.mockClear();
  onConflictDoNothingMock.mockReset();
  onConflictDoNothingMock.mockResolvedValue(undefined);
});

describe('ensureLikedListAction', () => {
  it('inserts a Liked auto-list with onConflictDoNothing', async () => {
    await ensureLikedListAction('user-1');

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith({
      id: 'generated-cuid',
      userId: 'user-1',
      kind: 'LIKED',
      title: 'Liked',
      visibility: 'PUBLIC',
      discoverable: false,
    });
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(1);
  });

  it('swallows DB failures (best-effort)', async () => {
    onConflictDoNothingMock.mockRejectedValue(new Error('db down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(ensureLikedListAction('user-1')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
