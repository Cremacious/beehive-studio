import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters } from './books'

export const hiveStatusEnum = pgEnum('hive_status', ['ACTIVE', 'COMPLETED'])
export const hiveVisibilityEnum = pgEnum('hive_visibility', ['PRIVATE', 'PUBLIC', 'FRIENDS'])
export const hiveMemberRoleEnum = pgEnum('hive_member_role', ['OWNER', 'CONTRIBUTOR', 'EDITOR', 'BETA_READER', 'PROOFREADER'])
export const hiveInviteStatusEnum = pgEnum('hive_invite_status', ['PENDING', 'ACCEPTED', 'DECLINED'])
export const hiveSubmissionStatusEnum = pgEnum('hive_submission_status', ['PENDING', 'APPROVED', 'REJECTED'])
export const hiveSuggestionStatusEnum = pgEnum('hive_suggestion_status', ['PENDING', 'ACCEPTED', 'REJECTED'])

export const hives = pgTable('hives', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').references(() => books.id, { onDelete: 'set null' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  visibility: hiveVisibilityEnum('visibility').default('PRIVATE').notNull(),
  status: hiveStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const hiveMembers = pgTable('hive_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: hiveMemberRoleEnum('role').default('CONTRIBUTOR').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
})

export const hiveInvites = pgTable('hive_invites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  inviteeId: text('invitee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: hiveMemberRoleEnum('role').default('CONTRIBUTOR').notNull(),
  status: hiveInviteStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const hiveSubmissions = pgTable('hive_submissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  submitterId: text('submitter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: hiveSubmissionStatusEnum('status').default('PENDING').notNull(),
  reviewerNote: text('reviewer_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const hiveSuggestions = pgTable('hive_suggestions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalText: text('original_text').notNull(),
  suggestedText: text('suggested_text').notNull(),
  status: hiveSuggestionStatusEnum('status').default('PENDING').notNull(),
  diff: text('diff'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const hiveComments = pgTable('hive_comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  anchorStart: text('anchor_start'),
  anchorEnd: text('anchor_end'),
  content: text('content').notNull(),
  resolved: timestamp('resolved'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const hivesRelations = relations(hives, ({ one, many }) => ({
  owner: one(users, { fields: [hives.ownerId], references: [users.id] }),
  book: one(books, { fields: [hives.bookId], references: [books.id] }),
  members: many(hiveMembers),
  invites: many(hiveInvites),
}))
