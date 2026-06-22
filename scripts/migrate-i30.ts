/**
 * Migration for Issue #30 — Book Club Page Redesign
 *
 * Steps (all idempotent):
 *  1. Add book_clubs.current_reading_goal_description (text nullable)
 *  2. Add book_clubs.current_reading_goal_deadline (timestamp nullable)
 *  3. Add book_clubs.current_progress_value (int nullable) — owner-controlled group pace
 *  4. Add book_clubs.total_progress_value (int nullable)
 *  5. Add book_clubs.progress_unit (text nullable — 'page' | 'chapter')
 *  6. Create club_member_progress table
 *  7. Verification
 *
 * Run: dotenv -e .env.local -- tsx scripts/migrate-i30.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  // ── Step 1-5: book_clubs column additions ─────────────────────────────────
  console.log('Step 1: add current_reading_goal_description...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS current_reading_goal_description text`
  console.log('  ✓')

  console.log('Step 2: add current_reading_goal_deadline...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS current_reading_goal_deadline timestamptz`
  console.log('  ✓')

  console.log('Step 3: add current_progress_value...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS current_progress_value integer`
  console.log('  ✓')

  console.log('Step 4: add total_progress_value...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS total_progress_value integer`
  console.log('  ✓')

  console.log('Step 5: add progress_unit...')
  await sql`ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS progress_unit text`
  console.log('  ✓')

  // ── Step 6: club_member_progress table ────────────────────────────────────
  console.log('Step 6: create club_member_progress table...')
  await sql`
    CREATE TABLE IF NOT EXISTS club_member_progress (
      id         text        PRIMARY KEY,
      club_id    text        NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
      user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id    text        NOT NULL,
      is_on_track boolean    NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT club_member_progress_unique UNIQUE (club_id, user_id, book_id)
    )
  `
  console.log('  ✓ club_member_progress table created (or already present)')

  console.log('Step 6b: add index on club_member_progress(club_id, book_id)...')
  await sql`
    CREATE INDEX IF NOT EXISTS club_member_progress_club_book_idx
    ON club_member_progress (club_id, book_id)
  `
  console.log('  ✓')

  // ── Step 7: verify ─────────────────────────────────────────────────────────
  console.log('Step 7: verify book_clubs columns...')
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'book_clubs'
      AND column_name IN (
        'current_reading_goal_description',
        'current_reading_goal_deadline',
        'current_progress_value',
        'total_progress_value',
        'progress_unit'
      )
    ORDER BY column_name
  `
  if (cols.length !== 5) {
    console.error(`  ✗ expected 5 columns, found ${cols.length}`)
    process.exit(1)
  }
  cols.forEach(c => console.log(`  ✓ ${c.column_name} (${c.data_type})`))

  console.log('Step 7b: verify club_member_progress table...')
  const tbl = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'club_member_progress'
  `
  if (tbl.length === 0) {
    console.error('  ✗ club_member_progress table not found')
    process.exit(1)
  }
  console.log('  ✓ club_member_progress exists')

  console.log('\nDone. Issue #30 migration complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
