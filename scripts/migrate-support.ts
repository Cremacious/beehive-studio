/**
 * Additive migration for Issue #47 — Support/Help feature:
 *   1. CREATE TYPE support_category enum
 *   2. CREATE TYPE support_status enum
 *   3. CREATE TABLE support_messages
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-support.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  const sql = neon(process.env.DATABASE_URL)

  console.log('1. Creating support_category enum...')
  await sql`
    DO $$ BEGIN
      CREATE TYPE support_category AS ENUM ('general', 'technical', 'feedback');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  console.log('2. Creating support_status enum...')
  await sql`
    DO $$ BEGIN
      CREATE TYPE support_status AS ENUM ('new', 'in_progress', 'resolved');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  console.log('3. Creating support_messages table...')
  await sql`
    CREATE TABLE IF NOT EXISTS support_messages (
      id text PRIMARY KEY,
      user_id text REFERENCES users(id) ON DELETE SET NULL,
      email text NOT NULL,
      category support_category NOT NULL,
      subject text NOT NULL,
      message text NOT NULL,
      status support_status NOT NULL DEFAULT 'new',
      admin_response text,
      responded_at timestamp,
      responded_by text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS support_messages_status_idx ON support_messages (status, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS support_messages_category_idx ON support_messages (category)`
  await sql`CREATE INDEX IF NOT EXISTS support_messages_user_idx ON support_messages (user_id)`

  const rows = await sql`SELECT count(*)::int AS n FROM support_messages`
  console.log(`✓ support_messages=${rows[0].n}`)
  console.log('Migration complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
