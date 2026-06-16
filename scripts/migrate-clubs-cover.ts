/**
 * One-shot migration for Clubs Hub redesign T1:
 *  1. Add book_clubs.cover_image_url text column (nullable).
 *  2. Verification.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-clubs-cover.ts
 *   (or npx tsx scripts/migrate-clubs-cover.ts if .env.local is autoloaded)
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add book_clubs.cover_image_url column (nullable)...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS cover_image_url text`
  console.log('  ✓ cover_image_url added (or already present)')

  console.log('Step 2: verify column exists...')
  const rows = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'book_clubs' AND column_name = 'cover_image_url'
  `
  if (rows.length === 0) {
    console.error('  ✗ verification failed: cover_image_url column not found')
    process.exit(1)
  }
  console.log(`  ✓ verified:`, rows[0])

  console.log('Step 3: count NULL rows (expected: every existing club until upload)...')
  const counts = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE cover_image_url IS NULL)::int AS null_count
    FROM book_clubs
  `
  console.log(`  ✓ counts:`, counts[0])

  console.log('\nDone.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
