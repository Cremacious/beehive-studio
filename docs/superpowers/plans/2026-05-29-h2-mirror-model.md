# H2 — Mirror Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H2 of 5 (Hives redesign)
**Predecessor:** H1 Foundation (shipped `b12f3f4`)
**Successors:** H3 Collaboration, H4 Motivation, H5 Dashboard

**Goal:** Make the hive wiki / outline / notes BE the editor binder. One canonical row in `binderItems`; the editor and the hive UI are both views. Add the 14 wiki categories with per-category templates and tags. Extend outline beats with optional act grouping. Replace standalone-hive nullable-bookId with invisible shadow `books` rows so the model is uniform. Wire role-based binder write permission so BETA_READER is read-only and CONTRIBUTOR+ can edit wiki/outline/notes; chapters / parts / front-matter / back-matter stay author-only (H3 owns the submission flow).

**Spec:** [`docs/superpowers/specs/2026-05-29-h2-mirror-model-design.md`](../specs/2026-05-29-h2-mirror-model-design.md)
**Reference precedent (tone, granularity, code-shape inclusion):** [`docs/superpowers/plans/2026-05-29-h1-hive-foundation.md`](2026-05-29-h1-hive-foundation.md)

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (Neon Postgres), Tailwind v4, vitest. IDs are `text` (cuid2). Migrations run via a one-shot tsx script per AGENTS.md (drizzle-kit push needs TTY).

---

## Pre-flight Findings

Verified by direct reads + grep against `main` at HEAD = `b12f3f4`.

- **`db/schema/hive.ts`** still defines `hiveOutlines` (lines 85–91) and `hiveWikiPages` (93–102) tables, plus their relations (166–173). The spec drops both. Confirmed they exist to be dropped.
- **`hives.bookId`** is currently nullable + has the partial UNIQUE index `hives_book_id_unique ... WHERE book_id IS NOT NULL` (lines 17, 26–29). FK is already CASCADE (good — no FK change needed). H2 tightens to plain UNIQUE + NOT NULL after the shadow-book backfill.
- **`db/schema/books.ts:7`** — `bookStatusEnum = pgEnum('book_status', ['DRAFT', 'PUBLISHED'])`. H2 adds `STANDALONE_HIVE_SHADOW`.
- **`db/schema/books.ts:9-12`** — `binderItemTypeEnum` currently 8 values. H2 adds `wiki_entry`, `wiki_folder`.
- **`binderItems`** already has `book_id_idx` and `parent_id_idx` (line 62). H2 adds `(book_id, type)` composite index.
- **`lib/hive/permissions.ts`** already exports `canEditWiki` and `canEditOutline` predicates (lines 33, 38). H2 extends with `requireBinderWritePermission(bookId, binderItemId, userId)` — adds rather than replaces.
- **`lib/actions/binder.actions.ts`** uses `assertBookOwner` (line 124) and a local `assertBinderOwner` helper (37–53) on all four write actions (`createBinderItemAction`, `updateBinderItemAction`, `deleteBinderItemAction`, `reorderBinderItemsAction`). All four will be migrated to `requireBinderWritePermission`. `getBinderTreeAction` projection (lines 87–99) does NOT currently include `content.category / content.tags / authorId` — these need to be added but they live INSIDE `content` jsonb, so the projection just needs to expose `content` and the consumer pulls them — confirm during implementation whether a dedicated `authorId` column needs to be added (none currently exists on `binderItems`; "author" was implicit = book owner). **The spec asks for `authorId` in the projection but `binderItems` has no `authorId` column.** Treat as a Plan Pre-flight Note (see callout under Task 7).
- **`lib/actions/hive-content.actions.ts`** is where the legacy wiki/outline actions live (and also discussion + tasks actions — DO NOT touch those; only the wiki/outline halves are deleted). Confirmed callers via grep: zero callers in `app/` for `getWikiPagesAction|createWikiPageAction|getWikiPageAction|saveWikiPageAction|deleteWikiPageAction|getHiveOutlineAction|saveHiveOutlineAction`. Only the actions file itself references them. Deletion is safe.
- **H1 hive stubs** at `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx` and `outline/page.tsx` are 5-line `<ComingSoon>` placeholders. They're being replaced wholesale — no logic to preserve.
- **`books.userId` query sites** (grep confirmed):
  - `lib/actions/book.actions.ts:51` (getActiveBookCount)
  - `lib/actions/book.actions.ts:225` (getUserBooksAction)
  - `lib/actions/book.actions.ts:306` (getStudioStatsAction)
  - `lib/actions/book.actions.ts:321` (booksInProgress sub-query)
  - `lib/actions/book.actions.ts:370` (getBookAction — single-book lookup, NOT scoped because user might be opening a shadow book directly; but `/studio/[bookId]/page.tsx` should refuse shadow books — see Task 2 §2)
  - `lib/actions/book.actions.ts:462` (deleteBookAction)
  - `lib/actions/_helpers.ts:8` (`assertBookOwner` — used everywhere; do NOT change semantics, but it accidentally allows shadow-book access; flag in plan)
  - `lib/actions/community.actions.ts` (any `eq(books.userId, X)` — verify)
  - `lib/actions/user-profile.actions.ts:112, 116, 189` (`getUserProfileAction` published-books queries — these are scoped by `status='PUBLISHED'` so naturally exclude shadow books; verify)
  - `lib/actions/discover.actions.ts` (verify)
  - `lib/billing/book-overflow.ts:24` (overflow active-book count — must exclude shadows)
  - `lib/books/get-series-neighbors.ts` (same-author neighbor query — must exclude shadows)
  - `lib/actions/hive.actions.ts:69` (createHive book ownership check — keep raw, intentional)
  - `app/api/export/[bookId]/[format]/route.ts:105` (export route — shadow books shouldn't be exportable; refuse)
- **Existing `lib/books/scoped.ts`** does NOT exist (verified via `ls`). New file in Task 2.
- **Outline editor file** is `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` (NOT `outline-editor.tsx` as the brief speculated). `readBeats()` translator lives in this file (lines 53–60+). Act grouping additions go here (Task 13).
- **Chapter-editor render-branch** lives at `_components/editor/chapter-editor.tsx` lines 240–267. Routes 7 types today: `front_matter`/`back_matter` (via `shouldUseFrontBackMatterRenderer`), `outline` → `<OutlineBoard>`, `research_note` → `<NoteEditor>`, `character` → `<CharacterProfile>`, `part`/`research_folder` → `<ContainerView>`. H2 adds `wiki_entry` → `<WikiEntryEditor>` and `wiki_folder` → `<WikiFolderRenderer>`.
- **Binder "+ Add" menu** lives at `_components/binder/binder-add-menu.tsx` and currently has two sections: `MANUSCRIPT_OPTIONS` (4 items) and `RESEARCH_OPTIONS` (4 items). H2 regroups into three sections per spec.
- **Live `hive_member_role` enum is `OWNER / MODERATOR / CONTRIBUTOR / BETA_READER`** (confirmed `db/schema/hive.ts:9`). The H1 plan text said READER but the live schema uses BETA_READER. **The H2 plan reflects BETA_READER everywhere — schema is source of truth.**
- **Migration runner precedent:** `scripts/migrate-h1.ts` (idempotent via `IF NOT EXISTS` + `DO $$ EXCEPTION WHEN duplicate_object`). H2's runner follows the same shape. The spec proposes `scripts/db/apply-h2-migration.ts` — we keep the existing `scripts/migrate-XX.ts` flat-directory pattern for consistency with `migrate-h1.ts` (the only other migration script in the repo). Final path: `scripts/migrate-h2.ts`.

### Plan Pre-flight Note A — `authorId` on binder items

The spec ([line 281](../specs/2026-05-29-h2-mirror-model-design.md)) asks `getBinderTreeAction`'s projection to include `authorId` so hive-side views can render "Created by @x". **But `binderItems` has no `authorId` column today.** Options:

1. Add `binderItems.authorId text references users(id) on delete set null` in the H2 migration, defaulting to the book's `userId` on backfill; new rows pick it up from the creator.
2. Defer: derive "author" = book's `userId` on the render side until H3 (where per-row authorship matters more).

**Recommendation (carried into Task 1):** Option 1 — add the column now. It's cheap, and the hive Wiki view needs "Last edited by @x" + "Created by @x" lines. Surfaced as part of T1 migration; also add `lastEditedBy` to support the per-entry header line cleanly.

### Plan Pre-flight Note B — `book_status` enum and existing readers

`bookStatusEnum` is referenced as a string union `'DRAFT' | 'PUBLISHED'` in ~20 places. Adding `STANDALONE_HIVE_SHADOW` will TS-error every exhaustive `switch` / discriminated union narrowing until those sites either (a) handle the new value or (b) get filtered out by `scopedBooksForUser`. Strategy: do the enum add first (Task 1), then the `scopedBooksForUser` codemod (Task 2). Between those two tasks tsc may complain — that's intentional. The Task 2 commit is the one that ends with tsc clean.

### Plan Pre-flight Note C — Spec asks for `requireBinderWritePermission` import path

The spec lives in `lib/hive/permissions.ts`. H1's `permissions.ts` is a 41-line file of pure helpers. Putting an async DB-dependent helper next to pure predicates is the existing convention (the file already has `requireHiveMember` / `requireHiveMod` / `requireHiveOwner` as async helpers at the top). Keep convention: append `requireBinderWritePermission` to the same file.

---

## Task Index

1. Schema migration — enum extensions, shadow-book backfill, FK tightening, port legacy rows, drop legacy tables, indexes.
2. `scopedBooksForUser` helper + codemod sweep (~12 call sites).
3. Category templates module (`lib/wiki/category-templates.ts`) — 14 templates.
4. Permission helper extension (`requireBinderWritePermission`) + 50-case truth table tests.
5. Tag-handling pure helpers (`normalizeTags`) + unit tests.
6. Outline act-grouping pure helper (`groupBeatsByAct`) + unit tests.
7. Wire `requireBinderWritePermission` into the four binder write actions; extend `getBinderTreeAction` projection.
8. `createHiveAction` reshape — standalone path creates a shadow book first.
9. New hive content views (`getHiveWikiView`, `getHiveOutlineView`, `getHiveNotesView`) in `lib/actions/hive-content.actions.ts`.
10. Delete legacy hive content actions + drop relations + remove dropped-table imports.
11. Binder "+ Add" menu — grouped three-section layout + 14-card category picker modal for Wiki Entry.
12. `WikiEntryEditor` renderer + chapter-editor render-branch hookup.
13. `WikiFolderRenderer` renderer + chapter-editor render-branch hookup.
14. Outline editor — per-act header strip + render-time grouping + cross-act drag.
15. Character profile — tag chip strip under name header (reuse shared `TagChipStrip`).
16. `/hive/[hiveId]/wiki` page — full implementation (header search, view-mode toggle, By Category / By Folder / Notes, `HiveWikiEntryEditor` wrapper, role gating).
17. `/hive/[hiveId]/outline` page — full implementation wrapping `OutlineBoard` in `HiveOutlineSurface` chrome.
18. AGENTS.md update + final ship commit.

---

### Task 1: Schema migration + shadow-book backfill + drop legacy tables

**Files:**
- Modify: `db/schema/books.ts` (add `STANDALONE_HIVE_SHADOW` to `bookStatusEnum`; add `wiki_entry` / `wiki_folder` to `binderItemTypeEnum`; add `authorId` + `lastEditedBy` columns to `binderItems`; add `(book_id, type)` composite index).
- Modify: `db/schema/hive.ts` — remove `hiveOutlines`, `hiveWikiPages` tables + their relations; tighten `hives.bookId` to NOT NULL in the drizzle definition.
- Create: `scripts/migrate-h2.ts`.

- [ ] **Step 1: Drizzle schema updates** (`db/schema/books.ts`)

```ts
export const bookStatusEnum = pgEnum('book_status', ['DRAFT', 'PUBLISHED', 'STANDALONE_HIVE_SHADOW'])

export const binderItemTypeEnum = pgEnum('binder_item_type', [
  'part', 'chapter', 'front_matter', 'back_matter',
  'research_folder', 'research_note', 'character', 'outline',
  'wiki_entry', 'wiki_folder',
])

export const binderItems = pgTable('binder_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): AnyPgColumn => binderItems.id, { onDelete: 'set null' }),
  type: binderItemTypeEnum('type').notNull(),
  title: text('title').notNull(),
  order: integer('order').default(0).notNull(),
  content: jsonb('content'),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),       // NEW
  lastEditedBy: text('last_edited_by').references(() => users.id, { onDelete: 'set null' }), // NEW
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('binder_items_book_id_idx').on(t.bookId),
  index('binder_items_parent_id_idx').on(t.parentId),
  index('binder_items_book_type_idx').on(t.bookId, t.type),  // NEW (H2)
])
```

- [ ] **Step 2: Drizzle schema updates** (`db/schema/hive.ts`)

- Delete `hiveOutlines`, `hiveWikiPages` tables (lines 85–102) AND their relations blocks (`hiveOutlinesRelations`, `hiveWikiPagesRelations` at 166–173).
- Tighten the `hives.bookId` column to NOT NULL:

```ts
bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
```

- Replace partial `uniqueIndex(...)` with plain unique on the column:

```ts
}, (t) => [
  uniqueIndex('hives_book_id_unique').on(t.bookId),
])
```

- Remove the H1 comment at lines 27–28 about "H2 will tighten" — H2 is now landing it.

- [ ] **Step 3: Migration runner** (`scripts/migrate-h2.ts`)

```ts
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
```

- [ ] **Step 4: Run + tsc check**

```bash
npx dotenv -e .env.local -- tsx scripts/migrate-h2.ts
npx tsc --noEmit
```

Expect: 8 ✓ lines, final counts printed, no `hives_with_null_book` mismatch. tsc may temporarily flag exhaustive switches on `book_status` — those are fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add db/schema/books.ts db/schema/hive.ts scripts/migrate-h2.ts
git commit -m "feat(hive): H2 T1 — schema migration, shadow-book backfill, drop legacy hive content tables"
```

---

### Task 2: `scopedBooksForUser` helper + codemod sweep

**Files:**
- Create: `lib/books/scoped.ts`
- Modify: `lib/actions/book.actions.ts` (5 sites: lines 51, 225, 306, 321, 462)
- Modify: `lib/billing/book-overflow.ts` (line 24)
- Modify: `lib/books/get-series-neighbors.ts` (same-author query)
- Modify: `lib/actions/community.actions.ts` (verify call sites)
- Modify: `lib/actions/discover.actions.ts` (verify call sites — discover already filters `discoverable=true AND visibility='PUBLIC'`, so shadows are already excluded; codemod for consistency)
- Modify: `app/api/export/[bookId]/[format]/route.ts:105` (single-book lookup — replace with `getOwnedBookOrNull(bookId, userId)`)
- Modify: `lib/actions/_helpers.ts:8` (`assertBookOwner` — exclude shadows OR add a sibling `assertOwnedNonShadowBook`)

**Do NOT modify (intentional):**
- `lib/actions/hive.actions.ts:69` — `createHiveAction`'s ownership check on a `bookId` provided by the user; shadow books can never be linked here (the standalone path creates its own; the linked-book path requires `bookId` to be a real book). Add an `ne(books.status, 'STANDALONE_HIVE_SHADOW')` to be defensive but leave logic intact.
- `lib/actions/user-profile.actions.ts:112, 116, 189` — already filters `books.status = 'PUBLISHED'`, which excludes shadows. Leave but add a comment.

- [ ] **Step 1: Write the helper**

```ts
// lib/books/scoped.ts
import { db } from '@/db'
import { books } from '@/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'

/**
 * Builds a `WHERE` fragment matching the user's non-shadow books.
 * Pair with any `select().from(books).where(scopedBooksForUser(userId))`.
 *
 * H2 introduced `STANDALONE_HIVE_SHADOW` books — invisible carriers that back
 * standalone hives. Every /studio surface filters them OUT via this helper.
 * The only places that should NOT use it are the hive resolution paths
 * (where the shadow is the load-bearing row).
 */
export function scopedBooksForUser(userId: string) {
  return and(eq(books.userId, userId), ne(books.status, 'STANDALONE_HIVE_SHADOW'))
}

/** Same as `scopedBooksForUser` but as a raw SQL fragment, for compose-into-CTE cases. */
export const scopedBooksForUserSql = (userId: string) =>
  sql`${books.userId} = ${userId} AND ${books.status} != 'STANDALONE_HIVE_SHADOW'`
```

- [ ] **Step 2: Codemod each call site**

For each site listed in Files above, replace:

```ts
.where(eq(books.userId, userId))
// →
.where(scopedBooksForUser(userId))
```

```ts
.where(and(eq(books.userId, userId), <other>))
// →
.where(and(scopedBooksForUser(userId), <other>))
```

```ts
where: and(eq(books.id, bookId), eq(books.userId, userId)),
// → (for the single-book case where we still want to allow ID match)
where: and(eq(books.id, bookId), scopedBooksForUser(userId)),
```

`assertBookOwner` becomes:

```ts
export async function assertBookOwner(bookId: string, userId: string) {
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), scopedBooksForUser(userId)),
    columns: { id: true },
  })
  if (!book) throw new Error('Book not found or access denied')
}
```

This is the CRUCIAL site: it means hitting `/studio/<shadow-book-id>` returns "Book not found" rather than rendering a fake editor.

- [ ] **Step 3: Manual grep verification**

```bash
grep -rn "eq(books.userId" lib/ app/ --include="*.ts"
```

Expect: only the intentional sites listed under "Do NOT modify" remain. If anything else surfaces, codemod or document why it stays.

- [ ] **Step 4: tsc + run binder + book tests**

`npx tsc --noEmit && npm test` — clean. Existing book / binder / billing tests still pass (the helper is semantically equivalent for pre-H2 data because no shadow books exist outside the backfill).

- [ ] **Step 5: Commit**

```bash
git add lib/books/scoped.ts lib/actions/ lib/billing/ lib/books/get-series-neighbors.ts app/api/export/
git commit -m "feat(hive): H2 T2 — scopedBooksForUser helper + codemod studio queries to exclude shadow books"
```

---

### Task 3: Category templates module

**Files:**
- Create: `lib/wiki/category-templates.ts`
- Create: `lib/wiki/__tests__/category-templates.test.ts`

The 14 categories with icons (lucide), brief, accent color CSS var (added to `app/globals.css` :root in this task), and a per-category `defaultBody` TipTap JSON skeleton (heading + brief bullet/intro that primes the user).

- [ ] **Step 1: Add accent color CSS vars to `globals.css` `:root`**

```css
/* Wiki category accents (oklch — match DP1 token system) */
--wiki-character:   oklch(0.74 0.13 80);   /* warm gold */
--wiki-location:    oklch(0.72 0.12 165);  /* teal */
--wiki-lore:        oklch(0.70 0.13 290);  /* violet */
--wiki-plot:        oklch(0.72 0.16 25);   /* warm red */
--wiki-artifact:    oklch(0.78 0.10 65);   /* amber */
--wiki-faction:     oklch(0.68 0.12 245);  /* steel blue */
--wiki-culture:     oklch(0.72 0.11 130);  /* sage */
--wiki-language:    oklch(0.70 0.10 200);  /* slate cyan */
--wiki-biology:     oklch(0.74 0.13 100);  /* leafy yellow-green */
--wiki-theme:       oklch(0.70 0.13 320);  /* magenta */
--wiki-economy:     oklch(0.74 0.11 55);   /* copper */
--wiki-terminology: oklch(0.68 0.05 270);  /* lavender gray */
--wiki-timeline:    oklch(0.74 0.10 180);  /* aqua */
--wiki-other:       oklch(0.68 0.04 270);  /* neutral */
```

- [ ] **Step 2: Module file**

```ts
// lib/wiki/category-templates.ts
import {
  User, MapPin, ScrollText, Drama, Sword,
  Flag, Globe, Languages, Leaf, Sparkles,
  Coins, BookA, Clock, FileQuestion,
  type LucideIcon,
} from 'lucide-react'

export type WikiCategory =
  | 'CHARACTER' | 'LOCATION' | 'LORE' | 'PLOT' | 'ARTIFACT'
  | 'FACTION' | 'CULTURE' | 'LANGUAGE' | 'BIOLOGY' | 'THEME'
  | 'ECONOMY' | 'TERMINOLOGY' | 'TIMELINE' | 'OTHER'

// TipTap JSON document fragment — minimal, opens with a heading + a hint line.
function doc(headings: Array<{ h2: string; hint: string }>): unknown {
  return {
    type: 'doc',
    content: headings.flatMap(({ h2, hint }) => [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: h2 }] },
      { type: 'paragraph', content: [{ type: 'text', text: hint }] },
    ]),
  }
}

export type CategoryTemplate = {
  category: WikiCategory
  label: string
  blurb: string
  icon: LucideIcon
  accentColor: string        // CSS variable name (without `var()` wrapper)
  defaultBody: unknown       // TipTap doc JSON
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  { category: 'CHARACTER',   label: 'Character',   blurb: 'A person — protagonist, antagonist, or supporting.',
    icon: User,          accentColor: '--wiki-character',
    defaultBody: doc([
      { h2: 'Appearance', hint: 'Physical description and notable features.' },
      { h2: 'Personality', hint: 'Temperament, beliefs, fears.' },
      { h2: 'Role in story', hint: 'What they want, what stands in their way.' },
    ]) },
  { category: 'LOCATION',    label: 'Location',    blurb: 'A place — city, region, dungeon, planet.',
    icon: MapPin,        accentColor: '--wiki-location',
    defaultBody: doc([
      { h2: 'Geography', hint: 'Where it sits in the world.' },
      { h2: 'Notable features', hint: 'What makes it visually or culturally distinct.' },
      { h2: 'Inhabitants', hint: 'Who lives here and why it matters.' },
    ]) },
  { category: 'LORE',        label: 'Lore',        blurb: 'A myth, legend, or historical event.',
    icon: ScrollText,    accentColor: '--wiki-lore',
    defaultBody: doc([
      { h2: 'Origin', hint: 'When and where this began.' },
      { h2: 'What is believed', hint: 'The popular version of the story.' },
      { h2: 'Truth', hint: 'What really happened (or what the narrator knows).' },
    ]) },
  { category: 'PLOT',        label: 'Plot thread', blurb: 'A storyline or arc you are tracking.',
    icon: Drama,         accentColor: '--wiki-plot',
    defaultBody: doc([
      { h2: 'Setup', hint: 'How and when this thread enters the story.' },
      { h2: 'Stakes', hint: 'What the protagonist stands to gain or lose.' },
      { h2: 'Payoff', hint: 'Where this thread resolves (or refuses to).' },
    ]) },
  { category: 'ARTIFACT',    label: 'Artifact',    blurb: 'An object — weapon, relic, technology.',
    icon: Sword,         accentColor: '--wiki-artifact',
    defaultBody: doc([
      { h2: 'Description', hint: 'Form, material, sensory presence.' },
      { h2: 'Powers / function', hint: 'What it does.' },
      { h2: 'History', hint: 'Where it came from and who has held it.' },
    ]) },
  { category: 'FACTION',     label: 'Faction',     blurb: 'A group, guild, nation, or organization.',
    icon: Flag,          accentColor: '--wiki-faction',
    defaultBody: doc([
      { h2: 'Mission', hint: 'What they want.' },
      { h2: 'Structure', hint: 'How they are organized; key figures.' },
      { h2: 'Allies & enemies', hint: 'Who they work with and against.' },
    ]) },
  { category: 'CULTURE',     label: 'Culture',     blurb: 'A people or society — customs, beliefs, daily life.',
    icon: Globe,         accentColor: '--wiki-culture',
    defaultBody: doc([
      { h2: 'Values', hint: 'What this culture holds sacred.' },
      { h2: 'Customs', hint: 'Daily rituals and milestones.' },
      { h2: 'Tensions', hint: 'Internal frictions or external pressures.' },
    ]) },
  { category: 'LANGUAGE',    label: 'Language',    blurb: 'A tongue, dialect, or constructed lexicon.',
    icon: Languages,     accentColor: '--wiki-language',
    defaultBody: doc([
      { h2: 'Phonology', hint: 'Sound and feel; how it is heard.' },
      { h2: 'Lexicon', hint: 'A starter list of words and phrases.' },
      { h2: 'Speakers', hint: 'Who uses this language and in what contexts.' },
    ]) },
  { category: 'BIOLOGY',     label: 'Biology / species', blurb: 'A creature, race, or organism.',
    icon: Leaf,          accentColor: '--wiki-biology',
    defaultBody: doc([
      { h2: 'Form', hint: 'Anatomy and lifecycle.' },
      { h2: 'Behavior', hint: 'Social structure, diet, conflict.' },
      { h2: 'Role in story', hint: 'How they intersect with the plot.' },
    ]) },
  { category: 'THEME',       label: 'Theme',       blurb: 'A motif or thematic question your book asks.',
    icon: Sparkles,      accentColor: '--wiki-theme',
    defaultBody: doc([
      { h2: 'The question', hint: 'One sentence framing.' },
      { h2: 'Where it appears', hint: 'Scenes / characters that carry it.' },
      { h2: 'The answer', hint: 'What the book argues, if anything.' },
    ]) },
  { category: 'ECONOMY',     label: 'Economy',     blurb: 'Trade, currency, resources, scarcity.',
    icon: Coins,         accentColor: '--wiki-economy',
    defaultBody: doc([
      { h2: 'Currency', hint: 'What is exchanged and how.' },
      { h2: 'Major trade', hint: 'Who produces what, who needs what.' },
      { h2: 'Friction', hint: 'Scarcities, monopolies, criminal economies.' },
    ]) },
  { category: 'TERMINOLOGY', label: 'Terminology', blurb: 'A glossary entry — slang, jargon, in-world term.',
    icon: BookA,         accentColor: '--wiki-terminology',
    defaultBody: doc([
      { h2: 'Definition', hint: 'Plain-English meaning.' },
      { h2: 'In-world usage', hint: 'Who uses it; example sentence.' },
    ]) },
  { category: 'TIMELINE',    label: 'Timeline',    blurb: 'A chronology — eras, decades, or beats.',
    icon: Clock,         accentColor: '--wiki-timeline',
    defaultBody: doc([
      { h2: 'Era', hint: 'Name and scope of this chunk of time.' },
      { h2: 'Key events', hint: 'Bulleted list of what happened.' },
      { h2: 'How it shapes today', hint: 'Why this matters to the present narrative.' },
    ]) },
  { category: 'OTHER',       label: 'Other',       blurb: "Doesn't fit a category — that's fine.",
    icon: FileQuestion,  accentColor: '--wiki-other',
    defaultBody: doc([
      { h2: 'Notes', hint: 'Anything you need to remember.' },
    ]) },
]

export const CATEGORY_TEMPLATE_MAP: Record<WikiCategory, CategoryTemplate> =
  Object.fromEntries(CATEGORY_TEMPLATES.map(t => [t.category, t])) as Record<WikiCategory, CategoryTemplate>
```

- [ ] **Step 3: Tests**

```ts
// lib/wiki/__tests__/category-templates.test.ts
import { describe, it, expect } from 'vitest'
import { CATEGORY_TEMPLATES, CATEGORY_TEMPLATE_MAP } from '../category-templates'

const ALL_CATEGORIES = [
  'CHARACTER','LOCATION','LORE','PLOT','ARTIFACT','FACTION','CULTURE',
  'LANGUAGE','BIOLOGY','THEME','ECONOMY','TERMINOLOGY','TIMELINE','OTHER',
] as const

describe('category templates', () => {
  it('exports exactly 14 templates', () => {
    expect(CATEGORY_TEMPLATES).toHaveLength(14)
  })
  it('covers every WikiCategory value', () => {
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_TEMPLATE_MAP[c]).toBeDefined()
      expect(CATEGORY_TEMPLATE_MAP[c].category).toBe(c)
    }
  })
  it('every defaultBody is a valid TipTap doc shape', () => {
    for (const t of CATEGORY_TEMPLATES) {
      const body = t.defaultBody as { type: string; content: unknown[] }
      expect(body.type).toBe('doc')
      expect(Array.isArray(body.content)).toBe(true)
      expect(body.content.length).toBeGreaterThan(0)
    }
  })
  it('every accentColor starts with --wiki-', () => {
    for (const t of CATEGORY_TEMPLATES) {
      expect(t.accentColor.startsWith('--wiki-')).toBe(true)
    }
  })
})
```

- [ ] **Step 4: Commit**

```bash
git add lib/wiki/ app/globals.css
git commit -m "feat(hive): H2 T3 — 14 wiki category templates + accent color tokens"
```

---

### Task 4: `requireBinderWritePermission` + 50-case truth table

**Files:**
- Modify: `lib/hive/permissions.ts` (append new helper)
- Modify: `lib/hive/__tests__/permissions.test.ts` (extend tests)

- [ ] **Step 1: Append helper**

```ts
// lib/hive/permissions.ts (append)
import { books, binderItems } from '@/db/schema'

export type BinderItemTypeForPermission =
  | 'chapter' | 'part' | 'front_matter' | 'back_matter'
  | 'wiki_entry' | 'wiki_folder' | 'character'
  | 'outline' | 'research_note' | 'research_folder'

/**
 * Determines whether `userId` may write to the given binder item.
 *
 *  - Book author wins outright (always allowed).
 *  - Else lookup the hive tied to the book; non-member → NOT_AUTHORIZED.
 *  - Branch on item type:
 *      chapter | part | front_matter | back_matter   → NOT_AUTHORIZED (author only;
 *                                                       hive members go through H3's
 *                                                       submission/suggestion flow)
 *      wiki_entry | wiki_folder | character          → require canEditWiki(role)
 *      outline                                       → require canEditOutline(role)
 *      research_note | research_folder               → require canEditWiki(role)
 */
export async function requireBinderWritePermission(
  bookId: string,
  binderItemId: string,
  userId: string,
): Promise<void> {
  // 1. Author bypass
  const book = await db.query.books.findFirst({
    where: eq(books.id, bookId),
    columns: { userId: true },
  })
  if (!book) throw new Error('BOOK_NOT_FOUND')
  if (book.userId === userId) return

  // 2. Resolve hive for this book
  const hive = await db.query.hives.findFirst({
    where: eq(hives.bookId, bookId),
    columns: { id: true },
  })
  if (!hive) throw new Error('NOT_AUTHORIZED')

  // 3. Resolve role
  const member = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hive.id), eq(hiveMembers.userId, userId)),
    columns: { role: true },
  })
  if (!member) throw new Error('NOT_AUTHORIZED')
  const role = member.role as HiveRole

  // 4. Resolve item type
  const item = await db.query.binderItems.findFirst({
    where: eq(binderItems.id, binderItemId),
    columns: { type: true, bookId: true },
  })
  if (!item || item.bookId !== bookId) throw new Error('BINDER_ITEM_NOT_FOUND')

  // 5. Type-based branch
  switch (item.type as BinderItemTypeForPermission) {
    case 'chapter':
    case 'part':
    case 'front_matter':
    case 'back_matter':
      throw new Error('NOT_AUTHORIZED')   // H3 owns the submission flow
    case 'outline':
      if (!canEditOutline(role)) throw new Error('NOT_AUTHORIZED')
      return
    case 'wiki_entry':
    case 'wiki_folder':
    case 'character':
    case 'research_note':
    case 'research_folder':
      if (!canEditWiki(role)) throw new Error('NOT_AUTHORIZED')
      return
  }
}
```

- [ ] **Step 2: Tests — 50-case truth table**

```ts
// lib/hive/__tests__/permissions.test.ts (extend)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireBinderWritePermission } from '../permissions'

vi.mock('@/db', () => ({
  db: {
    query: {
      books: { findFirst: vi.fn() },
      hives: { findFirst: vi.fn() },
      hiveMembers: { findFirst: vi.fn() },
      binderItems: { findFirst: vi.fn() },
    },
  },
}))
import { db } from '@/db'

const ROLES = ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER'] as const
const TYPES = [
  'chapter','part','front_matter','back_matter',
  'wiki_entry','wiki_folder','character','outline',
  'research_note','research_folder',
] as const

// Truth: rows = role, cols = type, true = write allowed.
const TRUTH: Record<string, Record<string, boolean>> = {
  OWNER:        { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:true, wiki_folder:true, character:true,  outline:true,  research_note:true, research_folder:true },
  MODERATOR:    { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:true, wiki_folder:true, character:true,  outline:true,  research_note:true, research_folder:true },
  CONTRIBUTOR:  { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:true, wiki_folder:true, character:true,  outline:true,  research_note:true, research_folder:true },
  BETA_READER:  { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:false,wiki_folder:false,character:false, outline:false, research_note:false,research_folder:false },
}

describe('requireBinderWritePermission — 4 hive roles × 10 item types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.query.books.findFirst as any).mockResolvedValue({ userId: 'author-id' })  // never the actor
    ;(db.query.hives.findFirst as any).mockResolvedValue({ id: 'hive-1' })
  })

  for (const role of ROLES) {
    for (const type of TYPES) {
      const allowed = TRUTH[role][type]
      it(`${role} × ${type} ⇒ ${allowed ? 'allow' : 'deny'}`, async () => {
        ;(db.query.hiveMembers.findFirst as any).mockResolvedValue({ role })
        ;(db.query.binderItems.findFirst as any).mockResolvedValue({ type, bookId: 'book-1' })
        const p = requireBinderWritePermission('book-1', 'item-1', 'user-1')
        if (allowed) await expect(p).resolves.toBeUndefined()
        else        await expect(p).rejects.toThrow('NOT_AUTHORIZED')
      })
    }
  }
})

describe('requireBinderWritePermission — author bypass', () => {
  it('book author is always allowed', async () => {
    ;(db.query.books.findFirst as any).mockResolvedValue({ userId: 'author-1' })
    await expect(requireBinderWritePermission('book-1', 'item-1', 'author-1')).resolves.toBeUndefined()
  })
  it('non-member non-author is denied', async () => {
    ;(db.query.books.findFirst as any).mockResolvedValue({ userId: 'author-1' })
    ;(db.query.hives.findFirst as any).mockResolvedValue({ id: 'hive-1' })
    ;(db.query.hiveMembers.findFirst as any).mockResolvedValue(undefined)
    await expect(requireBinderWritePermission('book-1', 'item-1', 'stranger')).rejects.toThrow('NOT_AUTHORIZED')
  })
})
```

40 truth-table tests + 2 author tests + the 8 existing predicate tests = ~50 cases as the spec asks.

- [ ] **Step 3: tsc + run tests**

`npx tsc --noEmit && npm test -- permissions` — clean.

- [ ] **Step 4: Commit**

```bash
git add lib/hive/permissions.ts lib/hive/__tests__/permissions.test.ts
git commit -m "feat(hive): H2 T4 — requireBinderWritePermission with 4 roles × 10 item types truth table"
```

---

### Task 5: Tag-handling pure helpers

**Files:**
- Create: `lib/wiki/tags.ts`
- Create: `lib/wiki/__tests__/tags.test.ts`

- [ ] **Step 1: Helpers**

```ts
// lib/wiki/tags.ts
export const MAX_TAGS = 10

/** Lowercase + trim + drop empties + dedupe + cap at MAX_TAGS. */
export function normalizeTags(input: readonly string[] | undefined | null): string[] {
  if (!input) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    const t = raw.trim().toLowerCase()
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

/** Validate a single proposed new tag against an existing list. Returns the
 *  normalized form or null if the tag would be rejected. */
export function acceptTag(existing: readonly string[], candidate: string): string | null {
  const t = candidate.trim().toLowerCase()
  if (!t) return null
  if (existing.length >= MAX_TAGS) return null
  if (existing.includes(t)) return null
  return t
}
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeTags, acceptTag, MAX_TAGS } from '../tags'

describe('normalizeTags', () => {
  it('returns [] for null / undefined / empty', () => {
    expect(normalizeTags(null)).toEqual([])
    expect(normalizeTags(undefined)).toEqual([])
    expect(normalizeTags([])).toEqual([])
  })
  it('lowercases and trims', () => {
    expect(normalizeTags([' Lore ', 'PLOT', 'hero'])).toEqual(['lore','plot','hero'])
  })
  it('dedupes after lowercasing', () => {
    expect(normalizeTags(['Lore','LORE','lore'])).toEqual(['lore'])
  })
  it('drops empty after trim', () => {
    expect(normalizeTags(['',' '])).toEqual([])
  })
  it(`caps at MAX_TAGS (${MAX_TAGS})`, () => {
    const long = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `t${i}`)
    expect(normalizeTags(long)).toHaveLength(MAX_TAGS)
  })
})

describe('acceptTag', () => {
  it('returns normalized tag when valid', () => {
    expect(acceptTag(['lore'], ' Plot ')).toBe('plot')
  })
  it('returns null on dupe', () => {
    expect(acceptTag(['lore','plot'], 'LORE')).toBeNull()
  })
  it('returns null at cap', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(acceptTag(full, 'new')).toBeNull()
  })
  it('returns null on empty', () => {
    expect(acceptTag([], '   ')).toBeNull()
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add lib/wiki/tags.ts lib/wiki/__tests__/tags.test.ts
git commit -m "feat(hive): H2 T5 — tag normalization helpers (lowercase, trim, dedupe, cap 10)"
```

---

### Task 6: Outline `groupBeatsByAct` helper

**Files:**
- Create: `lib/outline/group-by-act.ts`
- Create: `lib/outline/__tests__/group-by-act.test.ts`

- [ ] **Step 1: Helper**

```ts
// lib/outline/group-by-act.ts
import type { Beat as ExistingBeat } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

// Beat shape used by H2 — adds optional `act`.
export type ActBeat = ExistingBeat & { act?: string | null }

export type ActGroup = {
  /** null = ungrouped (collapsible "No Act" group; only rendered if non-empty) */
  act: string | null
  beats: ActBeat[]
}

/**
 * Groups beats into act blocks while preserving input order both BETWEEN groups
 * (first appearance of a given act name wins its position) and WITHIN groups.
 * Ungrouped beats (`act` null/undefined/empty) collect into a single null-keyed
 * group surfaced at the top of the returned array.
 */
export function groupBeatsByAct(beats: readonly ActBeat[]): ActGroup[] {
  const ungrouped: ActBeat[] = []
  const orderedActs: string[] = []
  const byAct = new Map<string, ActBeat[]>()

  for (const b of beats) {
    const a = (b.act ?? '').trim()
    if (!a) {
      ungrouped.push(b)
      continue
    }
    if (!byAct.has(a)) {
      byAct.set(a, [])
      orderedActs.push(a)
    }
    byAct.get(a)!.push(b)
  }

  const groups: ActGroup[] = []
  if (ungrouped.length) groups.push({ act: null, beats: ungrouped })
  for (const a of orderedActs) groups.push({ act: a, beats: byAct.get(a)! })
  return groups
}

/** Distinct act names in order of first appearance — for autocomplete on the
 *  per-act header input. Excludes null/empty. */
export function distinctActs(beats: readonly ActBeat[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of beats) {
    const a = (b.act ?? '').trim()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
  return out
}
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect } from 'vitest'
import { groupBeatsByAct, distinctActs, type ActBeat } from '../group-by-act'

const beat = (id: string, act?: string | null): ActBeat => ({ id, title: id, act, status: 'idea' })

describe('groupBeatsByAct', () => {
  it('returns empty array for no input', () => {
    expect(groupBeatsByAct([])).toEqual([])
  })
  it('returns one null group when nothing has acts', () => {
    expect(groupBeatsByAct([beat('a'), beat('b')])).toEqual([
      { act: null, beats: [beat('a'), beat('b')] },
    ])
  })
  it('omits the null group when every beat has an act', () => {
    const r = groupBeatsByAct([beat('a','Act 1'), beat('b','Act 2')])
    expect(r.map(g => g.act)).toEqual(['Act 1','Act 2'])
  })
  it('preserves first-appearance act order', () => {
    const r = groupBeatsByAct([beat('a','II'), beat('b','I'), beat('c','II')])
    expect(r.map(g => g.act)).toEqual(['II','I'])
    expect(r[0].beats.map(b => b.id)).toEqual(['a','c'])
  })
  it('puts null-act beats first', () => {
    const r = groupBeatsByAct([beat('a','Act 1'), beat('b'), beat('c','Act 1')])
    expect(r.map(g => g.act)).toEqual([null,'Act 1'])
  })
  it('trims & treats empty-string acts as ungrouped', () => {
    const r = groupBeatsByAct([beat('a','  '), beat('b','Act 1')])
    expect(r[0].act).toBeNull()
  })
})

describe('distinctActs', () => {
  it('returns unique acts in first-appearance order', () => {
    expect(distinctActs([beat('a','I'), beat('b','II'), beat('c','I')])).toEqual(['I','II'])
  })
  it('excludes empty + null', () => {
    expect(distinctActs([beat('a',''), beat('b'), beat('c','I')])).toEqual(['I'])
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add lib/outline/
git commit -m "feat(hive): H2 T6 — groupBeatsByAct + distinctActs pure helpers"
```

---

### Task 7: Wire `requireBinderWritePermission` + extend `getBinderTreeAction` projection

**Files:**
- Modify: `lib/actions/binder.actions.ts`

- [ ] **Step 1: Replace `assertBinderOwner` calls in write actions**

In `createBinderItemAction` — keep `assertBookOwner` for the create case (the new item has no ID yet, so `requireBinderWritePermission` needs special handling) — but for hive-member CONTRIBUTOR+ to create wiki/research items, we need a `requireBinderCreatePermission(bookId, type, userId)` variant. Plan:

```ts
// Add to lib/hive/permissions.ts as well:
export async function requireBinderCreatePermission(
  bookId: string,
  type: BinderItemTypeForPermission,
  userId: string,
): Promise<void> {
  // Same shape as requireBinderWritePermission but skips the binder-item lookup
  // and uses the supplied `type` instead. Reuses the role + type branch.
  // (Full implementation matches the type switch from requireBinderWritePermission.)
}
```

Then in `binder.actions.ts`:

```ts
// createBinderItemAction (replace `await assertBookOwner(parsed.data.bookId, userId)`):
await requireBinderCreatePermission(parsed.data.bookId, parsed.data.type, userId)

// updateBinderItemAction (replace `await assertBinderOwner(id, userId)`):
const { bookId: ownerBookId } = await getBinderItemBook(id)
await requireBinderWritePermission(ownerBookId, id, userId)
// (assertBinderOwner removed — replaced by a pure lookup `getBinderItemBook`)

// deleteBinderItemAction — same swap as updateBinderItemAction.

// reorderBinderItemsAction — the `bookId` arg is provided; check the BOOK-level
// permission with a wiki-write probe by passing one of the affected item IDs:
await requireBinderWritePermission(bookId, parsed.data[0].id, userId)
// Note: reorder operates across many items; for now, gate the whole reorder by
// the FIRST item's permission. Edge case — re-parenting items of mixed types —
// is acceptable in v1 because the UI only emits reorders the user is allowed
// to make. Document in code comment.
```

- [ ] **Step 2: Extract `getBinderItemBook(id)` helper**

```ts
async function getBinderItemBook(binderItemId: string): Promise<{ bookId: string }> {
  const row = await db.query.binderItems.findFirst({
    where: eq(binderItems.id, binderItemId),
    columns: { bookId: true },
  })
  if (!row) throw new Error('Binder item not found')
  return { bookId: row.bookId }
}
```

- [ ] **Step 3: Extend `getBinderTreeAction` projection**

```ts
// Inside the `rows: BinderItemRow[] = items.map(...)` builder:
{
  id: item.id,
  bookId: item.bookId,
  parentId: item.parentId,
  type: item.type,
  title: item.title,
  order: item.order,
  content: item.content,
  authorId: item.authorId,           // NEW
  lastEditedBy: item.lastEditedBy,   // NEW
  chapterId: chapter?.id ?? null,
  chapterStatus: chapter?.status ?? null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
}
```

…and widen `BinderItemRow`:

```ts
export type BinderItemRow = {
  id: string
  bookId: string
  parentId: string | null
  type:
    | 'part' | 'chapter' | 'front_matter' | 'back_matter'
    | 'research_folder' | 'research_note' | 'character' | 'outline'
    | 'wiki_entry' | 'wiki_folder'            // NEW
  title: string
  order: number
  content: unknown
  authorId: string | null                     // NEW
  lastEditedBy: string | null                 // NEW
  chapterId: string | null
  chapterStatus: ChapterStatus | null
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 4: Reading-side: getBinderTreeAction permission**

Currently the read action uses `assertBookOwner` — keep that for the AUTHOR's binder view (the editor), but the hive views (Task 9) use their own permission path (assertHiveMember). The split is clean: editor → assertBookOwner; hive page → `getHiveWikiView`/`getHiveOutlineView` (Task 9), which assert hive membership.

- [ ] **Step 5: Update `lastEditedBy` on every write**

```ts
// updateBinderItemAction — include lastEditedBy in updates:
const updates: Record<string, unknown> = { lastEditedBy: userId }
```

Also in `createBinderItemAction`'s insert:

```ts
await tx.insert(binderItems).values({
  ...,
  authorId: userId,
  lastEditedBy: userId,
})
```

- [ ] **Step 6: tsc + tests**

`npx tsc --noEmit && npm test` — clean. Binder + permission tests still green; existing binder action tests may need fixture updates for the new columns (default to null).

- [ ] **Step 7: Commit**

```bash
git add lib/actions/binder.actions.ts lib/hive/permissions.ts
git commit -m "feat(hive): H2 T7 — wire requireBinderWritePermission + authorId/lastEditedBy projection"
```

---

### Task 8: `createHiveAction` reshape — standalone path creates shadow book

**Files:**
- Modify: `lib/actions/hive.actions.ts`

- [ ] **Step 1: Replace null-bookId branch with shadow-book creation**

Find the existing `createHiveAction` (lines 53–99). The current logic permits `bookId: null` and inserts `bookId: data.bookId ?? null`. H2 changes the meaning of "no bookId": ALWAYS create a shadow book.

```ts
export async function createHiveAction(input: unknown): Promise<ActionResult<{ hiveId: string }>> {
  try {
    const userId = await requireAuth()
    const parsed = createHiveSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const data = parsed.data

    const isPremium = await getUserPremiumStatus(userId)
    if (!isPremium && (await getHiveCount(userId)) >= FREE_HIVE_LIMIT) {
      return { success: false, error: 'FREE_LIMIT_REACHED' }
    }

    let bookId: string

    if (data.bookId) {
      // Linked-book path: verify ownership + uniqueness, refuse shadows
      const book = await db.query.books.findFirst({
        where: and(
          eq(books.id, data.bookId),
          eq(books.userId, userId),
          ne(books.status, 'STANDALONE_HIVE_SHADOW'),
        ),
        columns: { id: true },
      })
      if (!book) return { success: false, error: 'BOOK_NOT_FOUND' }
      const existing = await getBookHive(data.bookId)
      if (existing) return { success: false, error: 'BOOK_ALREADY_HAS_HIVE' }
      bookId = data.bookId
    } else {
      // Standalone path: invisible shadow book
      bookId = createId()
      await db.insert(books).values({
        id: bookId,
        userId,
        title: data.name,
        visibility: 'PRIVATE',
        discoverable: false,
        status: 'STANDALONE_HIVE_SHADOW',
      })
    }

    const hiveId = createId()
    await db.transaction(async (tx) => {
      await tx.insert(hives).values({
        id: hiveId,
        bookId,                                // always non-null now
        ownerId: userId,
        name: data.name,
        description: data.description ?? null,
        visibility: data.visibility,
        discoverable: data.discoverable,
      })
      await tx.insert(hiveMembers).values({ hiveId, userId, role: 'OWNER' })
    })

    return { success: true, data: { hiveId } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

- [ ] **Step 2: Unit test the three paths**

Add to whatever test file already covers `createHiveAction` (H1 T5 shipped 4 schema tests; extend):

```ts
it('standalone path creates a STANDALONE_HIVE_SHADOW book first', async () => { /* mock DB; assert insert order */ })
it('linked-book path refuses shadow-book IDs', async () => { /* mock book.status = STANDALONE_HIVE_SHADOW */ })
it('linked-book path rejects if book already has a hive', async () => { /* existing assertion */ })
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/hive.actions.ts
git commit -m "feat(hive): H2 T8 — createHive standalone path creates shadow book"
```

---

### Task 9: New hive content views

**Files:**
- Modify: `lib/actions/hive-content.actions.ts` (add three new actions; deletions land in Task 10).

- [ ] **Step 1: `getHiveWikiView`**

Returns a composite payload powering all three view-modes on `/hive/[hiveId]/wiki`:

```ts
export type HiveWikiEntry = {
  id: string
  title: string
  category: WikiCategory
  tags: string[]
  excerpt: string            // first ~120 chars of body, plaintext
  authorId: string | null
  authorUsername: string | null
  authorAvatarUrl: string | null
  lastEditedBy: string | null
  lastEditedAt: Date
  parentId: string | null    // wiki_folder if any
}

export type HiveWikiFolder = {
  id: string
  title: string
  description: string | null
  parentId: string | null
  entryCount: number
}

export type HiveWikiViewData = {
  bookId: string
  entries: HiveWikiEntry[]              // all wiki_entry + character items
  folders: HiveWikiFolder[]             // all wiki_folder + research_folder items
  viewerRole: HiveRole
  authorUserId: string
}

export async function getHiveWikiView(hiveId: string): Promise<ActionResult<HiveWikiViewData>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)  // throws if not a member
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
    with: { book: { columns: { userId: true } } },
  })
  if (!hive) return { success: false, error: 'Hive not found' }

  // One query: all wiki-relevant rows for the book + folder rows + character rows
  const items = await db.query.binderItems.findMany({
    where: and(
      eq(binderItems.bookId, hive.bookId),
      inArray(binderItems.type, ['wiki_entry','wiki_folder','character','research_folder']),
    ),
    orderBy: [asc(binderItems.order)],
  })

  // Author profiles for excerpt headers
  const authorIds = Array.from(new Set(items.flatMap(i => [i.authorId, i.lastEditedBy]).filter(Boolean) as string[]))
  const profiles = authorIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, authorIds),
        columns: { userId: true, username: true, avatarUrl: true },
      })
    : []
  const profileByUserId = new Map(profiles.map(p => [p.userId, p]))

  const entries: HiveWikiEntry[] = items
    .filter(i => i.type === 'wiki_entry' || i.type === 'character')
    .map(i => {
      const content = (i.content ?? {}) as { category?: WikiCategory; body?: unknown; tags?: string[] }
      const profile = i.authorId ? profileByUserId.get(i.authorId) : null
      return {
        id: i.id,
        title: i.title,
        category: i.type === 'character' ? 'CHARACTER' : (content.category ?? 'OTHER'),
        tags: Array.isArray(content.tags) ? content.tags : [],
        excerpt: tipTapToPlain(content.body, 120),
        authorId: i.authorId,
        authorUsername: profile?.username ?? null,
        authorAvatarUrl: profile?.avatarUrl ?? null,
        lastEditedBy: i.lastEditedBy,
        lastEditedAt: i.updatedAt,
        parentId: i.parentId,
      }
    })

  const folders: HiveWikiFolder[] = items
    .filter(i => i.type === 'wiki_folder' || i.type === 'research_folder')
    .map(i => {
      const c = (i.content ?? {}) as { description?: string }
      return {
        id: i.id,
        title: i.title,
        description: c.description ?? null,
        parentId: i.parentId,
        entryCount: entries.filter(e => e.parentId === i.id).length,
      }
    })

  return {
    success: true,
    data: {
      bookId: hive.bookId,
      entries,
      folders,
      viewerRole: role,
      authorUserId: hive.book!.userId,
    },
  }
}
```

`tipTapToPlain(body, 120)` — small helper extracted from existing FM/BM `toPlainText` utility (already in `lib/export/front-back-matter-templates.ts`).

- [ ] **Step 2: `getHiveOutlineView`**

```ts
export async function getHiveOutlineView(hiveId: string): Promise<ActionResult<{
  bookId: string
  outline: BinderItemRow | null
  chapters: Array<{ id: string; title: string; order: number }>
  viewerRole: HiveRole
}>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive) return { success: false, error: 'Hive not found' }

  const outline = await db.query.binderItems.findFirst({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'outline')),
  })

  // Chapter picker source (empty for shadow books — they have no chapters)
  const chapterItems = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'chapter')),
    columns: { id: true, title: true, order: true },
    orderBy: [asc(binderItems.order)],
  })

  return {
    success: true,
    data: {
      bookId: hive.bookId,
      outline: outline ? toBinderItemRow(outline) : null,
      chapters: chapterItems,
      viewerRole: role,
    },
  }
}
```

- [ ] **Step 3: `getHiveNotesView`**

```ts
export async function getHiveNotesView(hiveId: string): Promise<ActionResult<{
  bookId: string
  notes: Array<BinderItemRow & { authorUsername: string | null }>
  viewerRole: HiveRole
}>> {
  // Same author-profile join shape as getHiveWikiView, but filter to research_note only.
}
```

- [ ] **Step 4: tsc + commit**

```bash
git add lib/actions/hive-content.actions.ts
git commit -m "feat(hive): H2 T9 — getHiveWikiView / getHiveOutlineView / getHiveNotesView (binder-backed)"
```

---

### Task 10: Delete legacy hive content actions

**Files:**
- Modify: `lib/actions/hive-content.actions.ts` — delete `getWikiPagesAction`, `createWikiPageAction`, `getWikiPageAction`, `saveWikiPageAction`, `deleteWikiPageAction`, `getHiveOutlineAction`, `saveHiveOutlineAction`, the `WikiPageSummary` / `WikiPageFull` types, and the import of `hiveOutlines` / `hiveWikiPages` from `@/db/schema` (those tables are dropped in T1's migration).
- Verify: no consumers in `app/` or `lib/` after the delete (grep before commit).

- [ ] **Step 1: Pre-flight grep**

```bash
grep -rn "getWikiPagesAction\|createWikiPageAction\|getWikiPageAction\|saveWikiPageAction\|deleteWikiPageAction\|getHiveOutlineAction\|saveHiveOutlineAction\|WikiPageSummary\|WikiPageFull" app/ lib/
```

If anything outside the actions file matches, treat as a blocker — likely the hive `/wiki` or `/outline` H1 stubs still reference them. Update them to the new actions or delete the reference.

- [ ] **Step 2: Delete the action functions + dead imports**

Discussion + tasks halves of `hive-content.actions.ts` stay untouched.

- [ ] **Step 3: tsc**

`npx tsc --noEmit` — clean. The H1 stubs at `/hive/[hiveId]/wiki/page.tsx` and `outline/page.tsx` don't import these (they're 5-line ComingSoon shells), so no breakage expected.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/hive-content.actions.ts
git commit -m "feat(hive): H2 T10 — delete legacy hive_wiki_pages / hive_outlines actions"
```

---

### Task 11: Binder "+ Add" menu — grouped layout + 14-card category picker modal

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/binder/wiki-category-picker.tsx`

- [ ] **Step 1: Regroup the menu into three sections**

```tsx
const MANUSCRIPT_OPTIONS: AddOption[] = [
  { type: 'chapter',      label: 'Chapter',      defaultTitle: 'Untitled Chapter',    subtitle: 'The actual prose. Opens in the editor.',  Icon: FileText,   tint: 'var(--type-chapter)' },
  { type: 'part',         label: 'Part (collection)', defaultTitle: 'Untitled Part', subtitle: 'A group of chapters (e.g., "Part One").',  Icon: BookOpen,   tint: 'var(--type-chapter)' },
  { type: 'front_matter', label: 'Front matter', defaultTitle: 'Front matter',        subtitle: 'Title page, dedication, copyright.',       Icon: ScrollText, tint: 'var(--type-front-matter)' },
  { type: 'back_matter',  label: 'Back matter',  defaultTitle: 'Back matter',         subtitle: 'Acknowledgments, about the author.',       Icon: ScrollText, tint: 'var(--type-back-matter)' },
]

const WORLDBUILDING_OPTIONS: AddOption[] = [
  { type: 'character',  label: 'Character', defaultTitle: 'Untitled Character', subtitle: 'Name, traits, backstory for one character.', Icon: UserIcon, tint: 'var(--type-character)' },
  // "Wiki Entry" is a special opener — handled by `onClick` rather than a normal handleAdd
  { type: 'wiki_entry', label: 'Wiki Entry ▸', defaultTitle: '', subtitle: '13 categories — pick one to start.', Icon: NotebookPen, tint: 'var(--wiki-other)' },
  { type: 'wiki_folder', label: 'Wiki Folder', defaultTitle: 'Untitled Folder', subtitle: 'A container for wiki entries.', Icon: FolderTree, tint: 'var(--wiki-other)' },
]

const PLANNING_OPTIONS: AddOption[] = [
  { type: 'outline',         label: 'Outline',         defaultTitle: 'Untitled Outline',  subtitle: 'Beat sheet — optional acts.', Icon: LayoutIcon, tint: 'var(--type-outline)' },
  { type: 'research_note',   label: 'Research note',   defaultTitle: 'Untitled note',     subtitle: 'Freeform notes.',             Icon: StickyNote,  tint: 'var(--type-research)' },
  { type: 'research_folder', label: 'Research folder', defaultTitle: 'Research',          subtitle: 'Container for notes.',         Icon: Folder,      tint: 'var(--type-research)' },
]
```

Add a `pickerOpen` state to the component; the Wiki Entry option's `onClick` opens the picker rather than calling `handleAdd` directly.

- [ ] **Step 2: 14-card category picker modal**

```tsx
// wiki-category-picker.tsx
'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CATEGORY_TEMPLATES } from '@/lib/wiki/category-templates'
import type { WikiCategory } from '@/lib/wiki/category-templates'

export function WikiCategoryPicker({
  open, onOpenChange, onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (category: WikiCategory) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>What kind of wiki entry?</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 mt-4">
          {CATEGORY_TEMPLATES.filter(t => t.category !== 'CHARACTER').map(t => (
            <button
              key={t.category}
              onClick={() => onPick(t.category)}
              className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-all hover:ring-2 hover:ring-brand hover:bg-surface-elevated"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ color: `var(${t.accentColor})`, background: `oklch(from var(${t.accentColor}) l c h / 0.12)` }}>
                <t.icon size={16} />
              </span>
              <div className="font-comfortaa font-bold text-[13px] leading-tight">{t.label}</div>
              <div className="text-[11px] text-muted-foreground leading-snug">{t.blurb}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

Note the `.filter(t => t.category !== 'CHARACTER')` — Character is already a separate menu entry (and its own binder type). 13 cards visible.

- [ ] **Step 3: Wire picker → create**

In `binder-add-menu.tsx`, when `WikiCategoryPicker` calls `onPick(category)`:

```ts
async function handlePickCategory(category: WikiCategory) {
  setPickerOpen(false)
  const template = CATEGORY_TEMPLATE_MAP[category]
  const rootItems = binderItems.filter(i => i.parentId === null)
  const order = (rootItems.length ? Math.max(...rootItems.map(i => i.order)) : -1) + 1
  const result = await createBinderItemAction({
    bookId,
    parentId: null,
    type: 'wiki_entry',
    title: `New ${template.label}`,
    order,
    content: { category, body: template.defaultBody, tags: [] },
  })
  if (result.success) {
    addBinderItem({ ... })   // mirror the existing handleAdd shape
    setActiveItemId(result.data.id)
    setPendingRenameId(result.data.id)
  }
}
```

- [ ] **Step 4: tsc + commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/_components/binder/
git commit -m "feat(hive): H2 T11 — binder Add menu regrouped + 13-card wiki category picker"
```

---

### Task 12: `WikiEntryEditor` renderer + chapter-editor hookup

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-entry-editor.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/tag-chip-strip.tsx` (shared with Character — Task 15 consumes)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (add render-branch line)

- [ ] **Step 1: `TagChipStrip` shared component**

```tsx
// tag-chip-strip.tsx
'use client'
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { acceptTag, MAX_TAGS } from '@/lib/wiki/tags'

export function TagChipStrip({
  tags, onChange, accentColor, readOnly = false,
}: {
  tags: string[]
  onChange: (next: string[]) => void
  accentColor: string                          // CSS var name, e.g. '--wiki-location'
  readOnly?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  function commit() {
    const accepted = acceptTag(tags, draft)
    if (accepted) onChange([...tags, accepted])
    setDraft('')
    setAdding(false)
  }
  function remove(t: string) {
    onChange(tags.filter(x => x !== t))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(t => (
        <span key={t}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color: `var(${accentColor})`, background: `oklch(from var(${accentColor}) l c h / 0.14)` }}>
          {t}
          {!readOnly && (
            <button onClick={() => remove(t)} className="opacity-60 hover:opacity-100" aria-label={`Remove tag ${t}`}>
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {!readOnly && tags.length < MAX_TAGS && (
        adding ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
            className="rounded-full border border-border bg-transparent px-2 py-0.5 text-[11px] outline-none focus:border-brand"
            placeholder="tag"
          />
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-brand hover:text-brand">
            <Plus size={10} /> tag
          </button>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: `WikiEntryEditor`**

Structure mirrors `character-profile.tsx`. Single sheet column. Header card with title (contenteditable) + category pill (template accent color) + TagChipStrip. Body: TipTap mini-editor with the same extensions as FM/BM (StarterKit + bold + italic + heading2 + bulletList + blockquote). `SaveStatusBadge` in the breadcrumb at the top, debounced via the existing `scheduleSave` pattern.

```tsx
// wiki-entry-editor.tsx (skeleton — match character-profile.tsx structure)
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Heading2, List, Quote } from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { normalizeTags } from '@/lib/wiki/tags'
import { TagChipStrip } from './tag-chip-strip'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { useBookEditor } from '../book-editor-provider'

type WikiEntryContent = {
  category: WikiCategory
  body: unknown
  tags: string[]
}

function readContent(raw: unknown): WikiEntryContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { category: 'OTHER', body: { type: 'doc', content: [] }, tags: [] }
  }
  const c = raw as Partial<WikiEntryContent>
  return {
    category: c.category ?? 'OTHER',
    body: c.body ?? { type: 'doc', content: [] },
    tags: Array.isArray(c.tags) ? c.tags : [],
  }
}

export function WikiEntryEditor({ item, readOnly = false }: { item: BinderItemRow; readOnly?: boolean }) {
  const { updateBinderItem } = useBookEditor()
  const initial = useMemo(() => readContent(item.content), [item.id])
  const [content, setContent] = useState<WikiEntryContent>(initial)
  const [status, setStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const template = CATEGORY_TEMPLATE_MAP[content.category]

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2] } })],
    content: initial.body as Parameters<typeof StarterKit>[0],
    editable: !readOnly,
    onUpdate({ editor: e }) {
      const next = { ...content, body: e.getJSON() }
      setContent(next)
      scheduleSave(next)
    },
  }, [item.id])

  const scheduleSave = useCallback((next: WikiEntryContent) => {
    if (readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('typing')
    saveTimer.current = setTimeout(async () => {
      setStatus('saving')
      const r = await updateBinderItemAction(item.id, { content: next })
      setStatus(r.success ? 'saved' : 'error')
      if (r.success) updateBinderItem(item.id, { content: next })
    }, 800)
  }, [item.id, readOnly, updateBinderItem])

  function setTags(tags: string[]) {
    const next = { ...content, tags: normalizeTags(tags) }
    setContent(next); scheduleSave(next)
  }
  async function commitTitle(title: string) {
    if (!title || title === item.title) return
    await updateBinderItemAction(item.id, { title })
    updateBinderItem(item.id, { title })
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--sheet-canvas)' }}>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-6">
        <header className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Wiki ▸ {template.label}</span>
          <SaveStatusBadge status={status} />
        </header>
        <section className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: `var(${template.accentColor})`, background: `oklch(from var(${template.accentColor}) l c h / 0.14)` }}>
              <template.icon size={12} /> {template.label}
            </span>
          </div>
          <div
            role="textbox"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className="font-comfortaa font-bold text-2xl outline-none"
            onBlur={e => commitTitle(e.currentTarget.textContent?.trim() ?? '')}
          >{item.title}</div>
          <TagChipStrip tags={content.tags} onChange={setTags} accentColor={template.accentColor} readOnly={readOnly} />
        </section>
        <section className="rounded-lg border border-border bg-card p-6">
          <EditorContent editor={editor} />
        </section>
        {readOnly && (
          <p className="text-center text-xs text-muted-foreground">Read-only — your role is Beta Reader.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Hookup in `chapter-editor.tsx`**

```tsx
// chapter-editor.tsx — extend the !isChapterType render-branch (around line 248)
if (activeItem.type === 'wiki_entry') {
  return <WikiEntryEditor item={activeItem} />
}
if (activeItem.type === 'wiki_folder') {
  return <WikiFolderRenderer item={activeItem} />        // Task 13
}
```

- [ ] **Step 4: tsc + smoke**

`npx tsc --noEmit`. Manual: create a wiki entry of category LORE from the binder; confirm the entry opens with the seeded body, lore accent on the category pill, tag strip works.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/_components/editor/
git commit -m "feat(hive): H2 T12 — WikiEntryEditor + shared TagChipStrip"
```

---

### Task 13: `WikiFolderRenderer`

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-folder-renderer.tsx`
- Modify: chapter-editor render-branch (done in T12 step 3)

- [ ] **Step 1: Component**

Same sheet chrome as `WikiEntryEditor`. Editable title, optional description (single contenteditable line; debounced save into `content.description`), "What's inside" list — pull child entries from `useBookEditor().binderItems.filter(i => i.parentId === item.id)`. Each row is a card link that calls `setActiveItemId(child.id)` — mirrors `container-view.tsx`. If no children: empty-state copy "This folder is empty. Add a wiki entry from the binder."

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-folder-renderer.tsx
git commit -m "feat(hive): H2 T13 — WikiFolderRenderer"
```

---

### Task 14: Outline editor — act grouping

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`
- Verify: `outline-card.tsx` accepts optional `act` (read-only render is fine; act lives in beat data)

- [ ] **Step 1: Extend `Beat` type + `readBeats()`**

```ts
export type Beat = {
  id: string
  title: string
  description?: string
  status?: BeatStatus
  linkedChapterId?: string | null
  act?: string | null     // NEW
}
```

`readBeats()` already returns whatever beats are in storage — no shape change needed.

- [ ] **Step 2: Wrap render with `groupBeatsByAct`**

Use the T6 helper. Walk `groupBeatsByAct(beats)`; for each group render:

```tsx
<div className="space-y-2">
  <header className="flex items-center gap-2">
    <input
      value={group.act ?? ''}
      placeholder={group.act === null ? 'No Act' : 'Act name'}
      onBlur={e => renameAct(group.act, e.target.value)}
      className="font-comfortaa font-bold text-base bg-transparent border-b border-transparent hover:border-border focus:border-brand outline-none"
      disabled={group.act === null}
    />
    <span className="text-xs text-muted-foreground">{group.beats.length} beat{group.beats.length === 1 ? '' : 's'}</span>
  </header>
  <SortableContext items={group.beats.map(b => b.id)} strategy={undefined}>
    {/* beats sortable within and across acts — see Step 3 */}
  </SortableContext>
</div>
```

After the loop, render a `"+ New Act"` button that prompts inline for a name and creates an empty group (no beats; surfaces by adding a single placeholder beat with `act: <name>` — or, simpler, the new group only appears once the user creates a beat in it; the button just sets `defaultActForNextBeat` state).

- [ ] **Step 3: Cross-act drag**

Cross-act drag requires the dnd-kit setup to span all groups. Two approaches:

1. **One global `SortableContext`** containing ALL beats (current code) — but render them grouped via headers in between. On drop, read the position of the dropped beat relative to its act header sibling to derive `act`.
2. **Per-act `SortableContext`** plus an outer `DndContext` — on `onDragEnd`, if the target's group differs from the source's group, update the beat's `act` to the target's group's act.

Approach 2 is simpler with the existing code shape. Implementation:

```ts
function onDragEnd(e: DragEndEvent) {
  const { active, over } = e
  if (!over || active.id === over.id) return
  const fromIdx = beats.findIndex(b => b.id === active.id)
  const toIdx   = beats.findIndex(b => b.id === over.id)
  if (fromIdx < 0 || toIdx < 0) return
  // Move the beat in the flat array
  let next = arrayMove(beats, fromIdx, toIdx)
  // If the target beat has a different act, adopt it
  const targetAct = next[toIdx].act ?? null
  next = next.map((b, i) => i === toIdx ? { ...b, act: targetAct } : b)
  setBeats(next)
  scheduleSave(next)
}
```

Drag-into-empty-act-header is a v1+ polish — for now, dragging a beat onto another beat in a different group moves it across.

- [ ] **Step 4: `renameAct(oldName, newName)`**

```ts
function renameAct(oldName: string | null, raw: string) {
  if (oldName === null) return                        // 'No Act' is not editable
  const newName = raw.trim()
  if (!newName || newName === oldName) return
  const next = beats.map(b => b.act === oldName ? { ...b, act: newName } : b)
  setBeats(next)
  scheduleSave(next)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/_components/outline/
git commit -m "feat(hive): H2 T14 — outline act grouping + cross-act drag"
```

---

### Task 15: Character tag strip

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/character-profile.tsx`

- [ ] **Step 1: Add `tags` to `CharacterContent`**

```ts
type CharacterContent = {
  // ... existing fields ...
  tags?: string[]
}
```

- [ ] **Step 2: Add `<TagChipStrip>` to the identity header card**

Place under the name + meta header card. Use accent `--wiki-character`. Wire to a `setTags(next)` that mirrors the wiki entry editor — calls `scheduleSave({ ...content, tags: normalizeTags(next) })`.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/_components/character-profile.tsx
git commit -m "feat(hive): H2 T15 — character profile tag chip strip"
```

---

### Task 16: `/hive/[hiveId]/wiki` page implementation

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx` (replace 5-line ComingSoon stub)
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-shell.tsx` (client)
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/by-category-view.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/by-folder-view.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/notes-view.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx` (wraps studio's `WikiEntryEditor`)

- [ ] **Step 1: Server page**

```tsx
// page.tsx
import { getHiveWikiView, getHiveNotesView } from '@/lib/actions/hive-content.actions'
import { notFound } from 'next/navigation'
import { HiveWikiShell } from './_components/hive-wiki-shell'

export default async function HiveWikiPage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId, locale } = await params
  const [wiki, notes] = await Promise.all([
    getHiveWikiView(hiveId),
    getHiveNotesView(hiveId),
  ])
  if (!wiki.success || !notes.success) notFound()
  return <HiveWikiShell wiki={wiki.data} notes={notes.data} hiveId={hiveId} locale={locale} />
}
```

- [ ] **Step 2: `HiveWikiShell` client component**

State: `viewMode: 'category' | 'folder' | 'notes'`, `search: string`, `selectedEntryId: string | null`. Header layout per spec (title + search input + "+ New Entry" button — hidden if `!canEditWiki(viewerRole)`). View-mode tab pill switches between the three views.

When an entry is clicked, render `<HiveWikiEntryEditor entryId={id} hiveId={hiveId} viewerRole={viewerRole} />` in a right-side slide-over OR an in-place page (decide during implementation — recommend in-place to match the editor experience).

`"+ New Entry"` button opens `<WikiCategoryPicker>` (the shared T11 component). On pick, calls `createBinderItemAction` directly with the chosen category + template, then refreshes the wiki view (server action invalidation via `router.refresh()`).

- [ ] **Step 3: `ByCategoryView`**

14 sections in `CATEGORY_TEMPLATES` order. Each section: header (icon + label + entry count + collapse caret) + filtered list of `entries.filter(e => e.category === c)`. Empty category: muted `"+ Add a {label}"` link (`canEditWiki(role)` gated). Entry card: title + excerpt + tag chips + author avatar + last-edited rel time. Click → opens `HiveWikiEntryEditor`.

Search filtering happens at the parent shell level: `filteredEntries = entries.filter(e => matchesSearch(e, search))` with `matchesSearch` checking title, tags, and excerpt (case-insensitive substring).

- [ ] **Step 4: `ByFolderView`**

Build a tree from `folders` + `entries`. Root nodes: folders with `parentId === null` + entries with `parentId === null`. Recurse for children. Render as nested sections; folders show entry count.

- [ ] **Step 5: `NotesView`**

Flat grid of `notes.data.notes`, sorted: pinned first (read `note.content.pinned`), then by `updatedAt` desc. "+ New Note" button (`canEditWiki` gated) calls `createBinderItemAction` with type `research_note`.

- [ ] **Step 6: `HiveWikiEntryEditor` wrapper**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { WikiEntryEditor } from '@/app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-entry-editor'
import type { HiveRole } from '@/lib/hive/permissions'
import { canEditWiki } from '@/lib/hive/permissions'

export function HiveWikiEntryEditor({ entryId, bookId, viewerRole, lastEditedByLabel }: {
  entryId: string; bookId: string; viewerRole: HiveRole; lastEditedByLabel: string | null
}) {
  // Fetch the binder item via getBinderTreeAction (existing) and pluck the one row by ID.
  // Pass readOnly={!canEditWiki(viewerRole)} to <WikiEntryEditor>.
  const [item, setItem] = useState<BinderItemRow | null>(null)
  useEffect(() => {
    getBinderTreeAction(bookId).then(r => {
      if (r.success) setItem(r.data.find(i => i.id === entryId) ?? null)
    })
  }, [bookId, entryId])
  if (!item) return <div className="p-8 text-center text-muted-foreground">Loading…</div>
  return (
    <div className="flex flex-col h-full">
      {lastEditedByLabel && (
        <div className="px-6 py-2 text-xs text-muted-foreground border-b border-border">
          Last edited by {lastEditedByLabel}
        </div>
      )}
      <WikiEntryEditor item={item} readOnly={!canEditWiki(viewerRole)} />
    </div>
  )
}
```

**Note:** `getBinderTreeAction` currently uses `assertBookOwner`, which DENIES non-owners. Two options:

1. Add a sibling `getBinderTreeForHiveAction(bookId, hiveId)` that asserts hive membership instead and reuses the same body.
2. Loosen `getBinderTreeAction` to accept either ownership OR hive membership.

Option 1 is cleaner (single-responsibility per action). Add `getBinderTreeForHiveAction` in T7 if not already; the H2 hive wiki page uses that variant. **Add a note in T7's commit to ship the sibling action.**

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/wiki/
git commit -m "feat(hive): H2 T16 — /hive/[hiveId]/wiki — By Category / By Folder / Notes views + entry editor"
```

---

### Task 17: `/hive/[hiveId]/outline` page implementation

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx`

- [ ] **Step 1: Server page**

```tsx
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { notFound } from 'next/navigation'
import { HiveOutlineSurface } from './_components/hive-outline-surface'

export default async function HiveOutlinePage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()
  return <HiveOutlineSurface data={r.data} hiveId={hiveId} locale={locale} />
}
```

- [ ] **Step 2: `HiveOutlineSurface` client component**

Wraps the studio `OutlineBoard` (default export from `_components/outline/outline-board.tsx`). Header strip: "Outline" + last-edited line + role-gated edit/read affordance. Empty state ("This hive's book has no outline yet — the author can create one in the editor") if `data.outline === null`. Standalone-hive case (no chapters) surfaces the chapter-picker's empty state inside `OutlineBoard` (`OutlineBoard` already reads chapters from the provider, which we'd need to supply via a hive-side adapter).

**Caveat:** `OutlineBoard` consumes `useBookEditor()` for `updateBinderItem`. The hive page is NOT inside the studio's `BookEditorProvider`. Two options:

1. Extract a presentational `<BeatSheet>` from `OutlineBoard` that takes `{ beats, onChange, chapters, readOnly }` as props and use it directly here. `OutlineBoard` then becomes a thin wrapper that wires the provider.
2. Build a parallel `<HiveOutlineProvider>` for this surface that mirrors the BookEditorProvider's API surface.

Option 1 is cleaner. Add to T14's scope: extract `<BeatSheet>` from `OutlineBoard`. Update T14's commit message accordingly. If T14 is already shipped without the extraction when this task is reached, do the extraction here (will widen the T17 diff).

- [ ] **Step 3: Read-only mode for BETA_READER**

Pass `readOnly={!canEditOutline(viewerRole)}`. `<BeatSheet>` accepts `readOnly` (disables drag, no scheduleSave on edits, no `+ New Beat` button).

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/outline/
git commit -m "feat(hive): H2 T17 — /hive/[hiveId]/outline wrapping BeatSheet with hive chrome"
```

---

### Task 18: AGENTS.md update + final ship commit

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add H2 entry above H1 in "What Has Been Built"**

```markdown
### Hives Redesign — H2 Mirror Model ✅ COMPLETE (2026-05-29)

Second of 5 sub-projects. Makes the hive wiki / outline / notes BE the editor binder.
One canonical row in `binderItems`; the editor and the hive UI are both views.

- **Schema** (`scripts/migrate-h2.ts`):
  - `binder_item_type` gains `wiki_entry`, `wiki_folder`.
  - `book_status` gains `STANDALONE_HIVE_SHADOW`.
  - `binder_items` gains `author_id` + `last_edited_by` columns + composite
    `(book_id, type)` index.
  - Shadow-book backfill: every pre-H2 standalone hive gets a new shadow `books`
    row created and `hives.book_id` updated to point at it.
  - `hives.book_id` tightened to NOT NULL + plain UNIQUE (H1's partial UNIQUE dropped).
  - Legacy `hive_wiki_pages` rows ported to `wiki_entry` binder items under an
    auto-created `wiki_folder` named "Imported from old wiki". Legacy `hive_outlines`
    rows appended to each book's `outline` binder item as a single "Imported" beat.
  - Tables dropped: `hive_wiki_pages`, `hive_outlines`.
- **`scopedBooksForUser(userId)` helper** (`lib/books/scoped.ts`) + codemod across
  ~12 sites — every `/studio` query filtering by `books.userId` now excludes
  shadow books. The hive resolution paths intentionally do NOT use it.
- **Category templates** (`lib/wiki/category-templates.ts`): 14 categories
  (Character / Location / Lore / Plot / Artifact / Faction / Culture / Language /
  Biology / Theme / Economy / Terminology / Timeline / Other) with icons, accent
  CSS vars (`--wiki-*` added to globals.css `:root`), and per-category
  TipTap-doc `defaultBody` seeded on entry creation.
- **Permission helper** (`lib/hive/permissions.ts`): `requireBinderWritePermission`
  + `requireBinderCreatePermission` — 4 roles × 10 item types truth table
  (50 cases tested). Author always wins; BETA_READER read-only on wiki/outline/
  notes; chapters / parts / front-matter / back-matter author-only (H3 owns the
  submission flow).
- **Tag helpers** (`lib/wiki/tags.ts`): `normalizeTags` + `acceptTag` (lowercase,
  trim, dedupe, cap 10).
- **Outline `groupBeatsByAct`** (`lib/outline/group-by-act.ts`): pure helper for
  render-time act grouping; supports null/ungrouped beats in a "No Act" group.
- **`createHiveAction` reshape** (H1 → H2): standalone path now creates a
  `STANDALONE_HIVE_SHADOW` book first, then the hive points at it. `hives.bookId`
  is always non-null.
- **Editor binder Add menu** regrouped: MANUSCRIPT / WORLDBUILDING / PLANNING.
  Wiki Entry opens a 13-card category picker modal (Character is its own menu entry).
- **`WikiEntryEditor` + `WikiFolderRenderer`** specialized renderers added to
  `chapter-editor.tsx`'s render-branch. Sheet-style chrome matching Character's
  pattern (theme-aware paper-ink, scheduleSave debounce, save-status badge).
- **Shared `TagChipStrip`** used by `WikiEntryEditor` and `CharacterProfile`.
- **Outline act grouping** in `outline-board.tsx`: per-act header strip with
  inline-rename + "+ New Act"; beats drag within and across acts (cross-act drag
  adopts the target's act). `BeatSheet` presentational extracted so the hive
  outline surface can reuse it without `BookEditorProvider`.
- **Character profile** gains the tag chip strip under the name header.
- **`/hive/[hiveId]/wiki`**: real implementation. Header (title + search +
  role-gated "+ New Entry"), view-mode toggle (By Category / By Folder / Notes),
  in-place entry editor wrapping the studio's `WikiEntryEditor`. BETA_READER
  sees read-only mode (TipTap `editable={false}`, no save badge, footer message).
- **`/hive/[hiveId]/outline`**: real implementation wrapping `BeatSheet` in
  `HiveOutlineSurface` chrome. Role-gated read/write via `canEditOutline`.
  Standalone-hive shadow book → outline still works (chapter picker empty state).
- **New server actions** in `lib/actions/hive-content.actions.ts`:
  `getHiveWikiView`, `getHiveOutlineView`, `getHiveNotesView`. All assert hive
  membership; one-shot queries with author-profile joins. Also new
  `getBinderTreeForHiveAction(bookId, hiveId)` companion to `getBinderTreeAction`
  for the hive-side editor wrapper.
- **Deleted server actions:** `getWikiPagesAction`, `createWikiPageAction`,
  `getWikiPageAction`, `saveWikiPageAction`, `deleteWikiPageAction`,
  `getHiveOutlineAction`, `saveHiveOutlineAction`.

**H2 pattern:** when adding a new binder type that should be hive-visible, (1)
add the enum value in a migration, (2) add a render-branch case in
`chapter-editor.tsx`, (3) extend the type union in `requireBinderWritePermission`'s
switch, (4) decide whether the type is also exposed by a hive view action.

**`scopedBooksForUser` rule:** every `/studio` query filtering by
`books.userId` MUST use `scopedBooksForUser(userId)` to exclude shadow books.
The exceptions are documented in `lib/books/scoped.ts`.

N/N tests, tsc clean.
```

- [ ] **Step 2: Update Resume Here block**

Replace the H1 entry with H2 status; bump `Last updated`, `Current focus`, `Last commit`. Suggested wording for `Current focus`:

> Hives redesign H2 Mirror Model COMPLETE — binder rows are the canonical home for wiki/outline/notes; shadow books back standalone hives; 14 wiki categories with templates + tags; per-act outline grouping. Next sub-project H3 Collaboration (chapter submissions, suggestions, annotations, discussions).

- [ ] **Step 3: Add `scopedBooksForUser` to Key Patterns**

Append a section:

```markdown
### H2 scopedBooksForUser pattern

Every `/studio` query that filters `books.userId` uses `scopedBooksForUser(userId)`
from `lib/books/scoped.ts`, which adds an `AND status != 'STANDALONE_HIVE_SHADOW'`
clause. Shadow books back standalone hives and must not leak into the user's
library / stats / discover / overflow counts. The two intentional non-scoped
sites are documented in `scoped.ts`.
```

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "feat(hive): H2 Mirror Model — single-source binder ↔ hive wiki/outline/notes"
```

---

## Self-Review Checklist

Before declaring H2 shipped:

- [ ] **Spec coverage:** every bullet under spec §Data Model, §Editor Changes, §Hive Surfaces, §Migration Plan, §Test Plan has a corresponding task or step here.
- [ ] **Migration safety:** runner is idempotent (re-running the same script is a no-op); enum additions use `IF NOT EXISTS`; data backfill uses INSERT-then-UPDATE so a failure mid-script doesn't orphan; legacy tables dropped only after porting in step 7.
- [ ] **Permission coverage:** truth table is exactly 4 × 10 = 40 cases; tests assert each cell; non-member + non-author paths both throw `NOT_AUTHORIZED`; author bypass tested for at least one type.
- [ ] **`scopedBooksForUser` audit:** every grep hit either uses the helper or is documented in `scoped.ts` as an intentional exception.
- [ ] **Shadow book invisibility:** Studio Library / Stats / Continue Writing / Discover / Series neighbors / Export / Overflow all exclude shadows; `assertBookOwner` excludes shadows.
- [ ] **Hive `bookId` invariant:** after T1, no hive row has `book_id IS NULL` (migration aborts if any remain); drizzle schema NOT NULL; plain UNIQUE constraint in place.
- [ ] **Read-only beta path:** `WikiEntryEditor` accepts `readOnly` prop wired to `!canEditWiki(role)`; `BeatSheet` accepts `readOnly` for the outline surface; both pass through to TipTap `editable={false}`.
- [ ] **Render-branch coverage:** chapter-editor handles `wiki_entry`, `wiki_folder`; no `console.warn(...)` fallback for these in dev.
- [ ] **Category picker:** 13 cards visible (Character excluded; it's a separate menu entry). All 14 templates exist in `CATEGORY_TEMPLATES`.
- [ ] **AGENTS.md:** entry above H1; Resume Here block bumped; `scopedBooksForUser` documented in Key Patterns.
- [ ] **tsc + tests:** clean at every task boundary commit (T2 is the boundary where exhaustive switches on `book_status` finally re-converge).
