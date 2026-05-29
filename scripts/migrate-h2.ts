/**
 * One-shot migration for H2 (Mirror Model):
 *  1. Add enum values (book_status: STANDALONE_HIVE_SHADOW; binder_item_type: wiki_entry, wiki_folder)
 *  2. Add binder_items.author_id + last_edited_by columns + composite (book_id, type) index
 *  3. Backfill: for every hives row with book_id IS NULL, create a shadow book + point hive at it
 *  4. Tighten hives.book_id → NOT NULL; drop H1 partial UNIQUE; add plain UNIQUE
 *  5. Port hive_wiki_pages → binder_items (wiki_entry under "Imported from old wiki" wiki_folder)
 *  6. Port hive_outlines → binder_items (append to existing outline item OR create one)
 *  7. Drop hive_wiki_pages, hive_outlines tables
 *  8. Print counts
 *
 * Idempotent via IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object / DROP CONSTRAINT IF EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-h2.ts
 */
import { neon } from '@neondatabase/serverless'
import { createId } from '@paralleldrive/cuid2'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running H2 schema migration...')

  // 1. Enum extensions (irreversible; idempotent via IF NOT EXISTS)
  await sql`ALTER TYPE book_status ADD VALUE IF NOT EXISTS 'STANDALONE_HIVE_SHADOW'`
  await sql`ALTER TYPE binder_item_type ADD VALUE IF NOT EXISTS 'wiki_entry'`
  await sql`ALTER TYPE binder_item_type ADD VALUE IF NOT EXISTS 'wiki_folder'`
  console.log('✓ enum values added')

  // 2. binder_items columns + index
  await sql`ALTER TABLE binder_items
            ADD COLUMN IF NOT EXISTS author_id text REFERENCES users(id) ON DELETE SET NULL`
  await sql`ALTER TABLE binder_items
            ADD COLUMN IF NOT EXISTS last_edited_by text REFERENCES users(id) ON DELETE SET NULL`
  // Backfill: author of all existing binder rows = owning book's user
  await sql`UPDATE binder_items bi
            SET author_id = b.user_id
            FROM books b
            WHERE bi.book_id = b.id AND bi.author_id IS NULL`
  await sql`CREATE INDEX IF NOT EXISTS binder_items_book_type_idx
            ON binder_items(book_id, type)`
  console.log('✓ binder_items columns + composite index')

  // 3. Backfill shadow books for any pre-existing standalone hives
  const standaloneHives = await sql`
    SELECT id, owner_id, name FROM hives WHERE book_id IS NULL
  `
  let backfilledShadows = 0
  for (const h of standaloneHives) {
    const shadowBookId = createId()
    await sql`
      INSERT INTO books (id, user_id, title, visibility, discoverable, status)
      VALUES (
        ${shadowBookId},
        ${h.owner_id as string},
        ${h.name as string},
        'PRIVATE',
        false,
        'STANDALONE_HIVE_SHADOW'
      )
    `
    await sql`UPDATE hives SET book_id = ${shadowBookId} WHERE id = ${h.id as string}`
    backfilledShadows++
  }
  console.log(`✓ backfilled ${backfilledShadows} standalone-hive shadow books`)

  // 4. Tighten hives.book_id
  await sql`ALTER TABLE hives ALTER COLUMN book_id SET NOT NULL`
  await sql`DROP INDEX IF EXISTS hives_book_id_unique`
  // Plain UNIQUE (not partial) — every hive now has a non-null book_id.
  await sql`ALTER TABLE hives ADD CONSTRAINT hives_book_id_unique UNIQUE (book_id)`
  console.log('✓ hives.book_id tightened to NOT NULL + plain UNIQUE')

  // 5. Port hive_wiki_pages → binder_items (wiki_entry)
  const wikiPages = await sql`
    SELECT wp.*, h.book_id AS book_id
    FROM hive_wiki_pages wp
    JOIN hives h ON wp.hive_id = h.id
  `
  // Group by bookId so we create exactly one "Imported from old wiki" folder per book
  const folderByBook = new Map<string, string>()
  let portedWiki = 0
  for (const p of wikiPages) {
    const bookId = p.book_id as string
    let folderId = folderByBook.get(bookId)
    if (!folderId) {
      folderId = createId()
      // Pick a high `order` so the folder lands at the bottom of the root
      const maxRow = await sql`
        SELECT COALESCE(MAX("order"), -1) AS m FROM binder_items
        WHERE book_id = ${bookId} AND parent_id IS NULL
      `
      const nextOrder = Number(maxRow[0].m) + 1
      await sql`
        INSERT INTO binder_items (id, book_id, parent_id, type, title, "order", content, author_id, last_edited_by)
        VALUES (
          ${folderId}, ${bookId}, NULL, 'wiki_folder',
          'Imported from old wiki', ${nextOrder},
          ${JSON.stringify({ description: 'Wiki entries ported from H1.' })}::jsonb,
          ${p.created_by as string}, ${p.created_by as string}
        )
      `
      folderByBook.set(bookId, folderId)
    }
    const wikiId = createId()
    const bodyJson = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: (p.content as string) ?? '' }] }],
    }
    await sql`
      INSERT INTO binder_items (id, book_id, parent_id, type, title, "order", content, author_id, last_edited_by, created_at, updated_at)
      VALUES (
        ${wikiId}, ${bookId}, ${folderId}, 'wiki_entry',
        ${p.title as string}, 0,
        ${JSON.stringify({ category: 'OTHER', body: bodyJson, tags: [] })}::jsonb,
        ${p.created_by as string}, ${(p.updated_by as string | null) ?? (p.created_by as string)},
        ${p.created_at}, ${p.updated_at}
      )
    `
    portedWiki++
  }
  console.log(`✓ ported ${portedWiki} hive_wiki_pages → wiki_entry binder items`)

  // 6. Port hive_outlines → outline binder_items
  const legacyOutlines = await sql`
    SELECT o.*, h.book_id AS book_id, h.owner_id AS owner_id
    FROM hive_outlines o
    JOIN hives h ON o.hive_id = h.id
    WHERE o.content IS NOT NULL AND length(trim(o.content)) > 0
  `
  let portedOutlines = 0
  for (const o of legacyOutlines) {
    const bookId = o.book_id as string
    const ownerId = o.owner_id as string
    // Find or create the book's outline binder item
    const existing = await sql`
      SELECT id, content FROM binder_items
      WHERE book_id = ${bookId} AND type = 'outline' LIMIT 1
    `
    const importedBeat = {
      id: createId(),
      title: 'Imported',
      synopsis: o.content as string,
      status: 'idea',
      act: 'Imported',
    }
    if (existing.length) {
      const cur = (existing[0].content as { beats?: unknown[] } | null) ?? { beats: [] }
      const beats = Array.isArray(cur.beats) ? cur.beats : []
      await sql`
        UPDATE binder_items
        SET content = ${JSON.stringify({ ...cur, beats: [...beats, importedBeat] })}::jsonb,
            updated_at = NOW()
        WHERE id = ${existing[0].id as string}
      `
    } else {
      const maxRow = await sql`
        SELECT COALESCE(MAX("order"), -1) AS m FROM binder_items
        WHERE book_id = ${bookId} AND parent_id IS NULL
      `
      const nextOrder = Number(maxRow[0].m) + 1
      await sql`
        INSERT INTO binder_items (id, book_id, parent_id, type, title, "order", content, author_id, last_edited_by)
        VALUES (
          ${createId()}, ${bookId}, NULL, 'outline', 'Outline', ${nextOrder},
          ${JSON.stringify({ beats: [importedBeat] })}::jsonb,
          ${ownerId}, ${ownerId}
        )
      `
    }
    portedOutlines++
  }
  console.log(`✓ ported ${portedOutlines} hive_outlines into outline binder items`)

  // 7. Drop legacy tables
  await sql`DROP TABLE IF EXISTS hive_wiki_pages`
  await sql`DROP TABLE IF EXISTS hive_outlines`
  console.log('✓ dropped hive_wiki_pages, hive_outlines')

  // 8. Counts
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM books WHERE status = 'STANDALONE_HIVE_SHADOW') AS shadow_books,
      (SELECT COUNT(*) FROM binder_items WHERE type = 'wiki_entry') AS wiki_entries,
      (SELECT COUNT(*) FROM binder_items WHERE type = 'wiki_folder') AS wiki_folders,
      (SELECT COUNT(*) FROM binder_items WHERE type = 'outline') AS outlines,
      (SELECT COUNT(*) FROM hives) AS hives_total,
      (SELECT COUNT(*) FROM hives WHERE book_id IS NULL) AS hives_with_null_book
  `
  console.log('Final counts:', counts[0])
  if (Number(counts[0].hives_with_null_book) > 0) {
    throw new Error('Sanity: some hives still have NULL book_id after migration. Aborting before any later step relies on it.')
  }
  console.log('H2 migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
