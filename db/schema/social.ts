import { pgTable, text, timestamp, integer, boolean, primaryKey, pgEnum, index, uniqueIndex, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations, sql } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters, binderItems, bookVisibilityEnum } from './books'

export const friendshipStatusEnum = pgEnum('friendship_status', ['PENDING', 'ACCEPTED'])

export const sparkVisibilityEnum = pgEnum('spark_visibility', ['PUBLIC', 'FRIENDS', 'PRIVATE'])
export const sparkStatusEnum = pgEnum('spark_status', ['OPEN', 'VOTING', 'CLOSED'])

export type SparkVisibility = (typeof sparkVisibilityEnum.enumValues)[number]
export type SparkStatus = (typeof sparkStatusEnum.enumValues)[number]

export const readingListKindEnum = pgEnum('reading_list_kind', ['CUSTOM', 'LIKED'])

export type ReadingListKind = (typeof readingListKindEnum.enumValues)[number]

export const bookClubMemberRoleEnum = pgEnum('book_club_member_role', ['OWNER', 'MODERATOR', 'MEMBER'])
export const bookClubBookStatusEnum = pgEnum('book_club_book_status', ['CURRENT', 'PAST', 'QUEUE'])
export const bookClubInviteStatusEnum = pgEnum('book_club_invite_status', ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED'])
export const bookClubJoinRequestStatusEnum = pgEnum('book_club_join_request_status', ['PENDING', 'ACCEPTED', 'REJECTED'])

export type BookClubMemberRole = (typeof bookClubMemberRoleEnum.enumValues)[number]
export type BookClubBookStatus = (typeof bookClubBookStatusEnum.enumValues)[number]
export type BookClubInviteStatus = (typeof bookClubInviteStatusEnum.enumValues)[number]
export type BookClubJoinRequestStatus = (typeof bookClubJoinRequestStatusEnum.enumValues)[number]

export const friendships = pgTable('friendships', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  requesterId: text('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: text('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: friendshipStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
}, (t) => [
  index('friendships_requester_idx').on(t.requesterId),
  index('friendships_recipient_idx').on(t.recipientId),
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_FOLLOWER', 'NEW_LIKE', 'NEW_COMMENT', 'NEW_CHAPTER',
  'HIVE_INVITE', 'HIVE_SUBMISSION', 'HIVE_SUGGESTION', 'SPARK_WIN',
  'HIVE_JOIN_REQUEST', 'HIVE_JOIN_APPROVED', 'HIVE_MEMBER_JOINED',
  'CHAPTER_EDITED', 'HIVE_COMMENT', 'TASK_ASSIGNED', 'TASK_COMPLETED',
  'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
  'CLUB_INVITE', 'CLUB_JOIN_REQUEST', 'CLUB_JOIN_APPROVED',
  'MENTION',
])

export const follows = pgTable('follows', {
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followeeId: text('followee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })])

export const bookLikes = pgTable('book_likes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.bookId] })])

export const bookComments = pgTable('book_comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: text('parent_id').references((): AnyPgColumn => bookComments.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('book_comments_book_id_idx').on(t.bookId)])

export const bookmarks = pgTable('bookmarks', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.bookId] })])

export const readingProgress = pgTable('reading_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  lastOpenedAt: timestamp('last_opened_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.bookId] })])

export const chapterReads = pgTable('chapter_reads', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterBinderItemId: text('chapter_binder_item_id').notNull().references(() => binderItems.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.chapterBinderItemId] }),
  index('chapter_reads_user_book_idx').on(t.userId, t.bookId),
])

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('notifications_user_id_idx').on(t.userId)])

export const sparks = pgTable('sparks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  rules: text('rules'),
  deadline: timestamp('deadline'),
  wordLimit: integer('word_limit'),
  creatorChoiceEntryId: text('creator_choice_entry_id').references((): AnyPgColumn => sparkEntries.id),
  winnerEntryId: text('winner_entry_id').references((): AnyPgColumn => sparkEntries.id),
  visibility: sparkVisibilityEnum('visibility').notNull().default('PUBLIC'),
  discoverable: boolean('discoverable').notNull().default(true),
  status: sparkStatusEnum('status').notNull().default('OPEN'),
  votingEndsAt: timestamp('voting_ends_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sparkEntries = pgTable('spark_entries', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sparkId: text('spark_id').notNull().references(() => sparks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
  title: text('title'),
  likeCount: integer('like_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('spark_entries_spark_id_idx').on(t.sparkId)])

export const sparkVotes = pgTable('spark_votes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryId: text('entry_id').notNull().references(() => sparkEntries.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.entryId] }),
])

export const sparkEntryComments = pgTable('spark_entry_comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  entryId: text('entry_id').notNull().references(() => sparkEntries.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: text('parent_id').references((): AnyPgColumn => sparkEntryComments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('spark_entry_comments_entry_id_idx').on(t.entryId)])

export const bookCommentsRelations = relations(bookComments, ({ one, many }) => ({
  book: one(books, { fields: [bookComments.bookId], references: [books.id] }),
  user: one(users, { fields: [bookComments.userId], references: [users.id] }),
  parent: one(bookComments, { fields: [bookComments.parentId], references: [bookComments.id], relationName: 'parent' }),
  replies: many(bookComments, { relationName: 'parent' }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
}))

export const socialActivityTypeEnum = pgEnum('social_activity_type', [
  'book_published',
  'chapter_posted',
  'book_liked',
  'book_commented',
  'spark_entry_submitted',
  'spark_won_community',
  'spark_won_creator_choice',
  'hive_created',
  'hive_joined',
  'reading_list_created',
  'books_added_batch',
  'book_club_created',
  'book_club_current_book_changed',
])

export type SocialActivityType = (typeof socialActivityTypeEnum.enumValues)[number]

export const socialActivity = pgTable('social_activity', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: socialActivityTypeEnum('type').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('social_activity_actor_created_idx').on(t.actorId, t.createdAt.desc()),
  index('social_activity_subject_idx').on(t.subjectType, t.subjectId),
])

export const userBlocks = pgTable('user_blocks', {
  blockerId: text('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: text('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.blockerId, t.blockedId] }),
  index('user_blocks_blocked_idx').on(t.blockedId),
])

export const userMutes = pgTable('user_mutes', {
  muterId: text('muter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mutedId: text('muted_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.muterId, t.mutedId] })])

export const friendInvites = pgTable('friend_invites', {
  token: text('token').primaryKey(),
  inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  claimedBy: text('claimed_by').references(() => users.id, { onDelete: 'set null' }),
  claimedAt: timestamp('claimed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('friend_invites_inviter_idx').on(t.inviterId)])

export const readingLists = pgTable(
  'reading_lists',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: readingListKindEnum('kind').notNull().default('CUSTOM'),
    title: text('title').notNull(),
    description: text('description'),
    visibility: bookVisibilityEnum('visibility').notNull().default('PUBLIC'),
    discoverable: boolean('discoverable').notNull().default(true),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    bookCount: integer('book_count').notNull().default(0),
    followerCount: integer('follower_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('reading_lists_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('reading_lists_discoverable_visibility_idx').on(t.discoverable, t.visibility),
  ],
)

export const readingListBooks = pgTable(
  'reading_list_books',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    listId: text('list_id').notNull().references(() => readingLists.id, { onDelete: 'cascade' }),
    bookId: text('book_id').references(() => books.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    author: text('author').notNull(),
    coverUrl: text('cover_url'),
    isRead: boolean('is_read').notNull().default(false),
    rating: integer('rating'),
    commentary: text('commentary'),
    order: integer('order').notNull().default(0),
    addedAt: timestamp('added_at').notNull().defaultNow(),
  },
  (t) => [
    index('reading_list_books_list_order_idx').on(t.listId, t.order),
  ],
)

export const readingListFollows = pgTable(
  'reading_list_follows',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    listId: text('list_id').notNull().references(() => readingLists.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listId] }),
    index('reading_list_follows_list_idx').on(t.listId),
  ],
)

// ============================================================================
// C4 — Book Clubs (11 tables)
// ============================================================================

export const bookClubs = pgTable(
  'book_clubs',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    rules: text('rules'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    visibility: bookVisibilityEnum('visibility').notNull().default('PUBLIC'),
    discoverable: boolean('discoverable').notNull().default(true),
    openJoin: boolean('open_join').notNull().default(true),
    memberCount: integer('member_count').notNull().default(1),
    // FK to book_club_books added via raw ALTER in migration step 14 (forward ref).
    currentBookId: text('current_book_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('book_clubs_owner_created_idx').on(t.ownerId, t.createdAt.desc()),
    index('book_clubs_discoverable_visibility_idx').on(t.discoverable, t.visibility),
  ],
)

export const bookClubBooks = pgTable(
  'book_club_books',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    bookId: text('book_id').references(() => books.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    author: text('author').notNull(),
    coverUrl: text('cover_url'),
    status: bookClubBookStatusEnum('status').notNull().default('QUEUE'),
    order: integer('order').notNull().default(0),
    addedAt: timestamp('added_at').notNull().defaultNow(),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
  },
  (t) => [
    index('book_club_books_club_status_order_idx').on(t.clubId, t.status, t.order),
  ],
)

export const bookClubMembers = pgTable(
  'book_club_members',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: bookClubMemberRoleEnum('role').notNull().default('MEMBER'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (t) => [
    index('book_club_members_user_idx').on(t.userId),
    uniqueIndex('book_club_members_club_user_unique').on(t.clubId, t.userId),
  ],
)

export const bookClubInvites = pgTable(
  'book_club_invites',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: bookClubInviteStatusEnum('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
  },
  (t) => [
    index('book_club_invites_recipient_status_idx').on(t.recipientId, t.status),
    index('book_club_invites_club_idx').on(t.clubId),
  ],
)

export const bookClubInviteTokens = pgTable(
  'book_club_invite_tokens',
  {
    token: text('token').primaryKey(),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    claimedBy: text('claimed_by').references(() => users.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('book_club_invite_tokens_club_idx').on(t.clubId)],
)

export const bookClubJoinRequests = pgTable(
  'book_club_join_requests',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: bookClubJoinRequestStatusEnum('status').notNull().default('PENDING'),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
  },
  (t) => [
    index('book_club_join_requests_club_status_idx').on(t.clubId, t.status),
    uniqueIndex('book_club_join_requests_club_user_unique').on(t.clubId, t.userId),
  ],
)

export const bookClubScheduleItems = pgTable(
  'book_club_schedule_items',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    bookId: text('book_id').notNull().references(() => bookClubBooks.id, { onDelete: 'cascade' }),
    chapterStart: integer('chapter_start').notNull(),
    chapterEnd: integer('chapter_end').notNull(),
    targetDate: timestamp('target_date').notNull(),
    label: text('label'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('book_club_schedule_items_club_book_order_idx').on(t.clubId, t.bookId, t.order),
  ],
)

export const bookClubDiscussions = pgTable(
  'book_club_discussions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    clubId: text('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
    authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('book_club_discussions_club_pinned_created_idx').on(t.clubId, t.isPinned.desc(), t.createdAt.desc()),
  ],
)

export const bookClubDiscussionReplies = pgTable(
  'book_club_discussion_replies',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    discussionId: text('discussion_id').notNull().references(() => bookClubDiscussions.id, { onDelete: 'cascade' }),
    authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    likeCount: integer('like_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('book_club_discussion_replies_discussion_created_idx').on(t.discussionId, t.createdAt),
  ],
)

export const bookClubDiscussionLikes = pgTable(
  'book_club_discussion_likes',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    discussionId: text('discussion_id').notNull().references(() => bookClubDiscussions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.discussionId] })],
)

export const bookClubDiscussionReplyLikes = pgTable(
  'book_club_discussion_reply_likes',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    replyId: text('reply_id').notNull().references(() => bookClubDiscussionReplies.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.replyId] })],
)
