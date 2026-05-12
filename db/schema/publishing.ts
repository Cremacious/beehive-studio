import { pgTable, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const exportFormatEnum = pgEnum('export_format', ['EPUB', 'PDF', 'DOCX', 'TXT', 'ZIP'])

export const exportPresets = pgTable('export_presets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  format: exportFormatEnum('format').notNull(),
  config: jsonb('config').notNull(),
  isSystemPreset: boolean('is_system_preset').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const bookTemplates = pgTable('book_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  genre: text('genre'),
  structure: jsonb('structure').notNull(),
  isSystemTemplate: boolean('is_system_template').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
