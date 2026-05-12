import { pgTable, text, timestamp, integer, boolean, primaryKey, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters } from './books'

export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_FOLLOWER', 'NEW_LIKE', 'NEW_COMMENT', 'NEW_CHAPTER',
  'HIVE_INVITE', 'HIVE_SUBMISSION', 'HIVE_SUGGESTION', 'SPARK_WIN',
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
  parentId: text('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sparks = pgTable('sparks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  rules: text('rules'),
  deadline: timestamp('deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sparkEntries = pgTable('spark_entries', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sparkId: text('spark_id').notNull().references(() => sparks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  votes: integer('votes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
