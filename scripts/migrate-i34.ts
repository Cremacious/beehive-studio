/**
 * Migration for Issue #34 — Settings redesign.
 *
 * 1. Add user_profiles.website column (text, nullable)
 * 2. Add user_profiles.location column (text, nullable)
 * 3. Create user_privacy_settings table
 * 4. Create user_preferences table
 *
 * Idempotent. Run:
 *   npx dotenv -e .env.local -- tsx scripts/migrate-i34.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add user_profiles.website column...')
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS website text`
  console.log('  done')

  console.log('Step 2: add user_profiles.location column...')
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location text`
  console.log('  done')

  console.log('Step 3: create user_privacy_settings table...')
  await sql`
    CREATE TABLE IF NOT EXISTS user_privacy_settings (
      user_id          text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      allow_follow     boolean NOT NULL DEFAULT true,
      show_liked_books boolean NOT NULL DEFAULT true,
      show_activity_feed boolean NOT NULL DEFAULT true,
      appear_in_suggested boolean NOT NULL DEFAULT true,
      findable_by_email boolean NOT NULL DEFAULT false,
      updated_at       timestamp NOT NULL DEFAULT now()
    )
  `
  console.log('  done')

  console.log('Step 4: create user_preferences table...')
  await sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id                  text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      default_book_visibility  text NOT NULL DEFAULT 'PRIVATE',
      default_genre            text,
      default_spark_word_limit text,
      editor_theme             text NOT NULL DEFAULT 'light',
      genre_interests          text[] NOT NULL DEFAULT '{}',
      updated_at               timestamp NOT NULL DEFAULT now()
    )
  `
  console.log('  done')

  console.log('Step 5: verify...')
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user_profiles'
      AND column_name IN ('website','location')
    ORDER BY column_name
  `
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('  user_profiles new cols:', cols.map((r: any) => r.column_name))

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('user_privacy_settings','user_preferences')
    ORDER BY table_name
  `
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('  new tables:', tables.map((r: any) => r.table_name))
  console.log('Migration complete.')
}

run().catch((err) => { console.error(err); process.exit(1) })
