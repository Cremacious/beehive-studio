import { describe, it, expect, vi, beforeEach } from 'vitest';

const { memberFindFirstMock, joinReqFindFirstMock } = vi.hoisted(() => ({
  memberFindFirstMock: vi.fn(),
  joinReqFindFirstMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      bookClubMembers: {
        findFirst: memberFindFirstMock,
      },
      bookClubJoinRequests: {
        findFirst: joinReqFindFirstMock,
      },
    },
  },
}));

import { getClubMembership } from '../get-membership';

beforeEach(() => {
  memberFindFirstMock.mockReset();
  joinReqFindFirstMock.mockReset();
});

describe('getClubMembership', () => {
  it('returns null role + no pending without DB call for anonymous viewer', async () => {
    const result = await getClubMembership(null, 'club-1');
    expect(result).toEqual({ role: null, pendingJoinRequest: false });
    expect(memberFindFirstMock).not.toHaveBeenCalled();
    expect(joinReqFindFirstMock).not.toHaveBeenCalled();
  });

  it('returns the row role when membership exists; does not check pending', async () => {
    memberFindFirstMock.mockResolvedValue({ role: 'MODERATOR' });
    const result = await getClubMembership('viewer-1', 'club-1');
    expect(result).toEqual({ role: 'MODERATOR', pendingJoinRequest: false });
    expect(memberFindFirstMock).toHaveBeenCalledTimes(1);
    expect(joinReqFindFirstMock).not.toHaveBeenCalled();
  });

  it('returns { role: null, pendingJoinRequest: false } when no membership AND no pending request', async () => {
    memberFindFirstMock.mockResolvedValue(undefined);
    joinReqFindFirstMock.mockResolvedValue(undefined);
    const result = await getClubMembership('viewer-2', 'club-2');
    expect(result).toEqual({ role: null, pendingJoinRequest: false });
  });

  it('returns { role: null, pendingJoinRequest: true } when a pending request exists', async () => {
    memberFindFirstMock.mockResolvedValue(undefined);
    joinReqFindFirstMock.mockResolvedValue({ id: 'req-1' });
    const result = await getClubMembership('viewer-3', 'club-3');
    expect(result).toEqual({ role: null, pendingJoinRequest: true });
  });
});
