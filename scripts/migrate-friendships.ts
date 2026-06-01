/**
 * SP-B: friendships subsystem.
 * Adds the friendship_status enum + friendships table + indexes + constraints.
 *
 * Idempotent via IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object / DROP CONSTRAINT IF EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-friendships.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running SP-B friendships migration...')

  await sql`DO $$ BEGIN
    CREATE TYPE friendship_status AS ENUM ('PENDING', 'ACCEPTED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ friendship_status enum')

  await sql`CREATE TABLE IF NOT EXISTS friendships (
    id            text PRIMARY KEY,
    requester_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        friendship_status NOT NULL DEFAULT 'PENDING',
    created_at    timestamp NOT NULL DEFAULT now(),
    accepted_at   timestamp
  )`

  await sql`ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_pair_unique`
  await sql`ALTER TABLE friendships ADD CONSTRAINT friendships_pair_unique UNIQUE (requester_id, recipient_id)`

  await sql`ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_no_self`
  await sql`ALTER TABLE friendships ADD CONSTRAINT friendships_no_self CHECK (requester_id <> recipient_id)`

  await sql`CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id)`
  await sql`CREATE INDEX IF NOT EXISTS friendships_recipient_idx ON friendships(recipient_id)`

  console.log('✓ friendships table created')

  const counts = await sql`SELECT COUNT(*) AS friendships FROM friendships`
  console.log('Final counts:', counts[0])
  console.log('SP-B migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
