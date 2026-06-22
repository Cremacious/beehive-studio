/**
 * Issue #22 audit: scan reading_lists.tags for values containing characters
 * the new Zod schema now rejects (, - / +). Reports occurrences without
 * mutating — manual cleanup decision left to the operator since semantics
 * differ per tag.
 *
 * Run: npx dotenv -e .env.local -- tsx scripts/audit-list-tags.ts
 */
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Scanning reading_lists for tags containing , - / or +...')
  const rows = await sql`
    SELECT l.id, l.title, l.tags
    FROM reading_lists l
    WHERE EXISTS (
      SELECT 1 FROM UNNEST(l.tags) AS t
      WHERE t ~ '[,/+\\-]'
    )
  `
  if (rows.length === 0) {
    console.log('  ✓ No offending tags found.')
    return
  }
  console.log(`  Found ${rows.length} list(s) with offending tag(s):`)
  for (const r of rows) {
    const offenders = (r.tags as string[]).filter((t) => /[,/+\-]/.test(t))
    console.log(
      `    - list ${r.id} "${r.title}": ${JSON.stringify(offenders)} (full tags: ${JSON.stringify(r.tags)})`,
    )
  }
  console.log(
    '\n  No automatic rewrite — manual cleanup needed (the right replacement is per-tag).',
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
