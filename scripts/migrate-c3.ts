/**
 * One-shot migration for C3 (Reading Lists):
 *  1. Create reading_list_kind enum.
 *  2. Create reading_lists + 2 indexes.
 *  3. Create reading_list_books + 1 index + 2 CHECK constraints (rating 1-5, commentary <=500).
 *  4. Create reading_list_follows (composite PK) + 1 index.
 *  5. Create partial unique index ON reading_lists(user_id) WHERE kind='LIKED' for ensureLikedListAction.
 *  6. ALTER TYPE social_activity_type ADD VALUE 'reading_list_created'.
 *  7. ALTER TYPE social_activity_type ADD VALUE 'books_added_batch'.
 *  8. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c3.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running C3 schema migration...')

  await sql`DO $$ BEGIN
    CREATE TYPE reading_list_kind AS ENUM ('CUSTOM','LIKED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ 1/8 reading_list_kind enum')

  await sql`CREATE TABLE IF NOT EXISTS reading_lists (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind reading_list_kind NOT NULL DEFAULT 'CUSTOM',
    title text NOT NULL,
    description text,
    visibility book_visibility NOT NULL DEFAULT 'PUBLIC',
    discoverable boolean NOT NULL DEFAULT true,
    tags text[] NOT NULL DEFAULT '{}',
    book_count integer NOT NULL DEFAULT 0,
    follower_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_user_created_idx ON reading_lists (user_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_discoverable_visibility_idx ON reading_lists (discoverable, visibility)`
  console.log('✓ 2/8 reading_lists table + indexes')

  await sql`CREATE TABLE IF NOT EXISTS reading_list_books (
    id text PRIMARY KEY,
    list_id text NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    book_id text REFERENCES books(id) ON DELETE SET NULL,
    title text NOT NULL,
    author text NOT NULL,
    cover_url text,
    is_read boolean NOT NULL DEFAULT false,
    rating integer,
    commentary text,
    "order" integer NOT NULL DEFAULT 0,
    added_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT reading_list_books_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT reading_list_books_commentary_check CHECK (commentary IS NULL OR length(commentary) <= 500)
  )`
  await sql`CREATE INDEX IF NOT EXISTS reading_list_books_list_order_idx ON reading_list_books (list_id, "order")`
  console.log('✓ 3/8 reading_list_books table + index + CHECKs')

  await sql`CREATE TABLE IF NOT EXISTS reading_list_follows (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id text NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, list_id)
  )`
  await sql`CREATE INDEX IF NOT EXISTS reading_list_follows_list_idx ON reading_list_follows (list_id)`
  console.log('✓ 4/8 reading_list_follows table + index')

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS reading_lists_user_liked_unique ON reading_lists (user_id) WHERE kind = 'LIKED'`
  console.log('✓ 5/8 partial unique index for Liked auto-list')

  await sql`ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'reading_list_created'`
  console.log('✓ 6/8 social_activity_type += reading_list_created')

  await sql`ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'books_added_batch'`
  console.log('✓ 7/8 social_activity_type += books_added_batch')

  const listsRows = (await sql`SELECT count(*)::int AS lists_count FROM reading_lists`) as Array<{ lists_count: number }>
  const booksRows = (await sql`SELECT count(*)::int AS books_count FROM reading_list_books`) as Array<{ books_count: number }>
  console.log(`✓ 8/8 verification — ${listsRows[0].lists_count} lists, ${booksRows[0].books_count} books`)

  console.log('\nC3 migration complete.')
}

main().catch((err) => { console.error(err); process.exit(1) })
