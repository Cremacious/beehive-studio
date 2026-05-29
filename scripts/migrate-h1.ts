/**
 * One-shot migration for H1 (Hive Foundation):
 *  - Add hives.discoverable
 *  - Tighten hives.book_id FK to ON DELETE CASCADE
 *  - Add partial UNIQUE index on hives(book_id) WHERE bookId IS NOT NULL
 *  - Collapse hive_member_role enum 5 → 4 (EDITOR → MODERATOR; PROOFREADER → CONTRIBUTOR)
 *  - Create hive_activity_type enum + hive_activity table
 * Run with: npx dotenv -e .env.local -- tsx scripts/migrate-h1.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running H1 schema migration...')

  // 1. hives.discoverable
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false`
  console.log('✓ hives.discoverable added')

  // 2. Defensive: at most one hive per book before adding the unique index.
  //    Keep oldest, delete the rest (cascade deletes child rows via existing FKs).
  const dupes = await sql`
    SELECT book_id, ARRAY_AGG(id ORDER BY created_at) AS ids
    FROM hives WHERE book_id IS NOT NULL
    GROUP BY book_id HAVING COUNT(*) > 1
  `
  for (const row of dupes) {
    const ids = row.ids as string[]
    const toDelete = ids.slice(1)
    console.log(`  dedup book ${row.book_id}: keeping ${ids[0]}, deleting ${toDelete.length} others`)
    for (const id of toDelete) {
      await sql`DELETE FROM hives WHERE id = ${id}`
    }
  }
  console.log(`✓ deduped ${dupes.length} books with multiple hives`)

  // 3. Coerce discoverable=false for any hive whose visibility != PUBLIC
  await sql`UPDATE hives SET discoverable = false WHERE visibility != 'PUBLIC'`
  console.log('✓ discoverable coerced for non-PUBLIC hives')

  // 4. Partial UNIQUE index on hives(book_id) WHERE bookId IS NOT NULL
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS hives_book_id_unique
            ON hives(book_id) WHERE book_id IS NOT NULL`
  console.log('✓ hives_book_id_unique partial unique index created')

  // 5. Tighten hives.book_id FK to ON DELETE CASCADE.
  //    Drop existing constraint (auto-named) and recreate.
  const fkRow = await sql`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'hives'::regclass AND contype = 'f'
      AND conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'hives'::regclass AND attname = 'book_id')]::smallint[]
  `
  if (fkRow.length) {
    const name = fkRow[0].conname as string
    // Identifier interpolation: neon's tagged template treats values as parameters,
    // which isn't valid for DDL identifiers. Use sql.unsafe for the quoted name.
    await sql.unsafe(`ALTER TABLE hives DROP CONSTRAINT "${name}"`)
    console.log(`  dropped FK ${name}`)
  }
  await sql`ALTER TABLE hives ADD CONSTRAINT hives_book_id_fkey
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE`
  console.log('✓ hives.book_id FK now CASCADE')

  // 6. Collapse hive_member_role enum 5 → 4 (create new, copy, swap)
  await sql`ALTER TYPE hive_member_role ADD VALUE IF NOT EXISTS 'MODERATOR'`
  await sql`UPDATE hive_members SET role = 'MODERATOR' WHERE role = 'EDITOR'`
  await sql`UPDATE hive_members SET role = 'CONTRIBUTOR' WHERE role = 'PROOFREADER'`
  await sql`UPDATE hive_invites SET role = 'MODERATOR' WHERE role = 'EDITOR'`
  await sql`UPDATE hive_invites SET role = 'CONTRIBUTOR' WHERE role = 'PROOFREADER'`
  console.log('✓ EDITOR → MODERATOR and PROOFREADER → CONTRIBUTOR rewrites done')

  await sql`CREATE TYPE hive_member_role_new
            AS ENUM ('OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER')`
  await sql`ALTER TABLE hive_members
            ALTER COLUMN role DROP DEFAULT`
  await sql`ALTER TABLE hive_invites
            ALTER COLUMN role DROP DEFAULT`
  await sql`ALTER TABLE hive_members
            ALTER COLUMN role TYPE hive_member_role_new
            USING role::text::hive_member_role_new`
  await sql`ALTER TABLE hive_invites
            ALTER COLUMN role TYPE hive_member_role_new
            USING role::text::hive_member_role_new`
  await sql`DROP TYPE hive_member_role`
  await sql`ALTER TYPE hive_member_role_new RENAME TO hive_member_role`
  await sql`ALTER TABLE hive_members
            ALTER COLUMN role SET DEFAULT 'CONTRIBUTOR'::hive_member_role`
  await sql`ALTER TABLE hive_invites
            ALTER COLUMN role SET DEFAULT 'CONTRIBUTOR'::hive_member_role`
  console.log('✓ hive_member_role enum collapsed to 4 values')

  // 7. Create hive_activity_type enum + hive_activity table
  await sql`DO $$ BEGIN
              CREATE TYPE hive_activity_type AS ENUM (
                'chapter_submitted','chapter_submitted_approved','chapter_submitted_rejected',
                'annotation_added','suggestion_proposed','suggestion_accepted','suggestion_rejected',
                'buzz_posted','discussion_posted','member_joined'
              );
            EXCEPTION WHEN duplicate_object THEN null; END $$`
  await sql`CREATE TABLE IF NOT EXISTS hive_activity (
              id text PRIMARY KEY,
              hive_id text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
              actor_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              type hive_activity_type NOT NULL,
              subject_id text,
              payload jsonb,
              created_at timestamp NOT NULL DEFAULT now()
            )`
  await sql`CREATE INDEX IF NOT EXISTS hive_activity_hive_id_created_at_idx
            ON hive_activity(hive_id, created_at DESC)`
  console.log('✓ hive_activity table created')

  // 8. Final counts
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM hives) AS hives_total,
      (SELECT COUNT(*) FROM hives WHERE book_id IS NOT NULL) AS hives_with_book,
      (SELECT COUNT(*) FROM hives WHERE book_id IS NULL) AS hives_standalone,
      (SELECT COUNT(*) FROM hive_members WHERE role = 'OWNER') AS owners,
      (SELECT COUNT(*) FROM hive_members WHERE role = 'MODERATOR') AS mods,
      (SELECT COUNT(*) FROM hive_members WHERE role = 'CONTRIBUTOR') AS contribs,
      (SELECT COUNT(*) FROM hive_members WHERE role = 'BETA_READER') AS betas
  `
  console.log('Final counts:', counts[0])
  console.log('H1 migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
