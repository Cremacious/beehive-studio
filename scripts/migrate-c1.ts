/**
 * One-shot migration for C1 (Community Foundation):
 *  1. Create enum social_activity_type.
 *  2. Create table social_activity + indexes.
 *  3. Create table user_blocks + index.
 *  4. Create table user_mutes.
 *  5. Create table friend_invites + index.
 *  6. Add notification_type value FRIEND_REQUEST.
 *  7. Add notification_type value FRIEND_ACCEPTED.
 *
 * Idempotent via IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object / ADD VALUE IF NOT EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-c1.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running C1 schema migration...')

  // 1. social_activity_type enum
  await sql`DO $$ BEGIN
    CREATE TYPE social_activity_type AS ENUM (
      'book_published',
      'chapter_posted',
      'book_liked',
      'book_commented',
      'spark_entry_submitted',
      'spark_won_community',
      'spark_won_creator_choice',
      'hive_created',
      'hive_joined'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ 1/7 social_activity_type enum created')

  // 2. social_activity table + indexes
  await sql`CREATE TABLE IF NOT EXISTS social_activity (
    id            text PRIMARY KEY,
    actor_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          social_activity_type NOT NULL,
    subject_type  text NOT NULL,
    subject_id    text NOT NULL,
    payload       jsonb,
    created_at    timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS social_activity_actor_created_idx
            ON social_activity(actor_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS social_activity_subject_idx
            ON social_activity(subject_type, subject_id)`
  console.log('✓ 2/7 social_activity table + indexes created')

  // 3. user_blocks table + index
  await sql`CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
  )`
  await sql`CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
            ON user_blocks(blocked_id)`
  console.log('✓ 3/7 user_blocks table + index created')

  // 4. user_mutes table
  await sql`CREATE TABLE IF NOT EXISTS user_mutes (
    muter_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (muter_id, muted_id)
  )`
  console.log('✓ 4/7 user_mutes table created')

  // 5. friend_invites table + index
  await sql`CREATE TABLE IF NOT EXISTS friend_invites (
    token       text PRIMARY KEY,
    inviter_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  timestamp NOT NULL,
    claimed_by  text REFERENCES users(id) ON DELETE SET NULL,
    claimed_at  timestamp,
    created_at  timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS friend_invites_inviter_idx
            ON friend_invites(inviter_id)`
  console.log('✓ 5/7 friend_invites table + index created')

  // 6. notification_type FRIEND_REQUEST
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FRIEND_REQUEST'`
  console.log('✓ 6/7 notification_type += FRIEND_REQUEST')

  // 7. notification_type FRIEND_ACCEPTED
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED'`
  console.log('✓ 7/7 notification_type += FRIEND_ACCEPTED')

  console.log('C1 migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
