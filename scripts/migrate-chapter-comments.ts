/**
 * One-shot migration: chapter_comments table.
 * Mirrors book_comments shape but scoped to a single chapter.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-chapter-comments.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  const sql = neon(process.env.DATABASE_URL)

  console.log('Creating chapter_comments...')
  await sql`
    CREATE TABLE IF NOT EXISTS chapter_comments (
      id text PRIMARY KEY,
      chapter_id text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content text NOT NULL,
      parent_id text REFERENCES chapter_comments(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS chapter_comments_chapter_id_idx ON chapter_comments (chapter_id)`

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM chapter_comments` as unknown as { n: number }[]
  console.log(`✓ chapter_comments rows=${n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
