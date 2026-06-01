/**
 * One-shot migration for H4 (Motivation):
 *  1. Create enums word_goal_type, buzz_post_type.
 *  2. Create table hive_word_goals + partial-unique index on (hive_id, type) WHERE is_active.
 *  3. Create table hive_word_logs + composite indexes.
 *  4. Create table hive_buzz_posts + CHECK constraint + index.
 *  5. Create table hive_buzz_likes (composite PK).
 *  6. Print row counts.
 *
 * Idempotent via IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object / DROP CONSTRAINT IF EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-h4.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running H4 schema migration...')

  // 1. Enums
  await sql`DO $$ BEGIN
    CREATE TYPE word_goal_type AS ENUM ('DAILY','WEEKLY','MONTHLY','TOTAL');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE buzz_post_type AS ENUM ('TEXT','LINK');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ enums created')

  // 2. hive_word_goals
  await sql`CREATE TABLE IF NOT EXISTS hive_word_goals (
    id            text PRIMARY KEY,
    hive_id       text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    created_by    text NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    type          word_goal_type NOT NULL,
    target_words  integer NOT NULL CHECK (target_words > 0),
    start_date    timestamp NOT NULL DEFAULT now(),
    end_date      timestamp,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS hive_word_goals_active_unique
            ON hive_word_goals(hive_id, type) WHERE is_active = true`
  console.log('✓ hive_word_goals created')

  // 3. hive_word_logs
  await sql`CREATE TABLE IF NOT EXISTS hive_word_logs (
    id           text PRIMARY KEY,
    hive_id      text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    words_added  integer NOT NULL,
    logged_at    timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS hive_word_logs_hive_id_logged_at_idx
            ON hive_word_logs(hive_id, logged_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS hive_word_logs_user_chapter_idx
            ON hive_word_logs(user_id, chapter_id, logged_at DESC)`
  console.log('✓ hive_word_logs created')

  // 4. hive_buzz_posts + CHECK
  await sql`CREATE TABLE IF NOT EXISTS hive_buzz_posts (
    id          text PRIMARY KEY,
    hive_id     text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    author_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        buzz_post_type NOT NULL,
    body        text NOT NULL,
    link_url    text,
    like_count  integer NOT NULL DEFAULT 0,
    created_at  timestamp NOT NULL DEFAULT now(),
    updated_at  timestamp NOT NULL DEFAULT now()
  )`
  await sql`ALTER TABLE hive_buzz_posts DROP CONSTRAINT IF EXISTS hive_buzz_posts_type_link_check`
  await sql`ALTER TABLE hive_buzz_posts
            ADD CONSTRAINT hive_buzz_posts_type_link_check
            CHECK ((type = 'LINK' AND link_url IS NOT NULL)
                OR (type = 'TEXT' AND link_url IS NULL))`
  await sql`CREATE INDEX IF NOT EXISTS hive_buzz_posts_hive_created_idx
            ON hive_buzz_posts(hive_id, created_at DESC)`
  console.log('✓ hive_buzz_posts created with CHECK')

  // 5. hive_buzz_likes
  await sql`CREATE TABLE IF NOT EXISTS hive_buzz_likes (
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buzz_id    text NOT NULL REFERENCES hive_buzz_posts(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, buzz_id)
  )`
  console.log('✓ hive_buzz_likes created')

  // 6. Counts
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM hive_word_goals)  AS goals,
      (SELECT COUNT(*) FROM hive_word_logs)   AS logs,
      (SELECT COUNT(*) FROM hive_buzz_posts)  AS posts,
      (SELECT COUNT(*) FROM hive_buzz_likes)  AS likes
  `
  console.log('Final counts:', counts[0])
  console.log('H4 migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
