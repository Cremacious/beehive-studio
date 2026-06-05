import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/social/are-friends', () => ({
  areFriends: vi.fn(async () => false),
}));

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}));

import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';
import { canViewList, canEditList, canFollowList } from '../predicates';

const mockAreFriends = areFriends as unknown as ReturnType<typeof vi.fn>;
const mockIsBlocked = isBlocked as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAreFriends.mockReset();
  mockAreFriends.mockResolvedValue(false);
  mockIsBlocked.mockReset();
  mockIsBlocked.mockResolvedValue(false);
});

describe('canViewList', () => {
  it('PUBLIC: allows anonymous viewers', async () => {
    expect(
      await canViewList(null, { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(true);
  });

  it('PUBLIC: allows any authed viewer when no block', async () => {
    expect(
      await canViewList('viewer', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(true);
  });

  it('PUBLIC: denies when block exists', async () => {
    mockIsBlocked.mockResolvedValue(true);
    expect(
      await canViewList('viewer', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(false);
  });

  it('PRIVATE: allows only the owner', async () => {
    expect(
      await canViewList('owner', { userId: 'owner', visibility: 'PRIVATE' }),
    ).toBe(true);
  });

  it('PRIVATE: denies non-owner', async () => {
    expect(
      await canViewList('someone', { userId: 'owner', visibility: 'PRIVATE' }),
    ).toBe(false);
  });

  it('PRIVATE: denies anonymous viewer', async () => {
    expect(
      await canViewList(null, { userId: 'owner', visibility: 'PRIVATE' }),
    ).toBe(false);
  });

  it('FRIENDS: allows the owner themselves', async () => {
    expect(
      await canViewList('owner', { userId: 'owner', visibility: 'FRIENDS' }),
    ).toBe(true);
  });

  it('FRIENDS: allows a confirmed friend', async () => {
    mockAreFriends.mockResolvedValue(true);
    expect(
      await canViewList('friend', { userId: 'owner', visibility: 'FRIENDS' }),
    ).toBe(true);
  });

  it('FRIENDS: denies non-friend', async () => {
    mockAreFriends.mockResolvedValue(false);
    expect(
      await canViewList('stranger', {
        userId: 'owner',
        visibility: 'FRIENDS',
      }),
    ).toBe(false);
  });

  it('FRIENDS: denies anonymous viewer', async () => {
    expect(
      await canViewList(null, { userId: 'owner', visibility: 'FRIENDS' }),
    ).toBe(false);
  });
});

describe('canEditList', () => {
  it('allows the owner', () => {
    expect(
      canEditList('owner', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(true);
  });

  it('denies a non-owner', () => {
    expect(
      canEditList('someone', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(false);
  });

  it('denies anonymous viewer', () => {
    expect(canEditList(null, { userId: 'owner', visibility: 'PUBLIC' })).toBe(
      false,
    );
  });
});

describe('canFollowList', () => {
  it('denies anonymous viewer', async () => {
    expect(
      await canFollowList(null, { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(false);
  });

  it('denies the owner from following their own list', async () => {
    expect(
      await canFollowList('owner', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(false);
  });

  it('allows a non-owner who can view (PUBLIC)', async () => {
    expect(
      await canFollowList('viewer', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(true);
  });

  it('denies when canViewList denies (FRIENDS non-friend)', async () => {
    mockAreFriends.mockResolvedValue(false);
    expect(
      await canFollowList('stranger', {
        userId: 'owner',
        visibility: 'FRIENDS',
      }),
    ).toBe(false);
  });

  it('denies when block exists', async () => {
    mockIsBlocked.mockResolvedValue(true);
    expect(
      await canFollowList('viewer', { userId: 'owner', visibility: 'PUBLIC' }),
    ).toBe(false);
  });
});
