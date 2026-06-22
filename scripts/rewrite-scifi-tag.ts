import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  const rows = await sql`
    UPDATE reading_lists
    SET tags = ARRAY(SELECT REPLACE(t, 'sci-fi', 'scifi') FROM UNNEST(tags) AS t)
    WHERE 'sci-fi' = ANY(tags)
    RETURNING id, title, tags
  `
  console.log(`Rewrote ${rows.length} row(s):`)
  for (const r of rows) {
    console.log(`  - ${r.id} "${r.title}": ${JSON.stringify(r.tags)}`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
