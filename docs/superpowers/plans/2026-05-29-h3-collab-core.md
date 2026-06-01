# H3 — Collaboration Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H3 of 5 (Hives redesign)
**Predecessors:** H1 Foundation (shipped `d162ddf`), H2 Mirror Model (shipped `7afac8c`)
**Successors:** H4 Motivation, H5 Dashboard

**Goal:** Land the four collaboration surfaces the redesign promised — Annotations, Edit Suggestions, Submit Chapter, Discussions — built on top of H1's hive shell + H2's binder mirror. Two new TipTap marks (`hiveAnnotation`, `hiveSuggestion`) anchor inline feedback to chapter prose so positions survive author edits naturally. Submissions are DRAFT → PENDING → APPROVED/REJECTED with reviewer attribution and automatic binder slot insertion on approval. Discussions are topic-tagged threaded forum posts with one level of reply depth. All eight H3-relevant activity event types in H1's `hive_activity` enum get wired here, so /community starts surfacing real content.

**Spec:** [`docs/superpowers/specs/2026-05-29-h3-collab-core-design.md`](../specs/2026-05-29-h3-collab-core-design.md)
**Reference precedents (tone, granularity, code-shape inclusion):**
- [`docs/superpowers/plans/2026-05-29-h2-mirror-model.md`](2026-05-29-h2-mirror-model.md)
- [`docs/superpowers/plans/2026-05-29-h1-hive-foundation.md`](2026-05-29-h1-hive-foundation.md)

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (Neon Postgres), Tailwind v4, vitest. IDs are `text` (cuid2). Migrations run via a one-shot tsx script per AGENTS.md (drizzle-kit push needs TTY).

---

## Pre-flight Findings

Verified by direct reads + grep against `main` at HEAD = `7afac8c`.

- **`db/schema/hive.ts`** still defines all five tables H3 reshapes or drops: `hiveSubmissions` (48), `hiveSuggestions` (59), `hiveComments` (71), `hiveDiscussionPosts` (95), `hiveChapterLocks` (104). All five have relations blocks (127–161). H3 renames `hiveComments → hiveAnnotations`, reshapes `hiveSuggestions` + `hiveSubmissions`, extends `hiveDiscussionPosts` with `topic`, drops `hiveChapterLocks` outright.
- **`hive_activity_type` enum** already declares all 10 H3/H4 event names (db/schema/hive.ts:163–179) — `chapter_submitted`, `chapter_submitted_approved`, `chapter_submitted_rejected`, `annotation_added`, `suggestion_proposed`, `suggestion_accepted`, `suggestion_rejected`, `discussion_posted` (+ H4's `member_joined` already-wired + `buzz_posted` deferred). **H3 only writes; no enum additions.** The `record-activity.ts` helper from H1 (`lib/hive/record-activity.ts`) is the entry point.
- **`lib/hive/permissions.ts`** is a 167-line file that already contains predicates `canSubmitChapter` (line 34 — CONTRIBUTOR only), `canReviewSubmissions` (35), `canAnnotate` (36), `canSuggestEdits` (37). The spec adds `canPostDiscussion`, `canReviewSuggestion`, `canResolveAnnotation`, `canEditDiscussionPost`. **Predicates already-present should not be re-defined.** Append-only extensions per H2's convention.
- **`lib/hive/record-activity.ts`** from H1 is the activity writer the spec leans on. Confirm its signature accepts a `payload: Record<string, unknown>` so H3's denormalized fields slot in cleanly.
- **Live `hive_member_role` enum is `OWNER / MODERATOR / CONTRIBUTOR / BETA_READER`** (per AGENTS.md — schema is the source of truth). All H3 predicates and tests use `BETA_READER` (not the spec text's `READER`).
- **`requireBinderWritePermission` (from H2)** gates the chapter family (chapter/part/front_matter/back_matter) as author-only — non-author hive members get `NOT_AUTHORIZED`. **Submission approval needs a privileged code path** that BYPASSES this guard because it creates a chapter on behalf of the contributor with `chapters.authorUserId = submission.userId`. See Task 11 — `approveSubmissionAction` writes directly to `binderItems` + `chapters` inside its own transaction, skipping the helper.
- **TipTap extension surface area:** chapter prose is rendered in two places now — (a) the studio editor `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`, and (b) the public reader `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx` (read-only). H3 adds a THIRD place — the new hive chapter view `/hive/[hiveId]/chapters/[chapterId]`. The two new TipTap marks (`hiveAnnotation`, `hiveSuggestion`) must register in (a) + (c). The public reader (b) renders marks as styled spans (visible to logged-out viewers) but is non-interactive — it does not need annotation/suggestion handlers, just the parseHTML so marks round-trip.
- **`saveChapterAction`** in `lib/actions/chapter.actions.ts` does NOT strip unknown marks — TipTap JSON is persisted whole. Confirmed safe: new marks ride along on save automatically.
- **`hive_submissions.chapterId`** currently references `chapters.id` and was load-bearing in the old design ("submission attaches to an existing chapter"). The new shape drops `chapterId` and adds `createdChapterId` (set on approval). Pre-existing rows in dev DB are degenerate (no contribution flow has shipped); legacy data backfill is a no-op other than mapping `status` → `draft_status` and zeroing the new columns.
- **`hive_discussion_posts`** already has `parent_id` self-FK (line 100). H3 adds `topic` + CHECK constraint enforcing topic-on-top-level-only. The reply-depth-one rule is policy-enforced in the action layer, not via DB constraint (CHECK can't trivially express it without a stored function).
- **Server-side TipTap mutation:** `acceptSuggestionAction` needs to scan a chapter's JSON doc for a `hiveSuggestion` mark with a specific id, compute current range, then `deleteRange` + `insertContentAt`. TipTap's `@tiptap/html` + `@tiptap/core` can construct an `Editor` instance server-side, but to keep it lightweight a pure JSON-walking helper is preferable. Plan: small module `lib/tiptap-extensions/apply-suggestion.ts` that walks the ProseMirror JSON tree, finds the marked range, and applies replacement. See Task 14.
- **`getChapterAction` projection** in `lib/actions/chapter.actions.ts` returns `contentJson` directly — annotation/suggestion marks ride along free. No projection change needed for the existing studio editor.
- **No `coordsAtPos` server-side.** Gutter positioning happens client-side via `editor.view.coordsAtPos(from)`. Plan does NOT compute coords server-side; just returns row data + the mark's `from`/`to` is rediscovered client-side from the doc.
- **Migration runner precedent:** `scripts/migrate-h1.ts` + `scripts/migrate-h2.ts` (idempotent via `IF NOT EXISTS` + `DO $$ EXCEPTION WHEN duplicate_object`). H3's runner is `scripts/migrate-h3.ts` (same flat-directory pattern; the spec proposes `scripts/db/apply-h3-migration.ts` but we keep the existing convention).

### Plan Pre-flight Note A — `acceptSuggestionAction` doc-mutation strategy

The spec asks for "server-side TipTap helper: `deleteRange({ from, to })` + `insertContentAt(from, suggestion.suggestedText)`". Importing the full TipTap Editor on the server is heavy (it pulls in DOM dependencies from `@tiptap/pm/view`). A lighter approach walks the ProseMirror JSON document directly: locate the run of text nodes carrying the `hiveSuggestion` mark with the target id, splice them out, insert a single text node with the replacement. The mark's `inclusive: false` semantics + sibling marks (bold/italic) need careful handling. **Plan carries Option B (pure JSON walker)** in Task 14 with explicit unit tests including drifted ranges (mark moved by N chars due to upstream edit) and sibling-marked text (bold/italic preserved on adjacent text outside the suggestion range).

### Plan Pre-flight Note B — submission approval bypasses `requireBinderWritePermission`

Approving a submission creates a `chapters` row plus a `binderItems` row of type `chapter`. Routing this through `createBinderItemAction` would fail H2's permission gate (non-author hive members can't create chapter binder items). `approveSubmissionAction` therefore writes directly to the DB inside a transaction, **after** asserting `canReviewSubmission(role)`. The chapter's `authorUserId` is set to `submission.userId` (the submitter), not the reviewer. Reader sub-byline (Task 13) keys off this column. Plan calls this out explicitly in Task 11.

### Plan Pre-flight Note C — Two TipTap marks, three render sites

Both marks (`HiveAnnotationMark`, `HiveSuggestionMark`) must register in:
1. `chapter-editor.tsx` extension array (studio editor — interactive).
2. The new hive chapter view at `/hive/[hiveId]/chapters/[chapterId]` (read-only prose + gutter).
3. **The public reader** `/books/[bookId]/read/[chapterId]` (read-only prose; marks render as no-op spans so the doc round-trips on save, but they are visually invisible to the public).

The public reader registration is **parseHTML/renderHTML only** — no command handlers needed; it renders the mark as a transparent `<span>` so the chapter prose displays cleanly. Plan splits the marks into a base `parseHTML/renderHTML` core file plus a thin extension layer that wires commands for the editor surfaces.

### Plan Pre-flight Note D — Reader sub-byline + `chapters.authorUserId`

Adding `chapters.authorUserId` is straightforward but the reader page must project + render it. SP-A's reader at `/[locale]/books/[bookId]/read/[chapterId]/page.tsx` currently queries chapter rows without `authorUserId`. Task 12's migration adds the column; Task 13 updates the reader projection + adds the sub-byline component. Existing chapters get NULL → render no sub-byline (defaults to "by book author").

### Plan Pre-flight Note E — `hive_chapter_locks` drop has no callers

Grep confirmed zero references to `hiveChapterLocks` outside `db/schema/hive.ts` itself. Drop in T1 is unceremonious.

---

## Task Index

1. Schema migration — rename `hive_comments → hive_annotations` + extend, reshape `hive_suggestions`, reshape `hive_submissions`, add `chapters.author_user_id`, add `hive_discussion_posts.topic` + CHECK, drop `hive_chapter_locks`, new indexes.
2. Permission predicate extensions (`canPostDiscussion`, `canReviewSuggestion`, `canResolveAnnotation`, `canEditDiscussionPost`) + tests.
3. TipTap marks — `HiveAnnotationMark` + `HiveSuggestionMark` in `lib/tiptap-extensions/` + serialization round-trip tests.
4. TipTap mark scanning helpers — `findMarkRanges`, `findOrphanMarks` pure helpers + tests.
5. Server-side TipTap suggestion-application helper — `applySuggestionToDoc` pure JSON walker + tests.
6. Server actions — annotations (`createAnnotationAction`, `replyToAnnotationAction`, `resolveAnnotationAction`, `getChapterAnnotationsAction`).
7. Server actions — suggestions (`createSuggestionAction`, `replyToSuggestionAction`, `acceptSuggestionAction`, `rejectSuggestionAction`, `getChapterSuggestionsAction`, `getPendingSuggestionsForHiveAction`).
8. Server actions — submissions (`saveSubmissionDraftAction`, `submitSubmissionAction`, `approveSubmissionAction`, `rejectSubmissionAction`, `getSubmissionAction`, `listHiveSubmissionsAction`).
9. Server actions — discussions reshape (`createDiscussionPostAction` w/ topic, `replyToDiscussionPostAction`, `editDiscussionPostAction`, `deleteDiscussionPostAction`, `listDiscussionPostsAction` w/ topic filter).
10. Selection popover + Annotate / Suggest edit modals (studio editor + hive chapter view).
11. Right-gutter UI — `<CollaborationGutter>` with annotation + suggestion cards, filter strip, threading, resolve / accept / reject, orphan section.
12. Wire TipTap marks + gutter into `chapter-editor.tsx`.
13. New hive chapter view at `/hive/[hiveId]/chapters/[chapterId]` — read-only prose + collaboration gutter.
14. Reader sub-byline on `/books/[bookId]/read/[chapterId]` — projection + `<ChapterContributionByline>` component.
15. `/hive/[hiveId]/submissions` list page (3 sections).
16. `/hive/[hiveId]/submissions/new` compose page — draft TipTap editor + target-order picker.
17. `/hive/[hiveId]/submissions/[submissionId]` review page — Approve / Reject with review note.
18. `/hive/[hiveId]/suggestions` bulk-review page.
19. `/hive/[hiveId]/discussions` list page + compose modal + `/hive/[hiveId]/discussions/[postId]` thread page.
20. Activity event wiring audit — confirm all 8 H3 event types fire from the right actions with the right payload shape.
21. AGENTS.md update + final ship commit.

---

### Task 1: Schema migration

**Files:**
- Modify: `db/schema/hive.ts` (rename `hiveComments → hiveAnnotations`; add new columns; reshape `hiveSuggestions`, `hiveSubmissions`; extend `hiveDiscussionPosts`; drop `hiveChapterLocks` + relations; add new enums).
- Modify: `db/schema/books.ts` (add `chapters.authorUserId` column + relation).
- Create: `scripts/migrate-h3.ts`.

- [ ] **Step 1: Drizzle schema updates** (`db/schema/hive.ts`)

```ts
// New enums
export const annotationLayerEnum = pgEnum('annotation_layer', [
  'GRAMMAR', 'PLOT', 'TONE', 'CONTINUITY', 'GENERAL',
])

export const discussionTopicEnum = pgEnum('discussion_topic', [
  'GENERAL', 'WORLDBUILDING', 'FEEDBACK', 'OFF_TOPIC',
])

// Rename hiveComments → hiveAnnotations and extend
export const hiveAnnotations = pgTable('hive_annotations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): AnyPgColumn => hiveAnnotations.id, { onDelete: 'cascade' }),
  layer: annotationLayerEnum('layer').notNull().default('GENERAL'),
  selectionStart: integer('selection_start'),                     // renamed from anchor_start; nullable on replies
  selectionEnd: integer('selection_end'),                         // renamed from anchor_end; nullable on replies
  selectedText: text('selected_text'),                            // NEW
  body: text('body').notNull(),
  resolved: boolean('resolved').default(false).notNull(),
  resolvedBy: text('resolved_by').references(() => users.id),     // NEW
  resolvedAt: timestamp('resolved_at'),                           // NEW
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hive_annotations_chapter_id_idx').on(t.chapterId),
  index('hive_annotations_parent_id_idx').on(t.parentId),
])

// Reshape hiveSuggestions — range-targeted
export const hiveSuggestions = pgTable('hive_suggestions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): AnyPgColumn => hiveSuggestions.id, { onDelete: 'cascade' }),
  selectionStart: integer('selection_start').notNull(),
  selectionEnd: integer('selection_end').notNull(),
  originalExcerpt: text('original_excerpt').notNull(),
  suggestedText: text('suggested_text').notNull(),
  body: text('body'),                                             // optional reviewer rationale; nullable
  resolved: boolean('resolved').default(false).notNull(),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hive_suggestions_chapter_id_idx').on(t.chapterId),
  index('hive_suggestions_parent_id_idx').on(t.parentId),
])

// Reshape hiveSubmissions — carries draft content inline
export const hiveSubmissions = pgTable('hive_submissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // renamed from submitter_id
  title: text('title').notNull().default(''),
  content: jsonb('content').notNull().default(sql`'{}'::jsonb`),
  wordCount: integer('word_count').notNull().default(0),
  targetChapterOrder: integer('target_chapter_order'),  // nullable = end
  draftStatus: text('draft_status').notNull().default('DRAFT'),
  createdChapterId: text('created_chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hive_submissions_hive_id_idx').on(t.hiveId),
  index('hive_submissions_user_id_idx').on(t.userId),
  // CHECK is added in the migration runner; drizzle doesn't model it well.
])

// Extend hiveDiscussionPosts
export const hiveDiscussionPosts = pgTable('hive_discussion_posts', {
  // ... existing columns ...
  topic: discussionTopicEnum('topic'),  // nullable on replies; non-null on top-level (CHECK enforced)
}, ...)

// DELETE hiveChapterLocks table + relations
```

Update relations: rename `hiveCommentsRelations` → `hiveAnnotationsRelations`; add `parent` + `replies` self-relations on annotations and suggestions; delete `hiveChapterLocksRelations`.

- [ ] **Step 2: Drizzle schema updates** (`db/schema/books.ts`)

```ts
export const chapters = pgTable('chapters', {
  // ... existing columns ...
  authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),  // NEW
})

// In chaptersRelations:
//   author: one(users, { fields: [chapters.authorUserId], references: [users.id] }),
```

- [ ] **Step 3: Migration runner** (`scripts/migrate-h3.ts`)

```ts
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

  // 2. Rename hive_comments → hive_annotations, extend
  await sql`ALTER TABLE IF EXISTS hive_comments RENAME TO hive_annotations`
  await sql`ALTER TABLE hive_annotations RENAME COLUMN anchor_start TO selection_start`
  await sql`ALTER TABLE hive_annotations RENAME COLUMN anchor_end TO selection_end`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS layer annotation_layer NOT NULL DEFAULT 'GENERAL'`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS parent_id text REFERENCES hive_annotations(id) ON DELETE CASCADE`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS selected_text text`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES users(id)`
  await sql`ALTER TABLE hive_annotations ADD COLUMN IF NOT EXISTS resolved_at timestamp`
  await sql`CREATE INDEX IF NOT EXISTS hive_annotations_chapter_id_idx ON hive_annotations(chapter_id)`
  await sql`CREATE INDEX IF NOT EXISTS hive_annotations_parent_id_idx ON hive_annotations(parent_id)`
  console.log('✓ hive_annotations renamed + extended')

  // 3. Reshape hive_suggestions
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS original_text`
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS suggested_text`
  await sql`ALTER TABLE hive_suggestions DROP COLUMN IF EXISTS diff`
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
  await sql`UPDATE hive_submissions SET user_id = submitter_id WHERE user_id IS NULL AND submitter_id IS NOT NULL`
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

  // draft_status CHECK
  await sql`ALTER TABLE hive_submissions DROP CONSTRAINT IF EXISTS draft_status_check`
  await sql`ALTER TABLE hive_submissions
            ADD CONSTRAINT draft_status_check
            CHECK (draft_status IN ('DRAFT','PENDING','APPROVED','REJECTED'))`
  await sql`CREATE INDEX IF NOT EXISTS hive_submissions_hive_id_idx ON hive_submissions(hive_id)`
  await sql`CREATE INDEX IF NOT EXISTS hive_submissions_user_id_idx ON hive_submissions(user_id)`
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
```

- [ ] **Step 4: Run + tsc check**

```bash
npx dotenv -e .env.local -- tsx scripts/migrate-h3.ts
npx tsc --noEmit
```

Expect: 7 ✓ lines, final counts printed. Drizzle relation renames may cascade into other files; expected and resolved in T2.

- [ ] **Step 5: Commit**

```bash
git add db/schema/hive.ts db/schema/books.ts scripts/migrate-h3.ts
git commit -m "feat(hive): H3 T1 — schema migration (annotations rename, suggestions/submissions reshape, topic CHECK, drop chapter_locks)"
```

**Subagent dispatch prompt:**

> Implement Task 1 of `docs/superpowers/plans/2026-05-29-h3-collab-core.md`. Update `db/schema/hive.ts` to rename `hiveComments → hiveAnnotations` with the new columns, reshape `hiveSuggestions` and `hiveSubmissions`, extend `hiveDiscussionPosts` with `topic`, drop `hiveChapterLocks` (table + relations), add the two new enums `annotation_layer` + `discussion_topic`. Update `db/schema/books.ts` to add `chapters.authorUserId` + its relation. Create `scripts/migrate-h3.ts` matching the H2 migration runner's idempotent pattern (`IF NOT EXISTS` / `DO $$ EXCEPTION WHEN duplicate_object` / `DROP CONSTRAINT IF EXISTS`). Run the migration via `npx dotenv -e .env.local -- tsx scripts/migrate-h3.ts` and confirm the printed counts are sensible. Run `npx tsc --noEmit` (some non-load-bearing references to `hiveComments` in legacy tests / unused actions may break; resolve in T2). Commit as `feat(hive): H3 T1 — schema migration ...`.

> Reference: H2's `scripts/migrate-h2.ts` is the canonical precedent for the runner shape — copy its structure, including the `console.log('✓ ...')` cadence and the final counts dump.

---

### Task 2: Permission predicate extensions

**Files:**
- Modify: `lib/hive/permissions.ts` (append predicates + tests).
- Modify: `lib/hive/__tests__/permissions.test.ts`.

- [ ] **Step 1: Append predicates**

```ts
// lib/hive/permissions.ts (append after existing predicates)

export const canPostDiscussion = (_r: HiveRole) => true   // all members
export const canReviewSuggestion = (r: HiveRole) => r === 'OWNER' || r === 'MODERATOR'

/**
 * Resolve an annotation: the book's author OR the annotation's own author.
 * (Hive moderators/owners are NOT granted resolve permission by default —
 *  the spec is intentional that resolution is a content decision, not a moderation one.)
 */
export function canResolveAnnotation(
  annotation: { authorId: string },
  _viewerRole: HiveRole,
  viewerId: string,
  bookOwnerId: string,
): boolean {
  return viewerId === bookOwnerId || viewerId === annotation.authorId
}

/**
 * Edit/delete a discussion post: post author OR OWNER/MODERATOR (for moderation).
 */
export function canEditDiscussionPost(
  post: { authorId: string },
  viewerRole: HiveRole,
  viewerId: string,
): boolean {
  return viewerId === post.authorId || viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
}
```

Note: `canSubmitChapter`, `canReviewSubmissions`, `canAnnotate`, `canSuggestEdits` already exist in `permissions.ts`. Do NOT redefine.

- [ ] **Step 2: Tests — extend `permissions.test.ts`**

```ts
import { canPostDiscussion, canReviewSuggestion, canResolveAnnotation, canEditDiscussionPost } from '../permissions'

describe('canPostDiscussion', () => {
  for (const role of ['OWNER','MODERATOR','CONTRIBUTOR','BETA_READER'] as const) {
    it(`${role} can post`, () => expect(canPostDiscussion(role)).toBe(true))
  }
})

describe('canReviewSuggestion', () => {
  it('OWNER allowed', () => expect(canReviewSuggestion('OWNER')).toBe(true))
  it('MODERATOR allowed', () => expect(canReviewSuggestion('MODERATOR')).toBe(true))
  it('CONTRIBUTOR denied', () => expect(canReviewSuggestion('CONTRIBUTOR')).toBe(false))
  it('BETA_READER denied', () => expect(canReviewSuggestion('BETA_READER')).toBe(false))
})

describe('canResolveAnnotation', () => {
  const annotation = { authorId: 'beta-1' }
  it('book owner resolves anyone', () =>
    expect(canResolveAnnotation(annotation, 'OWNER', 'author-1', 'author-1')).toBe(true))
  it('annotation author resolves their own', () =>
    expect(canResolveAnnotation(annotation, 'BETA_READER', 'beta-1', 'author-1')).toBe(true))
  it('other member cannot resolve', () =>
    expect(canResolveAnnotation(annotation, 'MODERATOR', 'mod-2', 'author-1')).toBe(false))
  it('non-author, non-book-owner contributor denied', () =>
    expect(canResolveAnnotation(annotation, 'CONTRIBUTOR', 'random', 'author-1')).toBe(false))
})

describe('canEditDiscussionPost', () => {
  const post = { authorId: 'beta-1' }
  it('post author allowed', () =>
    expect(canEditDiscussionPost(post, 'BETA_READER', 'beta-1')).toBe(true))
  it('OWNER allowed (moderation)', () =>
    expect(canEditDiscussionPost(post, 'OWNER', 'owner-1')).toBe(true))
  it('MODERATOR allowed', () =>
    expect(canEditDiscussionPost(post, 'MODERATOR', 'mod-1')).toBe(true))
  it('CONTRIBUTOR not allowed on other peoples posts', () =>
    expect(canEditDiscussionPost(post, 'CONTRIBUTOR', 'random')).toBe(false))
  it('BETA_READER not allowed on other peoples posts', () =>
    expect(canEditDiscussionPost(post, 'BETA_READER', 'random')).toBe(false))
})
```

- [ ] **Step 3: tsc + run tests**

```bash
npx tsc --noEmit && npm test -- permissions
```

- [ ] **Step 4: Commit**

```bash
git add lib/hive/permissions.ts lib/hive/__tests__/permissions.test.ts
git commit -m "feat(hive): H3 T2 — permission predicates canPostDiscussion / canReviewSuggestion / canResolveAnnotation / canEditDiscussionPost"
```

**Subagent dispatch prompt:**

> Implement Task 2. Append four pure predicates to `lib/hive/permissions.ts`: `canPostDiscussion`, `canReviewSuggestion`, `canResolveAnnotation`, `canEditDiscussionPost`. Match the existing predicate style at the top of the file (single-line arrow functions where possible; multi-arg functions for the two viewer-context-aware predicates). Extend `lib/hive/__tests__/permissions.test.ts` with the 14 cases above. tsc + `npm test -- permissions` clean. Do NOT redefine `canSubmitChapter`, `canReviewSubmissions`, `canAnnotate`, `canSuggestEdits` — they already exist. Commit as `feat(hive): H3 T2 ...`.

---

### Task 3: TipTap marks — `HiveAnnotationMark` + `HiveSuggestionMark`

**Files:**
- Create: `lib/tiptap-extensions/hive-annotation-mark.ts`.
- Create: `lib/tiptap-extensions/hive-suggestion-mark.ts`.
- Create: `lib/tiptap-extensions/__tests__/hive-marks.test.ts`.

- [ ] **Step 1: `HiveAnnotationMark`**

```ts
// lib/tiptap-extensions/hive-annotation-mark.ts
import { Mark, mergeAttributes } from '@tiptap/core'

export type AnnotationLayer = 'GRAMMAR' | 'PLOT' | 'TONE' | 'CONTINUITY' | 'GENERAL'

export interface HiveAnnotationOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hiveAnnotation: {
      setHiveAnnotation: (attrs: { annotationId: string; layer: AnnotationLayer }) => ReturnType
      unsetHiveAnnotation: (annotationId: string) => ReturnType
    }
  }
}

export const HiveAnnotationMark = Mark.create<HiveAnnotationOptions>({
  name: 'hiveAnnotation',
  inclusive: false,
  excludes: '',     // can coexist with bold/italic etc.
  addOptions() { return { HTMLAttributes: {} } },
  addAttributes() {
    return {
      annotationId: { default: null, parseHTML: el => el.getAttribute('data-annotation-id'),
                      renderHTML: a => a.annotationId ? { 'data-annotation-id': a.annotationId } : {} },
      layer:        { default: 'GENERAL', parseHTML: el => el.getAttribute('data-layer') ?? 'GENERAL',
                      renderHTML: a => ({ 'data-layer': a.layer }) },
    }
  },
  parseHTML() { return [{ tag: 'span[data-annotation-id]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'hive-annotation' }), 0]
  },
  addCommands() {
    return {
      setHiveAnnotation: attrs => ({ commands }) => commands.setMark(this.name, attrs),
      unsetHiveAnnotation: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})
```

- [ ] **Step 2: `HiveSuggestionMark`**

```ts
// lib/tiptap-extensions/hive-suggestion-mark.ts
import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hiveSuggestion: {
      setHiveSuggestion: (attrs: { suggestionId: string }) => ReturnType
      unsetHiveSuggestion: () => ReturnType
    }
  }
}

export const HiveSuggestionMark = Mark.create({
  name: 'hiveSuggestion',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      suggestionId: { default: null, parseHTML: el => el.getAttribute('data-suggestion-id'),
                      renderHTML: a => a.suggestionId ? { 'data-suggestion-id': a.suggestionId } : {} },
    }
  },
  parseHTML() { return [{ tag: 'span[data-suggestion-id]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'hive-suggestion' }), 0]
  },
  addCommands() {
    return {
      setHiveSuggestion: attrs => ({ commands }) => commands.setMark(this.name, attrs),
      unsetHiveSuggestion: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})
```

- [ ] **Step 3: Styling — extend `app/globals.css`**

```css
.hive-annotation       { background: oklch(from var(--brand) l c h / 0.18); border-bottom: 1.5px solid var(--brand); }
.hive-annotation[data-layer="GRAMMAR"]    { background: oklch(0.72 0.10 165 / 0.20); border-bottom-color: oklch(0.72 0.10 165); }
.hive-annotation[data-layer="PLOT"]       { background: oklch(0.72 0.13 25  / 0.20); border-bottom-color: oklch(0.72 0.13 25); }
.hive-annotation[data-layer="TONE"]       { background: oklch(0.72 0.13 290 / 0.20); border-bottom-color: oklch(0.72 0.13 290); }
.hive-annotation[data-layer="CONTINUITY"] { background: oklch(0.72 0.10 200 / 0.20); border-bottom-color: oklch(0.72 0.10 200); }
.hive-annotation[data-layer="GENERAL"]    { background: oklch(0.74 0.13 80  / 0.20); border-bottom-color: oklch(0.74 0.13 80); }

.hive-suggestion       { background: oklch(0.78 0.10 65 / 0.22); border-bottom: 1.5px dashed oklch(0.78 0.10 65); }

/* Public reader: render as invisible spans (marks ride along on save but don't visually leak to logged-out viewers) */
.public-reader .hive-annotation,
.public-reader .hive-suggestion { background: transparent; border-bottom: none; }
```

- [ ] **Step 4: Tests**

```ts
// lib/tiptap-extensions/__tests__/hive-marks.test.ts
import { describe, it, expect } from 'vitest'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { HiveAnnotationMark } from '../hive-annotation-mark'
import { HiveSuggestionMark } from '../hive-suggestion-mark'

describe('HiveAnnotationMark', () => {
  it('round-trips id + layer through HTML', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'text',
        text: 'Hello',
        marks: [{ type: 'hiveAnnotation', attrs: { annotationId: 'ann-1', layer: 'PLOT' } }],
      }]}],
    }
    const html = generateHTML(doc, [StarterKit, HiveAnnotationMark])
    expect(html).toContain('data-annotation-id="ann-1"')
    expect(html).toContain('data-layer="PLOT"')
  })
})

describe('HiveSuggestionMark', () => {
  it('round-trips id through HTML', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'text', text: 'World',
        marks: [{ type: 'hiveSuggestion', attrs: { suggestionId: 'sug-1' } }],
      }]}],
    }
    const html = generateHTML(doc, [StarterKit, HiveSuggestionMark])
    expect(html).toContain('data-suggestion-id="sug-1"')
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add lib/tiptap-extensions/hive-annotation-mark.ts lib/tiptap-extensions/hive-suggestion-mark.ts lib/tiptap-extensions/__tests__/ app/globals.css
git commit -m "feat(hive): H3 T3 — HiveAnnotationMark + HiveSuggestionMark TipTap marks"
```

**Subagent dispatch prompt:**

> Implement Task 3. Create two TipTap Mark extensions in `lib/tiptap-extensions/`: `HiveAnnotationMark` (attrs: `annotationId`, `layer`) and `HiveSuggestionMark` (attrs: `suggestionId`). Both: `inclusive: false`, `excludes: ''`, parseHTML on `span[data-...]`, renderHTML emits `<span class="hive-annotation|hive-suggestion" data-...>`. Add the CSS in `app/globals.css` per the plan including the `data-layer` color variations and the `.public-reader` reset. Write the round-trip tests using `@tiptap/html`'s `generateHTML`. tsc + tests clean. Commit as `feat(hive): H3 T3 ...`.

---

### Task 4: Mark scanning helpers (`findMarkRanges`, `findOrphanMarks`)

**Files:**
- Create: `lib/tiptap-extensions/mark-scanning.ts`.
- Create: `lib/tiptap-extensions/__tests__/mark-scanning.test.ts`.

- [ ] **Step 1: Helper module**

```ts
// lib/tiptap-extensions/mark-scanning.ts

/**
 * ProseMirror JSON node shape (subset we walk).
 */
export type PMMark = { type: string; attrs?: Record<string, unknown> }
export type PMNode = {
  type: string
  text?: string
  marks?: PMMark[]
  content?: PMNode[]
}

export interface MarkRange {
  from: number    // character offset within doc text
  to: number
  attrs: Record<string, unknown>
}

/**
 * Walk a ProseMirror JSON doc and return all character ranges that carry the
 * named mark, along with the mark's attrs. Ranges are based on text-only offsets
 * (the same offsets TipTap reports via editor.state.doc.textBetween).
 */
export function findMarkRanges(doc: PMNode, markName: string): MarkRange[] {
  const out: MarkRange[] = []
  let offset = 0
  let openRange: MarkRange | null = null

  function flush() { if (openRange) { out.push(openRange); openRange = null } }

  function walk(node: PMNode) {
    if (node.type === 'text' && typeof node.text === 'string') {
      const mark = node.marks?.find(m => m.type === markName)
      if (mark) {
        const attrs = mark.attrs ?? {}
        if (openRange && shallowEqAttrs(openRange.attrs, attrs)) {
          openRange.to = offset + node.text.length
        } else {
          flush()
          openRange = { from: offset, to: offset + node.text.length, attrs }
        }
      } else {
        flush()
      }
      offset += node.text.length
      return
    }
    flush() // block boundaries break marked runs
    if (node.content) for (const child of node.content) walk(child)
  }

  walk(doc)
  flush()
  return out
}

function shallowEqAttrs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => a[k] === b[k])
}

/**
 * Given a doc and a set of known mark ids (the rows that exist in DB), report:
 *  - orphanRows: ids that the DB has but no mark exists for (anchor lost — author deleted the text)
 *  - orphanMarks: ids the doc has but no DB row exists (DB row deleted out-of-band; rare)
 */
export function findOrphanMarks(
  doc: PMNode,
  markName: string,
  attrKey: string,
  dbIds: readonly string[],
): { orphanRows: string[]; orphanMarks: string[] } {
  const ranges = findMarkRanges(doc, markName)
  const docIds = new Set<string>()
  for (const r of ranges) {
    const id = r.attrs[attrKey]
    if (typeof id === 'string') docIds.add(id)
  }
  const dbSet = new Set(dbIds)
  return {
    orphanRows: [...dbSet].filter(id => !docIds.has(id)),
    orphanMarks: [...docIds].filter(id => !dbSet.has(id)),
  }
}
```

- [ ] **Step 2: Tests**

```ts
// 6 unit tests:
//   - single-text-node range
//   - multi-text-node range (same attrs collapse)
//   - block boundary breaks the range
//   - orphan row (DB id with no mark in doc)
//   - orphan mark (mark id with no DB row)
//   - sibling marks (bold/italic on adjacent text don't interfere)
```

- [ ] **Step 3: tsc + tests + commit**

```bash
npx tsc --noEmit && npm test -- mark-scanning
git add lib/tiptap-extensions/mark-scanning.ts lib/tiptap-extensions/__tests__/mark-scanning.test.ts
git commit -m "feat(hive): H3 T4 — findMarkRanges + findOrphanMarks pure helpers"
```

**Subagent dispatch prompt:**

> Implement Task 4. Create `lib/tiptap-extensions/mark-scanning.ts` exporting `findMarkRanges(doc, markName)` and `findOrphanMarks(doc, markName, attrKey, dbIds)`. Use a pure tree walk over ProseMirror JSON — do not import from `@tiptap/pm` at runtime. Coalesce adjacent text nodes carrying the same mark + same attrs into a single range; block-element boundaries break ranges. Write 6 unit tests covering single-text, multi-text-coalesced, block-break, orphan-row, orphan-mark, sibling-marks-preserved. tsc + tests clean. Commit as `feat(hive): H3 T4 ...`.

---

### Task 5: Server-side suggestion application — `applySuggestionToDoc`

**Files:**
- Create: `lib/tiptap-extensions/apply-suggestion.ts`.
- Create: `lib/tiptap-extensions/__tests__/apply-suggestion.test.ts`.

- [ ] **Step 1: Helper**

```ts
// lib/tiptap-extensions/apply-suggestion.ts
import type { PMNode } from './mark-scanning'
import { findMarkRanges } from './mark-scanning'

/**
 * Locate a `hiveSuggestion` mark with the target id and replace its marked text
 * range with `replacementText`. Returns the new doc + a flag indicating whether
 * the mark was found (orphaned suggestions return { doc: input, found: false }).
 *
 * Strategy: walk text nodes; when a text node carries the target mark, splice
 * its text down (or remove entirely if fully covered); insert a single new text
 * node carrying NO `hiveSuggestion` mark (but preserving sibling marks like
 * bold/italic that were on the original text).
 *
 * Adjacent text nodes carrying the same suggestion id are treated as one
 * contiguous run and all dropped; the replacement is inserted in place of the
 * first.
 */
export function applySuggestionToDoc(
  doc: PMNode,
  suggestionId: string,
  replacementText: string,
): { doc: PMNode; found: boolean } {
  // Implementation walks each block's content array, identifies contiguous
  // runs of text nodes carrying the mark id, and rewrites that run in place.
  // Sibling marks (bold/italic etc.) on the FIRST removed text node are
  // carried onto the inserted replacement text. Sibling marks that varied
  // across the run are dropped (user accepted the inserted text wholesale).
  // ...
}
```

- [ ] **Step 2: Tests — 7 cases**

```ts
//   1. Plain mark, simple replacement.
//   2. Mark spans multiple text nodes (coalesced run replaced as one).
//   3. Mark coexists with bold — replacement inherits bold.
//   4. Mark coexists with bold AND italic — both inherited.
//   5. Orphan: no mark in doc with that id → returned unchanged + found=false.
//   6. Drifted mark: text around the mark has shifted because an upstream edit
//      added characters — the replacement still lands at the mark's range, not
//      at the original selection_start offset (this is the load-bearing case).
//   7. Multiple text nodes with the same mark id in DIFFERENT block elements —
//      only the first block's run is replaced (suggestions are per-range).
```

- [ ] **Step 3: tsc + tests + commit**

```bash
npx tsc --noEmit && npm test -- apply-suggestion
git add lib/tiptap-extensions/apply-suggestion.ts lib/tiptap-extensions/__tests__/apply-suggestion.test.ts
git commit -m "feat(hive): H3 T5 — applySuggestionToDoc server-side TipTap JSON mutator"
```

**Subagent dispatch prompt:**

> Implement Task 5. Create `lib/tiptap-extensions/apply-suggestion.ts` exporting `applySuggestionToDoc(doc, suggestionId, replacementText) -> { doc, found }`. Pure ProseMirror JSON walker — no `@tiptap/pm` dependency at runtime. Sibling marks (bold/italic) on the leading replaced text node carry onto the replacement text. Orphan case returns `{ doc: input, found: false }`. Write the 7 tests in the plan, especially case 6 (drifted mark — replacement lands at the mark's current range, not the original `selection_start`). tsc + tests clean. Commit as `feat(hive): H3 T5 ...`.

---

### Task 6: Server actions — annotations

**Files:**
- Create: `lib/actions/hive-annotations.actions.ts`.
- Create: `lib/actions/__tests__/hive-annotations.test.ts`.

Actions:
- `createAnnotationAction({ hiveId, chapterId, layer, body, selectionStart, selectionEnd, selectedText })`
- `replyToAnnotationAction({ parentId, body })`
- `resolveAnnotationAction(annotationId)` / `unresolveAnnotationAction(annotationId)`
- `getChapterAnnotationsAction(chapterId, hiveId)` — returns rows + orphan ids list

- [ ] **Step 1: Action stubs**

Each action:
1. `await requireAuth()` → `userId`.
2. `await requireHiveMember(hiveId, userId)` → `role`.
3. Permission predicate check (`canAnnotate(role)` is always true for now but call it explicitly so future tightening is one-file).
4. Zod-validate input (new schemas in `lib/validations/hive-annotation.ts`).
5. DB transaction: insert annotation row + patch chapter doc to add the `hiveAnnotation` mark over the range. For replies, skip the doc patch (replies inherit parent range).
6. Inside the same tx, write `hive_activity` row via `recordHiveActivity(tx, { type: 'annotation_added', hiveId, actorId: userId, payload: { chapterId, layer, excerpt: selectedText?.slice(0, 80) } })`. **Top-level only — replies do NOT fire events.**
7. Return `{ success: true, data: { id } }`.

`resolveAnnotationAction`:
1. Load annotation + book to get `bookOwnerId`.
2. `canResolveAnnotation(annotation, role, userId, bookOwnerId)` — deny if false.
3. Update `resolved=true`, `resolvedBy=userId`, `resolvedAt=now()`.

`getChapterAnnotationsAction`:
1. Require hive membership.
2. Load all annotation rows for `chapterId` (top-level + replies, with `userProfiles` join for username/avatar).
3. Load the chapter doc; call `findOrphanMarks(doc, 'hiveAnnotation', 'annotationId', dbIds)`.
4. Return `{ annotations, orphanRowIds }`.

- [ ] **Step 2: Chapter doc patching**

The patching for `createAnnotationAction` walks the chapter doc (`contentJson`) and inserts a `hiveAnnotation` mark over the text spanning `[selectionStart, selectionEnd]`. Implementation lives in a private helper `patchDocWithMark(doc, markName, attrs, from, to): PMNode`. This is a sibling to T5's helper — similar JSON-walking shape. Add tests in T6's test file (3 cases: simple range, range spanning two text nodes, range that covers a text node with bold mark already — annotation rides alongside bold).

- [ ] **Step 3: Action tests (mocked DB)**

```ts
// vi.mock('@/db', ...) like H2 T4
//   - happy path creates row + writes activity event
//   - BETA_READER blocked: not currently (canAnnotate=true for all); place a
//     `expect(canAnnotate(role)).toBe(true)` sentinel test so a future
//     tightening flips the test red on purpose
//   - non-member blocked
//   - reply doesn't fire activity event
//   - resolve denied for non-author / non-bookOwner
//   - resolve allowed for annotation author
//   - resolve allowed for book owner
```

- [ ] **Step 4: tsc + tests + commit**

```bash
npx tsc --noEmit && npm test -- hive-annotations
git add lib/actions/hive-annotations.actions.ts lib/actions/__tests__/ lib/validations/hive-annotation.ts
git commit -m "feat(hive): H3 T6 — annotation server actions (create / reply / resolve / get)"
```

**Subagent dispatch prompt:**

> Implement Task 6. Create `lib/actions/hive-annotations.actions.ts` with `createAnnotationAction`, `replyToAnnotationAction`, `resolveAnnotationAction`, `unresolveAnnotationAction`, `getChapterAnnotationsAction`. Zod schemas in `lib/validations/hive-annotation.ts`. All actions: `requireAuth` → `requireHiveMember` → permission predicate (call `canAnnotate` explicitly even though it's always-true today) → Zod validate → DB transaction. Top-level `createAnnotationAction` patches the chapter doc to add the `hiveAnnotation` mark via a private `patchDocWithMark(doc, markName, attrs, from, to)` helper, and writes a `hive_activity` row with type `annotation_added` inside the same transaction. Replies skip both. `resolveAnnotationAction` calls `canResolveAnnotation` against the actor + book owner. `getChapterAnnotationsAction` returns rows + `orphanRowIds` from `findOrphanMarks`. Tests cover the 8 cases in the plan. Commit as `feat(hive): H3 T6 ...`.

> Note: `recordHiveActivity` from H1 (`lib/hive/record-activity.ts`) is the writer — confirm its signature accepts a `tx` (transaction handle) parameter for in-transaction writes; if it does not, append a transaction-aware sibling `recordHiveActivityTx(tx, ...)`.

---

### Task 7: Server actions — suggestions

**Files:**
- Create: `lib/actions/hive-suggestions.actions.ts`.
- Create: `lib/actions/__tests__/hive-suggestions.test.ts`.

Actions:
- `createSuggestionAction({ hiveId, chapterId, selectionStart, selectionEnd, originalExcerpt, suggestedText, body? })`
- `replyToSuggestionAction({ parentId, body })`
- `acceptSuggestionAction(suggestionId)` — uses `applySuggestionToDoc` from T5
- `rejectSuggestionAction(suggestionId, note?)`
- `getChapterSuggestionsAction(chapterId, hiveId)` — rows + orphans
- `getPendingSuggestionsForHiveAction(hiveId)` — for the bulk-review page (T18); returns pending suggestions grouped by chapter with the chapter title joined

- [ ] **Step 1: `acceptSuggestionAction` flow**

1. `requireAuth` → `userId`; `requireHiveMember(hiveId, userId)` → `role`.
2. `canReviewSuggestion(role)` → deny if false.
3. Load the suggestion row + chapter row + book row.
4. DB transaction:
   - `applySuggestionToDoc(chapter.contentJson, suggestionId, suggestion.suggestedText) → { doc, found }`.
   - If `!found` → mark suggestion `resolved=true, resolvedBy=userId, resolvedAt=now()` with no doc mutation; return `{ success: true, data: { orphan: true } }`. (Reject path basically.)
   - Else: update chapter `contentJson=newDoc`, recompute `wordCount` via `extractWordCount` from `lib/tiptap-utils.ts`, take a snapshot (re-use the 60s-throttle logic from `saveChapterAction`).
   - Update suggestion: `resolved=true, resolvedBy=userId, resolvedAt=now(), acceptedAt=now()`.
   - Write `hive_activity` event `suggestion_accepted`.
5. Return `{ success: true, data: { acceptedAt, newWordCount } }`.

- [ ] **Step 2: `createSuggestionAction` doc-patch**

Same private `patchDocWithMark` helper used in T6, but with `hiveSuggestion` mark + `suggestionId` attr. Activity event `suggestion_proposed`. Top-level only.

- [ ] **Step 3: `rejectSuggestionAction`**

Updates suggestion: `resolved=true, resolvedBy=userId, resolvedAt=now()`, leaves `acceptedAt` NULL. Writes `suggestion_rejected` event. Does NOT touch the chapter doc — the mark stays in place but the gutter renderer filters out resolved suggestions by default.

- [ ] **Step 4: `getPendingSuggestionsForHiveAction`**

Joins suggestions + chapters + books + userProfiles. Returns:
```ts
{ chapterId, chapterTitle, suggestions: [{ id, authorUsername, authorAvatar, originalExcerpt, suggestedText, createdAt, hasReplies }] }[]
```

Grouped by chapter, chapters ordered by `binderItems.order`, suggestions within a chapter ordered by `createdAt ASC`.

- [ ] **Step 5: Tests**

Mocked-DB tests:
- `acceptSuggestionAction` happy path — chapter doc mutated correctly (use a real PMNode fixture; assert doc structure post-mutation).
- `acceptSuggestionAction` with drifted mark (sim T5 case 6).
- `acceptSuggestionAction` orphan path — DB row resolved without doc mutation, no `suggestion_accepted` event (writes `suggestion_rejected` semantically? Or special "orphan accepted" event? **Decision: write `suggestion_rejected` because the chapter didn't actually change. Reflect that in the action's payload too.**)
- `rejectSuggestionAction` does not mutate chapter doc.
- BETA_READER blocked from accept/reject; CONTRIBUTOR blocked from accept/reject (canReviewSuggestion=false); OWNER/MOD allowed.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/hive-suggestions.actions.ts lib/actions/__tests__/ lib/validations/hive-suggestion.ts
git commit -m "feat(hive): H3 T7 — suggestion server actions (create / reply / accept / reject)"
```

**Subagent dispatch prompt:**

> Implement Task 7. Create `lib/actions/hive-suggestions.actions.ts` with 6 actions per the plan. `createSuggestionAction` uses `patchDocWithMark` to install a `hiveSuggestion` mark over the range and writes `suggestion_proposed` event in-tx. `acceptSuggestionAction` is the load-bearing one: permission check (`canReviewSuggestion`), `applySuggestionToDoc` from T5, recompute word count, take a snapshot (re-use saveChapterAction's throttle logic), write `suggestion_accepted`. Orphan path: resolve suggestion without doc mutation, write `suggestion_rejected` instead. `rejectSuggestionAction` only resolves the row. `getPendingSuggestionsForHiveAction` joins for T18's bulk page. Mocked-DB tests covering the 5 cases listed. Commit as `feat(hive): H3 T7 ...`.

---

### Task 8: Server actions — submissions

**Files:**
- Create: `lib/actions/hive-submissions.actions.ts`.
- Create: `lib/actions/__tests__/hive-submissions.test.ts`.

Actions:
- `saveSubmissionDraftAction({ submissionId?, hiveId, title, content, targetChapterOrder })` — upserts; first call (no id) creates with `draft_status='DRAFT'`.
- `submitSubmissionAction(submissionId)` — DRAFT → PENDING; fires `chapter_submitted` event.
- `approveSubmissionAction(submissionId)` — PENDING → APPROVED; creates chapter + binderItem (bypassing `requireBinderWritePermission` — the privileged path).
- `rejectSubmissionAction(submissionId, reviewNote: required)`.
- `getSubmissionAction(submissionId)` — full row + author profile + book context.
- `listHiveSubmissionsAction(hiveId)` — 3 sections (myDrafts / mySubmissions / allInHive) based on viewer role.

- [ ] **Step 1: `saveSubmissionDraftAction`**

1. `requireAuth` → `userId`; `requireHiveMember(hiveId, userId)` → `role`.
2. `canSubmitChapter(role)` → deny (BETA_READER cannot draft).
3. Zod validate.
4. If `submissionId` provided: load it; assert `userId === submission.userId` AND `submission.draftStatus === 'DRAFT'` (locked once PENDING+). Update title/content/wordCount/targetChapterOrder/updatedAt.
5. Else: insert new row with `draftStatus='DRAFT'`. No activity event yet (draft → no buzz).
6. Compute `wordCount` server-side via `extractWordCount(content)`.

- [ ] **Step 2: `submitSubmissionAction`**

1. Permission check (same as save).
2. Load submission; assert `userId === submission.userId` AND `draftStatus === 'DRAFT'`.
3. Update `draftStatus='PENDING'`.
4. Write `hive_activity` event `chapter_submitted` in same tx; payload `{ submissionId, title, wordCount }`.

- [ ] **Step 3: `approveSubmissionAction` — the privileged binder-create path**

1. `requireAuth` → `userId`; `requireHiveMember(hiveId, userId)` → `role`.
2. `canReviewSubmissions(role)` → deny if false.
3. Load submission + hive + book.
4. Assert `submission.draftStatus === 'PENDING'`.
5. **DB transaction**:
   - Compute insertion order: if `targetChapterOrder` null → max + 1; else shift all `binderItems` at-or-above that order by +1 (`UPDATE binder_items SET "order" = "order" + 1 WHERE book_id = ? AND parent_id IS NULL AND "order" >= ?`).
   - Insert `chapters` row: `id=createId(), bookId, title=submission.title, contentJson=submission.content, wordCount=submission.wordCount, authorUserId=submission.userId, status='FIRST_DRAFT', wordGoal=0`.
   - Insert `binderItems` row: `type='chapter', bookId, parentId=null, title=submission.title, order=<computed>, content=null, authorId=submission.userId, lastEditedBy=submission.userId`. The `chapters.id` is the same id as the `binderItems.id` per the existing chapter-create convention in `lib/actions/binder.actions.ts` (verify; if not, link via a separate column — but check pre-flight).
   - Update submission: `draftStatus='APPROVED'`, `createdChapterId=<chapterId>`, `reviewedBy=userId`, `reviewedAt=now()`, `reviewNote` (optional).
   - Write `hive_activity` event `chapter_submitted_approved`; payload `{ submissionId, chapterId, title, wordCount, submitterUserId }`.
6. **Bypasses `requireBinderWritePermission`** — this is the privileged path. The reviewer is creating a chapter on behalf of the submitter; the permission gate would otherwise reject (non-author hive member creating a chapter binder item).

- [ ] **Step 4: `rejectSubmissionAction`**

1. Permission check.
2. Assert PENDING.
3. Update: `draftStatus='REJECTED'`, `reviewedBy`, `reviewedAt`, `reviewNote` (required — Zod schema enforces non-empty).
4. Write `chapter_submitted_rejected` event.

- [ ] **Step 5: `listHiveSubmissionsAction`**

Returns 3 sections based on viewer role:
- `myDrafts`: where `userId === viewer AND draftStatus === 'DRAFT'`.
- `mySubmissions`: where `userId === viewer AND draftStatus IN ('PENDING','APPROVED','REJECTED')`.
- `allInHive`: only when `canReviewSubmissions(role)` — all submissions in the hive, PENDING first.

- [ ] **Step 6: Tests — mocked DB**

```ts
//   - saveSubmissionDraftAction: BETA_READER blocked
//   - saveSubmissionDraftAction: PENDING submission can't be edited by submitter
//   - submitSubmissionAction: fires chapter_submitted event
//   - approveSubmissionAction: creates chapter, creates binderItem, shifts orders,
//     sets chapters.authorUserId = submitter
//   - approveSubmissionAction: BETA_READER + CONTRIBUTOR blocked; OWNER/MOD allowed
//   - approveSubmissionAction: PENDING required (DRAFT → throw, APPROVED → throw)
//   - rejectSubmissionAction: requires non-empty reviewNote
//   - listHiveSubmissionsAction: non-reviewer doesn't see allInHive
```

- [ ] **Step 7: Commit**

```bash
git add lib/actions/hive-submissions.actions.ts lib/actions/__tests__/ lib/validations/hive-submission.ts
git commit -m "feat(hive): H3 T8 — submission server actions (draft / submit / approve / reject)"
```

**Subagent dispatch prompt:**

> Implement Task 8. Create `lib/actions/hive-submissions.actions.ts` with the 6 actions per the plan. The load-bearing one is `approveSubmissionAction` — it BYPASSES `requireBinderWritePermission` from H2 because it's the privileged path creating a chapter on behalf of the submitter. Inside one transaction: shift sibling `binder_items.order` by +1 at-or-above the target slot, insert `chapters` row with `authorUserId=submission.userId`, insert `binderItems` row of type `chapter`, update submission to APPROVED, write `chapter_submitted_approved` event. `submitSubmissionAction` flips DRAFT→PENDING + fires `chapter_submitted`. `rejectSubmissionAction` requires a non-empty `reviewNote`. Tests cover the 8 cases. Commit as `feat(hive): H3 T8 ...`.

> Pre-flight check before writing: confirm the chapter-create convention in `lib/actions/binder.actions.ts` — specifically whether `chapters.id === binderItems.id` (single-row "chapter" representation) OR `binderItems.id` is independent. This determines the foreign-key shape for `createdChapterId`.

---

### Task 9: Server actions — discussions reshape

**Files:**
- Modify: existing `lib/actions/hive-content.actions.ts` (the discussion CRUD half lives here per AGENTS.md) OR move discussion actions into a new file `lib/actions/hive-discussions.actions.ts` for tidiness. **Plan picks the new-file route** — discussion actions are isolated from H2's wiki/outline/notes views.
- Create: `lib/actions/hive-discussions.actions.ts`.
- Modify: original `lib/actions/hive-content.actions.ts` to delete the legacy discussion actions (if any) and re-export from the new file for callers.
- Create: `lib/actions/__tests__/hive-discussions.test.ts`.

Actions:
- `createDiscussionPostAction({ hiveId, topic, title?, body })` — top-level only; topic required.
- `replyToDiscussionPostAction({ parentId, body })` — reply; topic field nullable (enforced by CHECK constraint from T1).
- `editDiscussionPostAction({ postId, body })` — permission via `canEditDiscussionPost`.
- `deleteDiscussionPostAction(postId)` — same permission.
- `listDiscussionPostsAction({ hiveId, topics? })` — multi-topic filter; returns top-level posts only with reply counts joined.
- `getDiscussionThreadAction(postId)` — top post + all replies (flat one level), `userProfiles` joined.

- [ ] **Step 1: `createDiscussionPostAction` flow**

1. `requireAuth` → `userId`; `requireHiveMember(hiveId, userId)` → `role`.
2. `canPostDiscussion(role)` (always true today; sentinel-call for future tightening).
3. Zod-validate `{ hiveId, topic: enum, title?, body }`. Derive `title` from `body.slice(0, 80)` if not provided.
4. DB transaction: insert top-level post (`parentId=null`, `topic` non-null); write `hive_activity` event `discussion_posted` with payload `{ postId, topic, title }`.

- [ ] **Step 2: `replyToDiscussionPostAction`**

1. Permission check.
2. Load parent → assert `parent.parentId === null` (one level of depth enforced in action; CHECK constraint enforces `topic IS NULL` on replies).
3. Insert reply with `parentId=parent.id`, `topic=null`.
4. NO activity event (would flood the feed).

- [ ] **Step 3: `listDiscussionPostsAction`**

Returns top-level posts only, filtered by `topics` array (default all 4). Joins:
- `userProfiles` (avatar + username for the author).
- Subquery for `replyCount = COUNT(*) WHERE parent_id = post.id`.
- Subquery for `lastActivityAt = MAX(replies.createdAt OR post.createdAt)`.

Ordered by `lastActivityAt DESC`.

- [ ] **Step 4: Tests**

```ts
//   - create top-level requires topic; reply forbids topic
//   - reply-to-reply rejected (one level only)
//   - listDiscussionPostsAction topic filter returns correct subset
//   - editDiscussionPostAction: post author allowed, OWNER allowed, MOD allowed,
//     other CONTRIBUTOR denied
//   - deleteDiscussionPostAction: cascades replies (FK ON DELETE CASCADE)
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/hive-discussions.actions.ts lib/actions/hive-content.actions.ts lib/actions/__tests__/ lib/validations/hive-discussion.ts
git commit -m "feat(hive): H3 T9 — discussion server actions (topic + threading + edit/delete + filter)"
```

**Subagent dispatch prompt:**

> Implement Task 9. Create `lib/actions/hive-discussions.actions.ts` with the 6 discussion actions per the plan. Reply-to-reply is rejected at the action layer (assert `parent.parentId === null`). `createDiscussionPostAction` fires `discussion_posted` activity (top-level only). `listDiscussionPostsAction` takes a `topics?: DiscussionTopic[]` filter and returns top-level posts only with reply-count + last-activity subqueries. `editDiscussionPostAction` + `deleteDiscussionPostAction` use `canEditDiscussionPost`. If `lib/actions/hive-content.actions.ts` still has any legacy discussion actions, delete them. Tests cover the 5 cases in the plan. Commit as `feat(hive): H3 T9 ...`.

---

### Task 10: Selection popover + Annotate / Suggest edit modals

**Files:**
- Create: `lib/hooks/use-selection-popover.ts` — hook that listens for TipTap selection changes and exposes `{ from, to, text, anchorRect, isOpen, close }`.
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/collab/selection-popover.tsx` — small 2-button popover (Annotate / Suggest edit) anchored above the selection.
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/collab/annotate-modal.tsx` — 5 layer radio cards + textarea + submit.
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/collab/suggest-modal.tsx` — strikethrough preview of original + replacement textarea + submit.

- [ ] **Step 1: `useSelectionPopover` hook**

```ts
export function useSelectionPopover(editor: Editor | null) {
  const [state, setState] = useState<{ from: number; to: number; text: string; anchorRect: DOMRect } | null>(null)
  useEffect(() => {
    if (!editor) return
    const handler = () => {
      const { from, to, empty } = editor.state.selection
      if (empty) { setState(null); return }
      const text = editor.state.doc.textBetween(from, to)
      const { left, top, right, bottom } = editor.view.coordsAtPos(from)
      const rect = new DOMRect(left, top, right - left, bottom - top)
      setState({ from, to, text, anchorRect: rect })
    }
    editor.on('selectionUpdate', handler)
    return () => { editor.off('selectionUpdate', handler) }
  }, [editor])
  return { ...state, close: () => setState(null) }
}
```

- [ ] **Step 2: Popover UI**

Anchored above the selection via `Popover` from `components/ui/popover.tsx`. Two buttons (lucide MessageSquare + Edit3). Disabled if viewer lacks `canAnnotate` / `canSuggestEdits` (in studio editor: always enabled because author; in hive chapter view: gated by membership).

Clicking Annotate → opens `AnnotateModal` with `{ from, to, text }`. Clicking Suggest → opens `SuggestModal`.

- [ ] **Step 3: `AnnotateModal`**

shadcn `Dialog`. 5 horizontal layer cards (radio): GRAMMAR / PLOT / TONE / CONTINUITY / GENERAL, each with a color dot using the CSS `--layer-*` variables added in T3. Textarea (TipTap minimal — body text + simple **bold** / _italic_). Submit → `createAnnotationAction({ hiveId, chapterId, layer, body, selectionStart: from, selectionEnd: to, selectedText: text })`. On success, `editor.commands.setHiveAnnotation({ annotationId, layer })` then close modal. (Plus refresh gutter — the gutter has its own React-Query-like reload hook.)

- [ ] **Step 4: `SuggestModal`**

shadcn `Dialog`. Strikethrough preview of selected text + textarea for replacement (plain text — no rich formatting because the replacement is text-only). Submit → `createSuggestionAction` then `editor.commands.setHiveSuggestion({ suggestionId })`. Close.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-selection-popover.ts app/[locale]/(app)/studio/[bookId]/_components/editor/collab/
git commit -m "feat(hive): H3 T10 — selection popover + Annotate / Suggest modals"
```

**Subagent dispatch prompt:**

> Implement Task 10. Create the `useSelectionPopover(editor)` hook that returns `{ from, to, text, anchorRect, close }` when the user makes a non-empty selection in a TipTap editor. Create `SelectionPopover` anchored above the selection with two buttons (Annotate / Suggest edit). Create `AnnotateModal` (5 layer radio cards + body textarea) and `SuggestModal` (strikethrough preview + replacement textarea). On submit, call the relevant T6/T7 server action and then call `editor.commands.setHiveAnnotation(...)` / `setHiveSuggestion(...)` to apply the mark locally. tsc clean. Commit as `feat(hive): H3 T10 ...`.

> Path detail: keep `collab/` directory both inside the studio editor `_components/editor/` AND in a sibling location for the hive chapter view (T13). Either share by relative-importing, or extract to a shared `components/hive/collab/` directory if tests reveal coupling concerns. Plan default: share via `components/hive/collab/`.

---

### Task 11: Right-gutter UI — `<CollaborationGutter>`

**Files:**
- Create: `components/hive/collab/collaboration-gutter.tsx` — main component.
- Create: `components/hive/collab/annotation-card.tsx`.
- Create: `components/hive/collab/suggestion-card.tsx`.
- Create: `components/hive/collab/gutter-filter-strip.tsx`.
- Create: `components/hive/collab/orphan-section.tsx`.
- Create: `lib/hooks/use-collab-data.ts` — fetches + caches annotations + suggestions for a chapter, exposes mutations.

- [ ] **Step 1: `<CollaborationGutter>` layout**

Right-side fixed-width column (300px) inside the chapter pane. Anchored items computed from each row's `selectionStart` via `editor.view.coordsAtPos(from)`; cards positioned absolutely with `top: <coordY>`. Collapsible via a hide/show toggle in the chapter toolbar. Filter strip pinned at top; orphan section pinned at bottom.

- [ ] **Step 2: Filter strip**

Pills above gutter: **All · Grammar · Plot · Tone · Continuity · General · Suggestions · Resolved**. Multi-select. "Resolved" off by default. State persisted per-user per-chapter in `localStorage` under key `collab:filter:<userId>:<chapterId>`.

- [ ] **Step 3: `<AnnotationCard>`**

Author avatar + username + relTime · layer color dot · first 2 lines of body · reply count chip · resolve check (shown only when `canResolveAnnotation(annotation, viewerRole, viewerId, bookOwnerId)`). Click → expands inline: full body, threaded replies (chronological), reply input. Replies fetched in same gutter query (joined).

- [ ] **Step 4: `<SuggestionCard>`**

Author avatar + username + relTime · "→" with strikethrough of `originalExcerpt` and inline `suggestedText` · Accept / Reject buttons (shown only for `canReviewSuggestion(role)`) · reply count chip. Click expands: full body (if present), full side-by-side diff, threaded replies, reply input.

Accept → `acceptSuggestionAction(suggestionId)` → on success, the chapter editor's TipTap state is invalidated and re-loaded from server (because we mutated the doc server-side). Use a `chapterContentVersion` counter in the editor provider so the chapter editor `useEditor` recreates with the fresh content.

Reject → `rejectSuggestionAction(suggestionId)`.

- [ ] **Step 5: `<OrphanSection>`**

Footer pill: "Orphaned (N)". Click expands a list showing `selectedText` + body with no anchor + Dismiss button (calls `resolveAnnotationAction` / `rejectSuggestionAction` with an orphan note).

- [ ] **Step 6: `useCollabData` hook**

Provides `{ annotations, suggestions, orphanRowIds, refresh, mutations }` — fetches on mount via `getChapterAnnotationsAction` + `getChapterSuggestionsAction`. Refresh after any mutation (create/reply/resolve/accept/reject).

- [ ] **Step 7: Commit**

```bash
git add components/hive/collab/ lib/hooks/use-collab-data.ts
git commit -m "feat(hive): H3 T11 — collaboration gutter with annotation + suggestion cards, filter strip, orphan section"
```

**Subagent dispatch prompt:**

> Implement Task 11. Build `<CollaborationGutter>` in `components/hive/collab/` — right-side 300px fixed-width column inside the chapter pane. Items anchored via `editor.view.coordsAtPos(from)`. Filter strip with multi-select pills (layers + Suggestions + Resolved), localStorage-persisted per-user per-chapter. Annotation cards show author + layer dot + 2-line excerpt + reply count + resolve check (gated). Suggestion cards show "→" diff + Accept/Reject (gated by `canReviewSuggestion`) + reply count. Orphan section at bottom. `useCollabData` hook owns the data fetch + cache + refresh after mutations. After `acceptSuggestionAction` succeeds, the parent editor invalidates its TipTap state via a `chapterContentVersion` counter prop so `useEditor` recreates with the fresh chapter content. tsc clean. Commit as `feat(hive): H3 T11 ...`.

---

### Task 12: Wire marks + gutter into `chapter-editor.tsx`

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`.

- [ ] **Step 1: Register marks in the extensions array**

Add `HiveAnnotationMark` and `HiveSuggestionMark` to the editor extensions. Confirm `saveChapterAction` already persists arbitrary marks (it does — TipTap JSON is round-tripped whole; no strip step). Verify with a quick test: type text, attach a mark via a dev command, reload page, assert mark survives.

- [ ] **Step 2: Mount selection popover + modals**

Inside the chapter pane (only when the chapter has an associated hive — `bookHive !== null` from the existing provider), render `<SelectionPopover>` + the two modals.

- [ ] **Step 3: Mount the gutter**

Right-side companion to the prose column. The studio's current right-panel slot pattern (from SP6 `RightPanelSlot`) already supports swapping panels; add a `'gutter'` state to that switch. Hidden by default; toggled via a new toolbar button (lucide MessagesSquare).

- [ ] **Step 4: `chapterContentVersion` counter**

Add a `chapterContentVersion: number` field to `BookEditorProvider`'s context. Increment after `acceptSuggestionAction` succeeds. The `useEditor` call in `ChapterEditor` keys on this so the editor recreates with the server-fresh doc.

- [ ] **Step 5: Author affordances**

The book author IS a hive member implicitly (via `requireBinderWritePermission` author bypass). For the author, the gutter shows all annotations + suggestions across the chapter; the selection popover offers Annotate / Suggest edit but is rare in practice (author writes, members annotate). Author's resolve check is always present on annotations (book-owner branch of `canResolveAnnotation`).

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx
git commit -m "feat(hive): H3 T12 — wire annotation + suggestion marks + collaboration gutter into studio editor"
```

**Subagent dispatch prompt:**

> Implement Task 12. Wire `HiveAnnotationMark` + `HiveSuggestionMark` into `chapter-editor.tsx`'s extensions array. Mount `<SelectionPopover>` + the two modals + `<CollaborationGutter>` inside the chapter pane WHEN `bookHive !== null`. Extend `BookEditorProvider` context with `chapterContentVersion: number` + `bumpChapterContentVersion()`. Add a toolbar button (lucide MessagesSquare) to toggle the gutter via the SP6 `RightPanelSlot` pattern (add `'gutter'` to the panel union). tsc clean. Commit as `feat(hive): H3 T12 ...`.

---

### Task 13: New hive chapter view at `/hive/[hiveId]/chapters/[chapterId]`

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/page.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx`.
- Modify: `lib/actions/hive-content.actions.ts` — add `getHiveChapterView(hiveId, chapterId)`.

- [ ] **Step 1: `getHiveChapterView`**

```ts
// Member-scoped read for a chapter in a hive.
// Returns: { chapter, book, authorProfile, hive, viewerRole, contentVersion }.
// requireHiveMember(hiveId, userId) gate.
// Asserts chapter.bookId === hive.bookId (cross-hive escape guard).
```

- [ ] **Step 2: Server page**

```tsx
export default async function HiveChapterPage({ params }) {
  const { hiveId, chapterId, locale } = await params
  const r = await getHiveChapterView(hiveId, chapterId)
  if (!r.success) notFound()
  return <HiveChapterSurface data={r.data} hiveId={hiveId} chapterId={chapterId} locale={locale} />
}
```

- [ ] **Step 3: `HiveChapterSurface` client component**

- Read-only TipTap render of `chapter.contentJson` with extensions = `[StarterKit, HiveAnnotationMark, HiveSuggestionMark]`.
- `<SelectionPopover>` + `<AnnotateModal>` + `<SuggestModal>` from T10.
- `<CollaborationGutter>` from T11.
- Header: chapter title + author byline ("@bookAuthor" or "@submitter — chapter contribution" if `chapter.authorUserId` is set) + member badge.
- Read-only: TipTap `editable={false}`; selection popover still works (you can select read-only text).

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/chapters/ lib/actions/hive-content.actions.ts
git commit -m "feat(hive): H3 T13 — /hive/[hiveId]/chapters/[chapterId] read-only chapter view with collab gutter"
```

**Subagent dispatch prompt:**

> Implement Task 13. Add `getHiveChapterView(hiveId, chapterId)` to `lib/actions/hive-content.actions.ts` — requires hive membership; joins author profile; cross-hive escape guard (chapter.bookId === hive.bookId). Create the page + `HiveChapterSurface` client component that renders the chapter read-only via TipTap (`editable={false}`) with both H3 marks registered, plus the `<SelectionPopover>` + `<CollaborationGutter>` so hive members can annotate / suggest edits without writing to the chapter doc directly. tsc clean. Commit as `feat(hive): H3 T13 ...`.

---

### Task 14: Reader sub-byline on public reader

**Files:**
- Modify: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx` — extend chapter projection with `authorUserId` + join `userProfiles` for the submitter when set.
- Create: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/_components/chapter-contribution-byline.tsx`.
- Modify: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx` to register the H3 marks in the read-only TipTap render so the public reader doesn't error on chapters that contain marks (renders them as transparent spans per the `.public-reader` CSS override).

- [ ] **Step 1: Update chapter projection**

```ts
const chapter = await db.query.chapters.findFirst({
  where: eq(chapters.id, chapterId),
  with: { author: true },  // join the new userProfiles via authorUserId
  // ...
})
```

- [ ] **Step 2: `<ChapterContributionByline>` component**

Renders only when `chapter.authorUserId !== null AND chapter.authorUserId !== book.userId`:

```tsx
<p className="text-sm text-muted-foreground italic">
  Written by <Link href={`/u/${author.username}`}>@{author.username}</Link>
  {' '}— chapter contribution to{' '}
  <span className="not-italic">{book.title}</span>{' '}
  by <Link href={`/u/${bookAuthor.username}`}>@{bookAuthor.username}</Link>
</p>
```

Positioned between the chapter title and the prose body.

- [ ] **Step 3: Mark registration in public reader**

The public reader currently uses StarterKit only. Add `HiveAnnotationMark` + `HiveSuggestionMark` to its extension set so chapters that contain marks parse cleanly. Wrap the rendered prose in `<div className="public-reader">` so the CSS overrides from T3 make the marks transparent.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/books/[bookId]/read/[chapterId]/
git commit -m "feat(hive): H3 T14 — reader sub-byline + register H3 marks (transparent) in public reader"
```

**Subagent dispatch prompt:**

> Implement Task 14. Extend the public reader chapter projection with `authorUserId` + joined `userProfiles`. Create `<ChapterContributionByline>` that renders only when the chapter has a non-null `authorUserId` distinct from the book owner. Register `HiveAnnotationMark` + `HiveSuggestionMark` in the public reader's TipTap extension set and wrap the rendered prose in `<div className="public-reader">` so the T3 CSS reset hides the marks for logged-out viewers. tsc clean. Commit as `feat(hive): H3 T14 ...`.

---

### Task 15: `/hive/[hiveId]/submissions` list page (3 sections)

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/submissions/page.tsx` (replace H1 stub).
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submissions-list.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-row.tsx`.

- [ ] **Step 1: Server page**

Parallel-fetch `listHiveSubmissionsAction(hiveId)`. Pass `viewerRole` + 3 section arrays.

- [ ] **Step 2: Layout**

Header: title + "+ New Submission" CTA → `/hive/[hiveId]/submissions/new` (disabled with tooltip if `!canSubmitChapter(role)`). Three collapsible sections:
1. **My drafts** — DRAFT rows; click → `/submissions/[id]` (compose mode).
2. **My submissions** — PENDING/APPROVED/REJECTED rows owned by viewer; status pill (FIRST_DRAFT → blue, PENDING → amber, APPROVED → green, REJECTED → red — using existing `--status-*` tokens). Click → `/submissions/[id]` (read-only mode).
3. **All in this hive** — only rendered when `canReviewSubmissions(role)`; PENDING first ordered by `updatedAt DESC`; then resolved.

Empty states per section.

- [ ] **Step 3: Row component**

`<SubmissionRow>`: avatar + title + submitter username + word count + target order label + status pill + relTime. Click → `/submissions/[id]`.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/submissions/
git commit -m "feat(hive): H3 T15 — /hive/[hiveId]/submissions list with 3 role-scoped sections"
```

**Subagent dispatch prompt:**

> Implement Task 15. Replace the H1 stub at `app/[locale]/(app)/hive/[hiveId]/submissions/page.tsx`. Fetch via `listHiveSubmissionsAction`. Render three collapsible sections — My drafts / My submissions / All in this hive (last gated by `canReviewSubmissions`). `+ New Submission` CTA disabled for BETA_READER with tooltip. Status pills use existing `--status-*` tokens. tsc clean. Commit as `feat(hive): H3 T15 ...`.

---

### Task 16: `/hive/[hiveId]/submissions/new` compose page

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/new/page.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/[submissionId]/page.tsx` (handles both compose-existing-draft and review modes).
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-composer.tsx`.

- [ ] **Step 1: Server guard**

The compose page calls `requireHiveMember` + `canSubmitChapter(role)` server-side. BETA_READER → `redirect('/hive/[hiveId]/submissions')` so they don't see the form even via URL hop.

- [ ] **Step 2: `SubmissionComposer` client component**

Layout (sheet-style, mirroring H2 wiki entry / character chrome):
- Title input (contenteditable, font-comfortaa, 24px).
- Target-chapter-order dropdown: "Beginning" (order=0), "After Chapter 1", "After Chapter 2", ..., "End" (default — `targetChapterOrder=null`). Populated from existing chapters in the hive's book via a new `getHiveChapterListAction(hiveId)` (or piggy-back on existing `getHiveOutlineView` which returns chapters).
- Full TipTap editor (`StarterKit` + Newsreader prose + same chapter-editor CSS) MINUS `HiveAnnotationMark` and `HiveSuggestionMark` (drafts shouldn't carry marks — those only land on approved chapters via the editor surface).
- Word count chip + save status badge.
- "Submit" button (CTA: brand-yellow); calls `submitSubmissionAction(submissionId)` after final save.

Auto-save: `saveSubmissionDraftAction` debounced 800ms (matching H2 wiki entry pattern). First save creates the row + redirects to `/submissions/[newId]` so future saves carry the id.

- [ ] **Step 3: Resume-from-draft**

`/hive/[hiveId]/submissions/[submissionId]` for an existing DRAFT owned by the viewer reuses `SubmissionComposer` with the row pre-loaded. PENDING/APPROVED/REJECTED rows render the row in read-only mode (`<SubmissionRead>` component — see T17).

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/submissions/new/ app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-composer.tsx
git commit -m "feat(hive): H3 T16 — submission compose page with auto-save TipTap draft"
```

**Subagent dispatch prompt:**

> Implement Task 16. Create the compose page at `/hive/[hiveId]/submissions/new` — server-gated by `canSubmitChapter` (BETA_READER redirect). `SubmissionComposer` is a sheet-style client component with title input, target-chapter-order dropdown, full TipTap editor (StarterKit only — no H3 marks at draft stage), word count chip, save status badge, and a brand-yellow Submit button. 800ms-debounced `saveSubmissionDraftAction`. First save creates the row + redirects to `/submissions/[newId]`. Submit button calls `submitSubmissionAction`. tsc clean. Commit as `feat(hive): H3 T16 ...`.

---

### Task 17: `/hive/[hiveId]/submissions/[submissionId]` review page

**Files:**
- Modify: existing dynamic page from T16 (it handles both compose and review modes).
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-review.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/submissions/_components/submission-read.tsx`.

- [ ] **Step 1: Branch on viewer + status**

```tsx
const sub = await getSubmissionAction(submissionId)
const role = await requireHiveMember(hiveId, userId)
const isOwner = sub.userId === userId
const canReview = canReviewSubmissions(role)

if (sub.draftStatus === 'DRAFT' && isOwner) return <SubmissionComposer ... />
if (sub.draftStatus === 'PENDING' && canReview) return <SubmissionReview ... />
return <SubmissionRead ... />   // read-only for everyone else
```

- [ ] **Step 2: `SubmissionReview` component**

- Header card: submitter avatar + username · timestamp · target-order label · word count · current status pill.
- Body: rendered TipTap content (read-only, StarterKit only).
- Footer card with two CTAs: **Approve** (calls `approveSubmissionAction`; on success → router.push to the created chapter in `/studio/[bookId]?chapter=<id>` if viewer is book owner, else to the hive chapter view) and **Reject** (opens a dialog with a required review-note textarea; calls `rejectSubmissionAction`).

- [ ] **Step 3: `SubmissionRead` component**

Read-only render with status pill + review-note (if rejected) + "Submitted by @x on Y" header. For APPROVED rows, link to the created chapter via `created_chapter_id`.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/submissions/[submissionId]/
git commit -m "feat(hive): H3 T17 — submission review page + read-only state"
```

**Subagent dispatch prompt:**

> Implement Task 17. The dynamic page `/hive/[hiveId]/submissions/[submissionId]` branches: DRAFT + viewer-is-owner → `SubmissionComposer` (T16); PENDING + `canReviewSubmissions(role)` → `SubmissionReview` (Approve/Reject); else → `SubmissionRead` (read-only). Reject opens a ConfirmDialog with a required review-note textarea. Approve on success routes to the created chapter. tsc clean. Commit as `feat(hive): H3 T17 ...`.

---

### Task 18: `/hive/[hiveId]/suggestions` bulk-review page

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/suggestions/page.tsx` (replace H1 stub).
- Create: `app/[locale]/(app)/hive/[hiveId]/suggestions/_components/suggestions-by-chapter.tsx`.

- [ ] **Step 1: Server page**

```tsx
const role = await requireHiveMember(hiveId, userId)
if (!canReviewSuggestion(role)) return <ComingSoon message="Suggestion review is for hive owners and moderators." />
const data = await getPendingSuggestionsForHiveAction(hiveId)
return <SuggestionsByChapter data={data} hiveId={hiveId} locale={locale} />
```

- [ ] **Step 2: Layout**

Group by chapter. Each chapter group: chapter title (links to `/hive/[hiveId]/chapters/[chapterId]`) + count of pending suggestions + collapsible list. Each suggestion row: author + relTime + inline diff (strikethrough original + replacement) + Accept / Reject buttons + "Open in chapter" link (deep links to the chapter view + scrolls to the suggestion via fragment `#sug-<id>`).

Accept/Reject from this bulk view calls the same T7 actions; success refreshes the data via `router.refresh()`.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/suggestions/
git commit -m "feat(hive): H3 T18 — /hive/[hiveId]/suggestions bulk-review surface"
```

**Subagent dispatch prompt:**

> Implement Task 18. Replace the H1 stub at `/hive/[hiveId]/suggestions/page.tsx`. Gated to `canReviewSuggestion(role)` — non-reviewer sees ComingSoon-style message. Fetch via `getPendingSuggestionsForHiveAction`. Group by chapter; each suggestion shows the diff inline + Accept/Reject + "Open in chapter" deep link with `#sug-<id>` fragment. Accept/Reject calls T7 actions then `router.refresh()`. tsc clean. Commit as `feat(hive): H3 T18 ...`.

---

### Task 19: Discussions list + thread + compose modal

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/discussions/page.tsx` (replace H1 stub).
- Create: `app/[locale]/(app)/hive/[hiveId]/discussions/[postId]/page.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussions-list.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-row.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-compose-modal.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/discussions/_components/discussion-thread.tsx`.

- [ ] **Step 1: List page**

Header: title · "+ New Post" CTA opens `DiscussionComposeModal`. Topic filter chip strip: All · General · Worldbuilding · Feedback · Off-topic (multi-select, color-coded per `--wiki-*` tokens or new `--topic-*` tokens — plan picks the existing `--wiki-*` palette: GENERAL→other, WORLDBUILDING→lore, FEEDBACK→theme, OFF_TOPIC→terminology). Feed: top-level posts reverse-chron via `listDiscussionPostsAction({ hiveId, topics })`. Each row: avatar · topic pill · title (or first-80-chars of body bolded) · body excerpt · reply count · last-activity timestamp · click → `/discussions/[postId]`.

- [ ] **Step 2: Compose modal**

shadcn `Dialog`. Topic radio (4 chips, GENERAL default) · title input (optional, derived from `body.slice(0, 80)` if empty) · TipTap body (StarterKit, no headings). Submit → `createDiscussionPostAction`. Close + router.refresh.

- [ ] **Step 3: Thread page**

Server: load top post + replies (via `getDiscussionThreadAction`). Layout:
- Top post in full (rendered TipTap; author + relTime + topic pill).
- Reply input pinned at top of replies area (TipTap StarterKit minimal).
- Replies chronological, **flat one level**. Each reply has a `Reply` button that puts cursor in the main reply input with `@username ` prepended.
- Owner/moderator/post-author get Edit + Delete via `canEditDiscussionPost`.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/discussions/
git commit -m "feat(hive): H3 T19 — discussions list + thread + compose modal with topic filter"
```

**Subagent dispatch prompt:**

> Implement Task 19. Replace the H1 stub at `/hive/[hiveId]/discussions/page.tsx`. List page: topic-pill multi-select + reverse-chron feed of top-level posts via `listDiscussionPostsAction({ hiveId, topics })`. `+ New Post` opens `DiscussionComposeModal` (topic radio default GENERAL, optional title, StarterKit TipTap body, no headings). Thread page at `/discussions/[postId]`: top post + flat one-level replies + reply input at top. Reply button prepends `@username ` into the reply input. `canEditDiscussionPost` gates the edit/delete kebab. tsc clean. Commit as `feat(hive): H3 T19 ...`.

---

### Task 20: Activity event wiring audit

**Files:**
- Audit only — no new files. Verify each event type fires from the right action with the right payload shape.

- [ ] **Step 1: Audit checklist**

For each of the 8 event types, confirm in the relevant action file:

| Event type                       | Fired from                            | Payload shape                                              |
| -------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `chapter_submitted`              | `submitSubmissionAction`              | `{ submissionId, title, wordCount }`                       |
| `chapter_submitted_approved`     | `approveSubmissionAction`             | `{ submissionId, chapterId, title, wordCount, submitterUserId }` |
| `chapter_submitted_rejected`     | `rejectSubmissionAction`              | `{ submissionId, title, reviewNote }`                      |
| `annotation_added`               | `createAnnotationAction` (TOP-LEVEL only) | `{ annotationId, chapterId, layer, excerpt }`         |
| `suggestion_proposed`            | `createSuggestionAction` (TOP-LEVEL only) | `{ suggestionId, chapterId, originalExcerpt, suggestedText }` |
| `suggestion_accepted`            | `acceptSuggestionAction`              | `{ suggestionId, chapterId }`                              |
| `suggestion_rejected`            | `rejectSuggestionAction`              | `{ suggestionId, chapterId, note }`                        |
| `discussion_posted`              | `createDiscussionPostAction` (TOP-LEVEL only) | `{ postId, topic, title }`                         |

For each:
1. Confirm the activity row is written inside the SAME transaction as the source-row insert. If a feature went tx-less by accident, fix.
2. Confirm replies do NOT emit events.
3. Confirm the payload denormalizes the fields `/community`'s feed renderer expects (the H1 `<ActivityEventRow>` has copy templates for all 8 — re-read that component to map each event's denorm needs).
4. Add an inline comment near each `recordHiveActivity` call documenting the payload shape (lowers future drift).

- [ ] **Step 2: Spot-check /community after firing one of each event type**

Manual smoke (per Chris's pref): create one of each event by exercising the actions through the new UI surfaces; load `/community`; confirm 8 rows with the right copy/links/avatars.

- [ ] **Step 3: Commit (only if any source-fix landed)**

```bash
git add lib/actions/
git commit -m "feat(hive): H3 T20 — activity event wiring audit + payload comments"
```

**Subagent dispatch prompt:**

> Audit Task 20. For each of the 8 H3 event types in the table in the plan, confirm: (a) it fires from the listed action, (b) inside the same DB transaction as the source-row insert, (c) only on top-level inserts (replies emit nothing), (d) the payload denormalizes the fields `ActivityEventRow` in `/community` consumes. If any of those are violated, fix and re-test. Add an inline comment near each `recordHiveActivity` call documenting the payload shape so future drift is caught. tsc + tests clean. Commit only if any source-fix landed.

---

### Task 21: AGENTS.md update + final ship commit

**Files:**
- Modify: `AGENTS.md`.

- [ ] **Step 1: Add H3 entry above H2 in "What Has Been Built"**

```markdown
### Hives Redesign — H3 Collaboration Core ✅ COMPLETE (2026-05-30)

Third of 5 sub-projects. Lands the four collaboration surfaces — annotations, edit
suggestions, submit chapter, and discussions — on top of H2's binder mirror.

- **Schema** (`scripts/migrate-h3.ts`):
  - `hive_comments` renamed to `hive_annotations`, with new columns:
    `layer annotation_layer NOT NULL DEFAULT 'GENERAL'`, `parent_id` self-FK
    (CASCADE), `selected_text`, `resolved_by`, `resolved_at`. Indexes on
    `chapter_id` + `parent_id`.
  - `hive_suggestions` reshaped: dropped `original_text`/`suggested_text`/`diff`;
    added `selection_start`/`selection_end`/`original_excerpt`/`suggested_text`/
    `parent_id`/`resolved`/`resolved_by`/`resolved_at`/`accepted_at`. Indexes
    on `chapter_id` + `parent_id`.
  - `hive_submissions` reshaped to carry draft content inline: dropped
    `chapter_id`/`status`/`reviewer_note`/`submitter_id`; added `user_id`/
    `title`/`content jsonb`/`word_count`/`target_chapter_order`/`draft_status`
    (CHECK ∈ DRAFT/PENDING/APPROVED/REJECTED)/`created_chapter_id`/
    `reviewed_by`/`reviewed_at`/`review_note`.
  - `chapters.author_user_id` added (NULL = book owner; non-null = submitter).
  - `hive_discussion_posts.topic discussion_topic` added + CHECK constraint
    `topic_only_on_top_level` (non-null on top-level posts; null on replies).
  - `hive_chapter_locks` dropped (unused).
  - New enums: `annotation_layer` (GRAMMAR/PLOT/TONE/CONTINUITY/GENERAL),
    `discussion_topic` (GENERAL/WORLDBUILDING/FEEDBACK/OFF_TOPIC).
- **TipTap marks** (`lib/tiptap-extensions/`): `HiveAnnotationMark` (attrs:
  `annotationId`, `layer`) and `HiveSuggestionMark` (attrs: `suggestionId`).
  Both `inclusive: false`; round-trip parseHTML/renderHTML; commands wired
  for the studio editor + hive chapter view. Registered (parseHTML only) on
  the public reader too so chapter docs round-trip cleanly; rendered as
  transparent spans via `.public-reader` CSS.
- **Permission predicates** added to `lib/hive/permissions.ts`:
  `canPostDiscussion` (all), `canReviewSuggestion` (OWNER/MOD),
  `canResolveAnnotation` (book owner OR annotation author),
  `canEditDiscussionPost` (post author OR OWNER/MOD).
- **Mark scanning helpers** (`lib/tiptap-extensions/mark-scanning.ts`):
  `findMarkRanges(doc, markName)` + `findOrphanMarks(doc, markName, attrKey,
  dbIds)` — pure ProseMirror JSON walkers. Used by the orphan section in the
  collaboration gutter.
- **Server-side suggestion application** (`lib/tiptap-extensions/apply-suggestion.ts`):
  `applySuggestionToDoc(doc, suggestionId, replacementText) → { doc, found }`.
  Carries sibling marks (bold/italic) onto the replacement text. Handles
  drifted marks correctly — replacement lands at the mark's current range,
  not the original `selection_start`.
- **Annotation actions** (`lib/actions/hive-annotations.actions.ts`):
  `createAnnotationAction` (patches doc with mark; fires `annotation_added`),
  `replyToAnnotationAction` (no event, no mark — inherits parent range),
  `resolveAnnotationAction` (permission via `canResolveAnnotation`),
  `getChapterAnnotationsAction` (rows + orphanRowIds).
- **Suggestion actions** (`lib/actions/hive-suggestions.actions.ts`):
  `createSuggestionAction` (patches doc with mark; fires `suggestion_proposed`),
  `replyToSuggestionAction`, `acceptSuggestionAction` (applies replacement via
  `applySuggestionToDoc`; recomputes word count; snapshot via existing 60s
  throttle; fires `suggestion_accepted`), `rejectSuggestionAction` (no doc
  change; fires `suggestion_rejected`), `getChapterSuggestionsAction`,
  `getPendingSuggestionsForHiveAction`.
- **Submission actions** (`lib/actions/hive-submissions.actions.ts`):
  `saveSubmissionDraftAction` (debounced auto-save; BETA_READER blocked),
  `submitSubmissionAction` (DRAFT→PENDING; fires `chapter_submitted`),
  `approveSubmissionAction` (the privileged binder-create path — BYPASSES
  `requireBinderWritePermission` because it's the reviewer creating a
  chapter on behalf of the submitter; shifts sibling `binder_items.order`
  by +1 at-or-above the target; sets `chapters.author_user_id =
  submission.user_id`; fires `chapter_submitted_approved`),
  `rejectSubmissionAction` (requires non-empty review note; fires
  `chapter_submitted_rejected`), `getSubmissionAction`,
  `listHiveSubmissionsAction` (3 sections role-scoped).
- **Discussion actions** (`lib/actions/hive-discussions.actions.ts`):
  `createDiscussionPostAction` (top-level only; topic required; fires
  `discussion_posted`), `replyToDiscussionPostAction` (one level only —
  rejects reply-to-reply), `editDiscussionPostAction` /
  `deleteDiscussionPostAction` (permission via `canEditDiscussionPost`),
  `listDiscussionPostsAction` (multi-topic filter + reply-count + last-
  activity subquery), `getDiscussionThreadAction`.
- **Selection popover + modals** in `components/hive/collab/`:
  `<SelectionPopover>` (Annotate / Suggest edit anchored above selection),
  `<AnnotateModal>` (5-layer radio + body textarea), `<SuggestModal>`
  (strikethrough preview + replacement textarea).
- **Right-gutter UI** `<CollaborationGutter>`: items anchored via
  `editor.view.coordsAtPos(from)`; multi-select filter strip (5 layers +
  Suggestions + Resolved, localStorage-persisted per-user per-chapter);
  annotation cards with threaded replies + resolve check; suggestion cards
  with inline diff + Accept/Reject + threaded replies; orphan section at
  bottom showing rows that lost their anchor.
- **Studio editor** (`chapter-editor.tsx`): H3 marks registered; selection
  popover + modals + gutter mounted when `bookHive !== null`. New
  `chapterContentVersion` counter in `BookEditorProvider` bumped after
  `acceptSuggestionAction` so the editor re-creates with the server-fresh doc.
- **New hive chapter view** at `/hive/[hiveId]/chapters/[chapterId]`:
  read-only TipTap render (`editable={false}`) with H3 marks + selection
  popover + gutter so hive members annotate / suggest edits without
  writing to the chapter doc directly. Cross-hive escape guard
  (`chapter.bookId === hive.bookId`) inside `getHiveChapterView`.
- **Reader sub-byline** on `/[locale]/books/[bookId]/read/[chapterId]`:
  when `chapters.author_user_id IS NOT NULL` AND distinct from book owner,
  renders "Written by @submitter — chapter contribution to *Book* by
  @bookAuthor".
- **Submissions surfaces** at `/hive/[hiveId]/submissions/`:
  - List page with 3 role-scoped sections (My drafts / My submissions /
    All in this hive — last gated by `canReviewSubmissions`).
  - Compose page at `/submissions/new` (BETA_READER server-redirected) with
    title + target-chapter-order dropdown + full TipTap editor + 800ms
    auto-save.
  - Dynamic page at `/submissions/[submissionId]` branches: DRAFT+owner →
    composer; PENDING+reviewer → review (Approve/Reject); else read-only.
- **Bulk suggestion review** at `/hive/[hiveId]/suggestions`:
  `canReviewSuggestion` gate; grouped-by-chapter pending suggestions with
  inline diffs + Accept/Reject + deep-link to the chapter view.
- **Discussions surfaces** at `/hive/[hiveId]/discussions/`:
  - List page with topic-pill multi-select + reverse-chron feed.
  - Compose modal (topic radio default GENERAL + optional title + TipTap
    body with no headings).
  - Thread page at `/discussions/[postId]` with flat one-level replies.

**H3 pattern: privileged binder-create on submission approval.**
`approveSubmissionAction` does NOT route through `createBinderItemAction`
or `requireBinderWritePermission` — it writes directly to `binder_items`
+ `chapters` in its own transaction, with `chapters.author_user_id` set
to the submitter. This is the documented exception to H2's permission
gate: the reviewer is creating a chapter on the submitter's behalf.

**H3 pattern: doc-as-source-of-truth for ranges.** Annotation +
suggestion rows store an initial `selection_start`/`selection_end` for
display but the AUTHORITATIVE range is the TipTap mark on the chapter
doc — survived author edits naturally. `acceptSuggestionAction` uses the
mark's current range (via `applySuggestionToDoc` → `findMarkRanges`),
not the stored `selection_start`.

**H3 pattern: top-level only fires activity events.** Replies on
annotations / suggestions / discussions emit nothing — would flood the
feed. Add a comment near every `recordHiveActivity` call so future devs
don't forget the policy.

N/N tests, tsc clean.
```

- [ ] **Step 2: Update Resume Here block**

Bump `Last updated`, `Current focus`, `Last commit`. Suggested wording for `Current focus`:

> Hives redesign H3 Collaboration Core COMPLETE — annotations, edit suggestions, chapter submissions, and topic-tagged discussions all live; eight activity event types now firing into the /community feed. Next sub-project H4 Motivation (word goals + buzz board) or pivot to /settings index / Phase 9 polish / Stripe webhook dashboard config / SP-B Friendships.

- [ ] **Step 3: Append H3 patterns to Key Patterns**

```markdown
### H3 privileged binder-create on approval

`approveSubmissionAction` writes directly to `binder_items` + `chapters`
in its own transaction, bypassing `requireBinderWritePermission`. The
reviewer is creating a chapter on the submitter's behalf;
`chapters.author_user_id` is set to the submitter so the reader sub-
byline renders "Written by @submitter — chapter contribution to ...".
This is the documented exception to H2's permission gate.

### H3 doc-as-source-of-truth ranges

Annotation + suggestion rows persist initial `selection_start` /
`selection_end` for the orphan-detection ledger only. The
AUTHORITATIVE range is the TipTap mark on the chapter doc — it
survives author edits because TipTap maintains it through transforms.
Server-side operations (`acceptSuggestionAction`) walk the doc to
find the mark's CURRENT range via `findMarkRanges`, not the stored
offsets.

### H3 activity event policy

`hive_activity` events are written ONLY for top-level inserts —
replies on annotations / suggestions / discussions emit nothing
(would flood `/community`). All writes happen inside the same DB
transaction as the source-row insert. Each `recordHiveActivity` call
should have an inline comment documenting its payload shape so the
feed renderer's denormalization needs stay in sync.
```

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "feat(hive): H3 Collaboration Core — annotations, suggestions, submissions, discussions"
```

**Subagent dispatch prompt:**

> Implement Task 21 — the final ship. Run `npx tsc --noEmit && npm test` and ensure both are clean. Update `AGENTS.md`: add the H3 entry above H2 in "What Has Been Built" per the plan; bump the Resume Here block; append the three H3 patterns to Key Patterns. Final commit `feat(hive): H3 Collaboration Core — annotations, suggestions, submissions, discussions`. Push only if Chris asks.

---

## Self-Review Checklist

Before declaring H3 shipped:

- [ ] **Spec coverage:** every section of the spec (`Data Model`, `TipTap Extensions`, `In-Chapter Overlays`, `Submit Chapter Flow`, `Edit Suggestions Reviewer Flow`, `Discussions UI`, `Activity Event Wiring`, `Migration Plan`, `Test Plan`) has a corresponding task here.
- [ ] **Migration safety:** runner is idempotent — re-running is a no-op. All ALTERs use `IF NOT EXISTS` / `DO $$ EXCEPTION WHEN duplicate_object` / `DROP CONSTRAINT IF EXISTS`. `topic_only_on_top_level` CHECK added AFTER backfill (top-level posts get GENERAL).
- [ ] **Permission predicates:** `canPostDiscussion` / `canReviewSuggestion` / `canResolveAnnotation` / `canEditDiscussionPost` all added, all unit-tested. Existing predicates (`canSubmitChapter`, `canReviewSubmissions`, `canAnnotate`, `canSuggestEdits`) not redefined.
- [ ] **TipTap marks:** registered in (a) studio editor, (b) hive chapter view, (c) public reader (parseHTML only). `inclusive: false`; round-trip tested via `@tiptap/html`.
- [ ] **Mark scanning + suggestion application:** pure helpers, no `@tiptap/pm` runtime import; all 13 tests (T4 + T5) pass; drifted-mark case explicitly covered.
- [ ] **Activity events:** all 8 H3 event types fire from the right action; top-level only; same-tx as source-row; payload denormalized for `<ActivityEventRow>`. T20 audit complete.
- [ ] **Privileged path:** `approveSubmissionAction` bypasses `requireBinderWritePermission` and sets `chapters.author_user_id = submission.user_id`. Reader sub-byline keys off this.
- [ ] **BETA_READER policy:** can annotate (yes), can suggest (yes), cannot submit (server-redirect on /submissions/new).
- [ ] **Reply-depth-one:** `replyToDiscussionPostAction` rejects reply-to-reply at the action layer; annotation + suggestion replies inherit parent range (no own mark).
- [ ] **Orphan detection:** doc + DB ids reconciled via `findOrphanMarks`; surfaced in gutter's orphan section with Dismiss.
- [ ] **`chapterContentVersion` bump:** `BookEditorProvider` exposes the counter; `acceptSuggestionAction` callers bump it; `useEditor` keys on it so the editor reloads with the server-fresh doc.
- [ ] **tsc + tests:** clean at every task boundary commit. Final commit clean.
- [ ] **AGENTS.md:** entry above H2; Resume Here block bumped; three H3 patterns appended to Key Patterns.
