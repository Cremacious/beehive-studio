import { pgTable, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
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
}, (t) => [index('hive_members_hive_id_idx').on(t.hiveId), index('hive_members_user_id_idx').on(t.userId)])

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
}, (t) => [index('hive_submissions_hive_id_idx').on(t.hiveId), index('hive_submissions_chapter_id_idx').on(t.chapterId)])

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
}, (t) => [index('hive_suggestions_chapter_id_idx').on(t.chapterId)])

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
}, (t) => [index('hive_comments_chapter_id_idx').on(t.chapterId)])

export const hivesRelations = relations(hives, ({ one, many }) => ({
  owner: one(users, { fields: [hives.ownerId], references: [users.id] }),
  book: one(books, { fields: [hives.bookId], references: [books.id] }),
  members: many(hiveMembers),
  invites: many(hiveInvites),
}))

export const hiveMembersRelations = relations(hiveMembers, ({ one }) => ({
  hive: one(hives, { fields: [hiveMembers.hiveId], references: [hives.id] }),
  user: one(users, { fields: [hiveMembers.userId], references: [users.id] }),
}))

export const hiveInvitesRelations = relations(hiveInvites, ({ one }) => ({
  hive: one(hives, { fields: [hiveInvites.hiveId], references: [hives.id] }),
  invitee: one(users, { fields: [hiveInvites.inviteeId], references: [users.id] }),
}))

export const hiveSubmissionsRelations = relations(hiveSubmissions, ({ one }) => ({
  hive: one(hives, { fields: [hiveSubmissions.hiveId], references: [hives.id] }),
  chapter: one(chapters, { fields: [hiveSubmissions.chapterId], references: [chapters.id] }),
  submitter: one(users, { fields: [hiveSubmissions.submitterId], references: [users.id] }),
}))

export const hiveSuggestionsRelations = relations(hiveSuggestions, ({ one }) => ({
  hive: one(hives, { fields: [hiveSuggestions.hiveId], references: [hives.id] }),
  chapter: one(chapters, { fields: [hiveSuggestions.chapterId], references: [chapters.id] }),
  author: one(users, { fields: [hiveSuggestions.authorId], references: [users.id] }),
}))

export const hiveCommentsRelations = relations(hiveComments, ({ one }) => ({
  hive: one(hives, { fields: [hiveComments.hiveId], references: [hives.id] }),
  chapter: one(chapters, { fields: [hiveComments.chapterId], references: [chapters.id] }),
  author: one(users, { fields: [hiveComments.authorId], references: [users.id] }),
}))
