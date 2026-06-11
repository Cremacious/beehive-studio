/**
 * One-shot migration for D2a (Discover Sparks):
 *  1. Add sparks.genre text column (additive, nullable).
 *  2. Add sparks.first_publicly_discoverable_at timestamp column (additive).
 *  3. Add sparks.entry_count integer column (additive, default 0).
 *  4. Backfill first_publicly_discoverable_at for existing PUBLIC + discoverable
 *     sparks with COALESCE(updated_at, created_at). sparks has no updated_at
 *     column, so we fall back to created_at directly.
 *  5. Backfill entry_count from spark_entries GROUP BY spark_id.
 *  6. Create 4 indexes (discoverable+visibility, status+deadline,
 *     status+voting_ends, first_public partial).
 *  7. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-d2a.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add sparks.genre column...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS genre text`
  console.log('  ✓ genre added (or already present)')

  console.log('Step 2: add sparks.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 3: add sparks.entry_count column...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS entry_count integer NOT NULL DEFAULT 0`
  console.log('  ✓ column added (or already present)')

  console.log('Step 4: backfill first_publicly_discoverable_at for existing PUBLIC+discoverable sparks...')
  // sparks table has no updated_at column; fall back to created_at.
  const fpBackfill = await sql`
    UPDATE sparks
    SET first_publicly_discoverable_at = created_at
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${fpBackfill.length} rows`)

  console.log('Step 5: backfill entry_count from spark_entries...')
  const ecBackfill = await sql`
    UPDATE sparks
    SET entry_count = sub.cnt
    FROM (
      SELECT spark_id, COUNT(*)::int AS cnt
      FROM spark_entries
      GROUP BY spark_id
    ) AS sub
    WHERE sparks.id = sub.spark_id
      AND sparks.entry_count <> sub.cnt
    RETURNING sparks.id
  `
  console.log(`  ✓ backfilled ${ecBackfill.length} sparks with entry counts`)

  console.log('Step 6: create indexes...')
  await sql`CREATE INDEX IF NOT EXISTS sparks_discoverable_visibility_idx ON sparks (discoverable, visibility)`
  await sql`CREATE INDEX IF NOT EXISTS sparks_status_deadline_idx ON sparks (status, deadline)`
  await sql`CREATE INDEX IF NOT EXISTS sparks_status_voting_ends_idx ON sparks (status, voting_ends_at)`
  await sql`CREATE INDEX IF NOT EXISTS sparks_first_public_idx ON sparks (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`
  console.log('  ✓ indexes created (or already present)')

  console.log('Step 7: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS fp_populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable,
      COUNT(*) FILTER (WHERE entry_count > 0) AS with_entries,
      COALESCE(AVG(entry_count)::numeric(10,2), 0) AS avg_entries
    FROM sparks
  `
  console.log('  fp_populated:', verify[0].fp_populated, '· public_discoverable:', verify[0].public_discoverable, '· with_entries:', verify[0].with_entries, '· avg_entries:', verify[0].avg_entries)
}

run().catch((err) => { console.error(err); process.exit(1) })
