/**
 * P0 notifications audit migration.
 * Adds HIVE_ANNOTATION as a notification_type enum value.
 * Idempotent: ADD VALUE IF NOT EXISTS is a no-op if already present.
 *
 * Run with: npx dotenv -e .env.local -- tsx scripts/migrate-notifications-p0.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  console.log('→ Adding HIVE_ANNOTATION to notification_type enum…')
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'HIVE_ANNOTATION'`
  console.log('  ✓ done')

  console.log('\nMigration complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
