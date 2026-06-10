import { pgTable, text, timestamp, integer, pgEnum, index, jsonb } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { users } from './auth'

export const promoCodeKindEnum = pgEnum('promo_code_kind', [
  'DAYS_30',
  'DAYS_90',
  'DAYS_365',
  'LIFETIME',
])

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    code: text('code').notNull().unique(),
    kind: promoCodeKindEnum('kind').notNull(),
    note: text('note'),
    maxUses: integer('max_uses'),
    usesCount: integer('uses_count').notNull().default(0),
    isActive: text('is_active').notNull().default('true'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (t) => [index('promo_codes_code_idx').on(t.code)],
)

export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    promoCodeId: text('promo_code_id')
      .notNull()
      .references(() => promoCodes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    redeemedAt: timestamp('redeemed_at').notNull().defaultNow(),
    grantedUntil: timestamp('granted_until'),
  },
  (t) => [
    index('promo_redemptions_user_idx').on(t.userId),
    index('promo_redemptions_code_idx').on(t.promoCodeId),
  ],
)

export const adminActions = pgTable(
  'admin_actions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    adminEmail: text('admin_email').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('admin_actions_created_idx').on(t.createdAt),
    index('admin_actions_target_idx').on(t.targetType, t.targetId),
  ],
)
