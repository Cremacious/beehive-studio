import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/social/are-friends', () => ({
  areFriends: vi.fn(async () => false),
}));

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}));

import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';
import {
  canViewClub,
  canJoinClub,
  canEditClubMetadata,
  canManageBookQueue,
  canManageSchedule,
  canPinDiscussion,
  canApproveJoinRequest,
  canInviteUser,
  canManageMembers,
  canChangeRole,
  canDeleteClub,
  canPostDiscussion,
} from '../predicates';

const mockAreFriends = areFriends as unknown as ReturnType<typeof vi.fn>;
const mockIsBlocked = isBlocked as unknown as ReturnType<typeof vi.fn>;

const noMembership = { role: null as null };
const memberMembership = { role: 'MEMBER' as const };

beforeEach(() => {
  mockAreFriends.mockReset();
  mockAreFriends.mockResolvedValue(false);
  mockIsBlocked.mockReset();
  mockIsBlocked.mockResolvedValue(false);
});

describe('canViewClub', () => {
  it('PUBLIC: allows anonymous viewers', async () => {
    expect(
      await canViewClub(null, { ownerId: 'owner', visibility: 'PUBLIC' }, noMembership),
    ).toBe(true);
  });

  it('PUBLIC: allows any authed viewer when no block', async () => {
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'PUBLIC' }, noMembership),
    ).toBe(true);
  });

  it('PUBLIC: denies when blocked', async () => {
    mockIsBlocked.mockResolvedValue(true);
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'PUBLIC' }, noMembership),
    ).toBe(false);
  });

  it('PRIVATE: denies non-member non-creator', async () => {
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'PRIVATE' }, noMembership),
    ).toBe(false);
  });

  it('PRIVATE: denies anonymous', async () => {
    expect(
      await canViewClub(null, { ownerId: 'owner', visibility: 'PRIVATE' }, noMembership),
    ).toBe(false);
  });

  it('PRIVATE: allows member', async () => {
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'PRIVATE' }, memberMembership),
    ).toBe(true);
  });

  it('PRIVATE: member-bypass blocked by isBlocked', async () => {
    mockIsBlocked.mockResolvedValue(true);
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'PRIVATE' }, memberMembership),
    ).toBe(false);
  });

  it('FRIENDS: denies anonymous', async () => {
    expect(
      await canViewClub(null, { ownerId: 'owner', visibility: 'FRIENDS' }, noMembership),
    ).toBe(false);
  });

  it('FRIENDS: allows creator-self', async () => {
    expect(
      await canViewClub('owner', { ownerId: 'owner', visibility: 'FRIENDS' }, noMembership),
    ).toBe(true);
  });

  it('FRIENDS: allows friends', async () => {
    mockAreFriends.mockResolvedValue(true);
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'FRIENDS' }, noMembership),
    ).toBe(true);
  });

  it('FRIENDS: denies non-friend non-member', async () => {
    mockAreFriends.mockResolvedValue(false);
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'FRIENDS' }, noMembership),
    ).toBe(false);
  });

  it('FRIENDS: allows member regardless of friendship', async () => {
    mockAreFriends.mockResolvedValue(false);
    expect(
      await canViewClub('viewer', { ownerId: 'owner', visibility: 'FRIENDS' }, memberMembership),
    ).toBe(true);
  });
});

describe('canJoinClub', () => {
  it('denies anonymous', async () => {
    expect(
      await canJoinClub(
        null,
        { ownerId: 'owner', visibility: 'PUBLIC', openJoin: true },
        noMembership,
      ),
    ).toBe(false);
  });

  it('denies already-member', async () => {
    expect(
      await canJoinClub(
        'viewer',
        { ownerId: 'owner', visibility: 'PUBLIC', openJoin: true },
        memberMembership,
      ),
    ).toBe(false);
  });

  it('allows authed viewer who can view a PUBLIC club', async () => {
    expect(
      await canJoinClub(
        'viewer',
        { ownerId: 'owner', visibility: 'PUBLIC', openJoin: true },
        noMembership,
      ),
    ).toBe(true);
  });

  it('denies non-viewable PRIVATE club', async () => {
    expect(
      await canJoinClub(
        'viewer',
        { ownerId: 'owner', visibility: 'PRIVATE', openJoin: true },
        noMembership,
      ),
    ).toBe(false);
  });
});

describe('role-based predicates', () => {
  it('canEditClubMetadata: OWNER/MODERATOR yes; MEMBER/null no', () => {
    expect(canEditClubMetadata('OWNER')).toBe(true);
    expect(canEditClubMetadata('MODERATOR')).toBe(true);
    expect(canEditClubMetadata('MEMBER')).toBe(false);
    expect(canEditClubMetadata(null)).toBe(false);
  });

  it('canManageBookQueue / canManageSchedule / canPinDiscussion: OWNER/MOD only', () => {
    for (const fn of [canManageBookQueue, canManageSchedule, canPinDiscussion]) {
      expect(fn('OWNER')).toBe(true);
      expect(fn('MODERATOR')).toBe(true);
      expect(fn('MEMBER')).toBe(false);
      expect(fn(null)).toBe(false);
    }
  });

  it('canApproveJoinRequest / canInviteUser / canManageMembers: OWNER/MOD only', () => {
    for (const fn of [canApproveJoinRequest, canInviteUser, canManageMembers]) {
      expect(fn('OWNER')).toBe(true);
      expect(fn('MODERATOR')).toBe(true);
      expect(fn('MEMBER')).toBe(false);
      expect(fn(null)).toBe(false);
    }
  });

  it('canChangeRole: OWNER only', () => {
    expect(canChangeRole('OWNER')).toBe(true);
    expect(canChangeRole('MODERATOR')).toBe(false);
    expect(canChangeRole('MEMBER')).toBe(false);
    expect(canChangeRole(null)).toBe(false);
  });

  it('canDeleteClub: OWNER only', () => {
    expect(canDeleteClub('OWNER')).toBe(true);
    expect(canDeleteClub('MODERATOR')).toBe(false);
    expect(canDeleteClub('MEMBER')).toBe(false);
    expect(canDeleteClub(null)).toBe(false);
  });

  it('canPostDiscussion: any member', () => {
    expect(canPostDiscussion('OWNER')).toBe(true);
    expect(canPostDiscussion('MODERATOR')).toBe(true);
    expect(canPostDiscussion('MEMBER')).toBe(true);
    expect(canPostDiscussion(null)).toBe(false);
  });
});
