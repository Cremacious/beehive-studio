import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/social/are-friends', () => ({
  areFriends: vi.fn(async () => false),
}));

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}));

import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';
import { canViewSpark, canEnterSpark, canVoteSpark } from '../predicates';

const mockAreFriends = areFriends as unknown as ReturnType<typeof vi.fn>;
const mockIsBlocked = isBlocked as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAreFriends.mockReset();
  mockAreFriends.mockResolvedValue(false);
  mockIsBlocked.mockReset();
  mockIsBlocked.mockResolvedValue(false);
});

describe('canViewSpark', () => {
  it('PUBLIC: allows anonymous viewers', async () => {
    expect(
      await canViewSpark(null, { creatorId: 'creator', visibility: 'PUBLIC' }),
    ).toBe(true);
  });

  it('PUBLIC: allows any authed viewer when no block', async () => {
    expect(
      await canViewSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
      }),
    ).toBe(true);
  });

  it('PUBLIC: denies when block exists in either direction', async () => {
    mockIsBlocked.mockResolvedValue(true);
    expect(
      await canViewSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
      }),
    ).toBe(false);
  });

  it('PRIVATE: allows only the creator', async () => {
    expect(
      await canViewSpark('creator', {
        creatorId: 'creator',
        visibility: 'PRIVATE',
      }),
    ).toBe(true);
  });

  it('PRIVATE: denies non-creator', async () => {
    expect(
      await canViewSpark('someone', {
        creatorId: 'creator',
        visibility: 'PRIVATE',
      }),
    ).toBe(false);
  });

  it('PRIVATE: denies anonymous viewer', async () => {
    expect(
      await canViewSpark(null, {
        creatorId: 'creator',
        visibility: 'PRIVATE',
      }),
    ).toBe(false);
  });

  it('FRIENDS: allows the creator themselves', async () => {
    expect(
      await canViewSpark('creator', {
        creatorId: 'creator',
        visibility: 'FRIENDS',
      }),
    ).toBe(true);
  });

  it('FRIENDS: allows a confirmed friend', async () => {
    mockAreFriends.mockResolvedValue(true);
    expect(
      await canViewSpark('friend', {
        creatorId: 'creator',
        visibility: 'FRIENDS',
      }),
    ).toBe(true);
  });

  it('FRIENDS: denies non-friend', async () => {
    mockAreFriends.mockResolvedValue(false);
    expect(
      await canViewSpark('stranger', {
        creatorId: 'creator',
        visibility: 'FRIENDS',
      }),
    ).toBe(false);
  });

  it('FRIENDS: denies anonymous viewer', async () => {
    expect(
      await canViewSpark(null, {
        creatorId: 'creator',
        visibility: 'FRIENDS',
      }),
    ).toBe(false);
  });
});

describe('canEnterSpark', () => {
  it('denies anonymous viewer', async () => {
    expect(
      await canEnterSpark(null, {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'OPEN',
      }),
    ).toBe(false);
  });

  it('denies the creator from entering their own spark', async () => {
    expect(
      await canEnterSpark('creator', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'OPEN',
      }),
    ).toBe(false);
  });

  it('denies when status is VOTING', async () => {
    expect(
      await canEnterSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'VOTING',
      }),
    ).toBe(false);
  });

  it('denies when status is CLOSED', async () => {
    expect(
      await canEnterSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'CLOSED',
      }),
    ).toBe(false);
  });

  it('allows OPEN + non-creator + can-view', async () => {
    expect(
      await canEnterSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'OPEN',
      }),
    ).toBe(true);
  });

  it('denies when canViewSpark denies (e.g. FRIENDS non-friend)', async () => {
    mockAreFriends.mockResolvedValue(false);
    expect(
      await canEnterSpark('stranger', {
        creatorId: 'creator',
        visibility: 'FRIENDS',
        status: 'OPEN',
      }),
    ).toBe(false);
  });
});

describe('canVoteSpark', () => {
  it('denies anonymous viewer', async () => {
    expect(
      await canVoteSpark(null, {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'VOTING',
      }),
    ).toBe(false);
  });

  it('denies when status is OPEN', async () => {
    expect(
      await canVoteSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'OPEN',
      }),
    ).toBe(false);
  });

  it('denies when status is CLOSED', async () => {
    expect(
      await canVoteSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'CLOSED',
      }),
    ).toBe(false);
  });

  it('allows VOTING + auth + can-view', async () => {
    expect(
      await canVoteSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'VOTING',
      }),
    ).toBe(true);
  });

  it('denies when canViewSpark denies (block in place)', async () => {
    mockIsBlocked.mockResolvedValue(true);
    expect(
      await canVoteSpark('viewer', {
        creatorId: 'creator',
        visibility: 'PUBLIC',
        status: 'VOTING',
      }),
    ).toBe(false);
  });
});
