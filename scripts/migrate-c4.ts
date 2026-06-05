/**
 * One-shot migration for C4 (Book Clubs):
 *  1. Create 4 pgEnums (book_club_member_role, book_club_book_status,
 *     book_club_invite_status, book_club_join_request_status).
 *  2. Create book_clubs (no current_book_id FK yet — added in step 14) + 2 indexes.
 *  3. Create book_club_books + 1 index.
 *  4. Create book_club_members + UNIQUE + 1 index.
 *  5. Create book_club_invites + 2 indexes.
 *  6. Create book_club_invite_tokens + 1 index.
 *  7. Create book_club_join_requests + UNIQUE + 1 index.
 *  8. Create book_club_schedule_items + 1 index + CHECK.
 *  9. Create book_club_discussions + 1 index.
 * 10. Create book_club_discussion_replies + 1 index.
 * 11. Create book_club_discussion_likes (composite PK).
 * 12. Create book_club_discussion_reply_likes (composite PK).
 * 13. Partial unique index book_club_books_one_current ON (club_id) WHERE status='CURRENT'.
 * 14. ADD book_clubs.current_book_id FK to book_club_books(id) ON DELETE SET NULL
 *     (drop-and-readd for idempotency).
 * 15. ALTER TYPE social_activity_type ADD VALUE for 2 new entries.
 * 16. ALTER TYPE notification_type ADD VALUE for 3 new entries.
 * 17. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c4.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running C4 schema migration...')

  await sql`DO $$ BEGIN
    CREATE TYPE book_club_member_role AS ENUM ('OWNER','MODERATOR','MEMBER');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE book_club_book_status AS ENUM ('CURRENT','PAST','QUEUE');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE book_club_invite_status AS ENUM ('PENDING','ACCEPTED','REJECTED','CANCELED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE book_club_join_request_status AS ENUM ('PENDING','ACCEPTED','REJECTED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ 1/17 4 enums (member_role, book_status, invite_status, join_request_status)')

  await sql`CREATE TABLE IF NOT EXISTS book_clubs (
    id text PRIMARY KEY,
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    rules text,
    tags text[] NOT NULL DEFAULT '{}',
    visibility book_visibility NOT NULL DEFAULT 'PUBLIC',
    discoverable boolean NOT NULL DEFAULT true,
    open_join boolean NOT NULL DEFAULT true,
    member_count integer NOT NULL DEFAULT 1,
    current_book_id text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_clubs_owner_created_idx ON book_clubs (owner_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS book_clubs_discoverable_visibility_idx ON book_clubs (discoverable, visibility)`
  console.log('✓ 2/17 book_clubs table + 2 indexes')

  await sql`CREATE TABLE IF NOT EXISTS book_club_books (
    id text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    book_id text REFERENCES books(id) ON DELETE SET NULL,
    title text NOT NULL,
    author text NOT NULL,
    cover_url text,
    status book_club_book_status NOT NULL DEFAULT 'QUEUE',
    "order" integer NOT NULL DEFAULT 0,
    added_at timestamp NOT NULL DEFAULT now(),
    started_at timestamp,
    finished_at timestamp
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_club_books_club_status_order_idx ON book_club_books (club_id, status, "order")`
  console.log('✓ 3/17 book_club_books table + index')

  await sql`CREATE TABLE IF NOT EXISTS book_club_members (
    id text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role book_club_member_role NOT NULL DEFAULT 'MEMBER',
    joined_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS book_club_members_club_user_unique ON book_club_members (club_id, user_id)`
  await sql`CREATE INDEX IF NOT EXISTS book_club_members_user_idx ON book_club_members (user_id)`
  console.log('✓ 4/17 book_club_members table + UNIQUE + 1 index')

  await sql`CREATE TABLE IF NOT EXISTS book_club_invites (
    id text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    inviter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status book_club_invite_status NOT NULL DEFAULT 'PENDING',
    created_at timestamp NOT NULL DEFAULT now(),
    responded_at timestamp
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_club_invites_recipient_status_idx ON book_club_invites (recipient_id, status)`
  await sql`CREATE INDEX IF NOT EXISTS book_club_invites_club_idx ON book_club_invites (club_id)`
  console.log('✓ 5/17 book_club_invites table + 2 indexes')

  await sql`CREATE TABLE IF NOT EXISTS book_club_invite_tokens (
    token text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    inviter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamp NOT NULL,
    claimed_by text REFERENCES users(id) ON DELETE SET NULL,
    claimed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_club_invite_tokens_club_idx ON book_club_invite_tokens (club_id)`
  console.log('✓ 6/17 book_club_invite_tokens table + index')

  await sql`CREATE TABLE IF NOT EXISTS book_club_join_requests (
    id text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status book_club_join_request_status NOT NULL DEFAULT 'PENDING',
    requested_at timestamp NOT NULL DEFAULT now(),
    responded_at timestamp
  )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS book_club_join_requests_club_user_unique ON book_club_join_requests (club_id, user_id)`
  await sql`CREATE INDEX IF NOT EXISTS book_club_join_requests_club_status_idx ON book_club_join_requests (club_id, status)`
  console.log('✓ 7/17 book_club_join_requests table + UNIQUE + 1 index')

  await sql`CREATE TABLE IF NOT EXISTS book_club_schedule_items (
    id text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    book_id text NOT NULL REFERENCES book_club_books(id) ON DELETE CASCADE,
    chapter_start integer NOT NULL,
    chapter_end integer NOT NULL,
    target_date timestamp NOT NULL,
    label text,
    "order" integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT book_club_schedule_items_chapter_range_check CHECK (chapter_end >= chapter_start)
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_club_schedule_items_club_book_order_idx ON book_club_schedule_items (club_id, book_id, "order")`
  console.log('✓ 8/17 book_club_schedule_items table + index + CHECK')

  await sql`CREATE TABLE IF NOT EXISTS book_club_discussions (
    id text PRIMARY KEY,
    club_id text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
    author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    is_pinned boolean NOT NULL DEFAULT false,
    like_count integer NOT NULL DEFAULT 0,
    reply_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_club_discussions_club_pinned_created_idx ON book_club_discussions (club_id, is_pinned DESC, created_at DESC)`
  console.log('✓ 9/17 book_club_discussions table + index')

  await sql`CREATE TABLE IF NOT EXISTS book_club_discussion_replies (
    id text PRIMARY KEY,
    discussion_id text NOT NULL REFERENCES book_club_discussions(id) ON DELETE CASCADE,
    author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content text NOT NULL,
    like_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS book_club_discussion_replies_discussion_created_idx ON book_club_discussion_replies (discussion_id, created_at)`
  console.log('✓ 10/17 book_club_discussion_replies table + index')

  await sql`CREATE TABLE IF NOT EXISTS book_club_discussion_likes (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discussion_id text NOT NULL REFERENCES book_club_discussions(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, discussion_id)
  )`
  console.log('✓ 11/17 book_club_discussion_likes table')

  await sql`CREATE TABLE IF NOT EXISTS book_club_discussion_reply_likes (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reply_id text NOT NULL REFERENCES book_club_discussion_replies(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, reply_id)
  )`
  console.log('✓ 12/17 book_club_discussion_reply_likes table')

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS book_club_books_one_current ON book_club_books (club_id) WHERE status = 'CURRENT'`
  console.log('✓ 13/17 partial unique index — one CURRENT book per club')

  await sql`ALTER TABLE book_clubs DROP CONSTRAINT IF EXISTS book_clubs_current_book_id_fkey`
  await sql`ALTER TABLE book_clubs ADD CONSTRAINT book_clubs_current_book_id_fkey FOREIGN KEY (current_book_id) REFERENCES book_club_books(id) ON DELETE SET NULL`
  console.log('✓ 14/17 book_clubs.current_book_id FK (drop-and-readd)')

  await sql`ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'book_club_created'`
  await sql`ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'book_club_current_book_changed'`
  console.log('✓ 15/17 social_activity_type += book_club_created, book_club_current_book_changed')

  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CLUB_INVITE'`
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CLUB_JOIN_REQUEST'`
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CLUB_JOIN_APPROVED'`
  console.log('✓ 16/17 notification_type += CLUB_INVITE, CLUB_JOIN_REQUEST, CLUB_JOIN_APPROVED')

  const clubsRows = (await sql`SELECT count(*)::int AS n FROM book_clubs`) as Array<{ n: number }>
  const membersRows = (await sql`SELECT count(*)::int AS n FROM book_club_members`) as Array<{ n: number }>
  const booksRows = (await sql`SELECT count(*)::int AS n FROM book_club_books`) as Array<{ n: number }>
  const discRows = (await sql`SELECT count(*)::int AS n FROM book_club_discussions`) as Array<{ n: number }>
  console.log(`✓ 17/17 verification — ${clubsRows[0].n} clubs, ${membersRows[0].n} members, ${booksRows[0].n} books, ${discRows[0].n} discussions`)

  console.log('\nC4 migration complete.')
}

main().catch((err) => { console.error(err); process.exit(1) })
