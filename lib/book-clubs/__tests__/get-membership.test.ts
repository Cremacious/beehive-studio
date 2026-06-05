import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      bookClubMembers: {
        findFirst: findFirstMock,
      },
    },
  },
}));

import { getClubMembership } from '../get-membership';

beforeEach(() => {
  findFirstMock.mockReset();
});

describe('getClubMembership', () => {
  it('returns { role: null } without DB call for anonymous viewer', async () => {
    const result = await getClubMembership(null, 'club-1');
    expect(result).toEqual({ role: null });
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns the row role when membership exists', async () => {
    findFirstMock.mockResolvedValue({ role: 'MODERATOR' });
    const result = await getClubMembership('viewer-1', 'club-1');
    expect(result).toEqual({ role: 'MODERATOR' });
    expect(findFirstMock).toHaveBeenCalledTimes(1);
  });

  it('returns { role: null } when no membership row exists', async () => {
    findFirstMock.mockResolvedValue(undefined);
    const result = await getClubMembership('viewer-2', 'club-2');
    expect(result).toEqual({ role: null });
  });
});
