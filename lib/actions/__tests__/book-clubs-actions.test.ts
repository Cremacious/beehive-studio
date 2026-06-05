import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/social/is-blocked', () => ({
  isBlocked: vi.fn(async () => false),
}))

vi.mock('@/lib/book-clubs/predicates', () => ({
  canViewClub: vi.fn(async () => true),
  canJoinClub: vi.fn(async () => true),
  canEditClubMetadata: vi.fn(() => true),
  canManageBookQueue: vi.fn(() => true),
  canManageSchedule: vi.fn(() => true),
  canPinDiscussion: vi.fn(() => true),
  canApproveJoinRequest: vi.fn(() => true),
  canInviteUser: vi.fn(() => true),
  canManageMembers: vi.fn(() => true),
  canChangeRole: vi.fn(() => true),
  canDeleteClub: vi.fn(() => true),
  canPostDiscussion: vi.fn(() => true),
}))

vi.mock('@/lib/book-clubs/get-membership', () => ({
  getClubMembership: vi.fn(async () => ({ role: 'OWNER' })),
}))

vi.mock('@/lib/book-clubs/derive-current-book', () => ({
  deriveCurrentBookTx: vi.fn(async () => undefined),
}))

vi.mock('@/lib/social/record-activity', () => ({
  recordSocialActivityTx: vi.fn(async () => undefined),
}))

vi.mock('@/lib/books/can-read', () => ({
  canReadBook: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/db', () => {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve([]),
    offset: () => Promise.resolve([]),
    groupBy: () => chain,
    set: () => chain,
    values: () => ({
      onConflictDoNothing: () => ({ returning: async () => [] }),
      returning: async () => [],
    }),
    returning: async () => [],
  }
  const queryStub = { findFirst: async () => null, findMany: async () => [] }
  return {
    db: {
      select: () => chain,
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => chain,
          update: () => chain,
          delete: () => chain,
          select: () => chain,
          query: {
            bookClubs: queryStub,
            bookClubBooks: queryStub,
            bookClubMembers: queryStub,
            bookClubInvites: queryStub,
            bookClubInviteTokens: queryStub,
            bookClubJoinRequests: queryStub,
            bookClubScheduleItems: queryStub,
            bookClubDiscussions: queryStub,
            bookClubDiscussionReplies: queryStub,
            bookClubDiscussionLikes: queryStub,
            bookClubDiscussionReplyLikes: queryStub,
            socialActivity: queryStub,
            userProfiles: queryStub,
          },
        }),
      query: {
        bookClubs: queryStub,
        bookClubBooks: queryStub,
        bookClubMembers: queryStub,
        bookClubInvites: queryStub,
        bookClubInviteTokens: queryStub,
        bookClubJoinRequests: queryStub,
        bookClubScheduleItems: queryStub,
        bookClubDiscussions: queryStub,
        bookClubDiscussionReplies: queryStub,
        bookClubDiscussionLikes: queryStub,
        bookClubDiscussionReplyLikes: queryStub,
        userProfiles: queryStub,
      },
    },
  }
})

import * as actions from '@/lib/actions/book-clubs.actions'

describe('book-clubs actions surface', () => {
  const expected = [
    // T3
    'createClubAction',
    'getClubsAction',
    'getClubAction',
    'updateClubAction',
    'deleteClubAction',
    // T4
    'joinClubAction',
    'leaveClubAction',
    'removeClubMemberAction',
    'changeClubMemberRoleAction',
    'transferClubOwnershipAction',
    // T5
    'inviteUserToClubAction',
    'respondToClubInviteAction',
    'cancelClubInviteAction',
    'createClubInviteTokenAction',
    'claimClubInviteTokenAction',
    // T6
    'respondToJoinRequestAction',
    'cancelJoinRequestAction',
    // T7
    'addClubBookAction',
    'updateClubBookAction',
    'setCurrentBookAction',
    'removeClubBookAction',
    'reorderClubQueueAction',
    'getClubBooksAction',
    'addScheduleItemAction',
    'updateScheduleItemAction',
    'removeScheduleItemAction',
    'getClubScheduleAction',
    // T8
    'createClubDiscussionAction',
    'updateClubDiscussionAction',
    'deleteClubDiscussionAction',
    'pinClubDiscussionAction',
    'replyToClubDiscussionAction',
    'deleteClubDiscussionReplyAction',
    'toggleClubDiscussionLikeAction',
    'toggleClubReplyLikeAction',
    'listClubDiscussionsAction',
    'getClubDiscussionAction',
    // T9
    'getMyClubsCountAction',
  ] as const

  for (const name of expected) {
    it(`exports ${name} as a function`, () => {
      expect(typeof (actions as Record<string, unknown>)[name]).toBe('function')
    })
  }
})
