import { pgTable, text, timestamp, pgEnum, index, uniqueIndex, boolean, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations, sql } from 'drizzle-orm'
import { users } from './auth'
import { books, chapters } from './books'

export const hiveStatusEnum = pgEnum('hive_status', ['ACTIVE', 'COMPLETED'])
export const hiveVisibilityEnum = pgEnum('hive_visibility', ['PRIVATE', 'PUBLIC', 'FRIENDS'])
export const hiveMemberRoleEnum = pgEnum('hive_member_role', ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER'])
export const hiveInviteStatusEnum = pgEnum('hive_invite_status', ['PENDING', 'ACCEPTED', 'DECLINED'])
export const hiveSubmissionStatusEnum = pgEnum('hive_submission_status', ['PENDING', 'APPROVED', 'REJECTED'])
export const hiveSuggestionStatusEnum = pgEnum('hive_suggestion_status', ['PENDING', 'ACCEPTED', 'REJECTED'])
export const hiveTaskStatusEnum = pgEnum('hive_task_status', ['OPEN', 'IN_PROGRESS', 'DONE'])

export const hives = pgTable('hives', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').references(() => books.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  visibility: hiveVisibilityEnum('visibility').default('PRIVATE').notNull(),
  discoverable: boolean('discoverable').default(false).notNull(),
  status: hiveStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // Partial UNIQUE: one hive per book, NULL bookId allowed for standalones.
  // H2 will tighten to plain UNIQUE once standalone hives have shadow books.
  uniqueIndex('hives_book_id_unique').on(t.bookId).where(sql`book_id IS NOT NULL`),
])

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
  inviteeId: text('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').unique(),
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

export const hiveOutlines = pgTable('hive_outlines', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().unique().references(() => hives.id, { onDelete: 'cascade' }),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const hiveWikiPages = pgTable('hive_wiki_pages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('hive_wiki_pages_hive_id_idx').on(t.hiveId)])

export const hiveTasks = pgTable('hive_tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: hiveTaskStatusEnum('status').notNull().default('OPEN'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('hive_tasks_hive_id_idx').on(t.hiveId)])

export const hiveDiscussionPosts = pgTable('hive_discussion_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: text('parent_id').references((): AnyPgColumn => hiveDiscussionPosts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('hive_discussion_posts_hive_id_idx').on(t.hiveId)])

export const hiveChapterLocks = pgTable('hive_chapter_locks', {
  chapterId: text('chapter_id').notNull().primaryKey().references(() => chapters.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lockedAt: timestamp('locked_at').defaultNow().notNull(),
})

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

export const hiveOutlinesRelations = relations(hiveOutlines, ({ one }) => ({
  hive: one(hives, { fields: [hiveOutlines.hiveId], references: [hives.id] }),
}))

export const hiveWikiPagesRelations = relations(hiveWikiPages, ({ one }) => ({
  hive: one(hives, { fields: [hiveWikiPages.hiveId], references: [hives.id] }),
  creator: one(users, { fields: [hiveWikiPages.createdBy], references: [users.id] }),
}))

export const hiveTasksRelations = relations(hiveTasks, ({ one }) => ({
  hive: one(hives, { fields: [hiveTasks.hiveId], references: [hives.id] }),
  assignee: one(users, { fields: [hiveTasks.assigneeId], references: [users.id], relationName: 'task_assignee' }),
  creator: one(users, { fields: [hiveTasks.creatorId], references: [users.id], relationName: 'task_creator' }),
}))

export const hiveDiscussionPostsRelations = relations(hiveDiscussionPosts, ({ one, many }) => ({
  hive: one(hives, { fields: [hiveDiscussionPosts.hiveId], references: [hives.id] }),
  author: one(users, { fields: [hiveDiscussionPosts.authorId], references: [users.id] }),
  parent: one(hiveDiscussionPosts, { fields: [hiveDiscussionPosts.parentId], references: [hiveDiscussionPosts.id], relationName: 'post_parent' }),
  replies: many(hiveDiscussionPosts, { relationName: 'post_parent' }),
}))

export const hiveChapterLocksRelations = relations(hiveChapterLocks, ({ one }) => ({
  chapter: one(chapters, { fields: [hiveChapterLocks.chapterId], references: [chapters.id] }),
  user: one(users, { fields: [hiveChapterLocks.userId], references: [users.id] }),
}))

export const hiveActivityTypeEnum = pgEnum('hive_activity_type', [
  'chapter_submitted',
  'chapter_submitted_approved',
  'chapter_submitted_rejected',
  'annotation_added',
  'suggestion_proposed',
  'suggestion_accepted',
  'suggestion_rejected',
  'buzz_posted',
  'discussion_posted',
  'member_joined',
])

export const hiveActivity = pgTable('hive_activity', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: hiveActivityTypeEnum('type').notNull(),
  subjectId: text('subject_id'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('hive_activity_hive_id_created_at_idx').on(t.hiveId, t.createdAt.desc()),
])

export const hiveActivityRelations = relations(hiveActivity, ({ one }) => ({
  hive: one(hives, { fields: [hiveActivity.hiveId], references: [hives.id] }),
  actor: one(users, { fields: [hiveActivity.actorId], references: [users.id] }),
}))
