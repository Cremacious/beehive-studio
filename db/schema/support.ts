import { pgTable, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { users } from './auth'

export const supportCategoryEnum = pgEnum('support_category', [
  'general',
  'technical',
  'feedback',
])

export const supportStatusEnum = pgEnum('support_status', ['new', 'in_progress', 'resolved'])

export const supportMessages = pgTable(
  'support_messages',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    category: supportCategoryEnum('category').notNull(),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    status: supportStatusEnum('status').notNull().default('new'),
    adminResponse: text('admin_response'),
    respondedAt: timestamp('responded_at'),
    respondedBy: text('responded_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('support_messages_status_idx').on(t.status, t.createdAt),
    index('support_messages_category_idx').on(t.category),
    index('support_messages_user_idx').on(t.userId),
  ],
)
