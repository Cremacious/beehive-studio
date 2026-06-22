/**
 * Issue #21 — Spark likes.
 *  1. Add sparks.like_count integer NOT NULL DEFAULT 0.
 *  2. Create spark_likes table: (user_id, spark_id, created_at), composite PK,
 *     FK cascade on both sides.
 *  3. Index spark_likes(spark_id) for reverse lookups (likeCount recompute,
 *     "users who liked this" queries).
 *  4. Verification.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-spark-likes.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add sparks.like_count column (NOT NULL DEFAULT 0)...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0`
  console.log('  ✓ like_count added (or already present)')

  console.log('Step 2: create spark_likes table...')
  await sql`
    CREATE TABLE IF NOT EXISTS spark_likes (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      spark_id text NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, spark_id)
    )
  `
  console.log('  ✓ spark_likes table created (or already present)')

  console.log('Step 3: index spark_likes(spark_id)...')
  await sql`CREATE INDEX IF NOT EXISTS spark_likes_spark_idx ON spark_likes(spark_id)`
  console.log('  ✓ index created (or already present)')

  console.log('Step 4: verify...')
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sparks' AND column_name = 'like_count'
  `
  if (cols.length === 0) {
    console.error('  ✗ sparks.like_count not found')
    process.exit(1)
  }
  const tab = await sql`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'spark_likes'
  `
  if (tab.length === 0) {
    console.error('  ✗ spark_likes table not found')
    process.exit(1)
  }
  const idx = await sql`
    SELECT indexname FROM pg_indexes WHERE tablename = 'spark_likes' AND indexname = 'spark_likes_spark_idx'
  `
  if (idx.length === 0) {
    console.error('  ✗ spark_likes_spark_idx not found')
    process.exit(1)
  }
  console.log('  ✓ verified all schema objects')

  const count = await sql`SELECT count(*)::int AS n FROM spark_likes`
  console.log(`  spark_likes row count: ${count[0].n}`)

  console.log('\nDone.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
