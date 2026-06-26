/**
 * Issue #37 migration: add missing indexes on hot filter/sort columns.
 *
 * Each composite-PK table already serves its LEADING column (PK index). These
 * indexes cover the TRAILING columns that hot queries filter/group by alone:
 *   - follows.followee_id   — follower counts, notification fan-out, discover ranking
 *   - book_likes.book_id    — likes-per-book aggregation in every trending/ranking path
 *   - bookmarks.book_id     — bookmark-per-book ranking signal
 *   - reading_lists.genre   — D3a discover lists genre filter (only tags GIN existed)
 *
 * Idempotent (CREATE INDEX IF NOT EXISTS). Mirrors scripts/migrate-list-tags-gin.ts.
 * Run:
 *   npx dotenv -e .env.local -- tsx scripts/migrate-perf-indexes.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

const INDEXES: { name: string; table: string; ddl: string }[] = [
  {
    name: 'follows_followee_id_idx',
    table: 'follows',
    ddl: 'CREATE INDEX IF NOT EXISTS follows_followee_id_idx ON follows(followee_id)',
  },
  {
    name: 'book_likes_book_id_idx',
    table: 'book_likes',
    ddl: 'CREATE INDEX IF NOT EXISTS book_likes_book_id_idx ON book_likes(book_id)',
  },
  {
    name: 'bookmarks_book_id_idx',
    table: 'bookmarks',
    ddl: 'CREATE INDEX IF NOT EXISTS bookmarks_book_id_idx ON bookmarks(book_id)',
  },
  {
    name: 'reading_lists_genre_idx',
    table: 'reading_lists',
    ddl: 'CREATE INDEX IF NOT EXISTS reading_lists_genre_idx ON reading_lists(genre)',
  },
]

async function run() {
  for (const idx of INDEXES) {
    console.log(`Creating ${idx.name} on ${idx.table}...`)
    await sql.query(idx.ddl)
    const rows = await sql.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname = $2`,
      [idx.table, idx.name],
    )
    if (rows.length === 0) {
      console.error(`  ✗ verification failed: ${idx.name} not found`)
      process.exit(1)
    }
    console.log(`  ✓ ${idx.name} present`)
  }
  console.log('\nDone.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
