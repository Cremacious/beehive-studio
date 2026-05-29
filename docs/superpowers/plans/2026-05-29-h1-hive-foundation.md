# H1 — Hive Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the schema, helpers, server actions, and primary UI surfaces of the Hives redesign foundation. A book may have at most one hive; standalone hives are allowed. 4 roles (OWNER/MODERATOR/CONTRIBUTOR/BETA_READER). Hive gets its own visibility + new `discoverable` boolean. Three creation paths from `/studio`. Editor binder footer button toggles "Create Hive" ↔ "Go to Hive". `/studio` gains a new Hives section. `/community` becomes a hive-activity feed (kills old follows feed). `/discover/hives` filters on `discoverable=true`. Book delete cascades hive. New `hive_activity` table; only `member_joined` event wired in H1 (H3/H4 wire the rest).

**Architecture:** New helpers in `lib/hive/` (permissions truth-table, `getBookHive` reverse lookup, `recordHiveActivity` writer). One schema migration applied via a one-shot `tsx` script in `scripts/` (drizzle-kit push needs TTY per AGENTS.md). Server actions consolidate in `lib/actions/hive.actions.ts` + new `lib/actions/hive-activity.actions.ts`. UI threading: `/studio` page-level server action loads books + hives in parallel; new Hives section is a client component nested in the existing studio library shell.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (Neon Postgres), Tailwind v4, vitest. Same `text`-id (cuid2) PK convention as the rest of the schema — NOT uuid (the H1 spec used `uuid` in SQL examples for clarity; actual code uses `text`).

**Spec:** [docs/superpowers/specs/2026-05-29-h1-hive-foundation-design.md](../specs/2026-05-29-h1-hive-foundation-design.md) (commit `7fc7cb7` + milestone amendment `b742908`)

**Downstream coupling note:** H2 will TIGHTEN H1's partial unique index `WHERE bookId IS NOT NULL` to a plain UNIQUE on `hives.bookId` once standalone hives have shadow books. Do NOT pre-tighten in H1 — the partial index is intentional at this milestone.

---

## Pre-flight Findings

- **`hives.bookId`** is currently `onDelete: 'set null'` (`db/schema/hive.ts:17`). H1 changes this to `cascade`.
- **`hive_member_role` enum** currently lists 5 values: `OWNER, CONTRIBUTOR, EDITOR, BETA_READER, PROOFREADER` (`db/schema/hive.ts:9`). H1 collapses to 4: drops `EDITOR`/`PROOFREADER`, adds `MODERATOR`. Postgres enum-value removal requires create-new-enum-and-swap.
- **All IDs are `text` (cuid2), NOT `uuid`.** SQL written in the spec used `uuid` for readability; the actual migration uses `text`.
- **`assertBookOwner`** already exists in `lib/actions/_helpers.ts`. `assertHiveMember`, `assertHiveOwner` also exist — H1's new `requireHiveMember` / `requireHiveOwner` / `requireHiveMod` extend rather than replace (returning the member role for downstream branching).
- **Migration script precedent:** `scripts/migrate-phase7.ts` uses `@neondatabase/serverless` + `tsx`. H1's migration follows the same shape. Run via `npx dotenv -e .env.local -- tsx scripts/migrate-h1.ts`.
- **Existing actions to be modified or deleted:**
  - `lib/actions/hive.actions.ts` — `createHiveAction`, `updateHiveAction`, `getUserHivesAction`, `getMyHivesAction`, others
  - `lib/actions/community.actions.ts` — `getCommunityFeedAction` (delete), `getSuggestedWritersAction` (keep), `getMyActiveSparksAction` (keep), `getMyHivesAction` (delete)
  - `lib/actions/discover.actions.ts` — `getPublicHivesAction` (rename + filter change)
- **`BinderHiveFooter`** lives in `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-hive-footer.tsx` (verify exact path during implementation; AGENTS.md DP2 notes the file exists). It currently opens a `CreateHiveModal`.
- **`/studio` library page** is at `app/[locale]/(app)/studio/page.tsx` — server component, fetches books + stats via `getStudioStatsAction`. H1 extends to also fetch hives.
- **`/community` page** is at `app/[locale]/(app)/community/page.tsx` — currently composes `SuggestedWritersStrip` + `FeedList` (the doomed feed) + sidebar with My Hives / Suggested Writers / Active Sparks.

---

### Task 1: Schema migration script + drizzle schema update

**Files:**
- Create: `scripts/migrate-h1.ts`
- Modify: `db/schema/hive.ts`

- [ ] **Step 1: Write the drizzle schema changes** (`db/schema/hive.ts`)

```ts
// Update the role enum to the new 4-value shape:
export const hiveMemberRoleEnum = pgEnum('hive_member_role',
  ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER'])

// Update the hives table:
export const hives = pgTable('hives', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').references(() => books.id, { onDelete: 'cascade' }),  // was 'set null'
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  visibility: hiveVisibilityEnum('visibility').default('PRIVATE').notNull(),
  discoverable: boolean('discoverable').default(false).notNull(),  // NEW
  status: hiveStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // Partial UNIQUE: one hive per book, NULL bookId allowed for standalones.
  // H2 will tighten to plain UNIQUE once standalone hives have shadow books.
  uniqueIndex('hives_book_id_unique').on(t.bookId).where(sql`book_id IS NOT NULL`),
])

// NEW: hive_activity table
export const hiveActivityTypeEnum = pgEnum('hive_activity_type', [
  'chapter_submitted',
  'chapter_submitted_approved',
  'chapter_submitted_rejected',
  'annotation_added',
  'suggestion_proposed',
  'suggestion_accepted',
  'suggestion_rejected',
  'buzz_posted',
  'discussion_posted',
  'member_joined',
])

export const hiveActivity = pgTable('hive_activity', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: hiveActivityTypeEnum('type').notNull(),
  subjectId: text('subject_id'),    // nullable
  payload: jsonb('payload'),         // nullable, denorm for cheap feed reads
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('hive_activity_hive_id_created_at_idx').on(t.hiveId, t.createdAt.desc()),
])
```

Add `boolean`, `jsonb`, `uniqueIndex`, `sql` to the `drizzle-orm/pg-core` and `drizzle-orm` imports at the top.

- [ ] **Step 2: Write the migration script** (`scripts/migrate-h1.ts`)

```ts
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

  // 2. Defensive: at most one hive per book before adding the unique index
  //    Keep oldest, delete the rest (cascade deletes child rows via existing FKs).
  const dupes = await sql`
    SELECT book_id, ARRAY_AGG(id ORDER BY created_at) AS ids
    FROM hives WHERE book_id IS NOT NULL
    GROUP BY book_id HAVING COUNT(*) > 1
  `
  for (const row of dupes) {
    const toDelete = (row.ids as string[]).slice(1)
    console.log(`  dedup book ${row.book_id}: keeping ${row.ids[0]}, deleting ${toDelete.length} others`)
    for (const id of toDelete) {
      await sql`DELETE FROM hives WHERE id = ${id}`
    }
  }
  console.log(`✓ deduped ${dupes.length} books with multiple hives`)

  // 3. Coerce discoverable=false for any hive whose visibility != PUBLIC (defense-in-depth)
  await sql`UPDATE hives SET discoverable = false WHERE visibility != 'PUBLIC'`
  console.log('✓ discoverable coerced for non-PUBLIC hives')

  // 4. Partial UNIQUE index on hives(book_id) WHERE bookId IS NOT NULL
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS hives_book_id_unique
            ON hives(book_id) WHERE book_id IS NOT NULL`
  console.log('✓ hives_book_id_unique partial unique index created')

  // 5. Tighten hives.book_id FK to ON DELETE CASCADE
  //    Drop existing constraint (auto-named) and recreate.
  const fkRow = await sql`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'hives'::regclass AND contype = 'f'
      AND conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'hives'::regclass AND attname = 'book_id')]::smallint[]
  `
  if (fkRow.length) {
    const name = fkRow[0].conname as string
    await sql`ALTER TABLE hives DROP CONSTRAINT ${sql.unsafe(`"${name}"`)}`
    console.log(`  dropped FK ${name}`)
  }
  await sql`ALTER TABLE hives ADD CONSTRAINT hives_book_id_fkey
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE`
  console.log('✓ hives.book_id FK now CASCADE')

  // 6. Collapse hive_member_role enum 5 → 4 (create new, copy, swap)
  //    Add new value MODERATOR first
  await sql`ALTER TYPE hive_member_role ADD VALUE IF NOT EXISTS 'MODERATOR'`
  //    Data: rewrite EDITOR → MODERATOR, PROOFREADER → CONTRIBUTOR
  await sql`UPDATE hive_members SET role = 'MODERATOR' WHERE role = 'EDITOR'`
  await sql`UPDATE hive_members SET role = 'CONTRIBUTOR' WHERE role = 'PROOFREADER'`
  await sql`UPDATE hive_invites SET role = 'MODERATOR' WHERE role = 'EDITOR'`
  await sql`UPDATE hive_invites SET role = 'CONTRIBUTOR' WHERE role = 'PROOFREADER'`
  console.log('✓ EDITOR → MODERATOR and PROOFREADER → CONTRIBUTOR rewrites done')

  //    Swap dance: create new enum, alter columns, drop old
  await sql`CREATE TYPE hive_member_role_new
            AS ENUM ('OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER')`
  await sql`ALTER TABLE hive_members
            ALTER COLUMN role TYPE hive_member_role_new
            USING role::text::hive_member_role_new`
  await sql`ALTER TABLE hive_invites
            ALTER COLUMN role TYPE hive_member_role_new
            USING role::text::hive_member_role_new`
  await sql`DROP TYPE hive_member_role`
  await sql`ALTER TYPE hive_member_role_new RENAME TO hive_member_role`
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
```

- [ ] **Step 3: Run migration**

`npx dotenv -e .env.local -- tsx scripts/migrate-h1.ts`

Expected: 8 numbered ✓ lines, final counts table printed, no errors.

- [ ] **Step 4: tsc check + smoke the schema**

`npx tsc --noEmit` — clean. Manually run a `db.query.hives.findFirst({ columns: { discoverable: true } })` in a scratch tsx to confirm the column is queryable via Drizzle.

- [ ] **Step 5: Commit**

```bash
git add db/schema/hive.ts scripts/migrate-h1.ts
git commit -m "feat(hive): H1 schema — discoverable, partial UNIQUE, CASCADE, role collapse, hive_activity"
```

---

### Task 2: Permission helpers + truth-table tests

**Files:**
- Create: `lib/hive/permissions.ts`
- Create: `lib/hive/__tests__/permissions.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import {
  canEditWiki, canSubmitChapter, canReviewSubmissions, canAnnotate,
  canSuggestEdits, canEditOutline, canManageMembers, canDeleteHive,
  type HiveRole,
} from '../permissions'

const ROLES: HiveRole[] = ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER']

describe('hive permission predicates', () => {
  it('canEditWiki: everyone except BETA_READER', () => {
    expect(canEditWiki('OWNER')).toBe(true)
    expect(canEditWiki('MODERATOR')).toBe(true)
    expect(canEditWiki('CONTRIBUTOR')).toBe(true)
    expect(canEditWiki('BETA_READER')).toBe(false)
  })
  it('canSubmitChapter: CONTRIBUTOR only', () => {
    expect(canSubmitChapter('OWNER')).toBe(false)
    expect(canSubmitChapter('MODERATOR')).toBe(false)
    expect(canSubmitChapter('CONTRIBUTOR')).toBe(true)
    expect(canSubmitChapter('BETA_READER')).toBe(false)
  })
  it('canReviewSubmissions: OWNER or MODERATOR', () => {
    expect(canReviewSubmissions('OWNER')).toBe(true)
    expect(canReviewSubmissions('MODERATOR')).toBe(true)
    expect(canReviewSubmissions('CONTRIBUTOR')).toBe(false)
    expect(canReviewSubmissions('BETA_READER')).toBe(false)
  })
  it('canAnnotate: all roles', () => {
    for (const r of ROLES) expect(canAnnotate(r)).toBe(true)
  })
  it('canSuggestEdits: all roles', () => {
    for (const r of ROLES) expect(canSuggestEdits(r)).toBe(true)
  })
  it('canEditOutline: everyone except BETA_READER', () => {
    expect(canEditOutline('BETA_READER')).toBe(false)
    expect(canEditOutline('OWNER')).toBe(true)
    expect(canEditOutline('MODERATOR')).toBe(true)
    expect(canEditOutline('CONTRIBUTOR')).toBe(true)
  })
  it('canManageMembers: OWNER or MODERATOR', () => {
    expect(canManageMembers('OWNER')).toBe(true)
    expect(canManageMembers('MODERATOR')).toBe(true)
    expect(canManageMembers('CONTRIBUTOR')).toBe(false)
    expect(canManageMembers('BETA_READER')).toBe(false)
  })
  it('canDeleteHive: OWNER only', () => {
    expect(canDeleteHive('OWNER')).toBe(true)
    expect(canDeleteHive('MODERATOR')).toBe(false)
    expect(canDeleteHive('CONTRIBUTOR')).toBe(false)
    expect(canDeleteHive('BETA_READER')).toBe(false)
  })
})
```

Run: `npm test -- hive/permissions`. Expected: FAIL ("Cannot find module").

- [ ] **Step 2: Implement predicates + require helpers**

```ts
import { db } from '@/db'
import { hives, hiveMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export type HiveRole = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

// ── Throw-or-return-role helpers ────────────────────────────────────────────
export async function requireHiveMember(hiveId: string, userId: string): Promise<HiveRole> {
  const m = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, userId)),
    columns: { role: true },
  })
  if (!m) throw new Error('NOT_HIVE_MEMBER')
  return m.role as HiveRole
}

export async function requireHiveMod(hiveId: string, userId: string): Promise<HiveRole> {
  const role = await requireHiveMember(hiveId, userId)
  if (role !== 'OWNER' && role !== 'MODERATOR') throw new Error('NOT_AUTHORIZED')
  return role
}

export async function requireHiveOwner(hiveId: string, userId: string): Promise<HiveRole> {
  const h = await db.query.hives.findFirst({
    where: and(eq(hives.id, hiveId), eq(hives.ownerId, userId)),
    columns: { id: true },
  })
  if (!h) throw new Error('NOT_HIVE_OWNER')
  return 'OWNER'
}

// ── Pure predicates ─────────────────────────────────────────────────────────
export const canEditWiki = (r: HiveRole) => r !== 'BETA_READER'
export const canSubmitChapter = (r: HiveRole) => r === 'CONTRIBUTOR'
export const canReviewSubmissions = (r: HiveRole) => r === 'OWNER' || r === 'MODERATOR'
export const canAnnotate = (_r: HiveRole) => true
export const canSuggestEdits = (_r: HiveRole) => true
export const canEditOutline = (r: HiveRole) => r !== 'BETA_READER'
export const canManageMembers = (r: HiveRole) => r === 'OWNER' || r === 'MODERATOR'
export const canDeleteHive = (r: HiveRole) => r === 'OWNER'
```

- [ ] **Step 3: Run tests + tsc**

`npm test -- hive/permissions && npx tsc --noEmit` — 8 tests pass, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add lib/hive/permissions.ts lib/hive/__tests__/permissions.test.ts
git commit -m "feat(hive): permission helpers (4 roles × 8 predicates) + require* functions"
```

---

### Task 3: `getBookHive` reverse-lookup helper + tests

**Files:**
- Create: `lib/hive/get-book-hive.ts`
- Create: `lib/hive/__tests__/get-book-hive.test.ts`

- [ ] **Step 1: Write failing tests** (mock DB)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/db', () => ({
  db: { query: { hives: { findFirst: vi.fn() } } },
}))
// React cache() unwrap: just identity in tests
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T extends (...a: any[]) => any>(fn: T) => fn }
})

import { getBookHive } from '../get-book-hive'
import { db } from '@/db'

describe('getBookHive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { hiveId } when a hive exists for the book', async () => {
    ;(db.query.hives.findFirst as any).mockResolvedValue({ id: 'hive-1' })
    const r = await getBookHive('book-1')
    expect(r).toEqual({ hiveId: 'hive-1' })
  })

  it('returns null when no hive exists for the book', async () => {
    ;(db.query.hives.findFirst as any).mockResolvedValue(null)
    const r = await getBookHive('book-1')
    expect(r).toBe(null)
  })
})
```

Run: `npm test -- get-book-hive`. Expected: FAIL.

- [ ] **Step 2: Implement with React `cache()` memoization**

```ts
import { cache } from 'react'
import { db } from '@/db'
import { hives } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Reverse-lookup: returns the hive linked to a book, or null.
 * Memoized per-request via React cache() so the binder footer, the
 * book-card "has hive" indicator, and createHiveAction's uniqueness
 * check don't all re-query.
 */
export const getBookHive = cache(
  async (bookId: string): Promise<{ hiveId: string } | null> => {
    const row = await db.query.hives.findFirst({
      where: eq(hives.bookId, bookId),
      columns: { id: true },
    })
    return row ? { hiveId: row.id } : null
  }
)
```

- [ ] **Step 3: Run tests + tsc**

`npm test -- get-book-hive && npx tsc --noEmit` — 2 pass, clean.

- [ ] **Step 4: Commit**

```bash
git add lib/hive/get-book-hive.ts lib/hive/__tests__/get-book-hive.test.ts
git commit -m "feat(hive): getBookHive() reverse-lookup helper with React cache()"
```

---

### Task 4: `recordHiveActivity` writer + `getHiveActivityFeedAction`

**Files:**
- Create: `lib/hive/record-activity.ts`
- Create: `lib/hive/__tests__/record-activity.test.ts`
- Create: `lib/actions/hive-activity.actions.ts`

- [ ] **Step 1: Write failing test for `recordHiveActivity`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
vi.mock('@/db', () => ({ db: { insert: insertMock } }))

import { recordHiveActivity } from '../record-activity'
import { hiveActivity } from '@/db/schema'

describe('recordHiveActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a row with the right shape', async () => {
    await recordHiveActivity({
      hiveId: 'h1', actorId: 'u1', type: 'member_joined',
      subjectId: null, payload: { foo: 'bar' },
    })
    expect(insertMock).toHaveBeenCalledWith(hiveActivity)
    expect(insertMock.mock.results[0].value.values).toHaveBeenCalledWith({
      hiveId: 'h1', actorId: 'u1', type: 'member_joined',
      subjectId: null, payload: { foo: 'bar' },
    })
  })
})
```

`npm test -- record-activity` → FAIL.

- [ ] **Step 2: Implement `recordHiveActivity`**

```ts
import { db } from '@/db'
import { hiveActivity } from '@/db/schema'

export type HiveActivityType =
  | 'chapter_submitted' | 'chapter_submitted_approved' | 'chapter_submitted_rejected'
  | 'annotation_added' | 'suggestion_proposed' | 'suggestion_accepted' | 'suggestion_rejected'
  | 'buzz_posted' | 'discussion_posted' | 'member_joined'

/**
 * Inserts one row into hive_activity. Callers should invoke this in the
 * same DB transaction as the source-row insert when possible.
 */
export async function recordHiveActivity(opts: {
  hiveId: string
  actorId: string
  type: HiveActivityType
  subjectId?: string | null
  payload?: unknown
}): Promise<void> {
  await db.insert(hiveActivity).values({
    hiveId: opts.hiveId,
    actorId: opts.actorId,
    type: opts.type,
    subjectId: opts.subjectId ?? null,
    payload: opts.payload ?? null,
  })
}
```

- [ ] **Step 3: Implement `getHiveActivityFeedAction`** (`lib/actions/hive-activity.actions.ts`)

```ts
'use server'
import { db } from '@/db'
import { hiveActivity, hiveMembers, hives, users } from '@/db/schema'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from '@/lib/action-result'

export type HiveActivityEvent = {
  id: string
  hiveId: string
  hiveName: string
  actorId: string
  actorUsername: string | null
  actorAvatarUrl: string | null
  type: string
  subjectId: string | null
  payload: unknown
  createdAt: Date
}

export type HiveActivityPage = {
  items: HiveActivityEvent[]
  nextCursor: string | null
}

/**
 * Member-scoped activity feed. Cursor = `<createdAt-ISO>|<id>` for stable order.
 * If `hiveId` is provided, scopes to a single hive (used by the H5 dashboard).
 */
export async function getHiveActivityFeedAction(opts: {
  cursor?: string | null
  limit?: number
  hiveId?: string | null
} = {}): Promise<ActionResult<HiveActivityPage>> {
  try {
    const userId = await requireAuth()
    const limit = Math.min(opts.limit ?? 30, 100)

    const memberHives = await db.select({ hiveId: hiveMembers.hiveId })
      .from(hiveMembers).where(eq(hiveMembers.userId, userId))
    let hiveIds = memberHives.map(r => r.hiveId)
    if (opts.hiveId) hiveIds = hiveIds.filter(id => id === opts.hiveId)
    if (hiveIds.length === 0) return { success: true, data: { items: [], nextCursor: null } }

    // Cursor parse
    let cursorDate: Date | null = null
    if (opts.cursor) {
      const [iso] = opts.cursor.split('|')
      cursorDate = new Date(iso)
    }

    const rows = await db.select({
      id: hiveActivity.id,
      hiveId: hiveActivity.hiveId,
      hiveName: hives.name,
      actorId: hiveActivity.actorId,
      actorUsername: users.name,            // adjust if your users table uses 'username'
      actorAvatarUrl: users.image,          // adjust to your avatar column
      type: hiveActivity.type,
      subjectId: hiveActivity.subjectId,
      payload: hiveActivity.payload,
      createdAt: hiveActivity.createdAt,
    })
      .from(hiveActivity)
      .innerJoin(hives, eq(hives.id, hiveActivity.hiveId))
      .innerJoin(users, eq(users.id, hiveActivity.actorId))
      .where(
        and(
          inArray(hiveActivity.hiveId, hiveIds),
          cursorDate ? lt(hiveActivity.createdAt, cursorDate) : undefined,
        ),
      )
      .orderBy(desc(hiveActivity.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(r => ({ ...r, type: r.type as string }))
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null

    return { success: true, data: { items, nextCursor } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

Adjust the `users` column names (`name`, `image`) to match this project's actual auth users table — confirm from `db/schema/auth.ts` during implementation.

- [ ] **Step 4: Run tests + tsc**

`npm test -- record-activity && npx tsc --noEmit` — 1 pass, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/hive/record-activity.ts lib/hive/__tests__/record-activity.test.ts lib/actions/hive-activity.actions.ts
git commit -m "feat(hive): recordHiveActivity writer + getHiveActivityFeedAction"
```

---

### Task 5: Reshape `createHiveAction` (3 paths + uniqueness + free-tier)

**Files:**
- Modify: `lib/actions/hive.actions.ts`
- Modify: `lib/validations/hive.ts` (or wherever the createHive zod schema lives — verify path during implementation)

- [ ] **Step 1: Update the zod schema**

```ts
// lib/validations/hive.ts
import { z } from 'zod'
export const createHiveSchema = z.object({
  bookId: z.string().nullable().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']).default('PRIVATE'),
  discoverable: z.boolean().default(false),
}).transform(v => ({
  ...v,
  // Coerce: discoverable can only be true on PUBLIC hives.
  discoverable: v.visibility === 'PUBLIC' ? v.discoverable : false,
}))
```

- [ ] **Step 2: Rewrite `createHiveAction`**

```ts
'use server'
import { db } from '@/db'
import { hives, hiveMembers, books } from '@/db/schema'
import { and, eq, isNull, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getUserPremiumStatus, FREE_HIVE_LIMIT } from '@/lib/premium'
import { createHiveSchema } from '@/lib/validations/hive'
import { getBookHive } from '@/lib/hive/get-book-hive'
import type { ActionResult } from '@/lib/action-result'

export async function createHiveAction(input: unknown): Promise<ActionResult<{ hiveId: string }>> {
  try {
    const userId = await requireAuth()
    const parsed = createHiveSchema.parse(input)

    // Free-tier limit (owned hives only)
    const isPremium = await getUserPremiumStatus(userId)
    if (!isPremium) {
      const [{ value: owned }] = await db.select({ value: count() })
        .from(hives).where(eq(hives.ownerId, userId))
      if (owned >= FREE_HIVE_LIMIT) {
        return { success: false, error: 'FREE_LIMIT_REACHED' }
      }
    }

    // If bookId provided, verify ownership + uniqueness
    if (parsed.bookId) {
      const book = await db.query.books.findFirst({
        where: and(eq(books.id, parsed.bookId), eq(books.userId, userId)),
        columns: { id: true },
      })
      if (!book) return { success: false, error: 'BOOK_NOT_FOUND' }
      const existing = await getBookHive(parsed.bookId)
      if (existing) return { success: false, error: 'BOOK_ALREADY_HAS_HIVE' }
    }

    // Insert hive + owner member row in a transaction
    const [hive] = await db.insert(hives).values({
      bookId: parsed.bookId ?? null,
      ownerId: userId,
      name: parsed.name,
      description: parsed.description ?? null,
      visibility: parsed.visibility,
      discoverable: parsed.discoverable,
    }).returning({ id: hives.id })

    await db.insert(hiveMembers).values({
      hiveId: hive.id,
      userId,
      role: 'OWNER',
    })

    return { success: true, data: { hiveId: hive.id } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

- [ ] **Step 3: Write integration-ish tests for the schema coercion**

```ts
// lib/validations/__tests__/hive.test.ts
import { describe, it, expect } from 'vitest'
import { createHiveSchema } from '../hive'

describe('createHiveSchema', () => {
  it('coerces discoverable=false when visibility != PUBLIC', () => {
    const r = createHiveSchema.parse({
      name: 'X', visibility: 'PRIVATE', discoverable: true,
    })
    expect(r.discoverable).toBe(false)
  })
  it('keeps discoverable=true when visibility=PUBLIC', () => {
    const r = createHiveSchema.parse({
      name: 'X', visibility: 'PUBLIC', discoverable: true,
    })
    expect(r.discoverable).toBe(true)
  })
  it('defaults discoverable=false', () => {
    const r = createHiveSchema.parse({ name: 'X' })
    expect(r.discoverable).toBe(false)
    expect(r.visibility).toBe('PRIVATE')
  })
  it('rejects empty name', () => {
    expect(() => createHiveSchema.parse({ name: '' })).toThrow()
  })
})
```

`npm test -- validations/hive && npx tsc --noEmit` — 4 pass, clean.

- [ ] **Step 4: Commit**

```bash
git add lib/validations/hive.ts lib/validations/__tests__/hive.test.ts lib/actions/hive.actions.ts
git commit -m "feat(hive): createHiveAction reshape — bookId, visibility, discoverable, free-tier"
```

---

### Task 6: Reshape `updateHiveAction` + remove dead actions

**Files:**
- Modify: `lib/actions/hive.actions.ts`
- Modify: `lib/validations/hive.ts`

- [ ] **Step 1: Add `updateHiveSchema` with coercion**

```ts
// in lib/validations/hive.ts
export const updateHiveSchema = z.object({
  hiveId: z.string(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(280).nullable().optional(),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']).optional(),
  discoverable: z.boolean().optional(),
}).transform(v => {
  // If visibility is being set to non-PUBLIC, force discoverable=false.
  if (v.visibility && v.visibility !== 'PUBLIC') v.discoverable = false
  return v
})
```

- [ ] **Step 2: Rewrite `updateHiveAction`**

```ts
export async function updateHiveAction(input: unknown): Promise<ActionResult<void>> {
  try {
    const userId = await requireAuth()
    const parsed = updateHiveSchema.parse(input)
    await requireHiveMod(parsed.hiveId, userId)

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.name !== undefined) patch.name = parsed.name
    if (parsed.description !== undefined) patch.description = parsed.description
    if (parsed.visibility !== undefined) patch.visibility = parsed.visibility
    if (parsed.discoverable !== undefined) patch.discoverable = parsed.discoverable

    await db.update(hives).set(patch).where(eq(hives.id, parsed.hiveId))
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

Import `requireHiveMod` from `@/lib/hive/permissions` at the top of the file.

- [ ] **Step 3: Delete `getMyHivesAction` and `getUserHivesAction`** (both fold into the new `getUserHivesView` in Task 7) — leave the file searchable for callers; they'll error at compile-time and Task 11 codemods them.

- [ ] **Step 4: tsc check** (expect compile errors at callers — that's intentional; they'll be fixed in later tasks)

`npx tsc --noEmit 2>&1 | grep -E "getMyHivesAction|getUserHivesAction"` — list the call sites for later codemod.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/hive.ts lib/actions/hive.actions.ts
git commit -m "feat(hive): updateHiveAction discoverable coercion + drop deprecated list actions"
```

---

### Task 7: `getUserHivesView` projection

**Files:**
- Modify: `lib/actions/hive.actions.ts`

- [ ] **Step 1: Implement `getUserHivesView`**

```ts
import { sql } from 'drizzle-orm'

export type UserHiveView = {
  id: string
  name: string
  description: string | null
  bookId: string | null
  bookTitle: string | null
  bookCoverUrl: string | null
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  discoverable: boolean
  status: 'ACTIVE' | 'COMPLETED'
  memberCount: number
  lastActiveAt: Date | null
  viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'
}

export async function getUserHivesView(): Promise<ActionResult<UserHiveView[]>> {
  try {
    const userId = await requireAuth()
    const rows = await db.execute<UserHiveView>(sql`
      SELECT
        h.id,
        h.name,
        h.description,
        h.book_id          AS "bookId",
        b.title            AS "bookTitle",
        b.cover_url        AS "bookCoverUrl",
        h.visibility,
        h.discoverable,
        h.status,
        (SELECT COUNT(*)::int FROM hive_members WHERE hive_id = h.id) AS "memberCount",
        (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id) AS "lastActiveAt",
        m.role::text       AS "viewerRole"
      FROM hives h
      INNER JOIN hive_members m ON m.hive_id = h.id AND m.user_id = ${userId}
      LEFT JOIN books b ON b.id = h.book_id
      ORDER BY COALESCE(
        (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id),
        h.created_at
      ) DESC
    `)
    return { success: true, data: rows.rows ?? rows as unknown as UserHiveView[] }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

Drizzle's `db.execute` return shape varies by driver — confirm the `.rows` access pattern matches what neon-http returns in this project (check `lib/actions/community.actions.ts` for `db.execute` precedent).

- [ ] **Step 2: tsc check**

`npx tsc --noEmit` — should be clean (modulo the deprecated callers from Task 6).

- [ ] **Step 3: Commit**

```bash
git add lib/actions/hive.actions.ts
git commit -m "feat(hive): getUserHivesView() projection for /studio Hives section"
```

---

### Task 8: Emit `member_joined` activity on invite acceptance

**Files:**
- Modify: `lib/actions/hive.actions.ts` (find `acceptHiveInviteAction`)

- [ ] **Step 1: Add `recordHiveActivity` call**

In `acceptHiveInviteAction`, after the `hiveMembers` insert + `hiveInvites` status update succeed, append:

```ts
import { recordHiveActivity } from '@/lib/hive/record-activity'

// … after the membership insert in the same try block:
await recordHiveActivity({
  hiveId: invite.hiveId,
  actorId: userId,
  type: 'member_joined',
  subjectId: null,
  payload: { role: invite.role },
})
```

Wrap inserts + activity write in a transaction if the existing action doesn't already use one:

```ts
await db.transaction(async (tx) => {
  await tx.insert(hiveMembers).values({ … })
  await tx.update(hiveInvites).set({ status: 'ACCEPTED' }).where(…)
  // recordHiveActivity uses module-level db; that's fine — same connection pool,
  // separate atomic op. If you want one transaction:
  await tx.insert(hiveActivity).values({ hiveId: invite.hiveId, actorId: userId, type: 'member_joined', payload: { role: invite.role } })
})
```

Pick whichever pattern the surrounding code uses.

- [ ] **Step 2: Manual smoke**

(Will be covered by the H1 final manual smoke in Task 18; no unit test added for the action because it's an integration of two helpers already tested.)

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add lib/actions/hive.actions.ts
git commit -m "feat(hive): emit member_joined activity on invite acceptance"
```

---

### Task 9: Rename `getPublicHivesAction` → `getDiscoverableHivesAction`

**Files:**
- Modify: `lib/actions/discover.actions.ts`
- Modify: callers (`app/[locale]/(app)/discover/` page that lists hives — find via grep)

- [ ] **Step 1: Rename + filter change**

```ts
// Old:
//   export async function getPublicHivesAction() { … WHERE visibility = 'PUBLIC' … }
// New:
export async function getDiscoverableHivesAction(): Promise<ActionResult<DiscoverableHive[]>> {
  // body identical except WHERE clause:
  //   WHERE visibility = 'PUBLIC' AND discoverable = true
}
```

- [ ] **Step 2: Update callers**

`grep -rn "getPublicHivesAction" app/ lib/` — replace every call site with `getDiscoverableHivesAction`. Likely just `app/[locale]/(public)/discover/page.tsx` (Hives tab) or wherever Phase 7's tab UI lives.

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add lib/actions/discover.actions.ts app/[locale]/**/discover/
git commit -m "refactor(discover): getPublicHivesAction → getDiscoverableHivesAction (discoverable filter)"
```

---

### Task 10: Delete `getCommunityFeedAction` + codemod callers

**Files:**
- Modify: `lib/actions/community.actions.ts`
- Modify: `app/[locale]/(app)/community/` (will be fully rewritten in Task 13; for now, stub or comment out the dead call so tsc passes)

- [ ] **Step 1: Delete `getCommunityFeedAction` + `getMyHivesAction`** from `lib/actions/community.actions.ts`. Keep `getSuggestedWritersAction` and `getMyActiveSparksAction`.

- [ ] **Step 2: tsc check — list breakages**

`npx tsc --noEmit 2>&1 | head -30`

Expected breakages: `app/[locale]/(app)/community/page.tsx` references the dead actions. Comment those imports + uses temporarily; replace fully in Task 13. Confirm tsc is clean after commenting.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/community.actions.ts app/[locale]/**/community/
git commit -m "chore(community): drop getCommunityFeedAction + getMyHivesAction (replaced by H1 hive-activity feed)"
```

---

### Task 11: `/studio` Hives section + Hive card

**Files:**
- Modify: `app/[locale]/(app)/studio/page.tsx`
- Create: `app/[locale]/(app)/studio/_components/hives-section.tsx`
- Create: `app/[locale]/(app)/studio/_components/hive-card.tsx`

- [ ] **Step 1: Server page — fetch hives in parallel**

In `app/[locale]/(app)/studio/page.tsx`, alongside existing books + stats fetch, add:

```tsx
import { getUserHivesView } from '@/lib/actions/hive.actions'

// inside the page component:
const [books, stats, hivesResult] = await Promise.all([
  getUserBooksAction(),
  getStudioStatsAction(),
  getUserHivesView(),
])
const hives = hivesResult.success ? hivesResult.data : []

return (
  <>
    {/* existing hero + stats + books grid */}
    <BooksSection books={books} />
    <HivesSection hives={hives} />
  </>
)
```

- [ ] **Step 2: `HivesSection` client component**

```tsx
// app/[locale]/(app)/studio/_components/hives-section.tsx
'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { UserHiveView } from '@/lib/actions/hive.actions'
import { HiveCard } from './hive-card'
import { CreateHiveModal } from './create-hive-modal'

type SortKey = 'activity' | 'recent' | 'name' | 'members'
type OwnedFilter = 'all' | 'owned' | 'member'
type LinkedFilter = 'all' | 'linked' | 'standalone'

export function HivesSection({ hives }: { hives: UserHiveView[] }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('activity')
  const [ownedF, setOwnedF] = useState<OwnedFilter>('all')
  const [linkedF, setLinkedF] = useState<LinkedFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    let xs = hives
    if (search) xs = xs.filter(h => h.name.toLowerCase().includes(search.toLowerCase()))
    if (ownedF === 'owned') xs = xs.filter(h => h.viewerRole === 'OWNER')
    if (ownedF === 'member') xs = xs.filter(h => h.viewerRole !== 'OWNER')
    if (linkedF === 'linked') xs = xs.filter(h => h.bookId !== null)
    if (linkedF === 'standalone') xs = xs.filter(h => h.bookId === null)
    const sorted = [...xs]
    switch (sort) {
      case 'recent': sorted.sort((a, b) => +b.lastActiveAt! - +a.lastActiveAt!); break
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'members': sorted.sort((a, b) => b.memberCount - a.memberCount); break
      // 'activity' = already sorted by getUserHivesView's ORDER BY
    }
    return sorted
  }, [hives, search, sort, ownedF, linkedF])

  const hasBoth = hives.some(h => h.bookId) && hives.some(h => !h.bookId)
  const counts = {
    all: hives.length,
    owned: hives.filter(h => h.viewerRole === 'OWNER').length,
    member: hives.filter(h => h.viewerRole !== 'OWNER').length,
  }

  return (
    <section className="mt-12">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Your Hives</h2>
        <button onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand text-brand-ink text-sm font-medium">
          <Plus size={16} /> New Hive
        </button>
      </header>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Search hives…" value={search} onChange={e => setSearch(e.target.value)}
               className="px-3 py-1.5 rounded-md bg-input text-sm w-64" />
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="px-3 py-1.5 rounded-md bg-input text-sm">
          <option value="activity">Most active</option>
          <option value="recent">Recently created</option>
          <option value="name">A → Z</option>
          <option value="members">Member count</option>
        </select>
        <ChipRow value={ownedF} onChange={setOwnedF} options={[
          ['all', `All (${counts.all})`],
          ['owned', `Owned (${counts.owned})`],
          ['member', `Member (${counts.member})`],
        ]} />
        {hasBoth && (
          <ChipRow value={linkedF} onChange={setLinkedF} options={[
            ['all', 'All'], ['linked', 'Linked to book'], ['standalone', 'Standalone'],
          ]} />
        )}
      </div>

      {filtered.length === 0 && hives.length === 0 && (
        <EmptyState onCreate={() => setModalOpen(true)} />
      )}
      {filtered.length === 0 && hives.length > 0 && (
        <p className="text-muted-foreground text-sm py-8 text-center">No hives match these filters.</p>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(h => <HiveCard key={h.id} hive={h} />)}
        </div>
      )}

      {modalOpen && <CreateHiveModal onClose={() => setModalOpen(false)} />}
    </section>
  )
}

function ChipRow<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: [T, string][]
}) {
  return (
    <div className="inline-flex gap-1 p-1 bg-input rounded-md">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
                className={`px-3 py-1 text-xs rounded ${value === v ? 'bg-brand text-brand-ink' : 'text-muted-foreground'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border border-dashed rounded-lg p-10 text-center">
      <p className="mb-4 text-muted-foreground">No hives yet. Start a hive to collaborate on a book.</p>
      <button onClick={onCreate} className="px-3 py-1.5 rounded-md bg-brand text-brand-ink text-sm">+ New Hive</button>
    </div>
  )
}
```

- [ ] **Step 3: `HiveCard`**

```tsx
// app/[locale]/(app)/studio/_components/hive-card.tsx
'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { UserHiveView } from '@/lib/actions/hive.actions'

const ROLE_PILL_CLS: Record<UserHiveView['viewerRole'], string> = {
  OWNER: 'bg-status-published/20 text-status-published',
  MODERATOR: 'bg-status-revised/20 text-status-revised',
  CONTRIBUTOR: 'bg-status-drafting/20 text-status-drafting',
  BETA_READER: 'bg-muted text-muted-foreground',
}

export function HiveCard({ hive }: { hive: UserHiveView }) {
  const { locale } = useParams<{ locale: string }>()
  return (
    <Link href={`/${locale}/hive/${hive.id}`}
          className="block rounded-lg overflow-hidden bg-[var(--canvas-dark-100)] border border-border hover:border-brand transition-colors">
      <div className="aspect-[3/2] bg-canvas-dark-150 relative">
        {hive.bookCoverUrl
          ? <Image src={hive.bookCoverUrl} alt="" fill className="object-cover" />
          : <HoneycombSvg />}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium truncate">{hive.name}</h3>
          <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${ROLE_PILL_CLS[hive.viewerRole]}`}>
            {hive.viewerRole.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {hive.bookTitle ? `for ${hive.bookTitle} · ` : ''}{hive.memberCount} {hive.memberCount === 1 ? 'member' : 'members'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {hive.lastActiveAt
            ? `Last active ${formatDistanceToNow(hive.lastActiveAt, { addSuffix: true })}`
            : 'No activity yet'}
        </p>
      </div>
    </Link>
  )
}

function HoneycombSvg() {
  // Minimal placeholder; can be polished later
  return (
    <div className="absolute inset-0 flex items-center justify-center text-brand/40 text-6xl">⬡</div>
  )
}
```

- [ ] **Step 4: tsc + visual smoke** (run the app, navigate to /studio, confirm empty Hives section renders without errors)

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/studio/page.tsx app/[locale]/(app)/studio/_components/hives-section.tsx app/[locale]/(app)/studio/_components/hive-card.tsx
git commit -m "feat(studio): Hives section with search, sort, filters, and hive cards"
```

---

### Task 12: `CreateHiveModal` (two-step path picker)

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-hive-modal.tsx`

- [ ] **Step 1: Implement two-step modal**

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Link2, BookPlus, Sparkles } from 'lucide-react'
import { createHiveAction } from '@/lib/actions/hive.actions'
import { getUserBooksAction } from '@/lib/actions/book.actions'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type Path = 'link' | 'new' | 'standalone'

export function CreateHiveModal({
  onClose,
  prelockBookId,    // when opened from the editor binder footer
}: { onClose: () => void; prelockBookId?: string }) {
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const [step, setStep] = useState<'pick' | 'details'>(prelockBookId ? 'details' : 'pick')
  const [path, setPath] = useState<Path>(prelockBookId ? 'link' : 'link')
  const [bookId, setBookId] = useState<string | null>(prelockBookId ?? null)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '',
    visibility: 'PRIVATE' as 'PRIVATE' | 'FRIENDS' | 'PUBLIC',
    discoverable: false,
  })

  if (path === 'new' && step === 'pick') {
    // Route to wizard with ?withHive=1; the wizard's submit handler will open
    // this modal at step='details' with the new bookId pre-locked.
    router.push(`/${locale}/studio/new?withHive=1`)
    return null
  }

  const submit = () => {
    setErr(null)
    start(async () => {
      const result = await createHiveAction({
        bookId: path === 'standalone' ? null : bookId,
        ...form,
      })
      if (!result.success) { setErr(result.error); return }
      router.push(`/${locale}/hive/${result.data.hiveId}`)
    })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        {step === 'pick' && (
          <PathPicker onPick={(p) => { setPath(p); if (p !== 'new') setStep('details') }} />
        )}
        {step === 'details' && (
          <DetailsForm
            path={path}
            bookId={bookId}
            setBookId={setBookId}
            form={form}
            setForm={setForm}
            err={err}
            pending={pending}
            onBack={() => setStep('pick')}
            onSubmit={submit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PathPicker({ onPick }: { onPick: (p: Path) => void }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Start a new hive</h3>
      <PathCard icon={<Link2 />} title="Link an existing book"
                blurb="Pick one of your books that doesn't yet have a hive"
                onClick={() => onPick('link')} />
      <PathCard icon={<BookPlus />} title="Create a new book + hive together"
                blurb="Goes through the book wizard, then opens hive details"
                onClick={() => onPick('new')} />
      <PathCard icon={<Sparkles />} title="Standalone hive (no book)"
                blurb="A collaboration space without a linked book"
                onClick={() => onPick('standalone')} />
    </div>
  )
}

function PathCard({ icon, title, blurb, onClick }:
  { icon: React.ReactNode; title: string; blurb: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className="w-full text-left p-4 rounded-lg border border-border hover:border-brand transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-brand">{icon}</div>
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-0.5">{blurb}</p>
        </div>
      </div>
    </button>
  )
}

function DetailsForm({ path, bookId, setBookId, form, setForm, err, pending, onBack, onSubmit }: any) {
  const [books, setBooks] = useState<Array<{ id: string; title: string; hasHive: boolean }> | null>(null)

  // Lazy-load eligible books for the 'link' path
  useEffect(() => {
    if (path !== 'link' || books) return
    getUserBooksAction().then(r => {
      if (!r.success) return
      // Need a 'hasHive' projection — see Step 2 below.
      setBooks(r.data.map((b: any) => ({ id: b.id, title: b.title, hasHive: !!b.hiveId })))
    })
  }, [path, books])

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <h3 className="text-lg font-semibold">Hive details</h3>

      {path === 'link' && (
        <div>
          <label className="block text-sm mb-1">Book</label>
          <select required value={bookId ?? ''} onChange={e => setBookId(e.target.value || null)}
                  className="w-full px-3 py-2 rounded-md bg-input">
            <option value="">Pick a book…</option>
            {books?.filter(b => !b.hasHive).map(b =>
              <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          {books && books.every(b => b.hasHive) && (
            <p className="text-xs text-muted-foreground mt-1">All your books already have a hive.</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm mb-1">Name</label>
        <input required maxLength={80} value={form.name}
               onChange={e => setForm({ ...form, name: e.target.value })}
               className="w-full px-3 py-2 rounded-md bg-input" />
      </div>

      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea maxLength={280} rows={2} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-input" />
      </div>

      <div>
        <label className="block text-sm mb-1">Visibility</label>
        <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value, discoverable: false })}
                className="w-full px-3 py-2 rounded-md bg-input">
          <option value="PRIVATE">Private — invite-only</option>
          <option value="FRIENDS">Friends — friends can join</option>
          <option value="PUBLIC">Public — anyone can find via link</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={form.visibility !== 'PUBLIC'} checked={form.discoverable}
               onChange={e => setForm({ ...form, discoverable: e.target.checked })} />
        Discoverable on /discover/hives
      </label>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground">← Back</button>
        <button type="submit" disabled={pending}
                className="px-4 py-2 rounded-md bg-brand text-brand-ink font-medium disabled:opacity-50">
          {pending ? 'Creating…' : 'Create hive'}
        </button>
      </div>
    </form>
  )
}
```

Add `useEffect` to the imports.

- [ ] **Step 2: Extend `getUserBooksAction` projection** with `hiveId`

In `lib/actions/book.actions.ts`, find the projection used by `getUserBooksAction` and add a left-join to `hives`:

```ts
// add to the select:
hiveId: hives.id,
// add to the query:
.leftJoin(hives, eq(hives.bookId, books.id))
```

Update the `BookSummary` type to include `hiveId: string | null`.

- [ ] **Step 3: Wizard `?withHive=1` handler**

In `app/[locale]/(app)/studio/new/page.tsx` (or `book-creation-form.tsx` — verify), after a successful book creation when the URL param `withHive=1` is set, instead of redirecting to `/studio/[bookId]`, push the user to `/studio?createHive=<newBookId>`. The studio page reads that query param and auto-opens `CreateHiveModal` with `prelockBookId` set.

```tsx
// In app/[locale]/(app)/studio/page.tsx (server component → wrap in a client opener):
'use client'  // in the wrapper component
const params = useSearchParams()
const prelock = params.get('createHive')
useEffect(() => {
  if (prelock) { /* open modal with prelockBookId = prelock; then router.replace to clear param */ }
}, [prelock])
```

- [ ] **Step 4: tsc + smoke**

`npx tsc --noEmit` clean. Manually open /studio, click + New Hive, walk all 3 paths.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/studio/_components/create-hive-modal.tsx lib/actions/book.actions.ts app/[locale]/(app)/studio/new/ app/[locale]/(app)/studio/page.tsx
git commit -m "feat(studio): CreateHiveModal with 3-path picker + wizard withHive=1 handoff"
```

---

### Task 13: `BinderHiveFooter` reshape

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-hive-footer.tsx` (verify exact path during implementation)
- Modify: `app/[locale]/(app)/studio/[bookId]/page.tsx` (book page server component — pass `hiveId` through provider)

- [ ] **Step 1: Page-level reverse lookup**

In `app/[locale]/(app)/studio/[bookId]/page.tsx`, alongside the existing data loading:

```ts
import { getBookHive } from '@/lib/hive/get-book-hive'

const bookHive = await getBookHive(bookId)  // { hiveId } | null
// pass to provider:
<BookEditorProvider … bookHive={bookHive}>
```

Extend `BookEditorProvider` to expose `bookHive` via context.

- [ ] **Step 2: Footer branches on hive existence**

```tsx
// binder-hive-footer.tsx
'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { CreateHiveModal } from '@/app/[locale]/(app)/studio/_components/create-hive-modal'

export function BinderHiveFooter() {
  const { bookHive, bookId } = useBookEditor()
  const { locale } = useParams<{ locale: string }>()
  const [open, setOpen] = useState(false)

  if (bookHive) {
    return (
      <Link href={`/${locale}/hive/${bookHive.hiveId}`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-input rounded">
        <Users size={14} /> Go to Hive
      </Link>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-input rounded">
        <Plus size={14} /> Create Hive
      </button>
      {open && <CreateHiveModal prelockBookId={bookId} onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 3: tsc + smoke**

`npx tsc --noEmit`. Open a book in the editor: button says "Create Hive". Click → modal opens prelocked. Submit → routes to hive. Reload the book editor → button now says "Go to Hive".

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(app)/studio/[bookId]/
git commit -m "feat(editor): BinderHiveFooter — Create Hive ↔ Go to Hive via getBookHive"
```

---

### Task 14: `/community` page rewrite — hive-activity feed

**Files:**
- Modify: `app/[locale]/(app)/community/page.tsx`
- Create: `app/[locale]/(app)/community/_components/activity-feed.tsx`
- Modify: `app/[locale]/(app)/community/_components/feed-list.tsx` (delete — replaced)

- [ ] **Step 1: New page composition**

```tsx
// app/[locale]/(app)/community/page.tsx
import { getHiveActivityFeedAction } from '@/lib/actions/hive-activity.actions'
import { getSuggestedWritersAction, getMyActiveSparksAction } from '@/lib/actions/community.actions'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { ActivityFeed } from './_components/activity-feed'
import { SuggestedWritersPanel } from './_components/suggested-writers-panel'
import { MyHivesPanel } from './_components/my-hives-panel'
import { ActiveSparksPanel } from './_components/active-sparks-panel'

export default async function CommunityPage() {
  const [feed, writers, sparks, hives] = await Promise.all([
    getHiveActivityFeedAction({ limit: 30 }),
    getSuggestedWritersAction(),
    getMyActiveSparksAction(),
    getUserHivesView(),
  ])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <main>
        <h1 className="text-2xl font-semibold mb-6">Community</h1>
        <ActivityFeed
          initialItems={feed.success ? feed.data.items : []}
          initialCursor={feed.success ? feed.data.nextCursor : null}
        />
      </main>
      <aside className="space-y-4">
        <MyHivesPanel hives={hives.success ? hives.data.slice(0, 5) : []} />
        <SuggestedWritersPanel writers={writers.success ? writers.data : []} />
        <ActiveSparksPanel sparks={sparks.success ? sparks.data : []} />
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: `ActivityFeed` client component**

```tsx
// app/[locale]/(app)/community/_components/activity-feed.tsx
'use client'
import { useState, useTransition } from 'react'
import { getHiveActivityFeedAction, type HiveActivityEvent } from '@/lib/actions/hive-activity.actions'
import { ActivityEventRow } from './activity-event-row'

export function ActivityFeed({
  initialItems, initialCursor,
}: { initialItems: HiveActivityEvent[]; initialCursor: string | null }) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [pending, start] = useTransition()

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>You're not in any hives yet.</p>
        <a href="../studio" className="underline">Go to studio →</a>
      </div>
    )
  }

  const loadMore = () => start(async () => {
    const r = await getHiveActivityFeedAction({ cursor })
    if (r.success) { setItems(s => [...s, ...r.data.items]); setCursor(r.data.nextCursor) }
  })

  return (
    <>
      <div className="space-y-2">
        {items.map(e => <ActivityEventRow key={e.id} event={e} />)}
      </div>
      {cursor && (
        <button onClick={loadMore} disabled={pending}
                className="mt-6 w-full py-2 text-sm text-muted-foreground hover:bg-input rounded">
          {pending ? 'Loading…' : 'Load older'}
        </button>
      )}
    </>
  )
}
```

- [ ] **Step 3: `ActivityEventRow` — copy renderer per type**

```tsx
// app/[locale]/(app)/community/_components/activity-event-row.tsx
'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { HiveActivityEvent } from '@/lib/actions/hive-activity.actions'

const COPY: Record<string, (e: HiveActivityEvent) => React.ReactNode> = {
  member_joined: e => <><b>@{e.actorUsername ?? '—'}</b> joined <b>{e.hiveName}</b></>,
  chapter_submitted: e => <><b>@{e.actorUsername}</b> submitted a chapter to <b>{e.hiveName}</b></>,
  discussion_posted: e => <><b>@{e.actorUsername}</b> posted in <b>{e.hiveName}</b></>,
  annotation_added: e => <><b>@{e.actorUsername}</b> annotated a chapter in <b>{e.hiveName}</b></>,
  suggestion_proposed: e => <><b>@{e.actorUsername}</b> proposed an edit in <b>{e.hiveName}</b></>,
  suggestion_accepted: e => <>An edit was accepted in <b>{e.hiveName}</b></>,
  suggestion_rejected: e => <>An edit was declined in <b>{e.hiveName}</b></>,
  chapter_submitted_approved: e => <>A chapter was approved in <b>{e.hiveName}</b></>,
  chapter_submitted_rejected: e => <>A chapter was rejected in <b>{e.hiveName}</b></>,
  buzz_posted: e => <><b>@{e.actorUsername}</b> shared in <b>{e.hiveName}</b></>,
}

export function ActivityEventRow({ event }: { event: HiveActivityEvent }) {
  const { locale } = useParams<{ locale: string }>()
  const render = COPY[event.type] ?? ((e: HiveActivityEvent) => <>Activity in <b>{e.hiveName}</b></>)
  return (
    <Link href={`/${locale}/hive/${event.hiveId}`}
          className="flex items-center justify-between px-3 py-2 rounded hover:bg-input">
      <span className="text-sm">{render(event)}</span>
      <span className="text-xs text-muted-foreground">
        {formatDistanceToNow(event.createdAt, { addSuffix: true })}
      </span>
    </Link>
  )
}
```

- [ ] **Step 4: Sidebar panel components** (`MyHivesPanel`, `SuggestedWritersPanel`, `ActiveSparksPanel`)

These are straightforward list renders — `MyHivesPanel` just lists hive names + counts with links; `SuggestedWritersPanel` and `ActiveSparksPanel` already exist in some form from Phase 7.5 (look for `suggested-writers-strip.tsx` and similar; refactor into discrete panel components if needed).

- [ ] **Step 5: Delete the doomed `FeedList`** + its imports.

- [ ] **Step 6: tsc + smoke**

`npx tsc --noEmit`. Visit /community: feed shows activity events from your hives; sidebar shows hives/writers/sparks.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/(app)/community/
git commit -m "feat(community): rewrite as hive-activity feed (kills follows-feed from P7.5)"
```

---

### Task 15: `/discover/hives` swap reference (final cleanup from Task 9)

**Files:**
- Modify: whichever page in `app/[locale]/(public)/discover/` or `app/[locale]/(app)/discover/` lists hives (find via `grep -rn getDiscoverableHivesAction\|getPublicHivesAction app/`)

- [ ] **Step 1: Confirm callers updated**

`grep -rn "getPublicHivesAction" app/ lib/` — expect zero matches. If any remain, replace.

- [ ] **Step 2: Manual smoke**

Mark a hive as `visibility=PUBLIC, discoverable=true`. Visit /discover, Hives tab → it appears. Toggle `discoverable=false` via `updateHiveAction` (or directly in DB for the smoke) → it disappears but the hive URL still works for members.

- [ ] **Step 3: No commit if no changes** (Task 9 already covered this).

---

### Task 16: `/hive/[hiveId]` Settings + Members pages + H2–H5 nav stubs

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/settings/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/members/page.tsx`
- Create stubs: `app/[locale]/(app)/hive/[hiveId]/{dashboard,outline,wiki,annotations,discussions,submissions,suggestions,word-goals,buzz}/page.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx` (or equivalent — verify path)

- [ ] **Step 1: Sidebar nav with all sections**

```tsx
// hive-sidebar.tsx
const NAV = [
  { slug: '', label: 'Dashboard' },         // landing = /hive/[hiveId]
  { slug: 'outline', label: 'Outline' },
  { slug: 'wiki', label: 'Wiki' },
  { slug: 'annotations', label: 'Annotations' },
  { slug: 'discussions', label: 'Discussions' },
  { slug: 'submissions', label: 'Submit Chapter' },
  { slug: 'suggestions', label: 'Edit Suggestions' },
  { slug: 'word-goals', label: 'Word Goals' },
  { slug: 'buzz', label: 'Buzz Board' },
  { slug: 'members', label: 'Members' },
  { slug: 'settings', label: 'Settings' },
]
```

- [ ] **Step 2: Stub page template**

```tsx
// e.g. app/[locale]/(app)/hive/[hiveId]/outline/page.tsx
export default function OutlinePage() {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <h2 className="text-lg font-medium mb-2">Outline</h2>
      <p>Coming in H2 (Mirror model).</p>
    </div>
  )
}
```

Repeat for `wiki` (H2), `annotations` / `discussions` / `submissions` / `suggestions` (H3), `word-goals` / `buzz` (H4), `dashboard` is left as the existing landing for now (H5 ships the real dashboard; H1 lands a simple "Welcome to your hive — N members, last active X" landing as the dashboard stub).

- [ ] **Step 3: Settings page**

Settings is in scope for H1. Build a form that lets OWNER edit `name`, `description`, `visibility`, `discoverable` (gated to PUBLIC), and (separately) delete the hive (OWNER only; ConfirmDialog using the shared component from delete-book). All wired to the existing `updateHiveAction` / `deleteHiveAction`.

- [ ] **Step 4: Members page**

Build a list of members showing avatar · username · role (with dropdown for OWNER to change roles via existing `changeHiveMemberRoleAction`) · remove button (OWNER/MOD via `removeHiveMemberAction`). Plus an Invite button that opens an invite-link generator (or invite-by-username UI — match the existing `inviteUserToHiveAction` shape; may already be partially built in the existing /members route).

- [ ] **Step 5: tsc + smoke**

Navigate to /hive/[hiveId]. Sidebar shows all 11 entries; stubs render with "Coming soon" text; Settings + Members + Dashboard stub all work.

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/(app)/hive/[hiveId]/
git commit -m "feat(hive): sidebar nav + Settings + Members + H2–H5 stub pages"
```

---

### Task 17: AGENTS.md update + final ship commit

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add H1 to "What Has Been Built"**

In `AGENTS.md`, add a new entry above the latest one ("Delete Book") following the same format other phase entries use:

```markdown
### Hives Redesign — H1 Foundation ✅ COMPLETE (2026-05-29)

First of 5 sub-projects in the Hives redesign. Lands the relational
foundation, helpers, and primary UI surfaces.

- **Schema** (`scripts/migrate-h1.ts`): `hives.discoverable boolean NOT NULL DEFAULT false`;
  `hives.book_id` FK tightened to ON DELETE CASCADE; partial UNIQUE
  `hives_book_id_unique ON hives(book_id) WHERE book_id IS NOT NULL`;
  `hive_member_role` enum collapsed 5 → 4 (`EDITOR` → `MODERATOR`,
  `PROOFREADER` → `CONTRIBUTOR`); new `hive_activity` table + `hive_activity_type`
  enum (10 values; only `member_joined` wired in H1, H3/H4 wire the rest).
- **Helpers** (`lib/hive/`): `permissions.ts` (8 predicates × 4 roles + 3
  require-helpers), `get-book-hive.ts` (`getBookHive(bookId)` reverse lookup
  with React `cache()` memoization), `record-activity.ts`.
- **Server actions:** `createHiveAction` reshape (3 paths: link book / standalone /
  new+book — wizard ?withHive=1 query bounces back into the modal); `updateHiveAction`
  with discoverable coercion when visibility != PUBLIC; `getUserHivesView`
  composite projection for the /studio Hives section; `getHiveActivityFeedAction`
  member-scoped cursor-paginated feed; rename `getPublicHivesAction` →
  `getDiscoverableHivesAction` (filter on `discoverable=true`). Drops
  `getCommunityFeedAction` (Phase 7.5 follows-feed retires) +
  `getMyHivesAction` (folded into `getUserHivesView`).
- **/studio:** new Hives section below the existing Books grid — search,
  sort (Most active / Recent / A→Z / Member count), filter chips (All/Owned/Member,
  Linked/Standalone), HiveCard with role pill and last-active label, empty state.
- **CreateHiveModal:** two-step modal — 3-radio path picker → name/description/
  visibility/discoverable details form. Wizard handoff via ?withHive=1.
- **Editor binder footer:** `BinderHiveFooter` reads `getBookHive(bookId)` from
  the page server component (threaded via `BookEditorProvider`). Renders
  "Create Hive" (Plus icon) when null, "Go to Hive" (Users icon) when set.
- **/community:** rewritten as the hive-activity feed. `getHiveActivityFeedAction`
  feeds an `ActivityFeed` client component with cursor pagination + per-event-type
  copy renderer. Sidebar keeps Phase 7.5's MyHives / SuggestedWriters / ActiveSparks
  panels.
- **/discover:** Hives tab now filters on `discoverable=true AND visibility='PUBLIC'`.
- **/hive/[hiveId]:** sidebar nav with all 11 entries; Settings + Members + Dashboard
  landing all real; the other 8 entries (Outline / Wiki / Annotations / Discussions /
  Submit Chapter / Edit Suggestions / Word Goals / Buzz Board) render "Coming in
  H{2,3,4}" stubs so the shell is real.

**H1 pattern:** every binder write that involves a hive-shared item type will go
through `requireBinderWritePermission()` once H2 lands; until then, hive-side
writes are read-only because there's no hive UI for binder content yet.

**H2 will tighten** the partial UNIQUE index on `hives.book_id` to a plain UNIQUE
once standalone hives have shadow books — intentionally deferred to H2.

N/N tests, tsc clean.
```

- [ ] **Step 2: Update "Resume Here" block**

Replace `Last updated`, `Current focus`, `Last commit`, `Next concrete step`:

- **Last updated:** 2026-05-29
- **Current focus:** **Hives Redesign — H1 Foundation COMPLETE** (X feature commits). H1 lands the schema, helpers, server actions, and primary UI surfaces — see "What Has Been Built" → Hives Redesign H1 for the breakdown. Awaiting Chris's manual smoke: (1) create a standalone hive from /studio → appears with role=OWNER; (2) create a hive linked to a book → editor binder footer flips Create→Go; (3) try to create a 2nd hive for the same book → toast error; (4) invite a 2nd user → activity event fires + appears in their /community feed; (5) delete the book → hive cascade-deletes; (6) flip a hive to PUBLIC + discoverable → appears on /discover/hives; flip back → disappears but URL still works for members. H2 (mirror model) starts next.
- **Last commit:** `feat(hive): H1 ship — full surface live with stubs for H2–H5`

- [ ] **Step 3: Commit AGENTS.md + create final ship marker**

```bash
git add AGENTS.md
git commit -m "feat(hive): H1 ship — full surface live with stubs for H2–H5

H1 of 5 Hives redesign sub-projects complete. See AGENTS.md
\"What Has Been Built\" → Hives Redesign H1 for the breakdown."
```

---

## Self-Review Checklist

After completing all tasks, run through this once:

- [ ] **Spec coverage:** Every section in `2026-05-29-h1-hive-foundation-design.md` has a corresponding task above (Data Model → T1, Permission helpers → T2, getBookHive → T3, Server Actions → T4–T10, /studio surface → T11–T12, editor button → T13, /community → T14, /discover → T15, /hive routes → T16, AGENTS.md → T17).
- [ ] **Partial UNIQUE not pre-tightened:** the migration uses `WHERE book_id IS NOT NULL` — H2 tightens it. Verified in T1.
- [ ] **Role enum collapse is irreversible** — the swap dance in T1 is the only path; document in AGENTS.md.
- [ ] **`requireBinderWritePermission` is NOT in H1** — that's H2 work (mentioned in T17 AGENTS update but not implemented in any H1 task).
- [ ] **Activity write paths:** H1 only wires `member_joined` (T8). All other event types are placeholders in the enum; H3/H4 wire writers.
- [ ] **All test assertions reference exported helpers correctly** — predicate names in T2 match `lib/hive/permissions.ts` exports.
- [ ] **Existing patterns followed:** `ActionResult<T>`, `requireAuth()`, `assertBookOwner()` style preserved (T5, T6).
- [ ] **No placeholder steps** — every step has either code or an exact command + expected output.

---

## Test Inventory Summary

- T2: 8 predicate tests + 4 require-helpers tests (mocked DB)
- T3: 2 getBookHive tests
- T4: 1 recordHiveActivity insert test
- T5: 4 createHiveSchema coercion tests
- Manual smoke checklist in T17 covers integration paths

**Target after H1 ships:** prior baseline (~175) + ~15 new = ~190/190 passing, tsc clean.
