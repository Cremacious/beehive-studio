import { pgTable, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'

export const bookVisibilityEnum = pgEnum('book_visibility', ['PRIVATE', 'PUBLIC'])
export const bookStatusEnum = pgEnum('book_status', ['DRAFT', 'PUBLISHED'])
export const chapterStatusEnum = pgEnum('chapter_status', ['IDEA', 'OUTLINE', 'FIRST_DRAFT', 'REVISED', 'FINAL'])
export const binderItemTypeEnum = pgEnum('binder_item_type', [
  'part', 'chapter', 'front_matter', 'back_matter',
  'research_folder', 'research_note', 'character', 'outline',
])

export const books = pgTable('books', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  genre: text('genre'),
  visibility: bookVisibilityEnum('visibility').default('PRIVATE').notNull(),
  status: bookStatusEnum('status').default('DRAFT').notNull(),
  coverUrl: text('cover_url'),
  explorable: boolean('explorable').default(false).notNull(),
  synopsis: text('synopsis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bookPublishingMetadata = pgTable('book_publishing_metadata', {
  bookId: text('book_id').primaryKey().references(() => books.id, { onDelete: 'cascade' }),
  isbn: text('isbn'),
  subtitle: text('subtitle'),
  trimSize: text('trim_size').default('6x9'),
  authorBio: text('author_bio'),
  dedication: text('dedication'),
  publisherName: text('publisher_name'),
  edition: text('edition').default('First Edition'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const binderItems = pgTable('binder_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  type: binderItemTypeEnum('type').notNull(),
  title: text('title').notNull(),
  order: integer('order').default(0).notNull(),
  content: jsonb('content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  binderItemId: text('binder_item_id').references(() => binderItems.id, { onDelete: 'set null' }),
  content: jsonb('content'),
  wordCount: integer('word_count').default(0).notNull(),
  status: chapterStatusEnum('status').default('FIRST_DRAFT').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chapterSnapshots = pgTable('chapter_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull(),
  wordCount: integer('word_count').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, { fields: [books.userId], references: [users.id] }),
  publishingMetadata: one(bookPublishingMetadata, { fields: [books.id], references: [bookPublishingMetadata.bookId] }),
  binderItems: many(binderItems),
  chapters: many(chapters),
}))

export const binderItemsRelations = relations(binderItems, ({ one, many }) => ({
  book: one(books, { fields: [binderItems.bookId], references: [books.id] }),
  parent: one(binderItems, { fields: [binderItems.parentId], references: [binderItems.id], relationName: 'parent' }),
  children: many(binderItems, { relationName: 'parent' }),
}))

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, { fields: [chapters.bookId], references: [books.id] }),
  binderItem: one(binderItems, { fields: [chapters.binderItemId], references: [binderItems.id] }),
  snapshots: many(chapterSnapshots),
}))
