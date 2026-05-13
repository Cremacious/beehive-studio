/**
 * One-shot migration script for Phase 7 community schema changes.
 * Run with: npx dotenv -e .env.local -- tsx scripts/migrate-phase7.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running Phase 7 schema migration...')

  // 1. Add new columns to sparks
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS word_limit integer`
  console.log('✓ sparks.word_limit added')

  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS creator_choice_entry_id text REFERENCES spark_entries(id)`
  console.log('✓ sparks.creator_choice_entry_id added')

  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS winner_entry_id text REFERENCES spark_entries(id)`
  console.log('✓ sparks.winner_entry_id added')

  // 2. Modify spark_entries: add new columns
  await sql`ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT ''`
  console.log('✓ spark_entries.content added')

  await sql`ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0`
  console.log('✓ spark_entries.word_count added')

  // 3. Modify spark_entries: drop old columns (chapter_id and votes)
  await sql`ALTER TABLE spark_entries DROP COLUMN IF EXISTS chapter_id`
  console.log('✓ spark_entries.chapter_id dropped')

  await sql`ALTER TABLE spark_entries DROP COLUMN IF EXISTS votes`
  console.log('✓ spark_entries.votes dropped')

  // 4. Create spark_votes table
  await sql`
    CREATE TABLE IF NOT EXISTS spark_votes (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_id text NOT NULL REFERENCES spark_entries(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, entry_id)
    )
  `
  console.log('✓ spark_votes table created')

  console.log('\nPhase 7 migration complete!')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
