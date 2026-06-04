/**
 * One-shot migration for C2 (Sparks Refresh):
 *  1. Create enums spark_visibility, spark_status.
 *  2. ALTER sparks ADD COLUMN visibility/discoverable/status/voting_ends_at.
 *  3. ALTER spark_entries ADD COLUMN title/like_count.
 *  4. ALTER spark_entry_comments ADD COLUMN parent_id.
 *  5. Backfill like_count from spark_votes COUNT.
 *  6. Backfill voting_ends_at from deadline + 48h.
 *  7. Print row counts for verification.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c2.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running C2 schema migration...')

  await sql`DO $$ BEGIN
    CREATE TYPE spark_visibility AS ENUM ('PUBLIC','FRIENDS','PRIVATE');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE spark_status AS ENUM ('OPEN','VOTING','CLOSED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ 1/7 enums created')

  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS visibility spark_visibility NOT NULL DEFAULT 'PUBLIC'`
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true`
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS status spark_status NOT NULL DEFAULT 'OPEN'`
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS voting_ends_at timestamp`
  console.log('✓ 2/7 sparks columns added')

  await sql`ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS title text`
  await sql`ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0`
  console.log('✓ 3/7 spark_entries columns added')

  await sql`ALTER TABLE spark_entry_comments ADD COLUMN IF NOT EXISTS parent_id text REFERENCES spark_entry_comments(id) ON DELETE CASCADE`
  console.log('✓ 4/7 spark_entry_comments.parent_id added')

  await sql`
    UPDATE spark_entries
    SET like_count = (SELECT count(*)::int FROM spark_votes WHERE entry_id = spark_entries.id)
    WHERE like_count = 0
  `
  console.log('✓ 5/7 like_count backfilled')

  await sql`
    UPDATE sparks
    SET voting_ends_at = deadline + interval '48 hours'
    WHERE voting_ends_at IS NULL AND deadline IS NOT NULL
  `
  console.log('✓ 6/7 voting_ends_at backfilled')

  const sparksRows = (await sql`SELECT count(*)::int AS sparks_count FROM sparks`) as Array<{ sparks_count: number }>
  const entriesRows = (await sql`SELECT count(*)::int AS entries_count FROM spark_entries`) as Array<{ entries_count: number }>
  const sparksCount = sparksRows[0]?.sparks_count ?? 0
  const entriesCount = entriesRows[0]?.entries_count ?? 0
  console.log(`✓ 7/7 verification — ${sparksCount} sparks, ${entriesCount} entries`)

  console.log('\nC2 migration complete.')
}

main().catch((err) => { console.error(err); process.exit(1) })
