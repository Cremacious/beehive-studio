# D2b — Discover Hives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the rail-driven Discover Hives surface per the locked spec at [docs/superpowers/specs/2026-06-11-d2b-discover-hives-design.md](../specs/2026-06-11-d2b-discover-hives-design.md): 5 algorithmic Hive rails (Trending now / Recently active / New communities / Looking for collaborators / From writers you follow) on a stacked Hives tab + Featured Hive "Hidden gem" hero + 14 genre hub routes (genre via linked-book join) + search + 5 rail sub-pages + visual chrome inheriting D1 + D2a design system end-to-end.

**Architecture:** Algorithm-first (no curator tooling). Three additive columns on `hives` (`first_publicly_discoverable_at` + `member_count` denorm + `last_activity_at` denorm) + 4 indexes. Nine new server actions in a NEW file `lib/actions/discover-hives.actions.ts` (keeps `hive.actions.ts` from growing). One pure helper module + 4 unit tests. Three new card components + one new rail wrapper. Reuses D2a's now-load-bearing `<DiscoverRailSubPage<TItem>>` generic with `renderCard` slot. Extends D2a's adjustments to `<GenreChipStrip>` / `<GenreFooterGrid>` / `<DiscoverSearchInput>` to support Hives context. Extends existing H1 `recordHiveActivityTx` helper to update `last_activity_at` in the same tx (~3-line change).

**Tech Stack:** Next.js 16 App Router (server components default, client opt-in), React 19, TypeScript, Tailwind v4, shadcn/ui (existing primitives), Drizzle ORM on Neon Postgres, vitest, sonner toasts, lucide icons. All design system tokens already in `app/globals.css`.

**Open-question resolutions from spec §14 (locked here):**
1. **`memberPreviews` window-function projection** → use Drizzle raw SQL with `ROW_NUMBER() OVER (PARTITION BY hive_id ORDER BY joined_at) <= 4` to fetch up to 4 avatar previews per hive in a single bounded query. Drizzle's `sql` template handles this cleanly. Document the query plan check at impl: `EXPLAIN` should show index scan + bounded LIMIT, not seq scan.
2. **Activity median caching at scale** → `unstable_cache` 5-minute revalidate for v1 (matches D1 Best Ongoing median pattern). If platform grows past 10k discoverable hives, bump to 15min revalidate via single constant edit.
3. **Trending sub-page size-chip default** → Any (no default scoping). The chip stays user-overridable. Looking-for-collaborators is the only rail that locks Size = Small.
4. **`last_activity_at` write contention granularity** → set to `now()` per activity event for v1. Acceptable at expected platform scale (~100s of discoverable hives × low event rate). If write contention surfaces in production, gate on `last_activity_at < now() - interval '1 minute'` to debounce.

---

## File structure (new + modified)

**New files:**
- `scripts/migrate-d2b.ts` — idempotent schema runner
- `lib/discover/hive-activity-score.ts` — pure helper module
- `lib/discover/__tests__/hive-activity-score.test.ts` — 4 unit tests
- `lib/actions/discover-hives.actions.ts` — 9 server actions + `HiveCard` type
- `lib/actions/__tests__/discover-hives-actions.test.ts` — surface-shape tests
- `app/[locale]/(public)/discover/_components/rail-hive-card.tsx`
- `app/[locale]/(public)/discover/_components/discover-hive-card.tsx`
- `app/[locale]/(public)/discover/_components/featured-hive-hero.tsx`
- `app/[locale]/(public)/discover/_components/discover-hive-rail.tsx`
- `app/[locale]/(public)/discover/hives/trending/page.tsx`
- `app/[locale]/(public)/discover/hives/recently-active/page.tsx`
- `app/[locale]/(public)/discover/hives/new/page.tsx`
- `app/[locale]/(public)/discover/hives/looking-for-collaborators/page.tsx`
- `app/[locale]/(public)/discover/hives/following/page.tsx`
- `app/[locale]/(public)/discover/hives/genre/[slug]/page.tsx`
- `app/[locale]/(public)/discover/hives/search/page.tsx`
- `app/[locale]/(public)/discover/hives/search/_components/hive-search-filter-rail.tsx`
- `app/[locale]/(public)/discover/hives/search/_components/hive-search-results.tsx`

**Modified files:**
- `db/schema/hive.ts` — add 3 columns + 4 indexes on `hives`
- `lib/hive/record-activity.ts` — extend `recordHiveActivityTx` to UPDATE `last_activity_at` in same tx
- `lib/actions/hive.actions.ts` — wire `firstPubliclyDiscoverableAt` stamp at every (visibility + discoverable) writer; wire `member_count` increment/decrement at every `hive_members` INSERT/DELETE site
- `app/[locale]/(public)/discover/page.tsx` — full rewrite of `HivesTab` server component (Books, Sparks, Lists, Clubs tabs untouched)
- `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx` — extend `tabContext` union with `'hives'` (chip click → `?tab=hives&genre=`)
- `AGENTS.md` — bookkeeping at T10

**Deleted files:** none.

---

## Wave shape (per spec §12)

- **W1** = T1 schema migration — blocks T2.
- **W2** = T2 pure helper + unit tests — blocks T3 (action layer uses scoring helper).
- **W3** = T3 single combined commit for all 9 actions.
- **W4** = T4 + T5 parallel (cards + rail wrapper — separate files, no import dependencies).
- **W5** = T6 alone (Hives home page consumes T3 actions + T4 cards + T5 rail wrapper + adjusted shared D1 components).
- **W6** = T7 + T8 + T9 parallel (3 isolated route scopes).
- **W7** = T10 (smoke + AGENTS.md + ship).

---

## Task 1: Schema migration

**Files:**
- Modify: `db/schema/hive.ts`
- Create: `scripts/migrate-d2b.ts`
- Modify: `lib/hive/record-activity.ts` (extend `recordHiveActivityTx`)
- Modify: `lib/actions/hive.actions.ts` (audit + wire writers)

- [ ] **Step 1: Extend drizzle schema in `db/schema/hive.ts`**

Find the `hives` pgTable. Add three columns + 4 indexes. Mirror D2a's `sparks` shape.

```ts
// Inside the hives columns block, after existing columns:
firstPubliclyDiscoverableAt: timestamp('first_publicly_discoverable_at'),
memberCount: integer('member_count').notNull().default(1),
lastActivityAt: timestamp('last_activity_at'),

// Inside the (t) => [...] indexes block, add:
index('hives_discoverable_visibility_idx').on(t.discoverable, t.visibility),
index('hives_member_count_idx').on(t.memberCount),
index('hives_last_activity_at_idx').on(t.lastActivityAt),
index('hives_first_public_idx').on(t.firstPubliclyDiscoverableAt),
```

If `hives_discoverable_visibility_idx` already exists drop the drizzle line and let the runner CREATE IF NOT EXISTS handle it. Verify with `\d hives` in psql or via the migration's verify step.

- [ ] **Step 2: Write idempotent migration runner `scripts/migrate-d2b.ts`**

Mirror `scripts/migrate-d2a.ts`. Run via `npx dotenv -e .env.local -- tsx scripts/migrate-d2b.ts`.

```ts
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add hives.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 2: add hives.member_count column...')
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 1`
  console.log('  ✓ column added')

  console.log('Step 3: add hives.last_activity_at column...')
  await sql`ALTER TABLE hives ADD COLUMN IF NOT EXISTS last_activity_at timestamp`
  console.log('  ✓ column added')

  console.log('Step 4: backfill first_publicly_discoverable_at for existing PUBLIC+discoverable hives...')
  const fpBackfill = await sql`
    UPDATE hives
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${fpBackfill.length} rows`)

  console.log('Step 5: backfill member_count from hive_members...')
  const mcBackfill = await sql`
    UPDATE hives
    SET member_count = sub.cnt
    FROM (
      SELECT hive_id, COUNT(*) AS cnt
      FROM hive_members
      GROUP BY hive_id
    ) AS sub
    WHERE hives.id = sub.hive_id
      AND hives.member_count <> sub.cnt
    RETURNING hives.id
  `
  console.log(`  ✓ backfilled ${mcBackfill.length} hives with member counts`)

  console.log('Step 6: backfill last_activity_at from hive_activity...')
  const laBackfill = await sql`
    UPDATE hives
    SET last_activity_at = sub.max_at
    FROM (
      SELECT hive_id, MAX(created_at) AS max_at
      FROM hive_activity
      GROUP BY hive_id
    ) AS sub
    WHERE hives.id = sub.hive_id
      AND (hives.last_activity_at IS NULL OR hives.last_activity_at < sub.max_at)
    RETURNING hives.id
  `
  console.log(`  ✓ backfilled ${laBackfill.length} hives with last_activity_at`)

  console.log('Step 7: create indexes...')
  await sql`CREATE INDEX IF NOT EXISTS hives_discoverable_visibility_idx ON hives (discoverable, visibility)`
  await sql`CREATE INDEX IF NOT EXISTS hives_member_count_idx ON hives (member_count)`
  await sql`CREATE INDEX IF NOT EXISTS hives_last_activity_at_idx ON hives (last_activity_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS hives_first_public_idx ON hives (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`
  console.log('  ✓ indexes created (or already present)')

  console.log('Step 8: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS fp_populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable,
      AVG(member_count)::numeric(10,2) AS avg_members,
      COUNT(*) FILTER (WHERE last_activity_at IS NOT NULL) AS with_activity
    FROM hives
  `
  console.log('  fp_populated:', verify[0].fp_populated, '· public_discoverable:', verify[0].public_discoverable, '· avg_members:', verify[0].avg_members, '· with_activity:', verify[0].with_activity)
}

run().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run the migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-d2b.ts`
Expected: 8 ✓ lines.

- [ ] **Step 4: Run it again to prove idempotency**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-d2b.ts`
Expected: same 8 ✓ lines; all 3 backfills return 0 rows on second run.

- [ ] **Step 5: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Extend `recordHiveActivityTx` to update `last_activity_at`**

Open `lib/hive/record-activity.ts`. Find `recordHiveActivityTx(tx, opts)`. Add an UPDATE call to `hives` inside the same tx after the activity row insert:

```ts
// After: await tx.insert(hiveActivity).values({ ... })
// Add:
await tx
  .update(hives)
  .set({ lastActivityAt: new Date() })
  .where(eq(hives.id, opts.hiveId))
```

Verify the existing tx-aware shape preserves transaction semantics. The same UPDATE applies to every consumer of this helper (annotations, suggestions, submissions, discussions, buzz posts, word logs, etc. — all already wired through this helper per H1/H3/H4 narratives).

- [ ] **Step 7: Audit `lib/actions/hive.actions.ts` for `discoverable:` writers**

Grep:
```bash
grep -n "discoverable:" lib/actions/hive.actions.ts
```

For every action that writes both `visibility` AND `discoverable` together, apply the in-tx first-public stamp gate (mirror D1's `updateBookDetailsAction` fix + D2a's `createSparkAction` audit pattern):

```ts
// Before the update, inside the existing tx:
const becomingPublic = nextVisibility === 'PUBLIC' && nextDiscoverable === true
let stampFirstPublic = false
if (becomingPublic) {
  const current = await tx.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { firstPubliclyDiscoverableAt: true },
  })
  if (current && current.firstPubliclyDiscoverableAt == null) stampFirstPublic = true
}

await tx.update(hives).set({
  // ...existing fields,
  ...(stampFirstPublic ? { firstPubliclyDiscoverableAt: new Date() } : {}),
}).where(eq(hives.id, hiveId))
```

Likely sites: `createHiveAction` (stamp immediately if initial state is PUBLIC+discoverable on create), `updateHiveAction` or whatever the metadata-edit action is called. Document every action that got the gate in your commit body.

- [ ] **Step 8: Wire `member_count` increment + decrement at every `hive_members` INSERT/DELETE**

Grep:
```bash
grep -n "hiveMembers" lib/actions/hive.actions.ts
```

For every action that INSERTs into `hive_members` (likely `acceptHiveInviteAction` + `joinHiveByLinkAction`), increment `member_count` in the SAME tx:

```ts
await tx.insert(hiveMembers).values({ ... })
await tx.update(hives)
  .set({ memberCount: sql`${hives.memberCount} + 1` })
  .where(eq(hives.id, hiveId))
```

For every action that DELETEs from `hive_members` (likely `leaveHiveAction` + `removeHiveMemberAction`), decrement with GREATEST guard:

```ts
await tx.delete(hiveMembers).where(...)
await tx.update(hives)
  .set({ memberCount: sql`GREATEST(${hives.memberCount} - 1, 1)` })  // floor at 1 since owner always counted
  .where(eq(hives.id, hiveId))
```

(Floor at 1 because owner is always a member; the row should never drop to 0.)

If you find writers named differently than expected, document in your commit body.

- [ ] **Step 9: Run tests + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Tests should still be at current baseline (659/659) since these are additive schema + write-site changes with no behavior tests modified.

- [ ] **Step 10: Commit**

```bash
git add db/schema/hive.ts scripts/migrate-d2b.ts lib/hive/record-activity.ts lib/actions/hive.actions.ts
git commit -m "$(cat <<'EOF'
feat(d2b/schema): hives first_public + member_count + last_activity_at + 4 indexes.

Adds 3 columns and 4 indexes drizzle-side + idempotent runner (CREATE
COLUMN/INDEX IF NOT EXISTS + 3 backfills). recordHiveActivityTx now
UPDATEs hives.last_activity_at in same tx as activity row insert.
firstPubliclyDiscoverableAt stamp gate wired into every hive writer
that writes (visibility AND discoverable) together — mirrors D1/D2a
load-bearing pattern (grep for discoverable:). member_count increment
+ decrement (GREATEST(N-1, 1) guard) wired at every hive_members
INSERT/DELETE write site.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure helper `computeHiveActivityScore7d`

**Files:**
- Create: `lib/discover/hive-activity-score.ts`
- Create: `lib/discover/__tests__/hive-activity-score.test.ts`

- [ ] **Step 1: Write the helper**

```ts
export type HiveActivityInputs = {
  buzzPosts7d: number
  wordLogs7d: number
  discussions7d: number
  chapterUpdates7d: number
  submissions7d: number
}

export function computeHiveActivityScore7d(i: HiveActivityInputs): number {
  return i.buzzPosts7d + i.wordLogs7d * 0.5 + i.discussions7d * 2 + i.chapterUpdates7d * 3 + i.submissions7d * 4
}
```

- [ ] **Step 2: Write 4 unit tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeHiveActivityScore7d } from '../hive-activity-score'

describe('computeHiveActivityScore7d', () => {
  it('returns 0 for all-zero inputs', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 0, wordLogs7d: 0, discussions7d: 0, chapterUpdates7d: 0, submissions7d: 0
    })).toBe(0)
  })
  it('weights submissions highest (4x)', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 0, wordLogs7d: 0, discussions7d: 0, chapterUpdates7d: 0, submissions7d: 1
    })).toBe(4)
  })
  it('weights chapter updates 3x and discussions 2x', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 0, wordLogs7d: 0, discussions7d: 1, chapterUpdates7d: 1, submissions7d: 0
    })).toBe(5)
  })
  it('weights buzz posts 1x and word logs 0.5x', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 1, wordLogs7d: 2, discussions7d: 0, chapterUpdates7d: 0, submissions7d: 0
    })).toBe(2)
  })
})
```

- [ ] **Step 3: Run tests + tsc**

Run: `npm test -- lib/discover/__tests__/hive-activity-score.test.ts`
Expected: 4 pass.

Run: `npm test && npx tsc --noEmit`
Expected: all green; +4 net tests (target 663 from 659 baseline).

- [ ] **Step 4: Commit**

```bash
git add lib/discover/hive-activity-score.ts lib/discover/__tests__/hive-activity-score.test.ts
git commit -m "$(cat <<'EOF'
feat(d2b/helper): computeHiveActivityScore7d pure helper.

Weighted score: submissions 4x (actual writing throughput), chapter
updates 3x, discussions 2x, buzz posts 1x, word logs 0.5x (noisy).
Used by Trending rail + Featured Hive hero. 4 unit tests cover zero,
each weight in isolation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server-action layer — `lib/actions/discover-hives.actions.ts`

**Files:**
- Create: `lib/actions/discover-hives.actions.ts`
- Create: `lib/actions/__tests__/discover-hives-actions.test.ts`

Single combined commit per D1-T3 / D2a-T2 precedent. All 9 actions live in this one new file.

- [ ] **Step 1: Define types + cursor helpers at top of file**

```ts
'use server'

import { db } from '@/db'
import { hives, hiveMembers } from '@/db/schema/hive'
import { hiveBuzzPosts, hiveWordLogs, hiveDiscussionPosts, hiveSubmissions, hiveActivity } from '@/db/schema/hive'
import { books } from '@/db/schema/books'
import { chapters } from '@/db/schema/books'
import { follows, userProfiles, userBlocks } from '@/db/schema/social'
import { unstable_cache } from 'next/cache'
import { and, eq, ne, desc, asc, sql, inArray, gte, lte, isNotNull, lt, gt, or } from 'drizzle-orm'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { GENRES, type GenreSlug, isValidGenre, normalizeGenre } from '@/lib/discover/genres'
import { applyBackfill } from '@/lib/discover/backfill'
import { computeHiveActivityScore7d } from '@/lib/discover/hive-activity-score'

export type HiveCard = {
  id: string
  name: string
  description: string | null
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  status: 'ACTIVE' | 'COMPLETED'
  ownerUserId: string
  ownerUsername: string | null
  ownerDisplayName: string | null
  ownerAvatarUrl: string | null
  bookId: string
  bookTitle: string
  bookCoverUrl: string | null
  bookGenre: GenreSlug | null
  memberCount: number
  lastActivityAt: Date | null
  activityScore7d: number       // 0 on cheap-path rails
  buzzPosts7d: number           // 0 on cheap-path rails (only Trending + Featured + search-most-active need it)
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>  // up to 4
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
}

export type RailResult<T = HiveCard> = {
  books: T[]                    // field name preserved across D-phase for component reuse
  strictCount: number
  nextCursor: string | null
}

export type SizeBucket = 'any' | 'small' | 'mid' | 'large'

const PAGE_SIZE = 12

type CursorPayload = { sortKey: string | number; id: string } | null
function encodeCursor(p: { sortKey: string | number; id: string }): string {
  return Buffer.from(JSON.stringify(p)).toString('base64url')
}
function decodeCursor(s: string | null | undefined): CursorPayload {
  if (!s) return null
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString())
    if (parsed && typeof parsed.id === 'string' && (typeof parsed.sortKey === 'string' || typeof parsed.sortKey === 'number')) {
      return parsed
    }
    return null
  } catch { return null }
}
```

- [ ] **Step 2: Size bucket helper (inline)**

```ts
function sizeBucketCondition(size: SizeBucket) {
  switch (size) {
    case 'small': return and(gte(hives.memberCount, 2), lte(hives.memberCount, 5))
    case 'mid':   return and(gte(hives.memberCount, 6), lte(hives.memberCount, 15))
    case 'large': return gte(hives.memberCount, 16)
    case 'any':
    default:      return sql`true`
  }
}
```

- [ ] **Step 3: Private helpers below types**

```ts
// Mirrors D1's getBlockedAuthorIdsForViewer + D2a's getBlockedSparkCreatorIdsForViewer.
async function getBlockedHiveOwnerIdsForViewer(viewerId: string): Promise<Set<string>> {
  const rows = await db.select({ blockedId: userBlocks.blockedId, blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, viewerId)))
  const set = new Set<string>()
  for (const r of rows) {
    if (r.blockerId === viewerId) set.add(r.blockedId)
    else set.add(r.blockerId)
  }
  return set
}

function buildPublicHiveFilters(genre: GenreSlug | undefined, size: SizeBucket, blocked: Set<string>) {
  const conds = [
    eq(hives.visibility, 'PUBLIC'),
    eq(hives.discoverable, true),
    eq(hives.status, 'ACTIVE'),
    sizeBucketCondition(size),
  ]
  if (genre) {
    // Note: genre lives on books, not hives. Caller must JOIN books for this condition to apply.
    // Returning the condition here; caller is expected to leftJoin books.
    conds.push(eq(books.genre, genre))
    conds.push(isNotNull(books.genre))
  }
  if (blocked.size > 0) {
    conds.push(sql`${hives.ownerId} NOT IN (${sql.join([...blocked].map((id) => sql`${id}`), sql`, `)})`)
  }
  return conds
}

// Project raw hive rows → HiveCard with all joins + Map-stitch.
type ProjectionOpts = { computeActivityScore: boolean; computeBuzzCount: boolean }
async function projectToHiveCards(rows: Array<{ id: string }>, opts: ProjectionOpts): Promise<HiveCard[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  // Fetch the raw hives columns we need + linked book in one JOIN.
  const fullRows = await db
    .select({
      id: hives.id,
      name: hives.name,
      description: hives.description,
      visibility: hives.visibility,
      status: hives.status,
      ownerId: hives.ownerId,
      bookId: hives.bookId,
      bookTitle: books.title,
      bookCoverUrl: books.coverUrl,
      bookGenre: books.genre,
      memberCount: hives.memberCount,
      lastActivityAt: hives.lastActivityAt,
      createdAt: hives.createdAt,
      firstPubliclyDiscoverableAt: hives.firstPubliclyDiscoverableAt,
    })
    .from(hives)
    .innerJoin(books, eq(books.id, hives.bookId))
    .where(inArray(hives.id, ids))

  const ownerIds = [...new Set(fullRows.map((r) => r.ownerId))]

  // Parallel queries for owner profiles + activity signals (when needed) + member previews.
  const [owners, activityScores, buzzCounts, memberPreviews] = await Promise.all([
    db.select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    }).from(userProfiles).where(inArray(userProfiles.userId, ownerIds)),

    opts.computeActivityScore
      ? loadActivityScoreMap(ids)
      : Promise.resolve(new Map<string, number>()),

    opts.computeBuzzCount
      ? loadBuzzCountMap(ids)
      : Promise.resolve(new Map<string, number>()),

    loadMemberPreviewsMap(ids),  // Always fetch — needed for B card design
  ])

  const ownerMap = new Map(owners.map((o) => [o.userId, o]))
  const idIndex = new Map(rows.map((r, i) => [r.id, i]))

  return fullRows
    .map((r): HiveCard => {
      const o = ownerMap.get(r.ownerId)
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        visibility: r.visibility,
        status: r.status,
        ownerUserId: r.ownerId,
        ownerUsername: o?.username ?? null,
        ownerDisplayName: o?.displayName ?? null,
        ownerAvatarUrl: o?.avatarUrl ?? null,
        bookId: r.bookId,
        bookTitle: r.bookTitle,
        bookCoverUrl: r.bookCoverUrl,
        bookGenre: r.bookGenre && isValidGenre(r.bookGenre) ? r.bookGenre : null,
        memberCount: r.memberCount,
        lastActivityAt: r.lastActivityAt,
        activityScore7d: activityScores.get(r.id) ?? 0,
        buzzPosts7d: buzzCounts.get(r.id) ?? 0,
        memberPreviews: memberPreviews.get(r.id) ?? [],
        createdAt: r.createdAt,
        firstPubliclyDiscoverableAt: r.firstPubliclyDiscoverableAt,
      }
    })
    .sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0))
}

async function loadActivityScoreMap(hiveIds: string[]): Promise<Map<string, number>> {
  // 5 parallel GROUP BY queries against the source tables for the 7-day window, stitched in JS.
  // (Full implementation matches D1's loadTrendingSignals pattern.)
  // ...
}

async function loadBuzzCountMap(hiveIds: string[]): Promise<Map<string, number>> {
  const rows = await db.select({
    hiveId: hiveBuzzPosts.hiveId,
    cnt: sql<number>`COUNT(*)::int`,
  }).from(hiveBuzzPosts)
    .where(and(
      inArray(hiveBuzzPosts.hiveId, hiveIds),
      gte(hiveBuzzPosts.createdAt, sql`now() - interval '7 days'`),
    ))
    .groupBy(hiveBuzzPosts.hiveId)
  return new Map(rows.map((r) => [r.hiveId, r.cnt]))
}

async function loadMemberPreviewsMap(hiveIds: string[]): Promise<Map<string, Array<{ userId: string; avatarUrl: string | null }>>> {
  // Window function: ROW_NUMBER() OVER (PARTITION BY hive_id ORDER BY joined_at) <= 4
  // Joins userProfiles for the avatarUrl. Single bounded query.
  const rows = await db.execute<{ hive_id: string; user_id: string; avatar_url: string | null }>(sql`
    SELECT hive_id, user_id, avatar_url FROM (
      SELECT
        hm.hive_id,
        hm.user_id,
        up.avatar_url,
        ROW_NUMBER() OVER (PARTITION BY hm.hive_id ORDER BY hm.joined_at) AS rn
      FROM hive_members hm
      LEFT JOIN user_profiles up ON up.user_id = hm.user_id
      WHERE hm.hive_id = ANY(ARRAY[${sql.join(hiveIds.map((id) => sql`${id}`), sql`, `)}]::text[])
    ) sub WHERE rn <= 4
  `)
  const map = new Map<string, Array<{ userId: string; avatarUrl: string | null }>>()
  for (const r of rows.rows ?? rows) {
    const list = map.get(r.hive_id) ?? []
    list.push({ userId: r.user_id, avatarUrl: r.avatar_url })
    map.set(r.hive_id, list)
  }
  return map
}
```

- [ ] **Step 4: Add the 9 server actions**

Each rail action follows D1/D2a's shape exactly:
1. `const viewerId = await getOptionalUserId()` (or `requireAuth()` for Following)
2. `const blocked = viewerId ? await getBlockedHiveOwnerIdsForViewer(viewerId) : new Set<string>()`
3. Build WHERE conditions with `buildPublicHiveFilters(genre, size, blocked)` (JOIN `books` for genre filter)
4. Apply rail-specific WHERE additions (status / score / first_public / member_count / last_activity)
5. Apply cursor clause
6. Run strict query with `PAGE_SIZE + 1` overscan via tuple cursor
7. Slice to PAGE_SIZE
8. If `<4 && !cursor` → fetch backfill via `getHiveBackfillAction`
9. `applyBackfill` stitch
10. Project with appropriate cheap-path flags
11. Compute `nextCursor` from last strict row
12. Return `{ books, strictCount, nextCursor }`

Per-action details:

```ts
type RailArgs = { genre?: GenreSlug; size?: SizeBucket; cursor?: string; limit?: number }

export async function getFeaturedHiveAction({ genre }: { genre?: GenreSlug }) {
  // Filter: PUBLIC + discoverable + ACTIVE + member_count <= 10 + activity_score_7d > 0
  // Threshold: activityScore7d > cached platform median (unstable_cache 5min)
  // Sort: activityScore DESC, lastActivityAt DESC, id DESC. LIMIT 1.
  // Returns { success: true, data: HiveCard | null }.
  // ... full implementation
}

export async function getTrendingHivesAction({ genre, size = 'any', cursor }: RailArgs) {
  // Cheap-path: computeActivityScore=true (needed for sort)
  // Filter: PUBLIC + discoverable + ACTIVE + size + activity_score_7d > 0
  // Sort: activityScore DESC, lastActivityAt DESC, id DESC
  // ... full implementation
}

export async function getRecentlyActiveHivesAction({ genre, size = 'any', cursor }: RailArgs) {
  // Cheap-path: computeActivityScore=false (uses last_activity_at sort)
  // Filter: PUBLIC + discoverable + ACTIVE + size + last_activity_at >= now() - 7d
  // Sort: lastActivityAt DESC, id DESC
}

export async function getNewHivesAction({ genre, size = 'any', cursor }: RailArgs) {
  // Cheap-path: computeActivityScore=false
  // Filter: PUBLIC + discoverable + ACTIVE + size + first_publicly_discoverable_at >= now() - 30d
  // Sort: firstPubliclyDiscoverableAt DESC, id DESC
}

export async function getLookingForCollaboratorsHivesAction({ genre, cursor }: Omit<RailArgs, 'size'>) {
  // Locks size = 'small' (member_count 2-5)
  // Cheap-path: computeActivityScore=false
  // Filter: PUBLIC + discoverable + ACTIVE + memberCount 2-5 + last_activity_at >= now() - 30d
  // Sort: lastActivityAt DESC, id DESC
}

export async function getFollowingHivesAction({ genre, size = 'any', cursor }: RailArgs) {
  const viewerId = await requireAuth()  // throws AuthError on guest
  const followeeIds = await db.select({ id: follows.followeeId })
    .from(follows).where(eq(follows.followerId, viewerId))
  if (followeeIds.length === 0) {
    return { success: true as const, data: { books: [], strictCount: 0, nextCursor: null } }
  }
  // Cheap-path: computeActivityScore=false
  // Filter: PUBLIC + discoverable + ACTIVE + owner IN followeeIds + size
  // Sort: lastActivityAt DESC, id DESC
  // No backfill (Following hides cleanly when empty per spec §6.5)
}

export async function getHiveBackfillAction({ excludeIds, genre, size = 'any', limit = 4 }: {
  excludeIds: string[]
  genre?: GenreSlug
  size?: SizeBucket
  limit?: number
}) {
  // Source: any PUBLIC + discoverable + ACTIVE + size + last_activity_at >= now() - 30d
  // Sort: lastActivityAt DESC, id DESC. LIMIT.
  // Cheap-path: computeActivityScore=false
  // Returns { success: true, data: HiveCard[] }
}

export async function searchHivesDiscoverAction({ q, genre, size = 'any', sort = 'recent', cursor }: {
  q: string
  genre?: GenreSlug
  size?: SizeBucket
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
  cursor?: string
}) {
  const trimmed = q.trim()
  if (trimmed.length === 0) {
    return { success: true as const, data: { books: [] as HiveCard[], nextCursor: null } }
  }
  // ILIKE on hives.name (primary), hives.description (secondary), and joined userProfiles.username/displayName
  // Filter: PUBLIC + discoverable + ACTIVE + size + genre + blocked
  // Sort:
  //   'recent' → createdAt DESC
  //   'most-active' → activityScore DESC (needs computeActivityScore=true)
  //   'most-members' → memberCount DESC
  //   'relevance' → collapses to 'most-active' for v1 with `// TODO: real relevance`
  // For v1 ship without cursor pagination (search nextCursor always null — matches D2a precedent)
}

export const getHiveGenreCountsAction = unstable_cache(
  async () => {
    // SELECT books.genre, count(*) FROM hives
    // INNER JOIN books ON books.id = hives.book_id
    // WHERE hives.visibility = 'PUBLIC' AND hives.discoverable AND hives.status = 'ACTIVE'
    //   AND books.genre IS NOT NULL
    // GROUP BY books.genre
    const rows = await db.select({
      genre: books.genre,
      cnt: sql<number>`COUNT(*)::int`,
    })
      .from(hives)
      .innerJoin(books, eq(books.id, hives.bookId))
      .where(and(
        eq(hives.visibility, 'PUBLIC'),
        eq(hives.discoverable, true),
        eq(hives.status, 'ACTIVE'),
        isNotNull(books.genre),
      ))
      .groupBy(books.genre)

    const counts: Record<GenreSlug, number> = Object.fromEntries(GENRES.map((g) => [g, 0])) as Record<GenreSlug, number>
    for (const r of rows) {
      const slug = normalizeGenre(r.genre)
      counts[slug] = (counts[slug] ?? 0) + r.cnt
    }
    return { success: true as const, data: counts }
  },
  ['discover-hives-genre-counts'],
  { revalidate: 300, tags: ['discover-hives-genre-counts'] }
)
```

Implementer fills in remaining boilerplate following D1's `discover.actions.ts` + D2a's `discover-sparks.actions.ts` patterns. The query shapes are well-established.

- [ ] **Step 5: Write surface-shape tests at `lib/actions/__tests__/discover-hives-actions.test.ts`**

Mirror D2a's `discover-sparks-actions.test.ts` shape:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
}))
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => [], orderBy: () => ({ limit: () => [] }), innerJoin: () => ({ where: () => [] }), leftJoin: () => ({ where: () => [] }), groupBy: () => [] }), groupBy: () => [] }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    execute: async () => ({ rows: [] }),
  },
}))

import * as discoverHivesActions from '@/lib/actions/discover-hives.actions'

describe('discover-hives actions surface', () => {
  it('exports all 9 actions', () => {
    expect(typeof discoverHivesActions.getFeaturedHiveAction).toBe('function')
    expect(typeof discoverHivesActions.getTrendingHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getRecentlyActiveHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getNewHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getLookingForCollaboratorsHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getFollowingHivesAction).toBe('function')
    expect(typeof discoverHivesActions.getHiveBackfillAction).toBe('function')
    expect(typeof discoverHivesActions.searchHivesDiscoverAction).toBe('function')
    expect(typeof discoverHivesActions.getHiveGenreCountsAction).toBe('function')
  })
})
```

Run: `npm test && npx tsc --noEmit`
Expected: all green; +1 net new test from T3 (+5 cumulative from baseline).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/discover-hives.actions.ts lib/actions/__tests__/discover-hives-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(d2b/actions): discover-hives.actions.ts — 9 rail actions.

Single combined commit (mirrors D1 W3 / D2a W2 precedents — all 9
actions share the same file). Reuses D1's applyBackfill + GENRES +
helpers; mirrors D2a's cheap-path optimization (skip activity score
JOIN on rails that don't sort/filter by it). HiveCard projection JOINs
books for genre + cover + title. memberPreviews via window function
(ROW_NUMBER OVER PARTITION) — bounded query cost per page.
unstable_cache 5min on platform activity median (Featured Hive
threshold) and genre counts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Card components

**Files:**
- Create: `app/[locale]/(public)/discover/_components/rail-hive-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/discover-hive-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/featured-hive-hero.tsx`

All three client components. Style from locked spec §9 + visual mockup B (community-forward).

- [ ] **Step 1: Write `<RailHiveCard>` (locked B design)**

Props:
```ts
type Props = {
  hive: HiveCard
  locale: string
}
```

- ~280px wide, 18px padding.
- Outer `<Link>` to `/${locale}/hive/${hive.id}`.
- Chrome: tile gradient + `--sh-tile` + `--r-card`. Hover via inline-style mutation (translateY(-1px) + deeper shadow).
- Header `grid-template-columns: [48px 1fr]`: 48px portrait book thumb (paper-warm gradient fallback when `bookCoverUrl` null) + meta cluster (Comfortaa hive name 16px truncate, mono uppercase `around {bookTitle}` eyebrow, mono `led by @owner` row with 14px owner avatar).
- Members section (recessed pill bar): `bg: rgba(255,255,255,0.04)`, `border-radius: 8px`, contains overlapping avatar stack (first 4 from `memberPreviews`, -6px margin overlap, 22px circles with brand gradient fallback for null avatars) + `{N} members` count.
- Hairline divider.
- Activity row: green dot + "Active Xh ago" (use existing `relTime` helper or write inline) + right-aligned genre pill (mono uppercase from `bookGenre`).

- [ ] **Step 2: Write `<DiscoverHiveCard>` for sub-pages + search + grids**

Wider variant. Default `variant: 'rail' | 'grid' | 'row'`.
- Adds line-clamp-2 description below header.
- Stat row adds `{buzzPosts7d} buzz this week` (only when `buzzPosts7d > 0` — gated so cheap-path rails don't show "0").
- Visibility pill in addition to genre.
- Optional brand-pill `Visit →` CTA on the right for `grid` variant.

- [ ] **Step 3: Write `<FeaturedHiveHero>` for the home hero slot**

Full-width panel card. 3-column layout `[160px_1fr_auto]`.
- Left: 160px portrait book cover (paper-warm fallback) with thin brand-yellow status strip across top.
- Center: "HIDDEN GEM" mono badge (brand-yellow bg, brand-ink text) + Comfortaa brand-yellow hive name 28px + mono uppercase `around {bookTitle}` eyebrow + line-clamp-3 description + owner byline.
- Right vertical stack: member count number large + green activity pulse + `{activityScore7d.toFixed(0)} actions this week` mono stat + brand-pill `Visit the Hive →` CTA.
- Panel chrome outer with brand-soft radial accent top-right.

- [ ] **Step 4: Verify tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean; tests stay at current baseline.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/_components/{rail-hive-card,discover-hive-card,featured-hive-hero}.tsx
git commit -m "$(cat <<'EOF'
feat(d2b/cards): RailHiveCard + DiscoverHiveCard + FeaturedHiveHero.

Locked B community-forward design — 48px linked-book thumb left,
hive name + owner + "around {Book Title}" eyebrow + member avatar
stack (overlapping first 4 from memberPreviews) + activity-pulse +
genre pill. Featured hero with HIDDEN GEM mono badge + activity stat
+ brand-pill CTA. Hidden cleanly when no qualifier.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Hive rail wrapper `<DiscoverHiveRail>`

**Files:**
- Create: `app/[locale]/(public)/discover/_components/discover-hive-rail.tsx`

Sibling of D1's `<DiscoverRail>` + D2a's `<DiscoverSparkRail>` typed for `RailResult<HiveCard>`. Server component.

- [ ] **Step 1: Write the component**

Mirror D2a's `<DiscoverSparkRail>` structure exactly but render `<RailHiveCard>` instead of `<RailSparkCard>`. Same panel chrome, backfill caption rendering when `result.strictCount < 4 && result.books.length > 0`, `hideWhenEmpty` for Following.

```ts
type Props = {
  title: string
  subPageHref: string
  result: RailResult<HiveCard>
  locale: string
  hideWhenEmpty?: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(public)/discover/_components/discover-hive-rail.tsx
git commit -m "feat(d2b/rail): DiscoverHiveRail wrapper.

Sibling of DiscoverRail (D1) + DiscoverSparkRail (D2a) typed for
RailResult<HiveCard>. Same shape: panel chrome + header + backfill
caption + hideWhenEmpty.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 6: Hives tab home page rewrite

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`
- Modify: `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx` (extend `tabContext` union)

- [ ] **Step 1: Extend `<GenreChipStrip>` `tabContext` union**

D2a added `'sparks'`. Add `'hives'`. When `tabContext='hives'`, chip click pushes `?tab=hives&genre=`.

- [ ] **Step 2: Rewrite `HivesTab` server component**

Replace existing `HivesTab` with rail-stacked layout. Mirror D2a's `SparksTab` pattern.

```tsx
async function HivesTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  const [hero, trending, recentlyActive, newHives, lookingForCollab, following, genreCounts] = await Promise.all([
    getFeaturedHiveAction({ genre: safeGenre }),
    getTrendingHivesAction({ genre: safeGenre }),
    getRecentlyActiveHivesAction({ genre: safeGenre }),
    getNewHivesAction({ genre: safeGenre }),
    getLookingForCollaboratorsHivesAction({ genre: safeGenre }),
    getFollowingHivesAction({ genre: safeGenre }).catch(() => ({ success: false as const, error: 'GUEST' })),
    getHiveGenreCountsAction(),
  ])

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && <FeaturedHiveHero hive={hero.data} locale={locale} />}

      <div className="flex items-center gap-3 sticky top-0 z-10 py-3" style={{ background: 'rgba(38,39,40,0.95)', backdropFilter: 'blur(8px)' }}>
        <GenreChipStrip activeGenre={safeGenre} locale={locale} tabContext="hives" />
        <div className="ml-auto">
          <DiscoverSearchInput locale={locale} searchHref={`/${locale}/discover/hives/search`} />
        </div>
      </div>

      {trending.success && <DiscoverHiveRail title="Trending now" subPageHref={`/${locale}/discover/hives/trending${qs(safeGenre)}`} result={trending.data} locale={locale} />}
      {recentlyActive.success && <DiscoverHiveRail title="Recently active" subPageHref={`/${locale}/discover/hives/recently-active${qs(safeGenre)}`} result={recentlyActive.data} locale={locale} />}
      {newHives.success && <DiscoverHiveRail title="New communities" subPageHref={`/${locale}/discover/hives/new${qs(safeGenre)}`} result={newHives.data} locale={locale} />}
      {lookingForCollab.success && <DiscoverHiveRail title="Looking for collaborators" subPageHref={`/${locale}/discover/hives/looking-for-collaborators${qs(safeGenre)}`} result={lookingForCollab.data} locale={locale} />}
      {following.success && <DiscoverHiveRail title="From writers you follow" subPageHref={`/${locale}/discover/hives/following${qs(safeGenre)}`} result={following.data} locale={locale} hideWhenEmpty />}

      {genreCounts.success && <GenreFooterGrid counts={genreCounts.data} locale={locale} linkBase={`/${locale}/discover/hives/genre/`} title="Browse Hives by genre" />}
    </div>
  )
}
```

- [ ] **Step 3: Verify tsc + tests + dev render**

Run: `npx tsc --noEmit && npm test`
Run: `npm run dev`, visit `/en/discover?tab=hives`, confirm rails render.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/discover/page.tsx app/[locale]/(public)/discover/_components/genre-chip-strip.tsx
git commit -m "$(cat <<'EOF'
feat(d2b/home): Hives tab rewrite — rail-stacked + Featured Hive hero.

Parallel-fetches 7 actions (Featured Hive + 5 rails + genre counts).
Sticky chip+search row with tabContext='hives' so chip click stays
on Hives tab. Following rail uses .catch() + hideWhenEmpty for guest
AuthError. Footer grid points at /discover/hives/genre/ slugs with
"Browse Hives by genre" title.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Five rail sub-routes (single combined commit)

**Files (all create):**
- `app/[locale]/(public)/discover/hives/trending/page.tsx`
- `app/[locale]/(public)/discover/hives/recently-active/page.tsx`
- `app/[locale]/(public)/discover/hives/new/page.tsx`
- `app/[locale]/(public)/discover/hives/looking-for-collaborators/page.tsx`
- `app/[locale]/(public)/discover/hives/following/page.tsx`

Each is ~30 LOC. Each consumes `<DiscoverRailSubPage<HiveCard>>` with a `renderCard` slot for `<DiscoverHiveCard variant="grid">` + `loadMoreHrefBase` + per-rail `emptyMessage`. Single combined commit per D1 T10 / D2a T7 precedent.

- [ ] **Step 1: Template for `trending/page.tsx`**

```tsx
import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import { getTrendingHivesAction, type HiveCard, type SizeBucket } from '@/lib/actions/discover-hives.actions'
import { DiscoverHiveCard } from '../../_components/discover-hive-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; size?: string; cursor?: string }>
}

const ALLOWED_SIZES: SizeBucket[] = ['any', 'small', 'mid', 'large']

export default async function TrendingHivesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = (ALLOWED_SIZES.includes(sp.size as SizeBucket) ? sp.size : 'any') as SizeBucket
  const result = await getTrendingHivesAction({ genre, size, cursor: sp.cursor })
  if (!result.success) {
    return <main className="max-w-5xl mx-auto px-4 py-6"><p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">Failed to load Trending. Try again later.</p></main>
  }
  return (
    <DiscoverRailSubPage<HiveCard>
      title="Trending now"
      description="Active Hives in the last 7 days, weighted by buzz posts, discussions, chapter updates, and submissions."
      result={result.data}
      locale={locale}
      loadMoreAction="trending"
      loadMoreHrefBase={`/${locale}/discover/hives/`}
      emptyMessage="No active Hives match this filter yet. Try a different size or genre."
      renderCard={(item, loc) => <DiscoverHiveCard hive={item} locale={loc} variant="grid" />}
      // filterRail: future — wire in T7 polish if member-count chip strip ships in v1
    />
  )
}
```

- [ ] **Step 2: Replicate for recently-active, new, looking-for-collaborators**

Same template, swap title + description + action + slug. Descriptions per spec §6:
- **Recently active**: "Hives with any activity in the last 7 days, most-recent first."
- **New communities**: "Hives that became discoverable in the last 30 days."
- **Looking for collaborators**: "Small Hives (2–5 members) with recent activity. Room to grow."

Looking-for-collaborators ignores `?size=` param (rail locks size to Small internally per spec §6.4).

- [ ] **Step 3: `following/page.tsx` — gated on auth**

Mirror D1's pattern:

```ts
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
// ...
const session = await auth.api.getSession({ headers: await headers() })
if (!session?.user) {
  redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/hives/following`)}`)
}
const result = await getFollowingHivesAction({ genre, size, cursor: sp.cursor })
// ... render same shell
```

Description: "Active Hives owned by writers you follow."

- [ ] **Step 4: Verify all routes render**

Run: `npx tsc --noEmit`
Run: `npm run dev` and visit each sub-route.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/hives/{trending,recently-active,new,looking-for-collaborators,following}/page.tsx
git commit -m "$(cat <<'EOF'
feat(d2b/sub-routes): 5 Hive rail sub-pages.

Each is a thin server component wrapping DiscoverRailSubPage<HiveCard>
with renderCard slot for DiscoverHiveCard. Following gates on session
and redirects guests to /sign-in?next=... per D1/D2a precedent.
Looking-for-collaborators locks size to Small internally.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Genre hub route

**Files:**
- Create: `app/[locale]/(public)/discover/hives/genre/[slug]/page.tsx`

- [ ] **Step 1: Write the page**

Mirror D2a's genre hub. `notFound()` if `!isValidGenre(slug)`. `Promise.all` 6 actions (Featured Hive + 5 rails — NO Following on genre hub since it's about author follow not genre). Render: back link → header (eyebrow + Comfortaa label) → optional hero → 5 `<DiscoverHiveRail>` mounts. `max-w-7xl`.

```tsx
import { notFound } from 'next/navigation'
import {
  getFeaturedHiveAction, getTrendingHivesAction, getRecentlyActiveHivesAction,
  getNewHivesAction, getLookingForCollaboratorsHivesAction,
} from '@/lib/actions/discover-hives.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverHiveRail } from '../../../_components/discover-hive-rail'
import { FeaturedHiveHero } from '../../../_components/featured-hive-hero'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = { params: Promise<{ locale: string; slug: string }> }

export default async function HiveGenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, trending, recentlyActive, newHives, lookingForCollab] = await Promise.all([
    getFeaturedHiveAction({ genre: slug }),
    getTrendingHivesAction({ genre: slug }),
    getRecentlyActiveHivesAction({ genre: slug }),
    getNewHivesAction({ genre: slug }),
    getLookingForCollaboratorsHivesAction({ genre: slug }),
  ])

  const label = GENRE_LABEL[slug]
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover?tab=hives`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Hives
      </Link>
      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">Hives genre hub</p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">{label}</h1>
      </header>
      {hero.success && hero.data && <FeaturedHiveHero hive={hero.data} locale={locale} />}
      {trending.success && <DiscoverHiveRail title={`Trending ${label} Hives`} subPageHref={`/${locale}/discover/hives/trending?genre=${slug}`} result={trending.data} locale={locale} />}
      {recentlyActive.success && <DiscoverHiveRail title={`Recently active in ${label}`} subPageHref={`/${locale}/discover/hives/recently-active?genre=${slug}`} result={recentlyActive.data} locale={locale} />}
      {newHives.success && <DiscoverHiveRail title={`New ${label} communities`} subPageHref={`/${locale}/discover/hives/new?genre=${slug}`} result={newHives.data} locale={locale} />}
      {lookingForCollab.success && <DiscoverHiveRail title={`Looking for collaborators (${label})`} subPageHref={`/${locale}/discover/hives/looking-for-collaborators?genre=${slug}`} result={lookingForCollab.data} locale={locale} />}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(public)/discover/hives/genre
git commit -m "feat(d2b/genre-hub): /discover/hives/genre/[slug] route.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 9: Search route

**Files:**
- Create: `app/[locale]/(public)/discover/hives/search/page.tsx`
- Create: `app/[locale]/(public)/discover/hives/search/_components/hive-search-filter-rail.tsx`
- Create: `app/[locale]/(public)/discover/hives/search/_components/hive-search-results.tsx`

- [ ] **Step 1: Write `search/page.tsx`**

Mirror D2a's search page. Parse `q` / `genre` / `size` / `sort`. Call `searchHivesDiscoverAction`. Render back link + header + two-col (filter rail + results).

```tsx
import { searchHivesDiscoverAction, type HiveCard, type SizeBucket } from '@/lib/actions/discover-hives.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { HiveSearchFilterRail } from './_components/hive-search-filter-rail'
import { HiveSearchResults } from './_components/hive-search-results'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; genre?: string; size?: string; sort?: string; cursor?: string }>
}

const ALLOWED_SIZES: SizeBucket[] = ['any', 'small', 'mid', 'large']
const ALLOWED_SORTS = ['relevance', 'recent', 'most-active', 'most-members'] as const
type Sort = (typeof ALLOWED_SORTS)[number]

export default async function HiveSearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = (ALLOWED_SIZES.includes(sp.size as SizeBucket) ? sp.size : 'any') as SizeBucket
  const sort: Sort = ALLOWED_SORTS.includes(sp.sort as Sort) ? sp.sort as Sort : 'recent'

  const result = q
    ? await searchHivesDiscoverAction({ q, genre, size, sort, cursor: sp.cursor })
    : { success: true as const, data: { books: [] as HiveCard[], nextCursor: null } }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover?tab=hives`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Hives
      </Link>
      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Hives for "${q}"` : 'Search Hives'}
        </h1>
        {q && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">{result.data.books.length} result{result.data.books.length === 1 ? '' : 's'}</p>
        )}
      </header>
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <HiveSearchFilterRail activeGenre={genre} activeSize={size} activeSort={sort} q={q} locale={locale} />
        <HiveSearchResults result={result.success ? result.data : { books: [], nextCursor: null }} locale={locale} hasQuery={!!q} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Write `<HiveSearchFilterRail>` (client)**

Refinement controls in `<aside>`:
- Genre dropdown (All + 14 from GENRES + GENRE_LABEL)
- Size segmented control (Any / Small / Mid / Large) — 4 buttons styled as segmented radiogroup
- Sort segmented control (Recent / Most active / Most members / Relevance) — 4 buttons, may wrap grid-cols-2 to fit 240px aside
- Updates URL params via `router.push` with `useTransition`. Preserves `q`.

- [ ] **Step 3: Write `<HiveSearchResults>` (server)**

Empty states: `!hasQuery` → "Type something to search Hives."; `hasQuery && books.length === 0` → "No Hives match that search. Try fewer filters." Else: 2-col grid of `<DiscoverHiveCard variant="grid">`. No Load more in v1 (search cursor deferred per spec).

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/discover/hives/search
git commit -m "feat(d2b/search): /discover/hives/search route + filter rail (genre + size + sort) + results.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 10: Manual smoke + AGENTS.md + ship

- [ ] **Step 1: Run full smoke per spec §13**

Walk every item in the 19-item checklist. For each failure, file a separate `fix(d2b): ...` commit before declaring the epic complete.

- [ ] **Step 2: Update AGENTS.md**

Bump "Last updated" + "Last commit". Move D2b from "Current focus" to "What Has Been Built". Write the ship summary mirroring D2a's level of detail: wave SHA map + locked patterns + deferred follow-ups. Refresh "Next concrete step" — likely D3 Lists+Clubs brainstorm dispatch.

- [ ] **Step 3: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs(agents): ship D2b Discover Hives.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

- [ ] **Step 4: Final tsc + tests**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

---

## Self-review

**Spec coverage:**
- §2 Goals 1-7 → all covered (T6 IA, T3 algorithm, T4-T5 cards/rails, T8 genre hubs, T9 search, T1 schema/denorm).
- §4 Locked decisions Q1-Q5 → carried through (discovery-only T1-T10; algorithm-first T3; 5 rails T3/T5/T7; hybrid IA + Featured Hive hero T6; 3-part schema T1; community-forward card B T4).
- §5 IA → T6 (home), T7 (sub-routes), T8 (genre hub), T9 (search).
- §6 Rails → every signal formula has a matching action in T3 with explicit query notes.
- §7 Schema → T1 (with full migration runner).
- §8 Server actions → all 9 in T3.
- §9 UI components → T4 (cards) + T5 (rail wrapper) + T6 (home).
- §10 Visual chrome → inherited from D1/D2a.
- §11 Test posture → unit tests in T2; surface-shape tests in T3; manual smoke in T10.
- §12 Phasing → wave shape at top.
- §13 Smoke checklist → referenced by T10.
- §14 Open questions → resolved at top.

**Placeholder scan:** T3 sketches a couple of internal helper functions (`loadActivityScoreMap`) with `// ...` continuation comments rather than fully spelled out. Implementer fills in following D1's `loadTrendingSignals` precedent. **No TBDs/TODOs/"implement later" markers exist in user-facing requirements.**

**Type consistency:** `HiveCard` defined at top of T3 with all 18 fields; referenced by T4 card components, T5 rail wrapper, T6 home page, T7 sub-routes, T8 genre hub, T9 search results. `RailResult<T>` generic from D1 reused with `HiveCard` substitution. `SizeBucket` literal union defined in T3, used in T7 sub-routes + T9 search filter rail. `GenreSlug` from `lib/discover/genres.ts` reused.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-11-d2b-discover-hives.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
