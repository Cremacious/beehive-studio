/**
 * One-shot migration for D2b (Discover Hives):
 *  1. Add hives.first_publicly_discoverable_at timestamp column (additive).
 *  2. Add hives.member_count integer NOT NULL DEFAULT 1 column (additive).
 *  3. Add hives.last_activity_at timestamp column (additive).
 *  4. Backfill first_publicly_discoverable_at for existing PUBLIC + discoverable
 *     hives with COALESCE(updated_at, created_at).
 *  5. Backfill member_count from hive_members GROUP BY hive_id.
 *  6. Backfill last_activity_at from hive_activity MAX(created_at) per hive_id.
 *  7. Create 4 indexes (discoverable+visibility, member_count,
 *     last_activity_at, first_public partial).
 *  8. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-d2b.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add hives.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 2: add hives.member_count column...')
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 1`
  console.log('  ✓ column added (or already present)')

  console.log('Step 3: add hives.last_activity_at column...')
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS last_activity_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 4: backfill first_publicly_discoverable_at for existing PUBLIC+discoverable hives...')
  const fpBackfill = await sql`
    UPDATE hives
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${fpBackfill.length} rows`)

  console.log('Step 5: backfill member_count from hive_members...')
  const mcBackfill = await sql`
    UPDATE hives
    SET member_count = sub.cnt
    FROM (
      SELECT hive_id, COUNT(*)::int AS cnt
      FROM hive_members
      GROUP BY hive_id
    ) AS sub
    WHERE hives.id = sub.hive_id
      AND hives.member_count <> sub.cnt
    RETURNING hives.id
  `
  console.log(`  ✓ backfilled ${mcBackfill.length} hives with member counts`)

  console.log('Step 6: backfill last_activity_at from hive_activity...')
  const laBackfill = await sql`
    UPDATE hives
    SET last_activity_at = sub.max_at
    FROM (
      SELECT hive_id, MAX(created_at) AS max_at
      FROM hive_activity
      GROUP BY hive_id
    ) AS sub
    WHERE hives.id = sub.hive_id
      AND (hives.last_activity_at IS NULL OR hives.last_activity_at < sub.max_at)
    RETURNING hives.id
  `
  console.log(`  ✓ backfilled ${laBackfill.length} hives with last_activity_at`)

  console.log('Step 7: create indexes...')
  await sql`CREATE INDEX IF NOT EXISTS hives_discoverable_visibility_idx ON hives (discoverable, visibility)`
  await sql`CREATE INDEX IF NOT EXISTS hives_member_count_idx ON hives (member_count)`
  await sql`CREATE INDEX IF NOT EXISTS hives_last_activity_at_idx ON hives (last_activity_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS hives_first_public_idx ON hives (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`
  console.log('  ✓ indexes created (or already present)')

  console.log('Step 8: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS fp_populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable,
      AVG(member_count)::numeric(10,2) AS avg_members,
      COUNT(*) FILTER (WHERE last_activity_at IS NOT NULL) AS with_activity
    FROM hives
  `
  console.log(
    '  fp_populated:', verify[0].fp_populated,
    '· public_discoverable:', verify[0].public_discoverable,
    '· avg_members:', verify[0].avg_members,
    '· with_activity:', verify[0].with_activity,
  )
}

run().catch((err) => { console.error(err); process.exit(1) })
