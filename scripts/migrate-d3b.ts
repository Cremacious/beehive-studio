/**
 * One-shot migration for D3b (Discover Clubs):
 *  1. Add book_clubs.genre text column (additive).
 *  2. Add book_clubs.first_publicly_discoverable_at timestamp column (additive).
 *  3. Add book_clubs.last_activity_at timestamp column (additive).
 *  4. Backfill first_publicly_discoverable_at for existing PUBLIC + discoverable
 *     clubs with COALESCE(updated_at, created_at).
 *  5. Backfill last_activity_at from MAX(book_club_discussions.created_at) per club.
 *  6. Create 3 indexes (last_activity, first_public partial, open_join).
 *  7. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-d3b.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add book_clubs.genre column...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS genre text`
  console.log('  ✓ column added (or already present)')

  console.log('Step 2: add book_clubs.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 3: add book_clubs.last_activity_at column...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS last_activity_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 4: backfill first_publicly_discoverable_at for existing PUBLIC+discoverable clubs...')
  const fpBackfill = await sql`
    UPDATE book_clubs
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${fpBackfill.length} rows`)

  console.log('Step 5: backfill last_activity_at from MAX(book_club_discussions.created_at)...')
  const laBackfill = await sql`
    UPDATE book_clubs bc
    SET last_activity_at = sub.max_created
    FROM (
      SELECT club_id, MAX(created_at) AS max_created
      FROM book_club_discussions
      GROUP BY club_id
    ) sub
    WHERE bc.id = sub.club_id
      AND bc.last_activity_at IS NULL
    RETURNING bc.id
  `
  console.log(`  ✓ backfilled ${laBackfill.length} rows`)

  console.log('Step 6: create indexes...')
  await sql`CREATE INDEX IF NOT EXISTS book_clubs_last_activity_idx ON book_clubs (last_activity_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS book_clubs_first_public_idx ON book_clubs (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`
  await sql`CREATE INDEX IF NOT EXISTS book_clubs_open_join_idx ON book_clubs (open_join, member_count DESC)`
  console.log('  ✓ indexes created (or already present)')

  console.log('Step 7: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS fp_populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable,
      COUNT(*) FILTER (WHERE last_activity_at IS NOT NULL) AS la_populated,
      COUNT(*) FILTER (WHERE genre IS NOT NULL) AS genre_populated,
      COUNT(*) AS total
    FROM book_clubs
  `
  console.log(
    '  fp_populated:', verify[0].fp_populated,
    '· public_discoverable:', verify[0].public_discoverable,
    '· la_populated:', verify[0].la_populated,
    '· genre_populated:', verify[0].genre_populated,
    '· total:', verify[0].total,
  )
}

run().catch((err) => { console.error(err); process.exit(1) })
