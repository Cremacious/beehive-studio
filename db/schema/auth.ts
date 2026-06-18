import { pgTable, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['member', 'moderator', 'admin'])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
])

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  banned: boolean('banned').default(false),
  bannedAt: timestamp('banned_at'),
  bannedReason: text('banned_reason'),
})

export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').unique(),
  displayName: text('display_name'),
  bio: text('bio'),
  website: text('website'),
  location: text('location'),
  avatarUrl: text('avatar_url'),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  role: userRoleEnum('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userPrivacySettings = pgTable('user_privacy_settings', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  allowFollow: boolean('allow_follow').notNull().default(true),
  showLikedBooks: boolean('show_liked_books').notNull().default(true),
  showActivityFeed: boolean('show_activity_feed').notNull().default(true),
  appearInSuggested: boolean('appear_in_suggested').notNull().default(true),
  findableByEmail: boolean('findable_by_email').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  defaultBookVisibility: text('default_book_visibility').notNull().default('PRIVATE'),
  defaultGenre: text('default_genre'),
  defaultSparkWordLimit: text('default_spark_word_limit'),
  editorTheme: text('editor_theme').notNull().default('light'),
  genreInterests: text('genre_interests').array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userBilling = pgTable('user_billing', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status'),
  currentPeriodEnd: timestamp('current_period_end'),
  // Admin-granted comp entitlement (promo codes, manual grants). NULL = no comp.
  // A far-future timestamp (e.g. year 9999) represents lifetime.
  compEntitlementUntil: timestamp('comp_entitlement_until'),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  password: text('password'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  billing: one(userBilling, { fields: [users.id], references: [userBilling.userId] }),
  privacySettings: one(userPrivacySettings, { fields: [users.id], references: [userPrivacySettings.userId] }),
  preferences: one(userPreferences, { fields: [users.id], references: [userPreferences.userId] }),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}))
