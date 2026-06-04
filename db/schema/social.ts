import { pgTable, text, timestamp, integer, boolean, primaryKey, pgEnum, index, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters, binderItems } from './books'

export const friendshipStatusEnum = pgEnum('friendship_status', ['PENDING', 'ACCEPTED'])

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
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sparkEntries = pgTable('spark_entries', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sparkId: text('spark_id').notNull().references(() => sparks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
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
  index('social_activity_actor_created_idx').on(t.actorId, t.createdAt),
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
