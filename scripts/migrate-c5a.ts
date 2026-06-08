/**
 * One-shot migration for C5a (@-Mentions):
 *  1. ALTER TYPE notification_type ADD VALUE 'MENTION'.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c5a.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  const sql = neon(process.env.DATABASE_URL)
  console.log('Adding MENTION to notification_type enum...')
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MENTION'`
  console.log('✓ Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
