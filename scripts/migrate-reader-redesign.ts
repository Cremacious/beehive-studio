/**
 * Reader page redesign: add chapter_reads join table for true per-chapter
 * manual mark-as-read. readingProgress table is NOT touched.
 *
 * Idempotent via IF NOT EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-reader-redesign.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Migrate: reader page redesign')

  await sql`CREATE TABLE IF NOT EXISTS chapter_reads (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_binder_item_id text NOT NULL REFERENCES binder_items(id) ON DELETE CASCADE,
    read_at timestamp DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, chapter_binder_item_id)
  )`
  console.log('  ✓ chapter_reads table')

  await sql`CREATE INDEX IF NOT EXISTS chapter_reads_user_book_idx
    ON chapter_reads (user_id, book_id)`
  console.log('  ✓ chapter_reads_user_book_idx')

  console.log('Migration complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
