/**
 * One-shot migration for H3 (Collaboration Core):
 *  1. Create new enums (annotation_layer, discussion_topic).
 *  2. Rename hive_comments → hive_annotations and extend (selection_*, layer, parent_id,
 *     selected_text, resolved_by, resolved_at, indexes).
 *  3. Reshape hive_suggestions (drop original_text/suggested_text/diff; add range +
 *     threading + resolution).
 *  4. Reshape hive_submissions (drop chapter_id/status/reviewer_note; add title/content/
 *     word_count/target_chapter_order/draft_status + reviewer fields + draft_status CHECK).
 *  5. Add chapters.author_user_id.
 *  6. Add hive_discussion_posts.topic + topic_only_on_top_level CHECK.
 *  7. Drop hive_chapter_locks.
 *  8. Print counts.
 *
 * Idempotent via IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object / DROP CONSTRAINT IF EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-h3.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running H3 schema migration...')

  // 1. New enums (idempotent — wrap in DO $$ for duplicate_object swallow)
  await sql`DO $$ BEGIN
    CREATE TYPE annotation_layer AS ENUM ('GRAMMAR','PLOT','TONE','CONTINUITY','GENERAL');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE discussion_topic AS ENUM ('GENERAL','WORLDBUILDING','FEEDBACK','OFF_TOPIC');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ enums created')

  // 2. Rename hive_comments → hive_annotations, extend.
  //    Use information_schema lookups so each step is idempotent across re-runs.
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hive_comments')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hive_annotations') THEN
      ALTER TABLE hive_comments RENAME TO hive_annotations;
    END IF;
  END $$`
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hive_annotations' AND column_name='anchor_start') THEN
      ALTER TABLE hive_annotations RENAME COLUMN anchor_start TO selection_start;
    END IF;
  END $$`
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hive_annotations' AND column_name='anchor_end') THEN
      ALTER TABLE hive_annotations RENAME COLUMN anchor_end TO selection_end;
    END IF;
  END $$`
  // Coerce selection_* to integer if they came in as text from the legacy hive_comments shape.
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hive_annotations' AND column_name='selection_start' AND data_type='text') THEN
      ALTER TABLE hive_annotations
        ALTER COLUMN selection_start TYPE integer USING NULLIF(selection_start,'')::integer;
    END IF;
  END $$`
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hive_annotations' AND column_name='selection_end' AND data_type='text') THEN
      ALTER TABLE hive_annotations
        ALTER COLUMN selection_end TYPE integer USING NULLIF(selection_end,'')::integer;
    END IF;
  END $$`
  // Rename legacy `content` → `body` so it matches the new drizzle column name.
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hive_annotations' AND column_name='content')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hive_annotations' AND column_name='body') THEN
      ALTER TABLE hive_annotations RENAME COLUMN content TO body;
    END IF;
  END $$`
  // Legacy `resolved` column was a timestamp; new schema has resolved boolean + resolved_at timestamp.
  // Migrate: rename old resolved → resolved_at if it's a timestamp, then add boolean resolved.
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hive_annotations' AND column_name='resolved'
               AND data_type IN ('timestamp without time zone','timestamp with time zone'))
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='hive_annotations' AND column_name='resolved_at') THEN
      ALTER TABLE hive_annotations RENAME COLUMN resolved TO resolved_at;
    END IF;
  END $$`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS resolved_at timestamp`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false`
  // If the old timestamp form was kept as resolved_at, backfill the boolean from it.
  await sql`UPDATE hive_annotations SET resolved = true WHERE resolved_at IS NOT NULL AND resolved = false`

  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS layer annotation_layer NOT NULL DEFAULT 'GENERAL'`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS parent_id text REFERENCES hive_annotations(id) ON DELETE CASCADE`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS selected_text text`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES users(id)`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW()`
  await sql`CREATE INDEX IF NOT EXISTS hive_annotations_chapter_id_idx ON hive_annotations(chapter_id)`
  await sql`CREATE INDEX IF NOT EXISTS hive_annotations_parent_id_idx ON hive_annotations(parent_id)`
  // Drop the old chapter index from hive_comments if it lingered.
  await sql`DROP INDEX IF EXISTS hive_comments_chapter_id_idx`
  console.log('✓ hive_annotations renamed + extended')

  // 3. Reshape hive_suggestions
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS original_text`
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS suggested_text`
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS diff`
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS status`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS selection_start integer`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS selection_end integer`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS original_excerpt text`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS suggested_text text`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS body text`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS parent_id text REFERENCES hive_suggestions(id) ON DELETE CASCADE`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES users(id)`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS resolved_at timestamp`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS accepted_at timestamp`
  await sql`ALTER TABLE hive_suggestions ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW()`

  // Backfill legacy rows (degenerate but preserve for inspection)
  await sql`UPDATE hive_suggestions
            SET selection_start = COALESCE(selection_start, 0),
                selection_end   = COALESCE(selection_end, 0),
                original_excerpt = COALESCE(original_excerpt, ''),
                suggested_text   = COALESCE(suggested_text, '')`

  // Now enforce NOT NULL on the range + text columns
  await sql`ALTER TABLE hive_suggestions ALTER COLUMN selection_start SET NOT NULL`
  await sql`ALTER TABLE hive_suggestions ALTER COLUMN selection_end   SET NOT NULL`
  await sql`ALTER TABLE hive_suggestions ALTER COLUMN original_excerpt SET NOT NULL`
  await sql`ALTER TABLE hive_suggestions ALTER COLUMN suggested_text   SET NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS hive_suggestions_chapter_id_idx ON hive_suggestions(chapter_id)`
  await sql`CREATE INDEX IF NOT EXISTS hive_suggestions_parent_id_idx ON hive_suggestions(parent_id)`
  console.log('✓ hive_suggestions reshaped')

  // 4. Reshape hive_submissions
  //    First add new columns (idempotent), backfill, then drop old.
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE CASCADE`
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hive_submissions' AND column_name='submitter_id') THEN
      UPDATE hive_submissions SET user_id = submitter_id WHERE user_id IS NULL AND submitter_id IS NOT NULL;
    END IF;
  END $$`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT ''`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS target_chapter_order integer`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS draft_status text NOT NULL DEFAULT 'DRAFT'`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS created_chapter_id text REFERENCES chapters(id) ON DELETE SET NULL`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS reviewed_by text REFERENCES users(id)`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS reviewed_at timestamp`
  await sql`ALTER TABLE hive_submissions ADD COLUMN IF NOT EXISTS review_note text`

  // Map legacy status → draft_status (if old status column still exists)
  await sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hive_submissions' AND column_name='status') THEN
      UPDATE hive_submissions
      SET draft_status = COALESCE(status::text, 'DRAFT'),
          title = COALESCE(NULLIF(title,''), 'Imported submission')
      WHERE draft_status = 'DRAFT' AND status IS NOT NULL;
    END IF;
  END $$`

  await sql`ALTER TABLE hive_submissions DROP COLUMN IF EXISTS chapter_id`
  await sql`ALTER TABLE hive_submissions DROP COLUMN IF EXISTS status`
  await sql`ALTER TABLE hive_submissions DROP COLUMN IF EXISTS reviewer_note`
  await sql`ALTER TABLE hive_submissions DROP COLUMN IF EXISTS submitter_id`

  // Now that user_id is backfilled, enforce NOT NULL.
  await sql`ALTER TABLE hive_submissions ALTER COLUMN user_id SET NOT NULL`

  // draft_status CHECK
  await sql`ALTER TABLE hive_submissions DROP CONSTRAINT IF EXISTS draft_status_check`
  await sql`ALTER TABLE hive_submissions
            ADD CONSTRAINT draft_status_check
            CHECK (draft_status IN ('DRAFT','PENDING','APPROVED','REJECTED'))`
  await sql`CREATE INDEX IF NOT EXISTS hive_submissions_hive_id_idx ON hive_submissions(hive_id)`
  await sql`CREATE INDEX IF NOT EXISTS hive_submissions_user_id_idx ON hive_submissions(user_id)`
  // Drop stale chapter-id index left over from prior shape.
  await sql`DROP INDEX IF EXISTS hive_submissions_chapter_id_idx`
  console.log('✓ hive_submissions reshaped')

  // 5. chapters.author_user_id
  await sql`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS author_user_id text REFERENCES users(id) ON DELETE SET NULL`
  console.log('✓ chapters.author_user_id added')

  // 6. hive_discussion_posts.topic + CHECK (backfill GENERAL on top-level BEFORE CHECK).
  await sql`ALTER TABLE hive_discussion_posts ADD COLUMN IF NOT EXISTS topic discussion_topic`
  await sql`UPDATE hive_discussion_posts SET topic = 'GENERAL' WHERE parent_id IS NULL AND topic IS NULL`
  await sql`ALTER TABLE hive_discussion_posts DROP CONSTRAINT IF EXISTS topic_only_on_top_level`
  await sql`ALTER TABLE hive_discussion_posts
            ADD CONSTRAINT topic_only_on_top_level
            CHECK ((parent_id IS NULL AND topic IS NOT NULL)
                OR (parent_id IS NOT NULL AND topic IS NULL))`
  console.log('✓ hive_discussion_posts.topic added with CHECK')

  // 7. Drop hive_chapter_locks
  await sql`DROP TABLE IF EXISTS hive_chapter_locks`
  console.log('✓ hive_chapter_locks dropped')

  // 8. Counts
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM hive_annotations) AS annotations,
      (SELECT COUNT(*) FROM hive_suggestions) AS suggestions,
      (SELECT COUNT(*) FROM hive_submissions) AS submissions,
      (SELECT COUNT(*) FROM hive_discussion_posts) AS discussion_posts,
      (SELECT COUNT(*) FROM chapters WHERE author_user_id IS NOT NULL) AS attributed_chapters
  `
  console.log('Final counts:', counts[0])
  console.log('H3 migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
