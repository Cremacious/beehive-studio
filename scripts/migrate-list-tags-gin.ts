/**
 * Issue #22 migration: add GIN index on reading_lists.tags
 * so `tags @> ARRAY['tagname']` queries are cheap as the table grows.
 *
 * Idempotent. Run:
 *   npx dotenv -e .env.local -- tsx scripts/migrate-list-tags-gin.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: create GIN index on reading_lists.tags...')
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_tags_gin ON reading_lists USING GIN (tags)`
  console.log('  ✓ reading_lists_tags_gin created (or already present)')

  console.log('Step 2: verify index exists...')
  const rows = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'reading_lists' AND indexname = 'reading_lists_tags_gin'
  `
  if (rows.length === 0) {
    console.error('  ✗ verification failed: index not found')
    process.exit(1)
  }
  console.log('  ✓ verified:', rows[0])

  console.log('\nDone.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
