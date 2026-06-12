/**
 * One-shot migration for D3a (Discover Lists):
 *  1. Add reading_lists.genre text column (additive).
 *  2. Add reading_lists.first_publicly_discoverable_at timestamp column (additive).
 *  3. Add reading_lists.last_updated_at timestamp column (additive).
 *  4. Backfill first_publicly_discoverable_at for existing PUBLIC + discoverable
 *     + kind='CUSTOM' lists with COALESCE(updated_at, created_at).
 *  5. Backfill last_updated_at from updated_at for all rows.
 *  6. Create 3 indexes (first_public partial, last_updated, follower_count).
 *  7. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-d3a.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add reading_lists.genre column...')
  await sql`ALTER TABLE reading_lists ADD COLUMN IF NOT EXISTS genre text`
  console.log('  ✓ column added (or already present)')

  console.log('Step 2: add reading_lists.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE reading_lists ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 3: add reading_lists.last_updated_at column...')
  await sql`ALTER TABLE reading_lists ADD COLUMN IF NOT EXISTS last_updated_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 4: backfill first_publicly_discoverable_at for existing PUBLIC+discoverable+CUSTOM lists...')
  const fpBackfill = await sql`
    UPDATE reading_lists
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
      AND kind = 'CUSTOM'
    RETURNING id
  `
  console.log(`  ✓ backfilled ${fpBackfill.length} rows`)

  console.log('Step 5: backfill last_updated_at from updated_at...')
  const luBackfill = await sql`
    UPDATE reading_lists
    SET last_updated_at = updated_at
    WHERE last_updated_at IS NULL
    RETURNING id
  `
  console.log(`  ✓ backfilled ${luBackfill.length} rows`)

  console.log('Step 6: create indexes...')
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_first_public_idx ON reading_lists (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true AND kind = 'CUSTOM'`
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_last_updated_idx ON reading_lists (last_updated_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_follower_count_idx ON reading_lists (follower_count DESC)`
  console.log('  ✓ indexes created (or already present)')

  console.log('Step 7: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS fp_populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true AND kind = 'CUSTOM') AS public_discoverable_custom,
      COUNT(*) FILTER (WHERE last_updated_at IS NOT NULL) AS lu_populated,
      COUNT(*) FILTER (WHERE genre IS NOT NULL) AS genre_populated,
      COUNT(*) AS total
    FROM reading_lists
  `
  console.log(
    '  fp_populated:', verify[0].fp_populated,
    '· public_discoverable_custom:', verify[0].public_discoverable_custom,
    '· lu_populated:', verify[0].lu_populated,
    '· genre_populated:', verify[0].genre_populated,
    '· total:', verify[0].total,
  )
}

run().catch((err) => { console.error(err); process.exit(1) })
