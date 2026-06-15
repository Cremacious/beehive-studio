/**
 * One-shot migration for Spark redesign W2.1:
 *  1. Add sparks.prompt text column (NOT NULL DEFAULT '').
 *  2. Verification row count.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-add-spark-prompt.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log("Step 1: add sparks.prompt column (NOT NULL DEFAULT '')...")
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS prompt text NOT NULL DEFAULT ''`
  console.log('  ✓ prompt added (or already present)')

  console.log('Step 2: verify column exists...')
  const rows = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'sparks' AND column_name = 'prompt'
  `
  if (rows.length === 0) {
    console.error('  ✗ verification failed: prompt column not found')
    process.exit(1)
  }
  console.log(`  ✓ verified:`, rows[0])

  console.log('\nDone.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
