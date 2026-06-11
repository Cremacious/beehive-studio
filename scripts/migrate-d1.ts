/**
 * One-shot migration for D1 (Discover Books):
 *  1. Add books.first_publicly_discoverable_at timestamp column (additive).
 *  2. Backfill existing PUBLIC + discoverable rows with COALESCE(updated_at, created_at).
 *  3. Create partial index books_first_public_idx on (first_publicly_discoverable_at DESC)
 *     WHERE visibility = 'PUBLIC' AND discoverable = true.
 *  4. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-d1.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add books.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 2: backfill existing PUBLIC+discoverable books...')
  const backfill = await sql`
    UPDATE books
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${backfill.length} rows`)

  console.log('Step 3: create partial index...')
  await sql`
    CREATE INDEX IF NOT EXISTS books_first_public_idx
    ON books (first_publicly_discoverable_at DESC)
    WHERE visibility = 'PUBLIC' AND discoverable = true
  `
  console.log('  ✓ index created (or already present)')

  console.log('Step 4: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable
    FROM books
  `
  console.log('  populated:', verify[0].populated, '· public_discoverable:', verify[0].public_discoverable)
}

run().catch((err) => { console.error(err); process.exit(1) })
