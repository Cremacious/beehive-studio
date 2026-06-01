# H4 — Motivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H4 of 5 (Hives redesign)
**Predecessors:** H1 Foundation (shipped `d162ddf`), H2 Mirror Model (shipped `7afac8c`), H3 Collaboration Core (planned `docs/superpowers/plans/2026-05-29-h3-collab-core.md`)
**Successors:** H5 Dashboard

**Goal:** Land the team-momentum layer the Hives redesign promised — shared Word Goals that accumulate progress automatically as anyone in the hive saves chapters on the linked book, and a lightweight Buzz Board for short text/link posts with likes. Two new feature surfaces under the H1 hive shell (`/word-goals` + `/buzz`), four new DB tables (`hive_word_goals`, `hive_word_logs`, `hive_buzz_posts`, `hive_buzz_likes`), one additive hook into `saveChapterAction`, one new `hive_activity` event type wired (`buzz_posted`). Milestones / achievements have been DROPPED from the redesign — do not add them.

**Spec:** [`docs/superpowers/specs/2026-05-29-h4-motivation-design.md`](../specs/2026-05-29-h4-motivation-design.md)
**Reference precedents (tone, granularity, code-shape inclusion):**
- [`docs/superpowers/plans/2026-05-29-h3-collab-core.md`](2026-05-29-h3-collab-core.md)
- [`docs/superpowers/plans/2026-05-29-h2-mirror-model.md`](2026-05-29-h2-mirror-model.md)

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (Neon Postgres), Tailwind v4, vitest. IDs are `text` (cuid2). Migrations run via a one-shot tsx script per AGENTS.md (drizzle-kit push needs TTY).

---

## Pre-flight Findings

Verified by direct reads + grep against `main` at HEAD = `7afac8c` (post-H2; H3 is assumed already shipped or in-flight — none of H4's surfaces depend on H3 code so order between H3 and H4 is independent).

- **`hive_activity_type` enum from H1 already declares `buzz_posted`** (`db/schema/hive.ts:163–179`). H4 only writes events; no enum additions. `record-activity.ts` from H1 is the writer; it accepts a `payload: Record<string, unknown>` so the `buzz_posted` denormalized payload (`{ type, bodyExcerpt, linkUrl? }`) slots in cleanly. Word logs DELIBERATELY do not emit `hive_activity` rows — would flood the feed; momentum surfaces on the Word Goals page directly. The spec is explicit on this; the plan honors it.
- **Hive sidebar shell from H1** already has the `/word-goals` and `/buzz` entries (the 11-entry sidebar built in H1). Currently both render the shared `_components/coming-soon.tsx` stub. H4 replaces both stubs with real pages — the sidebar nav itself needs no changes.
- **`saveChapterAction` snapshot pattern** in `lib/actions/chapter.actions.ts:113–130` is H4's reference template: after the chapter tx commits, fetch the most recent snapshot for `(chapterId)`, compare `createdAt` to `now - 60_000`, insert if outside the window. Word-log throttle MUST mirror this shape — same 60s window, same outside-tx posture (a logging failure must NOT break the user's save), same per-(user, chapter) granularity. The H4 hook lands as a sibling block in the same function, after the snapshot block, fenced in its own `try { … } catch (e) { console.error(e) }` so a missing-hive lookup or transient DB error never throws into the save's return path.
- **`getBookHive(bookId)` from H1** (`lib/hive/get-book-hive.ts`) is the reverse-lookup the word-log hook needs. It is React-`cache()`-memoized for server-component render passes, but is safe to call from a server action — the cache scope is per-request, and a stale value can only over-log (write a row when no hive exists, impossible) or under-log (skip a row when hive was just created, acceptable — next save catches up). No new helper needed beyond a thin `logHiveWordDelta` wrapper that calls it.
- **`requireHiveMember(hiveId, userId)` from H1/H2** returns the role; H4 reuses it from every action gate. `scopedBooksForUser` is NOT needed in H4 — H4 surfaces are member-scoped on `hive_id`, never user-library-scoped, so the standalone-hive-shadow-book convention from H2 doesn't enter the picture. Standalone hives just work: the shadow book has chapters; saves through `saveChapterAction` flow through the same `logHiveWordDelta` hook and write logs into the real hive.
- **Permission predicates** appended to `lib/hive/permissions.ts`: `canSetWordGoal` (OWNER + MODERATOR), `canPostBuzz` (all members), `canLikeBuzz` (all members), `canEditBuzz` (post-author OR OWNER + MODERATOR). The spec uses `canSetWordGoal` as the umbrella for create/edit/archive — single predicate for all three actions per H3's `canReviewSuggestion` style. The live `hive_member_role` enum values are `OWNER / MODERATOR / CONTRIBUTOR / BETA_READER` (per AGENTS.md — schema is the source of truth) — all H4 predicates and tests use these names.
- **Word logs `words_added` semantics: signed delta.** A negative log row is a legitimate event — author deletes a paragraph between two saves. Goal-progress aggregation is `SUM(words_added)` filtered by the goal's date window; negatives roll the bar backward visually. Tests must include a negative-delta case to lock the math in. **First-row baseline:** the first row per `(user_id, chapter_id)` ever logged is the FULL word count at first log, not a delta from zero — same row schema, just an arithmetic convention. The pure helper `computeWordDelta(currentWordCount, sumOfPriorLogs)` makes this explicit.
- **Goals auto-archive lazily on view.** DAILY/WEEKLY/MONTHLY goals have a computed `end_date` from their `start_date`. When the view fires `listHiveWordGoalsAction`, the loader scans active goals, and for any whose `end_date < now`, flips `is_active = false` inline (still inside the same request). No cron. TOTAL goals have nullable `end_date` and never auto-archive. Lazy-archive is idempotent (re-running on already-archived rows is a no-op via `WHERE is_active = true`).
- **Goal partial-unique index** is `UNIQUE (hive_id, type) WHERE is_active = true`. Postgres partial-unique enforces "max one active per (hive, type)" at the DB level — `createWordGoalAction` MUST archive the existing active goal inside the same transaction BEFORE inserting the new one, or the unique-index violation throws. Plan calls this out in T6 with an explicit `UPDATE … WHERE is_active = true; INSERT …` ordering inside `db.transaction`.
- **`hive_buzz_posts.like_count` is denormalized** for cheap feed reads. Both `INSERT … hive_buzz_likes` + `UPDATE … like_count = like_count + 1` (and the inverse) MUST happen inside the same `db.transaction` so the count and the row set never drift permanently. Reconciliation SQL provided in the Migration Plan as a one-shot if drift is ever detected manually.
- **Buzz CHECK constraint** (`(type = 'LINK' AND link_url IS NOT NULL) OR (type = 'TEXT' AND link_url IS NULL)`) is added at the DB level via the migration runner — drizzle-kit doesn't model raw CHECK well, so the constraint is named (`hive_buzz_posts_type_link_check`) and added via `ALTER TABLE … ADD CONSTRAINT` with a `DROP CONSTRAINT IF EXISTS` first for idempotency.
- **Link URL validation** in `createBuzzPostAction` runs via the `URL()` constructor. Accepts `https://*`; rejects anything else (no `http://`, no `javascript:`, no schemeless). Plan keeps validation server-side authoritative; client-side mirror in the compose modal is for UX only.
- **Migration runner precedent:** `scripts/migrate-h1.ts` + `scripts/migrate-h2.ts` + `scripts/migrate-h3.ts` (idempotent via `IF NOT EXISTS` + `DO $$ EXCEPTION WHEN duplicate_object`). H4's runner is `scripts/migrate-h4.ts` (same flat-directory pattern; the spec proposes `db/migrations/0xxx_h4_motivation.sql + scripts/db/apply-h4-migration.ts` but we keep the existing convention).

### Plan Pre-flight Note A — Word-log throttle is the load-bearing hot path

`logHiveWordDelta` runs on every chapter save for every book that has a hive — the most-frequent server-action side effect in H4. The throttle (60s per `(hive_id, user_id, chapter_id)`) is the only thing keeping the table from accumulating one row per keystroke when autosave is aggressive. The check is a single indexed `SELECT … ORDER BY logged_at DESC LIMIT 1` on `hive_word_logs(user_id, chapter_id, logged_at DESC)` (the index from the migration). The plan keeps the helper SYNCHRONOUS-LOOKING for the caller (returns `Promise<void>`) but the entire body lives inside a `try { … } catch (e) { console.error('[H4] log-word-delta failed', e) }` so any DB hiccup degrades to a silently-dropped log rather than a user-facing save error.

### Plan Pre-flight Note B — Goal progress is recomputed on view

There is no denormalized `progress_words` column on `hive_word_goals`. Every render of the Word Goals page aggregates `SUM(words_added)` over the goal's window from `hive_word_logs`. With the `(hive_id, logged_at DESC)` index plus a window filter, this is cheap for hives with tens of thousands of logs and acceptable to millions. If a hive ever accumulates 10M+ rows, the spec's optional "collapse-to-dailies" perf optimization can land later. Plan does NOT introduce a denorm column up front.

### Plan Pre-flight Note C — Lazy auto-archive is on the read path

Goals expire by date, not by polling. The first action that loads goals after an expiry — `listHiveWordGoalsAction` — flips `is_active = false` on any goal whose `end_date < now()`. Pattern: a single `UPDATE … SET is_active=false, end_date=COALESCE(end_date, now()) WHERE hive_id=$1 AND is_active=true AND end_date IS NOT NULL AND end_date < now()` runs at the top of the action; then the SELECT runs against the freshly-archived state. Idempotent. Plan calls this out in T6 with explicit ordering.

### Plan Pre-flight Note D — Likes count denorm is per-tx

`toggleBuzzLikeAction` always wraps the INSERT-or-DELETE + UPDATE inside `db.transaction`. The Postgres tx isolates the read-modify-write so concurrent double-likes from the same user can't both INSERT (the composite PK on `(user_id, buzz_id)` prevents that anyway — second INSERT throws). The denorm increment is a `like_count = like_count + 1` set-expression, NOT a read-then-write, so it's safe under interleaved updates from different users on the same post. Tests include a "double-click toggle" case and an "interleaved different-user" case.

### Plan Pre-flight Note E — Hive sidebar progress badge is a small server fetch

The hive shell's left-rail "Word Goals" nav entry shows a thin progress bar when an active goal exists. To avoid blowing up the hive layout's per-page-render cost, the badge data comes from a SINGLE `getActiveWordGoalSummaryAction` (or composed into the existing hive-shell server fetch) that returns `{ goalType, progressPct } | null` — picks the highest-priority active goal (DAILY > WEEKLY > MONTHLY > TOTAL), runs the same window-filtered SUM as the page, returns nothing more. Cached for the duration of the request via React `cache()` so the shell + the Word Goals page nav don't double-query.

---

## Migration Plan

Single file: `scripts/migrate-h4.ts` (same flat-directory pattern as H1/H2/H3 runners — the spec's proposed `db/migrations/0xxx_h4_motivation.sql + scripts/db/apply-h4-migration.ts` shape is overridden by the existing convention).

**Steps in order:**

1. Create enums `word_goal_type` (DAILY, WEEKLY, MONTHLY, TOTAL), `buzz_post_type` (TEXT, LINK).
2. Create table `hive_word_goals` (id, hive_id FK CASCADE, created_by FK SET NULL, type, target_words CHECK > 0, start_date, end_date nullable, is_active default true, created_at).
3. Create partial-unique index `hive_word_goals_active_unique ON hive_word_goals(hive_id, type) WHERE is_active = true`.
4. Create table `hive_word_logs` (id, hive_id FK CASCADE, user_id FK CASCADE, chapter_id FK CASCADE, words_added integer signed, logged_at).
5. Create indexes on `hive_word_logs`:
   - `hive_word_logs_hive_id_logged_at_idx ON hive_word_logs(hive_id, logged_at DESC)`
   - `hive_word_logs_user_chapter_idx ON hive_word_logs(user_id, chapter_id, logged_at DESC)`
6. Create table `hive_buzz_posts` (id, hive_id FK CASCADE, author_id FK CASCADE, type, body text, link_url nullable, like_count integer default 0, created_at, updated_at).
7. Add CHECK constraint `hive_buzz_posts_type_link_check` enforcing `(type='LINK' AND link_url IS NOT NULL) OR (type='TEXT' AND link_url IS NULL)`. Add via `ALTER TABLE … ADD CONSTRAINT` after a `DROP CONSTRAINT IF EXISTS` for idempotency.
8. Create index `hive_buzz_posts_hive_created_idx ON hive_buzz_posts(hive_id, created_at DESC)`.
9. Create table `hive_buzz_likes` (user_id + buzz_id composite PK; both FKs CASCADE; created_at).
10. Print row counts for the four new tables.

No data backfill — all tables are new.

**Reconciliation snippet** (NOT run as part of the migration; documented here for the on-call playbook if `hive_buzz_posts.like_count` ever drifts from `hive_buzz_likes`):

```sql
UPDATE hive_buzz_posts p
SET like_count = COALESCE((SELECT COUNT(*) FROM hive_buzz_likes l WHERE l.buzz_id = p.id), 0);
```

---

## Task Index

1. Schema migration — new enums (`word_goal_type`, `buzz_post_type`), new tables (`hive_word_goals`, `hive_word_logs`, `hive_buzz_posts`, `hive_buzz_likes`), partial-unique + supporting indexes, CHECK constraint.
2. Permission predicate extensions (`canSetWordGoal`, `canPostBuzz`, `canLikeBuzz`, `canEditBuzz`) + tests.
3. Word-delta helpers — `computeWordDelta` pure function + tests.
4. `logHiveWordDelta` hook + integration into `saveChapterAction`.
5. Goal-progress helpers — `getGoalWindowFilter`, `aggregateGoalProgress`, `pickPrimaryActiveGoal` + tests.
6. Server actions — word goals (`createWordGoalAction`, `updateWordGoalAction`, `archiveWordGoalAction`, `listHiveWordGoalsAction`, `getWordGoalProgressAction`, `getActiveWordGoalSummaryAction`).
7. Server actions — word logs (`getRecentWordLogsAction`).
8. Server actions — buzz posts (`createBuzzPostAction`, `updateBuzzPostAction`, `deleteBuzzPostAction`, `listBuzzPostsAction`, `toggleBuzzLikeAction`).
9. `/hive/[hiveId]/word-goals` page — active goals strip + contributors panel + recent activity + history.
10. + New Goal / Edit / Archive modals.
11. Hive sidebar progress badge under the Word Goals nav entry.
12. `/hive/[hiveId]/buzz` page — feed + empty state + compose entry.
13. Compose / Edit / Delete buzz modals + like flow (optimistic UI).
14. Activity event wiring audit — confirm `buzz_posted` fires from `createBuzzPostAction` with the right payload, top-level only.
15. AGENTS.md update + final ship commit.

---

### Task 1: Schema migration

**Files:**
- Modify: `db/schema/hive.ts` (add `hiveWordGoals`, `hiveWordLogs`, `hiveBuzzPosts`, `hiveBuzzLikes` tables; add `wordGoalTypeEnum`, `buzzPostTypeEnum`; add relations blocks).
- Create: `scripts/migrate-h4.ts`.

- [ ] **Step 1: Drizzle schema updates** (`db/schema/hive.ts`)

```ts
// New enums
export const wordGoalTypeEnum = pgEnum('word_goal_type', ['DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL'])
export const buzzPostTypeEnum = pgEnum('buzz_post_type', ['TEXT', 'LINK'])

// hive_word_goals
export const hiveWordGoals = pgTable('hive_word_goals', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'set null' }),
  type: wordGoalTypeEnum('type').notNull(),
  targetWords: integer('target_words').notNull(),
  startDate: timestamp('start_date').defaultNow().notNull(),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  // Partial-unique index added in the migration runner (drizzle doesn't model partial uniques well)
])

// hive_word_logs
export const hiveWordLogs = pgTable('hive_word_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  wordsAdded: integer('words_added').notNull(),  // signed
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
}, (t) => [
  index('hive_word_logs_hive_id_logged_at_idx').on(t.hiveId, t.loggedAt),
  index('hive_word_logs_user_chapter_idx').on(t.userId, t.chapterId, t.loggedAt),
])

// hive_buzz_posts
export const hiveBuzzPosts = pgTable('hive_buzz_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: buzzPostTypeEnum('type').notNull(),
  body: text('body').notNull(),
  linkUrl: text('link_url'),
  likeCount: integer('like_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hive_buzz_posts_hive_created_idx').on(t.hiveId, t.createdAt),
  // CHECK constraint added in the migration runner.
])

// hive_buzz_likes — composite PK
export const hiveBuzzLikes = pgTable('hive_buzz_likes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  buzzId: text('buzz_id').notNull().references(() => hiveBuzzPosts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.buzzId] }),
])
```

Relations:
- `hiveWordGoals` — `hive` (one), `createdBy` (one)
- `hiveWordLogs` — `hive` (one), `user` (one), `chapter` (one)
- `hiveBuzzPosts` — `hive` (one), `author` (one), `likes` (many)
- `hiveBuzzLikes` — `user` (one), `post` (one)
- Add `wordGoals: many(hiveWordGoals)`, `wordLogs: many(hiveWordLogs)`, `buzzPosts: many(hiveBuzzPosts)` into the existing `hives` relations block.

- [ ] **Step 2: Migration runner** (`scripts/migrate-h4.ts`)

```ts
/**
 * One-shot migration for H4 (Motivation):
 *  1. Create enums word_goal_type, buzz_post_type.
 *  2. Create table hive_word_goals + partial-unique index on (hive_id, type) WHERE is_active.
 *  3. Create table hive_word_logs + composite indexes.
 *  4. Create table hive_buzz_posts + CHECK constraint + index.
 *  5. Create table hive_buzz_likes (composite PK).
 *  6. Print row counts.
 *
 * Idempotent via IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object / DROP CONSTRAINT IF EXISTS.
 * Run: npx dotenv -e .env.local -- tsx scripts/migrate-h4.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running H4 schema migration...')

  // 1. Enums
  await sql`DO $$ BEGIN
    CREATE TYPE word_goal_type AS ENUM ('DAILY','WEEKLY','MONTHLY','TOTAL');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE buzz_post_type AS ENUM ('TEXT','LINK');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ enums created')

  // 2. hive_word_goals
  await sql`CREATE TABLE IF NOT EXISTS hive_word_goals (
    id            text PRIMARY KEY,
    hive_id       text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    created_by    text NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    type          word_goal_type NOT NULL,
    target_words  integer NOT NULL CHECK (target_words > 0),
    start_date    timestamp NOT NULL DEFAULT now(),
    end_date      timestamp,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS hive_word_goals_active_unique
            ON hive_word_goals(hive_id, type) WHERE is_active = true`
  console.log('✓ hive_word_goals created')

  // 3. hive_word_logs
  await sql`CREATE TABLE IF NOT EXISTS hive_word_logs (
    id           text PRIMARY KEY,
    hive_id      text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    words_added  integer NOT NULL,
    logged_at    timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS hive_word_logs_hive_id_logged_at_idx
            ON hive_word_logs(hive_id, logged_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS hive_word_logs_user_chapter_idx
            ON hive_word_logs(user_id, chapter_id, logged_at DESC)`
  console.log('✓ hive_word_logs created')

  // 4. hive_buzz_posts + CHECK
  await sql`CREATE TABLE IF NOT EXISTS hive_buzz_posts (
    id          text PRIMARY KEY,
    hive_id     text NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    author_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        buzz_post_type NOT NULL,
    body        text NOT NULL,
    link_url    text,
    like_count  integer NOT NULL DEFAULT 0,
    created_at  timestamp NOT NULL DEFAULT now(),
    updated_at  timestamp NOT NULL DEFAULT now()
  )`
  await sql`ALTER TABLE hive_buzz_posts DROP CONSTRAINT IF EXISTS hive_buzz_posts_type_link_check`
  await sql`ALTER TABLE hive_buzz_posts
            ADD CONSTRAINT hive_buzz_posts_type_link_check
            CHECK ((type = 'LINK' AND link_url IS NOT NULL)
                OR (type = 'TEXT' AND link_url IS NULL))`
  await sql`CREATE INDEX IF NOT EXISTS hive_buzz_posts_hive_created_idx
            ON hive_buzz_posts(hive_id, created_at DESC)`
  console.log('✓ hive_buzz_posts created with CHECK')

  // 5. hive_buzz_likes
  await sql`CREATE TABLE IF NOT EXISTS hive_buzz_likes (
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buzz_id    text NOT NULL REFERENCES hive_buzz_posts(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, buzz_id)
  )`
  console.log('✓ hive_buzz_likes created')

  // 6. Counts
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM hive_word_goals)  AS goals,
      (SELECT COUNT(*) FROM hive_word_logs)   AS logs,
      (SELECT COUNT(*) FROM hive_buzz_posts)  AS posts,
      (SELECT COUNT(*) FROM hive_buzz_likes)  AS likes
  `
  console.log('Final counts:', counts[0])
  console.log('H4 migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run + tsc check**

```bash
npx dotenv -e .env.local -- tsx scripts/migrate-h4.ts
npx tsc --noEmit
```

Expect: 5 ✓ lines, final counts printed (all zero on first run). Drizzle schema imports cascade into a couple of action files that didn't exist yet — confined to H4-internal files.

- [ ] **Step 4: Commit**

```bash
git add db/schema/hive.ts scripts/migrate-h4.ts
git commit -m "feat(hive): H4 T1 — schema migration (word goals, word logs, buzz posts, buzz likes)"
```

**Subagent dispatch prompt:**

> Implement Task 1 of `docs/superpowers/plans/2026-05-29-h4-motivation.md`. Update `db/schema/hive.ts` to add four new tables (`hiveWordGoals`, `hiveWordLogs`, `hiveBuzzPosts`, `hiveBuzzLikes`) plus two new pgEnums (`wordGoalTypeEnum`, `buzzPostTypeEnum`). Add all relations blocks (including extensions to the existing `hives` relations). Composite PK on `hiveBuzzLikes` via drizzle's `primaryKey()` helper. Create `scripts/migrate-h4.ts` matching the H3 migration runner's idempotent pattern (`IF NOT EXISTS` / `DO $$ EXCEPTION WHEN duplicate_object` / `DROP CONSTRAINT IF EXISTS`). Include the partial-unique index on `hive_word_goals(hive_id, type) WHERE is_active = true` and the CHECK constraint on `hive_buzz_posts` enforcing the TEXT/LINK shape. Run via `npx dotenv -e .env.local -- tsx scripts/migrate-h4.ts` and confirm counts print as zeros. `npx tsc --noEmit` clean. Commit as `feat(hive): H4 T1 — schema migration ...`.

> Reference: H3's `scripts/migrate-h3.ts` is the canonical precedent — match the `console.log('✓ ...')` cadence and final counts dump.

---

### Task 2: Permission predicate extensions

**Files:**
- Modify: `lib/hive/permissions.ts` (append predicates).
- Modify: `lib/hive/__tests__/permissions.test.ts`.

- [ ] **Step 1: Append predicates**

```ts
// lib/hive/permissions.ts (append after existing predicates)

export const canSetWordGoal = (r: HiveRole) => r === 'OWNER' || r === 'MODERATOR'
export const canPostBuzz    = (_r: HiveRole) => true   // all members
export const canLikeBuzz    = (_r: HiveRole) => true   // all members

/**
 * Edit/delete a buzz post: post author OR OWNER/MODERATOR (for moderation).
 */
export function canEditBuzz(
  post: { authorId: string },
  viewerRole: HiveRole,
  viewerId: string,
): boolean {
  return viewerId === post.authorId || viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
}
```

- [ ] **Step 2: Tests — extend `permissions.test.ts`**

```ts
import { canSetWordGoal, canPostBuzz, canLikeBuzz, canEditBuzz } from '../permissions'

describe('canSetWordGoal', () => {
  it('OWNER allowed', () => expect(canSetWordGoal('OWNER')).toBe(true))
  it('MODERATOR allowed', () => expect(canSetWordGoal('MODERATOR')).toBe(true))
  it('CONTRIBUTOR denied', () => expect(canSetWordGoal('CONTRIBUTOR')).toBe(false))
  it('BETA_READER denied', () => expect(canSetWordGoal('BETA_READER')).toBe(false))
})

describe('canPostBuzz', () => {
  for (const role of ['OWNER','MODERATOR','CONTRIBUTOR','BETA_READER'] as const) {
    it(`${role} can post`, () => expect(canPostBuzz(role)).toBe(true))
  }
})

describe('canLikeBuzz', () => {
  for (const role of ['OWNER','MODERATOR','CONTRIBUTOR','BETA_READER'] as const) {
    it(`${role} can like`, () => expect(canLikeBuzz(role)).toBe(true))
  }
})

describe('canEditBuzz', () => {
  const post = { authorId: 'author-1' }
  it('post author allowed', () =>
    expect(canEditBuzz(post, 'BETA_READER', 'author-1')).toBe(true))
  it('OWNER allowed (moderation)', () =>
    expect(canEditBuzz(post, 'OWNER', 'owner-1')).toBe(true))
  it('MODERATOR allowed (moderation)', () =>
    expect(canEditBuzz(post, 'MODERATOR', 'mod-1')).toBe(true))
  it('CONTRIBUTOR not allowed on others', () =>
    expect(canEditBuzz(post, 'CONTRIBUTOR', 'random')).toBe(false))
  it('BETA_READER not allowed on others', () =>
    expect(canEditBuzz(post, 'BETA_READER', 'random')).toBe(false))
})
```

- [ ] **Step 3: tsc + run tests**

```bash
npx tsc --noEmit && npm test -- permissions
```

- [ ] **Step 4: Commit**

```bash
git add lib/hive/permissions.ts lib/hive/__tests__/permissions.test.ts
git commit -m "feat(hive): H4 T2 — permission predicates canSetWordGoal / canPostBuzz / canLikeBuzz / canEditBuzz"
```

**Subagent dispatch prompt:**

> Implement Task 2. Append four pure predicates to `lib/hive/permissions.ts`: `canSetWordGoal`, `canPostBuzz`, `canLikeBuzz`, `canEditBuzz`. Match the existing predicate style (single-line arrow functions for the role-only ones; multi-arg function for `canEditBuzz` which takes `(post, viewerRole, viewerId)`). Extend `lib/hive/__tests__/permissions.test.ts` with the cases above (~17 cases). tsc + `npm test -- permissions` clean. Commit as `feat(hive): H4 T2 ...`.

---

### Task 3: Word-delta helper (`computeWordDelta`)

**Files:**
- Create: `lib/hive/word-delta.ts`.
- Create: `lib/hive/__tests__/word-delta.test.ts`.

- [ ] **Step 1: Pure helper**

```ts
// lib/hive/word-delta.ts

/**
 * Given the current chapter word count and the sum of all prior log rows for
 * the same (user, chapter), compute the signed delta to log.
 *
 *  - First-ever log: priorSum=0, returns currentWordCount as-is (the "baseline").
 *  - Steady growth:  delta = currentWordCount - priorSum.
 *  - Deletion:       delta is negative.
 *  - Zero delta:     returns 0 (caller decides whether to skip the row).
 */
export function computeWordDelta(currentWordCount: number, priorSum: number): number {
  if (!Number.isFinite(currentWordCount) || currentWordCount < 0) return 0
  if (!Number.isFinite(priorSum)) priorSum = 0
  return currentWordCount - priorSum
}
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeWordDelta } from '../word-delta'

describe('computeWordDelta', () => {
  it('first log emits full word count as baseline', () => {
    expect(computeWordDelta(842, 0)).toBe(842)
  })
  it('steady growth = subtract prior sum', () => {
    expect(computeWordDelta(1050, 842)).toBe(208)
  })
  it('deletion = negative delta', () => {
    expect(computeWordDelta(750, 842)).toBe(-92)
  })
  it('no change = 0', () => {
    expect(computeWordDelta(842, 842)).toBe(0)
  })
  it('guards against NaN currentWordCount', () => {
    expect(computeWordDelta(NaN as unknown as number, 100)).toBe(0)
  })
  it('treats NaN priorSum as 0', () => {
    expect(computeWordDelta(500, NaN as unknown as number)).toBe(500)
  })
  it('negative currentWordCount is treated as 0', () => {
    expect(computeWordDelta(-10, 0)).toBe(0)
  })
})
```

- [ ] **Step 3: tsc + tests**

```bash
npx tsc --noEmit && npm test -- word-delta
```

- [ ] **Step 4: Commit**

```bash
git add lib/hive/word-delta.ts lib/hive/__tests__/word-delta.test.ts
git commit -m "feat(hive): H4 T3 — computeWordDelta pure helper"
```

**Subagent dispatch prompt:**

> Implement Task 3. Create `lib/hive/word-delta.ts` exporting `computeWordDelta(currentWordCount: number, priorSum: number): number`. Behavior: first log returns currentWordCount as the baseline; subsequent logs return currentWordCount - priorSum; signed (negative on deletion); guarded against NaN/negative inputs. Add the 7 unit tests above. tsc + tests clean. Commit as `feat(hive): H4 T3 ...`.

---

### Task 4: `logHiveWordDelta` hook + integration into `saveChapterAction`

**Files:**
- Create: `lib/hive/log-word-delta.ts`.
- Modify: `lib/actions/chapter.actions.ts` (append the hook call after the snapshot block).
- Create: `lib/hive/__tests__/log-word-delta.test.ts`.

- [ ] **Step 1: Helper**

```ts
// lib/hive/log-word-delta.ts
import { db } from '@/db'
import { hiveWordLogs } from '@/db/schema/hive'
import { and, desc, eq, sql } from 'drizzle-orm'
import { getBookHive } from '@/lib/hive/get-book-hive'
import { computeWordDelta } from '@/lib/hive/word-delta'
import { requireHiveMember } from '@/lib/hive/permissions'

const THROTTLE_MS = 60_000

export interface LogHiveWordDeltaOpts {
  bookId: string
  userId: string
  chapterId: string
  currentWordCount: number
}

/**
 * Optionally append a hive_word_logs row for this save.
 *
 *  1. If book has no hive → no-op.
 *  2. If user is not a hive member → no-op.
 *  3. If the most recent log for (hive, user, chapter) is younger than 60s → no-op (throttle).
 *  4. Otherwise: delta = currentWordCount - SUM(prior logs); insert row.
 *
 * Wrapped in try/catch so failures NEVER throw into the caller. Saves must
 * succeed even if the hive-log write blows up.
 */
export async function logHiveWordDelta(opts: LogHiveWordDeltaOpts): Promise<void> {
  try {
    const hive = await getBookHive(opts.bookId)
    if (!hive) return

    // Membership check (silent no-op for non-members — possible for the book
    // author if they're the hive owner-bypass branch in standalone hives, but
    // requireHiveMember handles that)
    try {
      await requireHiveMember(hive.id, opts.userId)
    } catch {
      return
    }

    // Throttle check
    const mostRecent = await db.query.hiveWordLogs.findFirst({
      where: and(
        eq(hiveWordLogs.hiveId, hive.id),
        eq(hiveWordLogs.userId, opts.userId),
        eq(hiveWordLogs.chapterId, opts.chapterId),
      ),
      orderBy: [desc(hiveWordLogs.loggedAt)],
      columns: { loggedAt: true },
    })
    if (mostRecent && mostRecent.loggedAt > new Date(Date.now() - THROTTLE_MS)) {
      return
    }

    // Compute prior sum
    const priorSumRow = await db
      .select({ sum: sql<number>`COALESCE(SUM(${hiveWordLogs.wordsAdded}), 0)::int` })
      .from(hiveWordLogs)
      .where(and(
        eq(hiveWordLogs.userId, opts.userId),
        eq(hiveWordLogs.chapterId, opts.chapterId),
      ))
    const priorSum = priorSumRow[0]?.sum ?? 0
    const delta = computeWordDelta(opts.currentWordCount, priorSum)
    if (delta === 0) return  // skip no-op rows to keep the table lean

    await db.insert(hiveWordLogs).values({
      hiveId: hive.id,
      userId: opts.userId,
      chapterId: opts.chapterId,
      wordsAdded: delta,
    })
  } catch (e) {
    console.error('[H4] log-word-delta failed', e)
  }
}
```

- [ ] **Step 2: Wire into `saveChapterAction`**

In `lib/actions/chapter.actions.ts`, after the snapshot block (line ~130) and before `return { success: true, data: { wordCount } }`:

```ts
// Hive word-log throttle — same posture as the snapshot block above:
//   outside the chapter tx, swallowed errors, 60s window per (user, chapter).
await logHiveWordDelta({
  bookId: chapter.bookId,
  userId,
  chapterId,
  currentWordCount: wordCount,
})
```

Import at the top: `import { logHiveWordDelta } from '@/lib/hive/log-word-delta'`.

- [ ] **Step 3: Tests** — mock `db` + `getBookHive` + `requireHiveMember`

```ts
// lib/hive/__tests__/log-word-delta.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/hive/get-book-hive', () => ({ getBookHive: vi.fn() }))
vi.mock('@/lib/hive/permissions', async (orig) => ({
  ...await orig() as Record<string, unknown>,
  requireHiveMember: vi.fn(),
}))
vi.mock('@/db', () => ({
  db: {
    query: { hiveWordLogs: { findFirst: vi.fn() } },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ sum: 0 }]) })) })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  },
}))

import { logHiveWordDelta } from '../log-word-delta'
import { getBookHive } from '../get-book-hive'
import { requireHiveMember } from '../permissions'
import { db } from '@/db'

beforeEach(() => vi.clearAllMocks())

describe('logHiveWordDelta', () => {
  it('no-ops when book has no hive', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 500 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('no-ops when user is not a hive member', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not-member'))
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 500 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('throttles when prior log is within 60s', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      loggedAt: new Date(Date.now() - 30_000),  // 30s ago
    })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('inserts when last log is older than 60s (steady growth)', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      loggedAt: new Date(Date.now() - 120_000),
    })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(db.insert).toHaveBeenCalled()
  })

  it('inserts negative delta on deletion', async () => {
    // priorSum mock returns 1000; current is 800 → delta -200
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ sum: 1000 }]) })),
    })
    const valuesMock = vi.fn(async () => undefined)
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({ values: valuesMock })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ wordsAdded: -200 }))
  })

  it('skips zero-delta rows', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'h1' })
    ;(requireHiveMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce('CONTRIBUTOR')
    ;(db.query.hiveWordLogs.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ sum: 800 }]) })),
    })
    await logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 800 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('swallows errors silently', async () => {
    (getBookHive as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    await expect(
      logHiveWordDelta({ bookId: 'b1', userId: 'u1', chapterId: 'c1', currentWordCount: 500 }),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 4: tsc + tests + manual smoke** — save a chapter in a book that has a hive, confirm a `hive_word_logs` row appears; save again within 60s, confirm no new row.

```bash
npx tsc --noEmit && npm test -- log-word-delta
```

- [ ] **Step 5: Commit**

```bash
git add lib/hive/log-word-delta.ts lib/hive/__tests__/log-word-delta.test.ts lib/actions/chapter.actions.ts
git commit -m "feat(hive): H4 T4 — logHiveWordDelta hook wired into saveChapterAction"
```

**Subagent dispatch prompt:**

> Implement Task 4. Create `lib/hive/log-word-delta.ts` exporting `logHiveWordDelta(opts)` per the spec: get-book-hive → membership check → 60s throttle → compute delta from prior sum → insert. The ENTIRE body lives inside `try { … } catch (e) { console.error('[H4] log-word-delta failed', e) }` so failures degrade silently. Wire the call into `saveChapterAction` AFTER the snapshot block, BEFORE the return — same outside-tx posture as the snapshot. Add the 7 mocked-DB tests above. tsc + tests clean. Commit as `feat(hive): H4 T4 ...`.

---

### Task 5: Goal-progress helpers

**Files:**
- Create: `lib/hive/goal-progress.ts`.
- Create: `lib/hive/__tests__/goal-progress.test.ts`.

- [ ] **Step 1: Helpers**

```ts
// lib/hive/goal-progress.ts

export type WordGoalType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TOTAL'

export interface WordGoalRow {
  id: string
  type: WordGoalType
  targetWords: number
  startDate: Date
  endDate: Date | null
  isActive: boolean
}

/**
 * Compute the end-date for a goal based on its type + start.
 * - DAILY: start + 1 day
 * - WEEKLY: start + 7 days
 * - MONTHLY: start + 30 days (calendar-month if you prefer; spec keeps it 30 days flat)
 * - TOTAL: no end-date (null)
 */
export function computeGoalEndDate(type: WordGoalType, start: Date): Date | null {
  const ms = { DAILY: 86_400_000, WEEKLY: 7 * 86_400_000, MONTHLY: 30 * 86_400_000 }
  if (type === 'TOTAL') return null
  return new Date(start.getTime() + ms[type])
}

/**
 * Pick the highest-priority active goal: DAILY > WEEKLY > MONTHLY > TOTAL.
 * Returns null when no active goal in the list.
 */
export function pickPrimaryActiveGoal(goals: WordGoalRow[]): WordGoalRow | null {
  const order: WordGoalType[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL']
  for (const type of order) {
    const g = goals.find(g => g.isActive && g.type === type)
    if (g) return g
  }
  return null
}

/**
 * Aggregate progress for a goal from a flat array of word-log rows.
 * Logs are filtered to those falling within [startDate, endDate) (endDate exclusive).
 * Negative deltas are honored (deletion rolls the bar backwards).
 *
 * Returns words contributed (signed sum), not capped at target.
 */
export interface WordLogRow {
  userId: string
  wordsAdded: number
  loggedAt: Date
}

export function aggregateGoalProgress(goal: WordGoalRow, logs: WordLogRow[]): number {
  return logs.reduce((acc, l) => {
    if (l.loggedAt < goal.startDate) return acc
    if (goal.endDate && l.loggedAt >= goal.endDate) return acc
    return acc + l.wordsAdded
  }, 0)
}

/**
 * Per-contributor breakdown within a goal window. Keys are userIds; values
 * are signed sums. Empty map when no in-window logs.
 */
export function aggregateContributorBreakdown(
  goal: WordGoalRow,
  logs: WordLogRow[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of logs) {
    if (l.loggedAt < goal.startDate) continue
    if (goal.endDate && l.loggedAt >= goal.endDate) continue
    out.set(l.userId, (out.get(l.userId) ?? 0) + l.wordsAdded)
  }
  return out
}
```

- [ ] **Step 2: Tests**

```ts
import { describe, it, expect } from 'vitest'
import {
  computeGoalEndDate,
  pickPrimaryActiveGoal,
  aggregateGoalProgress,
  aggregateContributorBreakdown,
} from '../goal-progress'

const goalAt = (overrides: Partial<Parameters<typeof aggregateGoalProgress>[0]> = {}) => ({
  id: 'g1',
  type: 'WEEKLY' as const,
  targetWords: 5000,
  startDate: new Date('2026-05-01T00:00:00Z'),
  endDate: new Date('2026-05-08T00:00:00Z'),
  isActive: true,
  ...overrides,
})

describe('computeGoalEndDate', () => {
  const start = new Date('2026-05-01T00:00:00Z')
  it('DAILY = +1 day', () => expect(computeGoalEndDate('DAILY', start)?.toISOString())
    .toBe('2026-05-02T00:00:00.000Z'))
  it('WEEKLY = +7 days', () => expect(computeGoalEndDate('WEEKLY', start)?.toISOString())
    .toBe('2026-05-08T00:00:00.000Z'))
  it('MONTHLY = +30 days', () => expect(computeGoalEndDate('MONTHLY', start)?.toISOString())
    .toBe('2026-05-31T00:00:00.000Z'))
  it('TOTAL = null', () => expect(computeGoalEndDate('TOTAL', start)).toBeNull())
})

describe('pickPrimaryActiveGoal', () => {
  it('picks DAILY over WEEKLY+MONTHLY+TOTAL', () => {
    const goals = (['DAILY','WEEKLY','MONTHLY','TOTAL'] as const).map((t, i) =>
      ({ ...goalAt(), id: `g${i}`, type: t, isActive: true }))
    expect(pickPrimaryActiveGoal(goals)?.type).toBe('DAILY')
  })
  it('skips inactive', () => {
    const goals = [goalAt({ type: 'DAILY', isActive: false }), goalAt({ type: 'WEEKLY' })]
    expect(pickPrimaryActiveGoal(goals)?.type).toBe('WEEKLY')
  })
  it('null when no active', () => {
    expect(pickPrimaryActiveGoal([goalAt({ isActive: false })])).toBeNull()
  })
})

describe('aggregateGoalProgress', () => {
  const g = goalAt()
  it('sums positive deltas within window', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2026-05-04T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(800)
  })
  it('honors negative deltas (deletion)', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: -200, loggedAt: new Date('2026-05-03T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(300)
  })
  it('excludes logs before startDate', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-04-30T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2026-05-02T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(300)
  })
  it('excludes logs after endDate', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2026-05-09T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(g, logs)).toBe(500)
  })
  it('TOTAL goal counts all logs after startDate', () => {
    const total = goalAt({ type: 'TOTAL', endDate: null })
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u1', wordsAdded: 300, loggedAt: new Date('2030-01-01T10:00:00Z') },
    ]
    expect(aggregateGoalProgress(total, logs)).toBe(800)
  })
})

describe('aggregateContributorBreakdown', () => {
  const g = goalAt()
  it('groups by userId', () => {
    const logs = [
      { userId: 'u1', wordsAdded: 500, loggedAt: new Date('2026-05-02T10:00:00Z') },
      { userId: 'u2', wordsAdded: 300, loggedAt: new Date('2026-05-03T10:00:00Z') },
      { userId: 'u1', wordsAdded: 200, loggedAt: new Date('2026-05-04T10:00:00Z') },
    ]
    const out = aggregateContributorBreakdown(g, logs)
    expect(out.get('u1')).toBe(700)
    expect(out.get('u2')).toBe(300)
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add lib/hive/goal-progress.ts lib/hive/__tests__/goal-progress.test.ts
git commit -m "feat(hive): H4 T5 — goal-progress pure helpers"
```

**Subagent dispatch prompt:**

> Implement Task 5. Create `lib/hive/goal-progress.ts` with four pure exports: `computeGoalEndDate(type, start)`, `pickPrimaryActiveGoal(goals)`, `aggregateGoalProgress(goal, logs)`, `aggregateContributorBreakdown(goal, logs)`. All four are pure (no DB calls). MONTHLY treats end as start + 30 days flat (not calendar-month). Add the unit tests above (~13 cases). tsc + tests clean. Commit as `feat(hive): H4 T5 ...`.

---

### Task 6: Server actions — word goals

**Files:**
- Create: `lib/actions/hive-word-goals.actions.ts`.
- Create: `lib/validations/hive-word-goals.ts` (Zod).
- Create: `lib/actions/__tests__/hive-word-goals.test.ts`.

Actions:
- `createWordGoalAction({ hiveId, type, targetWords, startDate?, endDate? })` — `canSetWordGoal` → in a tx: archive existing active of same type (`UPDATE … SET is_active=false, end_date=now() WHERE hive_id=$1 AND type=$2 AND is_active=true`), then INSERT new row. End date defaults to `computeGoalEndDate(type, start)`.
- `updateWordGoalAction({ id, targetWords?, endDate? })` — only `targetWords` + `endDate` editable per spec; type + startDate locked.
- `archiveWordGoalAction(id)` — sets `is_active=false`, `end_date=now()`.
- `listHiveWordGoalsAction(hiveId)` — `requireHiveMember`; **runs the lazy-archive sweep first** (`UPDATE hive_word_goals SET is_active=false, end_date=COALESCE(end_date, now()) WHERE hive_id=$1 AND is_active=true AND end_date IS NOT NULL AND end_date < now()`), then SELECTs all rows ordered by `(is_active DESC, created_at DESC)`.
- `getWordGoalProgressAction({ goalId })` — `requireHiveMember` (via the goal's hive); returns `{ goal, progress, contributors, recentLogs }` — uses T5 helpers to aggregate; joins `userProfiles` for contributor display name + avatar.
- `getActiveWordGoalSummaryAction(hiveId)` — `requireHiveMember`; returns `{ goal, progress } | null` for the sidebar badge; uses `pickPrimaryActiveGoal`. Cached via React `cache()` so the hive shell + the Word Goals page share one query.

- [ ] **Step 1: Zod schemas**

```ts
// lib/validations/hive-word-goals.ts
import { z } from 'zod'

export const wordGoalTypeSchema = z.enum(['DAILY','WEEKLY','MONTHLY','TOTAL'])

export const createWordGoalSchema = z.object({
  hiveId: z.string().min(1),
  type: wordGoalTypeSchema,
  targetWords: z.number().int().min(1).max(10_000_000),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
})

export const updateWordGoalSchema = z.object({
  id: z.string().min(1),
  targetWords: z.number().int().min(1).max(10_000_000).optional(),
  endDate: z.coerce.date().nullable().optional(),
})
```

- [ ] **Step 2: Action file** — skeleton; full body fleshed by implementer

```ts
'use server'

import { cache } from 'react'
import { db } from '@/db'
import { hiveWordGoals, hiveWordLogs, hives } from '@/db/schema/hive'
import { userProfiles } from '@/db/schema/users'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canSetWordGoal } from '@/lib/hive/permissions'
import {
  computeGoalEndDate,
  pickPrimaryActiveGoal,
  aggregateGoalProgress,
  aggregateContributorBreakdown,
  type WordGoalRow,
} from '@/lib/hive/goal-progress'
import { createWordGoalSchema, updateWordGoalSchema } from '@/lib/validations/hive-word-goals'
import type { ActionResult } from '@/lib/types/action-result'

// createWordGoalAction → in a tx:
//   1. requireAuth + requireHiveMember(hiveId)
//   2. canSetWordGoal(role) → 'NOT_AUTHORIZED'
//   3. tx { archive existing active of same type; insert new }
//   4. revalidatePath(`/[locale]/hive/${hiveId}/word-goals`)

// listHiveWordGoalsAction → lazy-archive sweep, then SELECT
//   await db.update(hiveWordGoals).set({ isActive: false }).where(
//     and(eq(hiveWordGoals.hiveId, hiveId),
//         eq(hiveWordGoals.isActive, true),
//         sql`${hiveWordGoals.endDate} IS NOT NULL`,
//         sql`${hiveWordGoals.endDate} < now()`))
//   const rows = await db.select(...).from(hiveWordGoals).where(eq(hiveWordGoals.hiveId, hiveId)).orderBy(desc(hiveWordGoals.isActive), desc(hiveWordGoals.createdAt))

// getActiveWordGoalSummaryAction → React cache() wrapper
export const getActiveWordGoalSummaryAction = cache(async (hiveId: string) => { /* ... */ })
```

- [ ] **Step 3: Tests** — vitest with mocked db

Tests to add:
- `createWordGoalAction` archives prior active of same type
- `createWordGoalAction` denies BETA_READER (`NOT_AUTHORIZED`)
- `listHiveWordGoalsAction` lazy-archives expired goals on read
- `getWordGoalProgressAction` returns correct contributor breakdown for 3-member logs
- `getActiveWordGoalSummaryAction` returns null when no active goals
- `getActiveWordGoalSummaryAction` picks DAILY when DAILY + WEEKLY both active

- [ ] **Step 4: Commit**

```bash
git add lib/actions/hive-word-goals.actions.ts lib/validations/hive-word-goals.ts lib/actions/__tests__/hive-word-goals.test.ts
git commit -m "feat(hive): H4 T6 — word-goal server actions (create / update / archive / list / progress / active summary)"
```

**Subagent dispatch prompt:**

> Implement Task 6. Create `lib/actions/hive-word-goals.actions.ts` with the 6 actions per the plan. Validation schemas in `lib/validations/hive-word-goals.ts`. Pattern: `requireAuth` → `requireHiveMember(hiveId)` returns the role → `canSetWordGoal(role)` for the three write actions. `createWordGoalAction` MUST archive existing active of same type INSIDE the same tx as the insert (the partial-unique index throws otherwise). `listHiveWordGoalsAction` runs the lazy-archive sweep BEFORE the SELECT. `getActiveWordGoalSummaryAction` wrapped in React `cache()`. `getWordGoalProgressAction` uses T5's `aggregateGoalProgress` + `aggregateContributorBreakdown` + joins `userProfiles` for display. Add the 6 tests above with mocked db. tsc + tests clean. Commit as `feat(hive): H4 T6 ...`.

---

### Task 7: Server action — recent word logs

**Files:**
- Create: `lib/actions/hive-word-logs.actions.ts`.

- [ ] **Step 1: Action**

```ts
'use server'

// getRecentWordLogsAction({ hiveId, cursor?, limit = 20 })
//   requireAuth + requireHiveMember
//   SELECT hive_word_logs joined with userProfiles (display) + chapters (title)
//   ORDER BY logged_at DESC, id DESC
//   cursor-paginated on logged_at + id
//   returns { items: [{ id, user: {username,avatarUrl}, chapterId, chapterTitle, wordsAdded, loggedAt }], nextCursor }
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/hive-word-logs.actions.ts
git commit -m "feat(hive): H4 T7 — getRecentWordLogsAction"
```

**Subagent dispatch prompt:**

> Implement Task 7. Create `lib/actions/hive-word-logs.actions.ts` with a single `getRecentWordLogsAction({ hiveId, cursor?, limit })` action. Cursor-paginated on `(logged_at, id)`. Joins `userProfiles` for display name + avatar and `chapters` for the chapter title. Membership gate via `requireHiveMember`. Default limit 20. Returns `{ items, nextCursor }`. tsc clean. Commit as `feat(hive): H4 T7 ...`.

---

### Task 8: Server actions — buzz posts + likes

**Files:**
- Create: `lib/actions/hive-buzz.actions.ts`.
- Create: `lib/validations/hive-buzz.ts`.
- Create: `lib/actions/__tests__/hive-buzz.test.ts`.

Actions:
- `createBuzzPostAction({ hiveId, type, body, linkUrl? })` — `canPostBuzz` (always true for members). For LINK, validate `linkUrl` via `new URL()` and require `protocol === 'https:'`. Insert row + write `hive_activity` event `buzz_posted` with payload `{ type, bodyExcerpt: body.slice(0, 100), linkUrl }` — **inside the same transaction** via `recordHiveActivityTx(tx, …)`. Top-level only (no reply equivalent for buzz). Returns the new post id.
- `updateBuzzPostAction({ id, body, linkUrl? })` — `canEditBuzz(post, role, userId)` gate. Body editable for TEXT; body + linkUrl editable for LINK. Type LOCKED. Bump `updatedAt`.
- `deleteBuzzPostAction(id)` — `canEditBuzz` gate. Delete row; FK cascade drops likes. NO `hive_activity` event for deletion.
- `listBuzzPostsAction({ hiveId, cursor?, limit = 20 })` — `requireHiveMember`. Cursor-paginated on `(created_at, id)` DESC. Joins `userProfiles` for author display. **`viewerLiked: boolean` per post** via correlated subquery: `EXISTS (SELECT 1 FROM hive_buzz_likes WHERE buzz_id = posts.id AND user_id = $viewer)`.
- `toggleBuzzLikeAction({ buzzId })` — `requireHiveMember` + `canLikeBuzz`. INSIDE A TRANSACTION: check existence by `(user_id, buzz_id)` → DELETE row + `like_count = like_count - 1` if exists; INSERT row + `like_count = like_count + 1` otherwise. Returns `{ liked, likeCount }`.

- [ ] **Step 1: Zod**

```ts
// lib/validations/hive-buzz.ts
import { z } from 'zod'

export const buzzPostTypeSchema = z.enum(['TEXT','LINK'])

export const linkUrlSchema = z.string().refine(s => {
  try { return new URL(s).protocol === 'https:' } catch { return false }
}, { message: 'Must be a valid https URL' })

export const createBuzzPostSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TEXT'),
    hiveId: z.string().min(1),
    body: z.string().min(1).max(1000),
  }),
  z.object({
    type: z.literal('LINK'),
    hiveId: z.string().min(1),
    body: z.string().max(280),  // optional caption
    linkUrl: linkUrlSchema,
  }),
])

export const updateBuzzPostSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(0).max(1000),
  linkUrl: linkUrlSchema.optional().nullable(),
})
```

- [ ] **Step 2: Action skeleton**

```ts
'use server'

import { db } from '@/db'
import { hiveBuzzPosts, hiveBuzzLikes } from '@/db/schema/hive'
import { recordHiveActivityTx } from '@/lib/hive/record-activity'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canPostBuzz, canEditBuzz, canLikeBuzz } from '@/lib/hive/permissions'
// ...

// createBuzzPostAction:
//   await db.transaction(async tx => {
//     const [post] = await tx.insert(hiveBuzzPosts).values({ ... }).returning()
//     await recordHiveActivityTx(tx, {
//       hiveId, actorId: userId, type: 'buzz_posted',
//       payload: { type, bodyExcerpt: body.slice(0,100), linkUrl: linkUrl ?? null },
//     })
//     return post
//   })

// toggleBuzzLikeAction:
//   db.transaction(async tx => {
//     const existing = await tx.select().from(hiveBuzzLikes).where(...).limit(1)
//     if (existing.length) {
//       await tx.delete(hiveBuzzLikes).where(...)
//       await tx.update(hiveBuzzPosts).set({ likeCount: sql`like_count - 1` }).where(eq(hiveBuzzPosts.id, buzzId))
//       return { liked: false, likeCount: ... }
//     } else {
//       await tx.insert(hiveBuzzLikes).values({ userId, buzzId })
//       await tx.update(hiveBuzzPosts).set({ likeCount: sql`like_count + 1` }).where(eq(hiveBuzzPosts.id, buzzId))
//       return { liked: true, likeCount: ... }
//     }
//   })
```

- [ ] **Step 3: Tests**

- `createBuzzPostAction` writes `hive_activity` row in same transaction (mock tx; assert `recordHiveActivityTx` called with `type: 'buzz_posted'` + bodyExcerpt + linkUrl)
- `createBuzzPostAction` rejects LINK without linkUrl
- `createBuzzPostAction` rejects TEXT with linkUrl
- `createBuzzPostAction` rejects non-https URL
- `toggleBuzzLikeAction` is idempotent under double-click (test: like → like → unlike → unlike all behave correctly per call; final state matches expectation)
- `toggleBuzzLikeAction` increments / decrements `like_count` correctly
- `canEditBuzz` enforced on `updateBuzzPostAction` (non-author non-mod denied)

- [ ] **Step 4: Commit**

```bash
git add lib/actions/hive-buzz.actions.ts lib/validations/hive-buzz.ts lib/actions/__tests__/hive-buzz.test.ts
git commit -m "feat(hive): H4 T8 — buzz server actions (create / update / delete / list / toggle-like)"
```

**Subagent dispatch prompt:**

> Implement Task 8. Create `lib/actions/hive-buzz.actions.ts` with 5 actions per the plan. Validation in `lib/validations/hive-buzz.ts` (discriminated-union schema for create). `createBuzzPostAction` MUST wrap the INSERT + `recordHiveActivityTx` call in a single `db.transaction` — Stripe-style same-tx atomicity. `toggleBuzzLikeAction` MUST wrap the INSERT-or-DELETE + `like_count` UPDATE in a single tx. `listBuzzPostsAction` returns `viewerLiked` boolean per post via correlated subquery (`EXISTS …`). Add the 7 tests above with mocked db. tsc + tests clean. Commit as `feat(hive): H4 T8 ...`.

---

### Task 9: `/hive/[hiveId]/word-goals` page

**Files:**
- Replace: `app/[locale]/(app)/hive/[hiveId]/word-goals/page.tsx` (currently a `ComingSoon` stub).
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/active-goals-strip.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/goal-card.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/contributors-panel.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/recent-activity-panel.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/goal-history.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/empty-state.tsx`.

- [ ] **Step 1: Server page**

```tsx
// app/[locale]/(app)/hive/[hiveId]/word-goals/page.tsx
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canSetWordGoal } from '@/lib/hive/permissions'
import { listHiveWordGoalsAction, getWordGoalProgressAction } from '@/lib/actions/hive-word-goals.actions'
import { getRecentWordLogsAction } from '@/lib/actions/hive-word-logs.actions'
import { pickPrimaryActiveGoal } from '@/lib/hive/goal-progress'

export default async function WordGoalsPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)  // throws → notFound via shared error boundary
  const [goalsRes, recentLogs] = await Promise.all([
    listHiveWordGoalsAction(hiveId),
    getRecentWordLogsAction({ hiveId, limit: 20 }),
  ])
  if (!goalsRes.success) return notFound()
  const goals = goalsRes.data
  const primary = pickPrimaryActiveGoal(goals)
  const primaryProgress = primary ? await getWordGoalProgressAction({ goalId: primary.id }) : null
  // render <ActiveGoalsStrip> + <ContributorsPanel> + <RecentActivityPanel> + <GoalHistory>
}
```

- [ ] **Step 2: Components** — each follows the existing hive-shell client-component conventions

- **`<ActiveGoalsStrip>`** — up to 4 `<GoalCard>`s (one per active type). Renders only types with an active goal.
- **`<GoalCard>`** — type pill (color per type via `--status-*`-style tokens), progress bar (brand-yellow fill on chrome track; pulses past 100% via a `@keyframes pulseGlow` similar to the sprint-finished pulse), "X / Y words" + "Z%" + time remaining + target absolute timestamp. Edit + archive icons inside the card when `canSetWordGoal(role)`. Clicking the card opens the goal-detail drawer (optional in this task; can defer to T10).
- **`<ContributorsPanel>`** — per-member breakdown within the primary goal's window. Row: avatar + display + words + % of team total + last-write relative time. Default sort: words desc.
- **`<RecentActivityPanel>`** — last 20 word-log entries; "+847 words in *Chapter Title*" rows; cursor-paginated "Load older".
- **`<GoalHistory>`** — collapsible at bottom; all `is_active=false` rows; read-only.
- **`<EmptyState>`** — dotted-border card "No active goals" + + New Goal CTA if `canSetWordGoal(role)`.

- [ ] **Step 3: Manual smoke**
1. OWNER opens `/hive/[hiveId]/word-goals` with no goals → empty state + permission-gated CTA.
2. CONTRIBUTOR opens same page → empty state without CTA.
3. After creating a WEEKLY goal (T10), refreshing this page shows the card at 0% with contributors empty.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/word-goals/"
git commit -m "feat(hive): H4 T9 — /hive/[hiveId]/word-goals page (active strip + contributors + recent + history)"
```

**Subagent dispatch prompt:**

> Implement Task 9. Replace the `ComingSoon` stub at `app/[locale]/(app)/hive/[hiveId]/word-goals/page.tsx` with a server-component page that parallel-fetches `listHiveWordGoalsAction` + `getRecentWordLogsAction` + (conditionally) `getWordGoalProgressAction` for the primary active goal. Render six new presentational components under `_components/` per the plan: `<ActiveGoalsStrip>`, `<GoalCard>`, `<ContributorsPanel>`, `<RecentActivityPanel>`, `<GoalHistory>`, `<EmptyState>`. Match the existing hive-shell visual conventions (cards on dark walnut, brand-yellow accents restrained, `--status-*` palette for type pills). Permission gate the "+ New Goal" CTA + the per-card Edit/Archive icons via `canSetWordGoal(role)` — the role is passed as a prop from the server page. Modals themselves land in T10. tsc clean. Commit as `feat(hive): H4 T9 ...`.

---

### Task 10: + New Goal / Edit / Archive modals

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/new-goal-modal.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/word-goals/_components/edit-goal-modal.tsx`.

Reuses shared `ConfirmDialog` (from prior epics) for archive confirmation.

- [ ] **Step 1: + New Goal modal**

- Type radio cards: DAILY / WEEKLY / MONTHLY / TOTAL (icons + brief description per type)
- Target words integer input (min 1, max 10,000,000)
- Start date — defaults to today; locked to today when type=DAILY
- End date — auto-derived for DAILY/WEEKLY/MONTHLY via `computeGoalEndDate`; freeform / nullable for TOTAL
- Submit → `createWordGoalAction(…)` → toast + `router.refresh()`

- [ ] **Step 2: Edit modal**

- Pre-filled with current goal's `targetWords` + `endDate`
- Type + startDate are read-only display rows
- Submit → `updateWordGoalAction({ id, targetWords?, endDate? })`

- [ ] **Step 3: Archive confirm**

- Shared `ConfirmDialog`: "Archive this {type} goal? Members can still see progress in the History section."
- Confirm → `archiveWordGoalAction(id)` → toast + `router.refresh()`

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/word-goals/_components/"
git commit -m "feat(hive): H4 T10 — + New Goal / Edit / Archive modals"
```

**Subagent dispatch prompt:**

> Implement Task 10. Create two modal components in the word-goals `_components/` dir: `<NewGoalModal>` (type radio cards + target words + start date + end date — end auto-computed via T5's `computeGoalEndDate` for non-TOTAL; freeform for TOTAL) and `<EditGoalModal>` (pre-filled targetWords + endDate; type + startDate locked). Wire to T6's `createWordGoalAction` / `updateWordGoalAction`. Archive uses shared `ConfirmDialog` + `archiveWordGoalAction`. Sonner toast on success; `router.refresh()` to repaint the goals strip. Mount these from `<GoalCard>` (edit/archive) and the page header's + New Goal CTA (already wired in T9). tsc clean. Commit as `feat(hive): H4 T10 ...`.

---

### Task 11: Hive sidebar progress badge

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-shell.tsx` (or wherever H1 placed the sidebar nav).
- Modify: that file's data-fetch — call `getActiveWordGoalSummaryAction(hiveId)` alongside the existing fetches.

- [ ] **Step 1: Server-side fetch**

At the hive layout / shell level (where the sidebar renders), add a parallel `Promise.all` entry for `getActiveWordGoalSummaryAction(hiveId)`. React `cache()` means the same call from T9's page hits the same memo on the same request.

- [ ] **Step 2: Sidebar component**

Under the "Word Goals" nav row, when `activeGoalSummary !== null`, render a 2px-tall horizontal bar (chrome track + brand-yellow fill, width = `progressPct` clamped to 0–100). No number. Hidden when null.

```tsx
{activeGoalSummary && (
  <div className="mt-1 h-0.5 w-full rounded-full bg-[var(--chrome-300)] overflow-hidden">
    <div
      className="h-full bg-brand transition-[width] duration-300"
      style={{ width: `${Math.min(100, Math.max(0, activeGoalSummary.progressPct))}%` }}
      aria-label={`Word Goal progress: ${activeGoalSummary.progressPct}%`}
    />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/"
git commit -m "feat(hive): H4 T11 — sidebar Word Goals progress badge"
```

**Subagent dispatch prompt:**

> Implement Task 11. In the hive shell / layout (the H1-shipped 11-entry sidebar), wire a thin progress bar segment under the "Word Goals" nav row when an active goal exists. Data: `getActiveWordGoalSummaryAction(hiveId)` (T6) returning `{ goal, progressPct } | null`. Fetch alongside other sidebar data via `Promise.all`. Hidden when null. Brand-yellow fill on a chrome track at 2px height. tsc clean. Commit as `feat(hive): H4 T11 ...`.

---

### Task 12: `/hive/[hiveId]/buzz` page

**Files:**
- Replace: `app/[locale]/(app)/hive/[hiveId]/buzz/page.tsx` (currently a `ComingSoon` stub).
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-feed.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-post-card.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/link-card.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/buzz-empty-state.tsx`.

- [ ] **Step 1: Server page**

```tsx
// app/[locale]/(app)/hive/[hiveId]/buzz/page.tsx
const { hiveId } = await params
const userId = await requireAuth()
const role = await requireHiveMember(hiveId, userId)
const feed = await listBuzzPostsAction({ hiveId, limit: 20 })
// renders <BuzzFeed initialItems={feed.data.items} initialCursor={feed.data.nextCursor} viewerRole={role} viewerId={userId} />
```

- [ ] **Step 2: `<BuzzFeed>`** — client component owning the list + Load older + optimistic likes + compose entry button (mount the modal from T13 here).

- [ ] **Step 3: `<BuzzPostCard>`** — author avatar/name/timestamp header; body block (preserves line breaks; basic markdown via a tiny pure helper — bold/italic/code spans only); footer (heart icon + like count + author menu when `canEditBuzz(post, role, viewerId)`). For LINK posts, renders `<LinkCard>` below the optional caption.

- [ ] **Step 4: `<LinkCard>`** — domain favicon via `https://www.google.com/s2/favicons?domain=${hostname}` + URL hostname + truncated full URL; whole card clickable; opens in `target="_blank"` with `rel="noopener noreferrer"`.

- [ ] **Step 5: `<BuzzEmptyState>`** — dotted-border card "No posts yet. Drop your first vibe." + + New Post CTA.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/buzz/"
git commit -m "feat(hive): H4 T12 — /hive/[hiveId]/buzz feed page"
```

**Subagent dispatch prompt:**

> Implement Task 12. Replace the `ComingSoon` stub at `app/[locale]/(app)/hive/[hiveId]/buzz/page.tsx` with a server page that calls `listBuzzPostsAction({ hiveId, limit: 20 })`. Render a `<BuzzFeed>` client component that owns the items list + Load older + the like flow + the compose CTA. Build `<BuzzPostCard>` for the rendering (TEXT body block with basic-markdown helper; LINK uses `<LinkCard>` for the favicon-domain-url affordance below the optional caption). Empty state `<BuzzEmptyState>` for zero posts. Author menu shown via `canEditBuzz(post, viewerRole, viewerId)`. tsc clean — modals + like wiring land in T13. Commit as `feat(hive): H4 T12 ...`.

---

### Task 13: Compose / Edit / Delete buzz modals + like flow

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/compose-buzz-modal.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/edit-buzz-modal.tsx`.
- Create: `app/[locale]/(app)/hive/[hiveId]/buzz/_components/like-button.tsx`.

- [ ] **Step 1: Compose modal**

- Two pill tabs: Text / Link (default Text)
- TEXT form: body textarea (4-row auto-grow, max 1000 chars), live char counter
- LINK form: URL input (client validation via `new URL()` mirror + `https:` check) + optional caption (max 280 chars)
- Submit → `createBuzzPostAction({ hiveId, type, body, linkUrl? })` → sonner toast on success + `router.refresh()`

- [ ] **Step 2: Edit modal**

Same shape as compose, pre-filled. Type LOCKED (visible as a read-only badge — converting between TEXT and LINK is a delete + recreate per spec). Submit → `updateBuzzPostAction({ id, body, linkUrl? })`.

- [ ] **Step 3: Delete confirm**

Shared `ConfirmDialog`: "Delete this buzz post? This can't be undone." → `deleteBuzzPostAction(id)`.

- [ ] **Step 4: `<LikeButton>` — optimistic UI**

```tsx
'use client'
function LikeButton({ post, initialLiked, initialCount }) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()
  async function onClick() {
    setLiked(v => !v)
    setCount(c => c + (liked ? -1 : 1))
    startTransition(async () => {
      const res = await toggleBuzzLikeAction({ buzzId: post.id })
      if (!res.success) {
        // revert
        setLiked(initialLiked); setCount(initialCount)
        toast.error('Could not update like')
      } else {
        setLiked(res.data.liked); setCount(res.data.likeCount)
      }
    })
  }
  // heart icon fills/unfills; count rendered next to it
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/buzz/_components/"
git commit -m "feat(hive): H4 T13 — buzz compose / edit / delete modals + optimistic like button"
```

**Subagent dispatch prompt:**

> Implement Task 13. Build three components in the buzz `_components/` dir: `<ComposeBuzzModal>` (two-tab Text/Link, validation per the plan), `<EditBuzzModal>` (pre-filled, type-locked), `<LikeButton>` (optimistic UI with rollback on failure). Wire to T8's actions. Delete uses shared `ConfirmDialog`. Mount the compose modal from the page header + the empty state CTA; mount edit + delete from `<BuzzPostCard>`'s author menu. Sonner toasts on success + failure. tsc clean. Commit as `feat(hive): H4 T13 ...`.

---

### Task 14: Activity event wiring audit

**Files:**
- (Audit only — no new files. Confirm the wiring.)

- [ ] **Step 1: Grep audit**

```bash
grep -rn "recordHiveActivityTx\|recordHiveActivity" lib/actions/hive-buzz.actions.ts lib/actions/hive-word-goals.actions.ts lib/actions/hive-word-logs.actions.ts
```

Expected: exactly ONE hit (the `buzz_posted` write inside `createBuzzPostAction`). No word-goal or word-log action writes activity events.

- [ ] **Step 2: Confirm payload shape matches `<ActivityEventRow>`'s `buzz_posted` branch**

Open `app/[locale]/(app)/community/_components/activity-event-row.tsx`. The `buzz_posted` VERB-map entry was scaffolded in H1's T15. Confirm it expects the payload keys H4 writes: `type` ('TEXT' | 'LINK'), `bodyExcerpt` (string), `linkUrl` (string | null). Refine the renderer if needed (e.g. when `type === 'LINK'`, show "shared a link to <hostname>"; when `type === 'TEXT'`, show "posted: <excerpt>...").

- [ ] **Step 3: Manual smoke** — post a TEXT buzz, navigate to /community (with the hive in your member list), confirm the event row appears with correct copy. Repeat for LINK.

- [ ] **Step 4: Commit (only if the activity-event-row renderer needed copy refinement)**

```bash
git add app/[locale]/(app)/community/_components/activity-event-row.tsx
git commit -m "feat(hive): H4 T14 — refine buzz_posted activity row copy"
```

**Subagent dispatch prompt:**

> Implement Task 14. Audit the activity event wiring for H4. Grep-confirm that `createBuzzPostAction` is the ONLY H4 action calling `recordHiveActivityTx`, and that the call sits INSIDE the create transaction. Open `activity-event-row.tsx` and confirm the existing `buzz_posted` VERB-map branch handles both TEXT and LINK shapes — if it just shows a placeholder string, refine to "posted: \"<excerpt>...\"" for TEXT and "shared a link to <hostname>" for LINK. Smoke-test by posting a buzz and viewing /community. Commit only if the renderer needed updating. Don't add a commit otherwise.

---

### Task 15: AGENTS.md update + final ship commit

**Files:**
- Modify: `AGENTS.md`.

- [ ] **Step 1: Add `### Hives Redesign — H4 Motivation ✅ COMPLETE` entry above H3 in "What Has Been Built"**

Format mirroring H2 / H3 entries: bold lead-in summary, bullet list of all 15 tasks shipped with file paths and key decisions, an "H4 patterns now load-bearing" coda enumerating the throttle pattern + the lazy-archive pattern + the activity-event policy.

Suggested skeleton:

```markdown
### Hives Redesign — H4 Motivation ✅ COMPLETE (2026-MM-DD)

Third of 5 sub-projects in the Hives redesign. Lands the team-momentum
layer — shared Word Goals that progress automatically as anyone in the
hive saves chapters on the linked book, plus a lightweight Buzz Board
for text/link posts with likes. Milestones / achievements DROPPED from
the redesign entirely; do not reintroduce.

- **Schema migration** (`scripts/migrate-h4.ts`, `db/schema/hive.ts`):
  Two new enums (`word_goal_type`, `buzz_post_type`), four new tables
  (`hive_word_goals`, `hive_word_logs`, `hive_buzz_posts`,
  `hive_buzz_likes`). Partial-unique index on
  `hive_word_goals(hive_id, type) WHERE is_active = true` enforces
  one-active-per-type. CHECK constraint on `hive_buzz_posts` enforces
  TEXT/LINK column shape. Composite indexes on `hive_word_logs` for
  hive-feed + per-user-chapter throttle lookups.
- **Permission predicates** (`lib/hive/permissions.ts`):
  `canSetWordGoal` (OWNER + MODERATOR), `canPostBuzz` (all members),
  `canLikeBuzz` (all members), `canEditBuzz` (author OR OWNER/MOD).
- **Pure helpers** (`lib/hive/word-delta.ts`, `lib/hive/goal-progress.ts`):
  `computeWordDelta(current, priorSum)`, `computeGoalEndDate(type, start)`,
  `pickPrimaryActiveGoal`, `aggregateGoalProgress`,
  `aggregateContributorBreakdown`. All pure; ~20 unit tests.
- **`logHiveWordDelta` hook** (`lib/hive/log-word-delta.ts`):
  Appended to `saveChapterAction` after the snapshot block. Same
  posture as the snapshot throttle: outside the chapter tx, errors
  swallowed via try/catch (a logging failure must not break the
  user's save). 60s throttle per `(hive, user, chapter)`. Signed
  delta = `currentWordCount - SUM(prior logs)`. Skips zero-delta rows.
- **Word-goal actions** (`lib/actions/hive-word-goals.actions.ts`):
  Six actions — create/update/archive/list/progress/active-summary.
  `createWordGoalAction` archives prior active of same type INSIDE
  the same tx (otherwise the partial-unique index throws).
  `listHiveWordGoalsAction` runs the lazy auto-archive sweep BEFORE
  the SELECT (`SET is_active=false WHERE end_date < now()`). No cron.
  `getActiveWordGoalSummaryAction` wrapped in React `cache()` so the
  hive shell sidebar badge + the Word Goals page share one query
  per request.
- **Word-log action** (`lib/actions/hive-word-logs.actions.ts`):
  `getRecentWordLogsAction` for the recent-activity panel.
  Cursor-paginated; joins userProfiles + chapters.
- **Buzz actions** (`lib/actions/hive-buzz.actions.ts`):
  Five actions — create/update/delete/list/toggle-like.
  `createBuzzPostAction` wraps INSERT + `recordHiveActivityTx`
  inside the same tx. `toggleBuzzLikeAction` wraps INSERT-or-DELETE
  + `like_count` UPDATE in the same tx (denorm safety).
  `listBuzzPostsAction` returns `viewerLiked` per post via correlated
  subquery.
- **/hive/[hiveId]/word-goals** (server page + 6 _components/ files):
  Active goals strip (up to 4 cards) + contributors panel (per-member
  breakdown within the primary goal's window) + recent activity (last
  20 logs, cursor-paginated) + collapsible goal history at bottom.
  Empty state when no active goals. `canSetWordGoal(role)` gates the
  + New Goal CTA + per-card edit/archive icons.
- **+ New Goal / Edit / Archive modals**: type radio cards, target
  words input, start + end date with `computeGoalEndDate` auto-derive
  for non-TOTAL. Edit pre-fills `targetWords` + `endDate` (type +
  startDate locked). Archive via shared `ConfirmDialog`.
- **Hive sidebar progress badge**: thin 2px brand-yellow fill on a
  chrome track under the Word Goals nav row when an active goal
  exists. Aggregate progress against the primary active goal
  (DAILY > WEEKLY > MONTHLY > TOTAL).
- **/hive/[hiveId]/buzz** (server page + 4 _components/ files):
  Reverse-chron feed of `<BuzzPostCard>`s. TEXT cards preserve line
  breaks + basic markdown. LINK cards include `<LinkCard>` with
  favicon (`google.com/s2/favicons?domain=…`) + hostname + truncated
  URL; whole card opens in a new tab with `rel="noopener noreferrer"`.
  Empty state "No posts yet. Drop your first vibe."
- **Compose / Edit / Delete modals + LikeButton**: two-tab compose
  (Text/Link); URL validation via `new URL()` + `https:` check; edit
  pre-filled with type locked; delete via shared `ConfirmDialog`;
  `<LikeButton>` optimistic UI with `useTransition` + rollback on
  failure.
- **Activity event wiring**: `buzz_posted` fires from
  `createBuzzPostAction` (top-level only — buzz has no replies).
  Word logs deliberately do NOT emit events (would flood the feed).
  `<ActivityEventRow>`'s `buzz_posted` branch was scaffolded in H1
  T15; H4 T14 refined the copy for TEXT vs LINK.

**H4 patterns now load-bearing:**
- **`saveChapterAction` side-effect convention:** new chapter-save
  side effects mirror the snapshot block — same 60s throttle window,
  outside the chapter tx, swallowed errors. Add new ones below the
  snapshot block, above the return.
- **Lazy auto-archive on read:** date-bounded resources (here:
  DAILY/WEEKLY/MONTHLY goals) auto-archive when first observed
  after expiry. The read action runs a single UPDATE before its
  SELECT. No cron.
- **Denormalized counter safety:** denormalized counters
  (`hive_buzz_posts.like_count`) require the source-row INSERT/DELETE
  + the counter UPDATE to live inside the same `db.transaction`,
  with `like_count = like_count + 1` set-expressions (not
  read-then-write).
- **Top-level activity-only:** `recordHiveActivityTx` fires on the
  top-level INSERT only. No reply / no like / no
  word-log emissions.
- **`getBookHive(bookId)` as the hive entry point** from generic
  book code. Returns null when no hive is linked; safe to call from
  any code path with a known bookId.

N/N tests, tsc clean.
```

- [ ] **Step 2: Update Resume Here block**

Bump `Last updated`, `Current focus`, `Last commit`. Suggested `Current focus`:

> Hives redesign H4 Motivation COMPLETE — shared Word Goals + Buzz Board both live. Word logs flow automatically from `saveChapterAction` with 60s throttle; goal progress recomputed on view; lazy auto-archive on expiry. Buzz Board ships TEXT + LINK posts with optimistic likes. Next sub-project H5 Dashboard (analytics aggregation across goals + buzz + activity), or pivot to other priorities — /settings index / Phase 9 polish / Stripe webhook dashboard config / SP-B Friendships.

- [ ] **Step 3: Append H4 patterns to Key Patterns**

```markdown
### H4 saveChapterAction side-effect convention

New chapter-save side effects mirror the snapshot block in
`lib/actions/chapter.actions.ts`: outside the chapter tx, errors
swallowed with `console.error`, 60s throttle window where applicable.
H4's `logHiveWordDelta` is the canonical example. Add new ones below
the snapshot block, above the return. NEVER let a side effect throw
into the save's return path — the user's chapter must always save.

### H4 lazy auto-archive on read

Date-bounded resources (H4's DAILY/WEEKLY/MONTHLY word goals) flip
`is_active = false` lazily when first observed after expiry. The
read action runs a single `UPDATE … WHERE is_active=true AND
end_date IS NOT NULL AND end_date < now()` before its SELECT.
Idempotent (re-running on already-archived rows is a no-op).
No cron / no background job.

### H4 denormalized-counter safety

`hive_buzz_posts.like_count` is denormalized for cheap feed reads.
INSERT/DELETE on the source row + `like_count = like_count + 1`
UPDATE (set-expression, not read-then-write) MUST live inside the
same `db.transaction`. Reconciliation snippet on the Migration Plan
in the H4 plan doc if drift is ever detected.

### H4 top-level activity event policy

`recordHiveActivityTx` is called ONLY from the top-level INSERT side
of a feature surface. Word logs do NOT emit events (volume —
~1/min/active writer). Buzz likes do NOT emit events (not
feed-worthy). Goal creation could plausibly emit, but the spec
deliberately leaves it out — momentum surfaces on the Word Goals
page directly. Every `recordHiveActivityTx` call should have an
inline comment naming the payload shape so the feed renderer's
denormalization needs stay in sync.
```

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "feat(hive): H4 Motivation — word goals + buzz board"
```

**Subagent dispatch prompt:**

> Implement Task 15 — the final ship. Run `npx tsc --noEmit && npm test` and ensure both are clean. Update `AGENTS.md`: add the H4 entry above H3 in "What Has Been Built" per the plan; bump the Resume Here block; append the four H4 patterns to Key Patterns. Final commit `feat(hive): H4 Motivation — word goals + buzz board`. Push only if Chris asks.

---

## Self-Review Checklist

Before declaring H4 shipped:

- [ ] **Spec coverage:** every section of the spec (`Data Model`, `Word Goals: UI + Logging Integration`, `Buzz Board`, `Activity Event Wiring`, `Server Actions Summary`, `Migration Plan`, `Test Plan`) has a corresponding task here.
- [ ] **Migration safety:** runner is idempotent — re-running is a no-op. Partial-unique index added with `IF NOT EXISTS`; CHECK constraint added after `DROP CONSTRAINT IF EXISTS`; enums wrapped in `DO $$ EXCEPTION WHEN duplicate_object`.
- [ ] **Permission predicates:** `canSetWordGoal` / `canPostBuzz` / `canLikeBuzz` / `canEditBuzz` all added, all unit-tested. Live role enum names (`OWNER / MODERATOR / CONTRIBUTOR / BETA_READER`) used everywhere, not the spec text's `READER`.
- [ ] **Word-log hook:** `logHiveWordDelta` lives outside the chapter tx, swallows errors via try/catch, applies 60s throttle, skips zero-delta rows. Snapshot-pattern parity confirmed by reading both blocks side by side.
- [ ] **Goal partial-unique safety:** `createWordGoalAction` archives the existing active of the same type INSIDE the same tx as the new INSERT — verified by reading the action body, not just the test.
- [ ] **Lazy auto-archive:** `listHiveWordGoalsAction` runs the UPDATE sweep BEFORE the SELECT. Idempotent — re-running on already-archived rows is a no-op.
- [ ] **Denorm counter safety:** `toggleBuzzLikeAction` wraps INSERT-or-DELETE + `like_count` UPDATE in a single `db.transaction`. Uses `sql\`like_count + 1\`` set-expression, not read-then-write.
- [ ] **Activity event policy:** ONLY `createBuzzPostAction` writes a `hive_activity` row in H4. Confirmed by grep. Word logs + goal creation + likes all silent. `buzz_posted` payload is `{ type, bodyExcerpt: body.slice(0,100), linkUrl }`.
- [ ] **Standalone hives work:** shadow-book chapters route through `saveChapterAction` → `logHiveWordDelta` like any other chapter. No special-case branch.
- [ ] **Sidebar badge cached:** `getActiveWordGoalSummaryAction` is wrapped in React `cache()`; the hive shell + the /word-goals page share one query per request.
- [ ] **Buzz CHECK enforced:** TEXT post with linkUrl rejected; LINK post without linkUrl rejected. Confirmed by test + by manually attempting via SQL.
- [ ] **URL validation strict:** non-https URLs rejected (no `http://`, no `javascript:`, no schemeless).
- [ ] **Optimistic like rollback:** failed `toggleBuzzLikeAction` reverts the optimistic state + shows a sonner error. Confirmed by manual smoke with throttled network.
- [ ] **tsc + tests clean** at every task boundary commit. Final commit clean.
