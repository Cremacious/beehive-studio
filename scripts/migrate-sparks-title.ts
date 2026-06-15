import 'dotenv/config'
import { db } from '../db'
import { sparks } from '../db/schema/social'
import { eq } from 'drizzle-orm'

// Safety: refuse on production-y DB.
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSED: NODE_ENV=production.')
  process.exit(1)
}
const dbUrl = process.env.DATABASE_URL ?? ''
if (/prod|production|live/i.test(dbUrl)) {
  console.error('REFUSED: DATABASE_URL looks production-y.')
  process.exit(1)
}
if (!dbUrl) {
  console.error('REFUSED: DATABASE_URL not set.')
  process.exit(1)
}

async function main() {
  console.log('→ Migrating sparks: title → prompt + truncate title…')
  const all = await db.select().from(sparks)
  let migrated = 0
  for (const s of all) {
    if (s.prompt && s.prompt.length > 0) continue   // already migrated
    const promptText = s.title
    const newTitle = s.title.length <= 60
      ? s.title
      : s.title.slice(0, 49).trimEnd() + '…'
    await db.update(sparks)
      .set({ prompt: promptText, title: newTitle })
      .where(eq(sparks.id, s.id))
    const previewIn = promptText.slice(0, 50) + (promptText.length > 50 ? '…' : '')
    console.log(`  ${s.id}: "${previewIn}" → title="${newTitle}"`)
    migrated++
  }
  console.log(`✓ Migrated ${migrated} of ${all.length} sparks.`)
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
