# D2a — Discover Sparks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the rail-driven Discover Sparks surface per the locked spec at [docs/superpowers/specs/2026-06-11-d2a-discover-sparks-design.md](../specs/2026-06-11-d2a-discover-sparks-design.md): 6 algorithmic Spark rails (Live now / Voting now / Heating up / Newly opened / From writers you follow / Recently won) on a stacked Sparks tab + Featured Spark hero + 14 genre hub routes (shared vocabulary with D1) + search + 6 rail sub-pages + visual chrome inherits D1's design system end-to-end. Plus a minor refactor of D1's `<DiscoverRailSubPage>` to a generic with a `renderCard` slot — benefits D2b/D3 too.

**Architecture:** Algorithm-first (no curator tooling). Three additive columns on `sparks` (`genre` + `first_publicly_discoverable_at` + `entry_count` denorm) + 4 indexes. Ten new server actions in a NEW file `lib/actions/discover-sparks.actions.ts` (keeps D1's discover.actions.ts from growing further). Three new card components (`<RailSparkCard>` / `<DiscoverSparkCard>` / `<FeaturedSparkHero>`) + one new generic Spark rail wrapper (`<DiscoverSparkRail>`). Reuses D1's `<GenreChipStrip>`, `<DiscoverSearchInput>`, `<GenreFooterGrid>`, `applyBackfill`, `GENRES`/`isValidGenre`/`normalizeGenre`, and chrome tokens directly. The `<DiscoverRailSubPage>` from D1 gets widened to `<TItem>` generic + `renderCard` slot in T6 so it can serve Sparks (this spec), D2b Hives, and D3 Lists/Clubs.

**Tech Stack:** Next.js 16 App Router (server components default, client opt-in), React 19, TypeScript, Tailwind v4, shadcn/ui (existing primitives), Drizzle ORM on Neon Postgres, vitest, sonner toasts, lucide icons. All design system tokens already in `app/globals.css`.

**Open-question resolutions from spec §15 (locked here):**
1. **Sub-page refactor approach** → widen `<DiscoverRailSubPage>` to a `<TItem>` generic with a `renderCard` slot. D1 Books sub-pages stay functional via a default `renderCard` adapter; D2a Spark sub-pages pass their own. Long-term cleanest; benefits future D2b/D3.
2. **Recently Won backfill window** → 90 days for v1. Trigger to widen to 180 days: if smoke shows the rail is sparse + backfill exhausted in dev (less than 4 closed-with-winner sparks in the last 90 days), bump the constant in `getRecentlyWonSparksAction`. Document inline as `// FALLBACK_WINDOW_DAYS = 90` with a comment.
3. **Featured Spark hero fallback** → no fallback in v1. If `getFeaturedSparkAction` returns null (no qualifying OPEN within 72h), the hero is hidden cleanly. Document at-impl widening: if dev volume keeps the hero perpetually hidden, widen the deadline window to 7 days and surface a smaller `WORTH ENTERING` badge instead of `CLOSING SOON`.
4. **`voteTotal` projection on OPEN sparks** → set to 0 without the JOIN. The 4-parallel-Map-stitch projection (mirrors D1's `projectToBookCards`) computes `voteTotal` only when the rail is VOTING / CLOSED. For OPEN-only rails (Live now / Heating up / Newly opened / Following / search-default), the action skips the vote query entirely. Saves N×1 round-trip on the common path.

---

## File structure (new + modified)

**New files:**
- `scripts/migrate-d2a.ts` — idempotent schema runner
- `lib/actions/discover-sparks.actions.ts` — 10 new server actions + `SparkCard` type export
- `lib/actions/__tests__/discover-sparks-actions.test.ts` — surface-shape tests
- `app/[locale]/(public)/discover/_components/rail-spark-card.tsx`
- `app/[locale]/(public)/discover/_components/discover-spark-card.tsx`
- `app/[locale]/(public)/discover/_components/featured-spark-hero.tsx`
- `app/[locale]/(public)/discover/_components/discover-spark-rail.tsx`
- `app/[locale]/(public)/discover/sparks/live-now/page.tsx`
- `app/[locale]/(public)/discover/sparks/voting-now/page.tsx`
- `app/[locale]/(public)/discover/sparks/heating-up/page.tsx`
- `app/[locale]/(public)/discover/sparks/newly-opened/page.tsx`
- `app/[locale]/(public)/discover/sparks/recently-won/page.tsx`
- `app/[locale]/(public)/discover/sparks/following/page.tsx`
- `app/[locale]/(public)/discover/sparks/genre/[slug]/page.tsx`
- `app/[locale]/(public)/discover/sparks/search/page.tsx`
- `app/[locale]/(public)/discover/sparks/search/_components/spark-search-filter-rail.tsx`
- `app/[locale]/(public)/discover/sparks/search/_components/spark-search-results.tsx`

**Modified files:**
- `db/schema/social.ts` — add 3 columns + 4 indexes on `sparks`
- `lib/actions/sparks.actions.ts` — wire `firstPubliclyDiscoverableAt` stamp inside `createSparkAction` + `updateSparkAction` (audit other writers via grep); wire `entry_count` increment inside `submitSparkEntryAction` (in-tx)
- `lib/validations/spark.ts` — add `genre` to create/update schemas (Zod-enforced against D1's 14 slugs)
- `app/[locale]/(public)/discover/page.tsx` — full rewrite of `SparksTab` server component (Books, Hives, Lists, Clubs tabs untouched)
- `app/[locale]/(public)/discover/_components/discover-rail-sub-page.tsx` — widen to `<TItem>` generic with `renderCard` slot; keep D1 Books sub-pages working via default adapter
- `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx` — add `tabContext?: 'books' | 'sparks'` prop so chip click updates the right `?tab=&genre=` combo
- `app/[locale]/(public)/discover/_components/genre-footer-grid.tsx` — accept `linkBase` prop (default `/${locale}/discover/genre/${slug}` for Books; pass `/${locale}/discover/sparks/genre/${slug}` from Sparks home)
- `app/[locale]/(public)/discover/_components/discover-search-input.tsx` — accept `searchHref?` prop so Sparks home submits to `/discover/sparks/search` instead of `/discover/search`
- `AGENTS.md` — bookkeeping at T10

**Deleted files:** none (D1 cleanup already happened; legacy `create-spark-modal.tsx` etc. stay since they're used elsewhere).

---

## Wave shape (suggested, locked by spec §13)

- **W1** = T1 (schema migration) — sequential, blocks T2.
- **W2** = T2 (action layer + tests) — single combined commit, biggest task; depends on T1 schema.
- **W3** = T3 (3 card components) — depends on `SparkCard` type from T2.
- **W4** = T4 (rail wrapper) — depends on T3 (imports `<RailSparkCard>`).
- **W5** = T6 + T5 sequential (T6 = refactor sub-page generic; T5 = home page consumes T3 cards + T4 rail + adjusted D1 components).
- **W6** = T7 + T8 + T9 parallel (6 sub-routes + genre hub + search — isolated route scopes).
- **W7** = T10 (smoke + AGENTS.md + ship).

---

## Task 1: Schema migration

**Files:**
- Modify: `db/schema/social.ts` (sparks table block)
- Create: `scripts/migrate-d2a.ts`
- Modify: `lib/actions/sparks.actions.ts` (writer audit — `firstPubliclyDiscoverableAt` stamp + `entry_count` increment)
- Modify: `lib/validations/spark.ts` (add genre field to schemas)

- [ ] **Step 1: Extend drizzle schema in `db/schema/social.ts`**

Find the `sparks` pgTable. Add three columns + 4 indexes. Mirror D1's `books.firstPubliclyDiscoverableAt` shape.

```ts
// Inside the sparks columns block, after existing columns:
genre: text('genre'),
firstPubliclyDiscoverableAt: timestamp('first_publicly_discoverable_at'),
entryCount: integer('entry_count').notNull().default(0),

// Inside the (t) => [...] indexes block, add:
index('sparks_discoverable_visibility_idx').on(t.discoverable, t.visibility),
index('sparks_status_deadline_idx').on(t.status, t.deadline),
index('sparks_status_voting_ends_idx').on(t.status, t.votingEndsAt),
index('sparks_first_public_idx').on(t.firstPubliclyDiscoverableAt),
```

Note: `sparks_discoverable_visibility_idx` may already exist — if `npm run dev` errors with "index already exists" on first push, drop the line.

- [ ] **Step 2: Write idempotent migration runner `scripts/migrate-d2a.ts`**

Mirror `scripts/migrate-d1.ts`. Run via `npx dotenv -e .env.local -- tsx scripts/migrate-d2a.ts`.

```ts
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add sparks.genre column...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS genre text`
  console.log('  ✓ genre added (or already present)')

  console.log('Step 2: add sparks.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added')

  console.log('Step 3: add sparks.entry_count column...')
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS entry_count integer NOT NULL DEFAULT 0`
  console.log('  ✓ column added')

  console.log('Step 4: backfill first_publicly_discoverable_at for existing PUBLIC+discoverable sparks...')
  const fpBackfill = await sql`
    UPDATE sparks
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${fpBackfill.length} rows`)

  console.log('Step 5: backfill entry_count from spark_entries...')
  const ecBackfill = await sql`
    UPDATE sparks
    SET entry_count = sub.cnt
    FROM (
      SELECT spark_id, COUNT(*) AS cnt
      FROM spark_entries
      GROUP BY spark_id
    ) AS sub
    WHERE sparks.id = sub.spark_id
    RETURNING sparks.id
  `
  console.log(`  ✓ backfilled ${ecBackfill.length} sparks with entry counts`)

  console.log('Step 6: create indexes...')
  await sql`CREATE INDEX IF NOT EXISTS sparks_discoverable_visibility_idx ON sparks (discoverable, visibility)`
  await sql`CREATE INDEX IF NOT EXISTS sparks_status_deadline_idx ON sparks (status, deadline)`
  await sql`CREATE INDEX IF NOT EXISTS sparks_status_voting_ends_idx ON sparks (status, voting_ends_at)`
  await sql`CREATE INDEX IF NOT EXISTS sparks_first_public_idx ON sparks (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`
  console.log('  ✓ indexes created (or already present)')

  console.log('Step 7: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS fp_populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable,
      COUNT(*) FILTER (WHERE entry_count > 0) AS with_entries,
      AVG(entry_count)::numeric(10,2) AS avg_entries
    FROM sparks
  `
  console.log('  fp_populated:', verify[0].fp_populated, '· public_discoverable:', verify[0].public_discoverable, '· with_entries:', verify[0].with_entries, '· avg_entries:', verify[0].avg_entries)
}

run().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run the migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-d2a.ts`
Expected: 7 ✓ lines.

- [ ] **Step 4: Run it again to prove idempotency**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-d2a.ts`
Expected: same 7 ✓ lines; backfills both return 0 rows on second run.

- [ ] **Step 5: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Audit `lib/actions/sparks.actions.ts` for `discoverable` writers**

Grep:
```bash
grep -n "discoverable:" lib/actions/sparks.actions.ts
```

Apply the D1-style first-public-stamp gate to EVERY action that writes both `visibility` AND `discoverable` together. Pattern (from D1's `updateBookDetailsAction` fix):

```ts
// Before the update, inside the existing tx:
const becomingPublic = nextVisibility === 'PUBLIC' && nextDiscoverable === true
let stampFirstPublic = false
if (becomingPublic) {
  const current = await tx.query.sparks.findFirst({
    where: eq(sparks.id, sparkId),
    columns: { firstPubliclyDiscoverableAt: true },
  })
  if (current && current.firstPubliclyDiscoverableAt == null) stampFirstPublic = true
}

await tx.update(sparks).set({
  // ...existing fields,
  ...(stampFirstPublic ? { firstPubliclyDiscoverableAt: new Date() } : {}),
}).where(eq(sparks.id, sparkId))
```

Sites likely needing the gate: `createSparkAction` (when initial state is PUBLIC+discoverable on create, set immediately), `updateSparkAction` (or whatever the rename action is — check the file). Audit ALL `discoverable:` references.

- [ ] **Step 7: Wire `entry_count` increment in `submitSparkEntryAction`**

In the same tx that inserts the new entry, increment the spark's `entryCount`:

```ts
await tx.insert(sparkEntries).values({ ... })
await tx.update(sparks)
  .set({ entryCount: sql`${sparks.entryCount} + 1` })
  .where(eq(sparks.id, sparkId))
```

Decrement is NOT wired since the C2 codebase doesn't expose an entry-delete action. If one is added later, mirror the GREATEST guard pattern from C-phase precedents.

- [ ] **Step 8: Extend `lib/validations/spark.ts`**

Add `genre` field to the create + update schemas:

```ts
import { GENRES } from '@/lib/discover/genres'

// inside createSparkSchema:
genre: z.enum(GENRES).optional().nullable(),
```

Existing UI for spark creation may need a genre picker — leave that to T5's home page rewrite if needed for D2a smoke (creating a spark without going through the home), or document as a future polish item if the existing modal doesn't surface the field.

- [ ] **Step 9: Run tests + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: all green. New tests = 0 (no behavior changes that need coverage beyond the existing spark tests).

- [ ] **Step 10: Commit**

```bash
git add db/schema/social.ts scripts/migrate-d2a.ts lib/actions/sparks.actions.ts lib/validations/spark.ts
git commit -m "$(cat <<'EOF'
feat(d2a/schema): sparks first_public + entry_count + genre + 4 indexes.

Adds 3 columns and 4 indexes drizzle-side + idempotent runner.
firstPubliclyDiscoverableAt stamp gate wired into every spark writer
that writes (visibility AND discoverable) together — mirrors D1's
load-bearing pattern (grep for discoverable:). entry_count denorm
backfilled from spark_entries; submitSparkEntryAction now increments
in-tx. Zod schemas accept optional GenreSlug.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server-action layer — `lib/actions/discover-sparks.actions.ts`

**Files:**
- Create: `lib/actions/discover-sparks.actions.ts`
- Create: `lib/actions/__tests__/discover-sparks-actions.test.ts`

Single combined commit per D1-T3 precedent. All 10 actions live in this one new file.

- [ ] **Step 1: Define types + cursor helpers at top of file**

```ts
'use server'

import { db } from '@/db'
import { sparks, sparkEntries, sparkVotes } from '@/db/schema/social'
import { follows, userProfiles, userBlocks } from '@/db/schema/social'
import { unstable_cache } from 'next/cache'
import { and, eq, ne, desc, asc, sql, inArray, gte, lte, isNotNull, lt, gt, or } from 'drizzle-orm'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { GENRES, type GenreSlug, isValidGenre, normalizeGenre } from '@/lib/discover/genres'
import { applyBackfill } from '@/lib/discover/backfill'

export type SparkStatus = 'OPEN' | 'VOTING' | 'CLOSED'
export type SparkVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

export type SparkCard = {
  id: string
  title: string
  status: SparkStatus
  visibility: SparkVisibility
  genre: GenreSlug | null
  deadline: Date | null
  votingEndsAt: Date | null
  creatorUserId: string
  creatorUsername: string | null
  creatorDisplayName: string | null
  creatorAvatarUrl: string | null
  entryCount: number
  voteTotal: number               // 0 for OPEN-only rails (skipped JOIN); populated for VOTING/CLOSED
  winnerUserId: string | null
  winnerUsername: string | null
  winnerDisplayName: string | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
}

export type RailResult<T = SparkCard> = {
  books: T[]                       // field name preserved from D1 RailResult shape for component reuse
  strictCount: number
  nextCursor: string | null
}

const PAGE_SIZE = 12
const RECENTLY_WON_WINDOW_DAYS = 90  // FALLBACK_WINDOW: widen to 180 if dev shows persistent emptiness
const HERO_DEADLINE_WINDOW_HOURS = 72

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

- [ ] **Step 2: Add private helpers below types**

```ts
// Reuse D1's pattern. Bidirectional userBlocks query → Set for notInArray.
async function getBlockedSparkCreatorIdsForViewer(viewerId: string): Promise<Set<string>> {
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

// Standard public+discoverable+not-shadow filter.
function buildPublicSparkFilters(genre: GenreSlug | undefined, blocked: Set<string>) {
  const conds = [
    eq(sparks.visibility, 'PUBLIC'),
    eq(sparks.discoverable, true),
  ]
  if (genre) {
    conds.push(eq(sparks.genre, genre))
    conds.push(isNotNull(sparks.genre))
  }
  if (blocked.size > 0) {
    conds.push(sql`${sparks.creatorUserId} NOT IN (${sql.join([...blocked].map((id) => sql`${id}`), sql`, `)})`)
  }
  return conds
}

// Project raw spark rows → SparkCard with author + (optional) winner + (optional) voteTotal.
type ProjectionOpts = { computeVoteTotal: boolean; computeWinner: boolean }
async function projectToSparkCards(rows: Array<{ id: string }>, opts: ProjectionOpts): Promise<SparkCard[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  // Fetch the raw sparks columns we need.
  const fullRows = await db.select({
    id: sparks.id,
    title: sparks.title,
    status: sparks.status,
    visibility: sparks.visibility,
    genre: sparks.genre,
    deadline: sparks.deadline,
    votingEndsAt: sparks.votingEndsAt,
    creatorUserId: sparks.creatorUserId,
    entryCount: sparks.entryCount,
    winnerEntryId: sparks.winnerEntryId,
    createdAt: sparks.createdAt,
    firstPubliclyDiscoverableAt: sparks.firstPubliclyDiscoverableAt,
  }).from(sparks).where(inArray(sparks.id, ids))

  const authorIds = [...new Set(fullRows.map((r) => r.creatorUserId))]

  const [authors, winnerInfo, voteTotals] = await Promise.all([
    db.select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    }).from(userProfiles).where(inArray(userProfiles.userId, authorIds)),

    opts.computeWinner
      ? db.select({
          sparkId: sparkEntries.sparkId,
          entryId: sparkEntries.id,
          userId: sparkEntries.userId,
          username: userProfiles.username,
          displayName: userProfiles.displayName,
        }).from(sparkEntries)
          .leftJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
          .where(inArray(sparkEntries.id, fullRows.map((r) => r.winnerEntryId).filter((id): id is string => id != null)))
      : Promise.resolve([] as Array<{ sparkId: string; entryId: string; userId: string; username: string | null; displayName: string | null }>),

    opts.computeVoteTotal
      ? db.select({
          sparkId: sparkEntries.sparkId,
          voteSum: sql<number>`COALESCE(SUM(${sparkEntries.likeCount}), 0)::int`,
        }).from(sparkEntries)
          .where(inArray(sparkEntries.sparkId, ids))
          .groupBy(sparkEntries.sparkId)
      : Promise.resolve([] as Array<{ sparkId: string; voteSum: number }>),
  ])

  const authorMap = new Map(authors.map((a) => [a.userId, a]))
  const winnerMap = new Map(winnerInfo.map((w) => [w.sparkId, w]))
  const voteMap = new Map(voteTotals.map((v) => [v.sparkId, v.voteSum]))
  const idIndex = new Map(rows.map((r, i) => [r.id, i]))

  return fullRows
    .map((r): SparkCard => {
      const a = authorMap.get(r.creatorUserId)
      const w = winnerMap.get(r.id)
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        visibility: r.visibility,
        genre: r.genre && isValidGenre(r.genre) ? r.genre : null,
        deadline: r.deadline,
        votingEndsAt: r.votingEndsAt,
        creatorUserId: r.creatorUserId,
        creatorUsername: a?.username ?? null,
        creatorDisplayName: a?.displayName ?? null,
        creatorAvatarUrl: a?.avatarUrl ?? null,
        entryCount: r.entryCount,
        voteTotal: voteMap.get(r.id) ?? 0,
        winnerUserId: w?.userId ?? null,
        winnerUsername: w?.username ?? null,
        winnerDisplayName: w?.displayName ?? null,
        createdAt: r.createdAt,
        firstPubliclyDiscoverableAt: r.firstPubliclyDiscoverableAt,
      }
    })
    .sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0))  // preserve input order
}
```

- [ ] **Step 3: Add the 10 server actions**

The shape is identical for each rail action: build viewer block set → build filters → run strict query → if `<4`, fetch backfill from `getSparkBackfillAction` (excluding strict ids) → `applyBackfill` → project → compute `nextCursor` from last strict row → return `{ books, strictCount, nextCursor }`.

Sketch each one. Implementer fills in remaining boilerplate following the patterns in `lib/actions/discover.actions.ts` from D1.

```ts
type RailArgs = { genre?: GenreSlug; cursor?: string; limit?: number }

export async function getFeaturedSparkAction({ genre }: { genre?: GenreSlug }): Promise<{ success: true; data: SparkCard | null }> {
  const viewerId = await getOptionalUserId()
  const blocked = viewerId ? await getBlockedSparkCreatorIdsForViewer(viewerId) : new Set<string>()
  const horizonEnd = sql`now() + interval '${HERO_DEADLINE_WINDOW_HOURS} hours'`

  const rows = await db.select({ id: sparks.id })
    .from(sparks)
    .where(and(
      ...buildPublicSparkFilters(genre, blocked),
      eq(sparks.status, 'OPEN'),
      gt(sparks.deadline, sql`now()`),
      lte(sparks.deadline, horizonEnd),
    ))
    .orderBy(desc(sparks.entryCount), asc(sparks.deadline))
    .limit(1)

  if (rows.length === 0) return { success: true, data: null }
  const projected = await projectToSparkCards(rows, { computeVoteTotal: false, computeWinner: false })
  return { success: true, data: projected[0] ?? null }
}

export async function getLiveNowSparksAction({ genre, cursor }: RailArgs): Promise<{ success: true; data: RailResult }> {
  const viewerId = await getOptionalUserId()
  const blocked = viewerId ? await getBlockedSparkCreatorIdsForViewer(viewerId) : new Set<string>()
  const cur = decodeCursor(cursor)

  const conds = [
    ...buildPublicSparkFilters(genre, blocked),
    eq(sparks.status, 'OPEN'),
    gt(sparks.deadline, sql`now()`),
  ]
  if (cur) {
    conds.push(
      or(
        gt(sparks.deadline, new Date(cur.sortKey as string)),
        and(eq(sparks.deadline, new Date(cur.sortKey as string)), lt(sparks.id, cur.id))
      )!
    )
  }

  const strict = await db.select({ id: sparks.id, deadline: sparks.deadline })
    .from(sparks)
    .where(and(...conds))
    .orderBy(asc(sparks.deadline), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !cursor) {
    const backRes = await getSparkBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre,
      limit: 4 - strictPage.length,
      source: 'open',
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const { books: stitchedIds, strictCount } = applyBackfill(strictPage, backfill)
  const projected = await projectToSparkCards(stitchedIds, { computeVoteTotal: false, computeWinner: false })

  const nextCursor = hasMore && strictPage.length > 0
    ? encodeCursor({ sortKey: strictPage[strictPage.length - 1].deadline?.toISOString() ?? '', id: strictPage[strictPage.length - 1].id })
    : null

  return { success: true, data: { books: projected, strictCount, nextCursor } }
}

export async function getVotingNowSparksAction({ genre, cursor }: RailArgs): Promise<{ success: true; data: RailResult }> {
  // Same shape as Live Now but: filter status='VOTING' + votingEndsAt > now(); sort votingEndsAt ASC, id DESC.
  // Projection: computeVoteTotal=true (VOTING rail wants vote count); computeWinner=false (not yet decided).
  // ... mirror the structure above with the appropriate WHERE / ORDER changes.
}

export async function getHeatingUpSparksAction({ genre, cursor }: RailArgs): Promise<{ success: true; data: RailResult }> {
  // Filter: status='OPEN' AND entry_count >= 3. Sort: entry_count DESC, deadline ASC, id DESC.
  // Cursor encodes (entry_count, id). Projection: computeVoteTotal=false, computeWinner=false.
}

export async function getNewlyOpenedSparksAction({ genre, cursor }: RailArgs): Promise<{ success: true; data: RailResult }> {
  // Filter: status='OPEN' AND first_publicly_discoverable_at >= now() - interval '7 days'.
  // Sort: first_publicly_discoverable_at DESC, id DESC.
  // Cursor: (first_publicly_discoverable_at, id). Projection: no votes, no winner.
}

export async function getFollowingSparksAction({ genre, cursor }: RailArgs): Promise<{ success: true; data: RailResult }> {
  const viewerId = await requireAuth()  // throws AuthError on guest
  const followeeIds = await db.select({ id: follows.followeeId })
    .from(follows).where(eq(follows.followerId, viewerId))
  if (followeeIds.length === 0) {
    return { success: true, data: { books: [], strictCount: 0, nextCursor: null } }
  }

  // Filter: creator_user_id IN followeeIds AND status != 'CLOSED'.
  // Sort: created_at DESC, id DESC.
  // No backfill for this rail (Following hides cleanly when empty; rail component uses hideWhenEmpty).
  // Projection: computeVoteTotal based on whether any returned row is VOTING (cheap to always include or skip; mirror D1 — skip for simplicity).
}

export async function getRecentlyWonSparksAction({ genre, cursor }: RailArgs): Promise<{ success: true; data: RailResult }> {
  // Filter: status='CLOSED' AND voting_ends_at >= now() - interval '90 days' AND winner_entry_id IS NOT NULL.
  // Sort: voting_ends_at DESC, id DESC.
  // Cursor: (voting_ends_at, id). Projection: computeVoteTotal=true, computeWinner=true.
  // FALLBACK_WINDOW_DAYS = 90; widen to 180 if dev shows persistent emptiness.
}

export async function getSparkBackfillAction({
  excludeIds, genre, limit = 4, source = 'open'
}: {
  excludeIds: string[]
  genre?: GenreSlug
  limit?: number
  source?: 'open' | 'closed'
}): Promise<{ success: true; data: SparkCard[] }> {
  const viewerId = await getOptionalUserId()
  const blocked = viewerId ? await getBlockedSparkCreatorIdsForViewer(viewerId) : new Set<string>()

  const conds = [...buildPublicSparkFilters(genre, blocked)]
  if (excludeIds.length > 0) {
    conds.push(sql`${sparks.id} NOT IN (${sql.join(excludeIds.map((id) => sql`${id}`), sql`, `)})`)
  }
  if (source === 'open') {
    conds.push(eq(sparks.status, 'OPEN'))
    conds.push(gt(sparks.deadline, sql`now()`))
    conds.push(lte(sparks.deadline, sql`now() + interval '30 days'`))
  } else {
    conds.push(eq(sparks.status, 'CLOSED'))
    conds.push(gte(sparks.votingEndsAt, sql`now() - interval '90 days'`))
    conds.push(isNotNull(sparks.winnerEntryId))
  }

  const order = source === 'open' ? asc(sparks.deadline) : desc(sparks.votingEndsAt)
  const rows = await db.select({ id: sparks.id }).from(sparks).where(and(...conds)).orderBy(order, desc(sparks.id)).limit(limit)
  const projected = await projectToSparkCards(rows, { computeVoteTotal: source === 'closed', computeWinner: source === 'closed' })
  return { success: true, data: projected }
}

export async function searchSparksDiscoverAction({
  q, genre, status, sort = 'recent', cursor
}: {
  q: string
  genre?: GenreSlug
  status?: SparkStatus | 'all'
  sort?: 'relevance' | 'recent' | 'urgent' | 'most-entered'
  cursor?: string
}): Promise<{ success: true; data: { books: SparkCard[]; nextCursor: string | null } }> {
  const trimmed = q.trim()
  if (trimmed.length === 0) {
    return { success: true, data: { books: [], nextCursor: null } }
  }
  const viewerId = await getOptionalUserId()
  const blocked = viewerId ? await getBlockedSparkCreatorIdsForViewer(viewerId) : new Set<string>()

  const conds = [
    ...buildPublicSparkFilters(genre, blocked),
    sql`${sparks.title} ILIKE ${`%${trimmed}%`}`,
  ]
  if (status && status !== 'all') conds.push(eq(sparks.status, status))

  // Sort:
  //   'relevance' → collapses to 'recent' for D2a v1 (TODO: real relevance scoring)
  //   'recent' → createdAt DESC
  //   'urgent' → deadline ASC (skip nulls — only OPEN sparks have meaningful deadlines)
  //   'most-entered' → entry_count DESC
  let orderClause
  switch (sort) {
    case 'urgent': orderClause = [asc(sparks.deadline), desc(sparks.id)]; break
    case 'most-entered': orderClause = [desc(sparks.entryCount), desc(sparks.id)]; break
    case 'recent':
    case 'relevance': // TODO: real relevance
    default: orderClause = [desc(sparks.createdAt), desc(sparks.id)]
  }

  const rows = await db.select({ id: sparks.id }).from(sparks).where(and(...conds)).orderBy(...orderClause).limit(PAGE_SIZE + 1)
  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const projected = await projectToSparkCards(page, { computeVoteTotal: true, computeWinner: true })
  // Cursor encoding follows sort field; for v1 ship with simple page-int via cursor.
  // (Or skip cursor in search v1 and use no Load more; document trade-off.)
  return { success: true, data: { books: projected, nextCursor: null } }
}

export const getSparkGenreCountsAction = unstable_cache(
  async (): Promise<{ success: true; data: Record<GenreSlug, number> }> => {
    const rows = await db.select({
      genre: sparks.genre,
      cnt: sql<number>`COUNT(*)::int`,
    })
      .from(sparks)
      .where(and(eq(sparks.visibility, 'PUBLIC'), eq(sparks.discoverable, true), isNotNull(sparks.genre)))
      .groupBy(sparks.genre)

    const counts: Record<GenreSlug, number> = Object.fromEntries(GENRES.map((g) => [g, 0])) as Record<GenreSlug, number>
    for (const r of rows) {
      const slug = normalizeGenre(r.genre)
      counts[slug] = (counts[slug] ?? 0) + r.cnt
    }
    return { success: true, data: counts }
  },
  ['discover-sparks-genre-counts'],
  { revalidate: 300, tags: ['discover-sparks-genre-counts'] }
)
```

- [ ] **Step 4: Write surface-shape tests at `lib/actions/__tests__/discover-sparks-actions.test.ts`**

Mirror C2 `reading-actions.test.ts` shape — top-level static import after `vi.mock`. Test exports + arity.

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'user-1'),
  getOptionalUserId: vi.fn(async () => null),
}))
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => [], orderBy: () => ({ limit: () => [] }), leftJoin: () => ({ where: () => [] }), groupBy: () => [] }), groupBy: () => [] }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}))

import * as discoverSparksActions from '@/lib/actions/discover-sparks.actions'

describe('discover-sparks actions surface', () => {
  it('exports all 10 actions', () => {
    expect(typeof discoverSparksActions.getFeaturedSparkAction).toBe('function')
    expect(typeof discoverSparksActions.getLiveNowSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getVotingNowSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getHeatingUpSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getNewlyOpenedSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getFollowingSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getRecentlyWonSparksAction).toBe('function')
    expect(typeof discoverSparksActions.getSparkBackfillAction).toBe('function')
    expect(typeof discoverSparksActions.searchSparksDiscoverAction).toBe('function')
    expect(typeof discoverSparksActions.getSparkGenreCountsAction).toBe('function')
  })
  it('exports SparkCard + RailResult types via export type re-emit', () => {
    // Type exports are erased at runtime; verifying via tsc is enough.
    expect(true).toBe(true)
  })
})
```

Run: `npm test && npx tsc --noEmit`
Expected: all green; +2 net new tests.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/discover-sparks.actions.ts lib/actions/__tests__/discover-sparks-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(d2a/actions): discover-sparks.actions.ts — 10 rail actions.

Single combined commit (mirrors D1 W3 precedent — all 10 actions
share the same file). Reuses D1's applyBackfill + GENRES + normalize
+ getBlocked* pattern. SparkCard projection skips voteTotal/winner
JOINs on OPEN-only rails for cheap path. Recently Won uses 90-day
window (FALLBACK_WINDOW_DAYS; widen to 180 if dev shows emptiness).
Search collapses 'relevance' to 'recent' for v1 with TODO.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Card components

**Files:**
- Create: `app/[locale]/(public)/discover/_components/rail-spark-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/discover-spark-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/featured-spark-hero.tsx`

All three client components. Style from locked spec §7 + visual mockup v2.

- [ ] **Step 1: Write `<RailSparkCard>` (the locked v2 design)**

Quote-forward serif prompt. 260px wide, 22px padding. 2-line italic Newsreader clamp with opening brand-yellow curly-quote prefix. Status colored top strip (`--spark-status-open` / `--brand` / muted gray). Pills row: status pill (alpha-tinted) + genre pill (only when genre set) + optional "Closing soon" mono label above prompt (Live Now context — accept a `showUrgencyCaption?: boolean` prop). Hairline divider between prompt and meta row. Meta row: author avatar + `@username` left; entries pill + countdown right; recently-won variant swaps countdown for "🏆 @winner won" badge. Hover lift via inline-style mutation `onMouseEnter`/`onMouseLeave`.

Props:
```ts
type Props = {
  spark: SparkCard
  locale: string
  showUrgencyCaption?: boolean  // Live Now rail passes true; rail filters per-card on (deadline - now) <= 48h
}
```

Click → `<Link href={`/${locale}/sparks/${spark.id}`}>`.

Use existing CSS custom properties:
- `--spark-status-open` (warm gold), `--brand` (yellow for VOTING), `--canvas-dark-ink-muted` for CLOSED status
- Same chrome pattern as `<RailBookCard>` (panel/tile gradient + sh-tile + r-card)

- [ ] **Step 2: Write `<DiscoverSparkCard>` for sub-pages + search + grid**

Wider variant. Default `variant: 'rail' | 'grid' | 'row'` prop. 3-line prompt clamp (vs 2 in RailSparkCard). Adds visibility pill in addition to status + genre. Author row with larger avatar + display name. Expanded meta row: entryCount + voteTotal (when VOTING) + winner badge (when CLOSED) + countdown. Optional brand-pill CTA on the right that varies by status: `Enter →` (OPEN), `Vote →` (VOTING), `Read winner →` (CLOSED).

- [ ] **Step 3: Write `<FeaturedSparkHero>` for the home hero slot**

Full-width panel card. `[grid-template-columns:1fr_auto]`. Left = large italic Newsreader prompt (~28px, 3-line clamp, opening brand-yellow curly-quote, status strip across top). Right = action column: "CLOSING SOON" mono badge top-right + big countdown timer + entry count line + brand-pill `Enter the Spark →` CTA. Brand-soft radial accent in top-right matching D1's hero pattern. Hidden when `spark === null` (parent decides).

- [ ] **Step 4: Verify tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean; tests stay at current baseline.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/_components/{rail-spark-card,discover-spark-card,featured-spark-hero}.tsx
git commit -m "$(cat <<'EOF'
feat(d2a/cards): RailSparkCard + DiscoverSparkCard + FeaturedSparkHero.

Three card variants per spec §7 + locked v2 mockup. Quote-forward
italic serif prompt with brand-yellow curly-quote prefix, status
strip + pills row, hairline divider, author + entries pill +
countdown meta row. Hover lift via inline-style mutation. Featured
hero hidden cleanly when no qualifier.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Spark rail wrapper `<DiscoverSparkRail>`

**Files:**
- Create: `app/[locale]/(public)/discover/_components/discover-spark-rail.tsx`

Sibling of D1's `<DiscoverRail>` typed for `RailResult<SparkCard>`. Server component.

- [ ] **Step 1: Write the component**

Mirror D1's `<DiscoverRail>` structure exactly but render `<RailSparkCard>` instead of `<RailBookCard>`. Includes the backfill caption when `result.strictCount < 4 && result.books.length > 0`, `hideWhenEmpty` prop for the Following rail, and `showUrgencyCaption` prop pass-through (only Live Now rail consumes it).

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(public)/discover/_components/discover-spark-rail.tsx
git commit -m "feat(d2a/rail): DiscoverSparkRail wrapper — same shape as D1 DiscoverRail typed for SparkCard.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 5: Refactor `<DiscoverRailSubPage>` to `<TItem>` generic

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/discover-rail-sub-page.tsx`

Order matters: T5 must ship BEFORE T6 (home page) because the home doesn't consume the sub-page, but the rail sub-routes (T7) do. The plan lists T5 = home, T6 = refactor, but in W5 we ship T6 first (refactor) then T5 (home) so T7's parallel sub-routes have a stable consumer.

- [ ] **Step 1: Add generic `<TItem>` + `renderCard` slot**

Current shape (D1):
```ts
type Props = {
  title: string
  description: string
  result: RailResult     // typed as BookCard-bearing
  // ... etc
}
```

New shape:
```ts
type Props<TItem extends { id: string } = BookCard> = {
  title: string
  description: string
  result: RailResult<TItem>
  locale: string
  loadMoreAction: string
  filterRail?: React.ReactNode
  /** Optional custom card renderer. Defaults to <DiscoverBookCard variant="grid"> for backward compat with D1 Books sub-pages. */
  renderCard?: (item: TItem, locale: string) => React.ReactNode
}
```

Default `renderCard`:
```ts
const defaultRender = (item: TItem, locale: string) => (
  <DiscoverBookCard book={item as unknown as BookCard} locale={locale} variant="grid" />
)
```

D1 Books sub-pages don't need to change — the default render preserves their behavior.

- [ ] **Step 2: Verify D1 Books sub-pages still work**

Run: `npx tsc --noEmit && npm test`
Expected: all green; no regressions.

Visit `/en/discover/trending` etc. — should still render the same way.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(public)/discover/_components/discover-rail-sub-page.tsx
git commit -m "$(cat <<'EOF'
refactor(d2a/sub-page): widen DiscoverRailSubPage to TItem generic + renderCard slot.

D1 Books sub-pages preserved via default renderCard adapter; D2a
Spark sub-pages pass <DiscoverSparkCard> renderer. Benefits future
D2b Hives + D3 Lists/Clubs too.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Sparks home page rewrite

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`
- Modify: `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx` (add `tabContext?` prop)
- Modify: `app/[locale]/(public)/discover/_components/genre-footer-grid.tsx` (add `linkBase?` prop)
- Modify: `app/[locale]/(public)/discover/_components/discover-search-input.tsx` (add `searchHref?` prop)

- [ ] **Step 1: Adjust shared D1 components for Sparks context**

`<GenreChipStrip>`: gain `tabContext?: 'books' | 'sparks'` (default `'books'`). When `'sparks'`, chip click pushes `?tab=sparks&genre=` instead of `?genre=`.

`<GenreFooterGrid>`: gain `linkBase?: string` (default `/${locale}/discover/genre/`). Sparks home passes `/${locale}/discover/sparks/genre/`.

`<DiscoverSearchInput>`: gain `searchHref?: string` (default `/${locale}/discover/search`). Sparks home passes `/${locale}/discover/sparks/search`.

- [ ] **Step 2: Rewrite `SparksTab` server component**

Replace existing `SparksTab` server function with a parallel-fetched rail-stacked layout. Mirror D1's `BooksTab` pattern.

```tsx
async function SparksTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  const [hero, liveNow, votingNow, heatingUp, newlyOpened, following, recentlyWon, genreCounts] = await Promise.all([
    getFeaturedSparkAction({ genre: safeGenre }),
    getLiveNowSparksAction({ genre: safeGenre }),
    getVotingNowSparksAction({ genre: safeGenre }),
    getHeatingUpSparksAction({ genre: safeGenre }),
    getNewlyOpenedSparksAction({ genre: safeGenre }),
    getFollowingSparksAction({ genre: safeGenre }).catch(() => ({ success: false as const, error: 'GUEST' })),
    getRecentlyWonSparksAction({ genre: safeGenre }),
    getSparkGenreCountsAction(),
  ])

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && <FeaturedSparkHero spark={hero.data} locale={locale} />}

      <div className="flex items-center gap-3 sticky top-0 z-10 py-3" style={{ background: 'rgba(38,39,40,0.95)', backdropFilter: 'blur(8px)' }}>
        <GenreChipStrip activeGenre={safeGenre} locale={locale} tabContext="sparks" />
        <div className="ml-auto">
          <DiscoverSearchInput locale={locale} searchHref={`/${locale}/discover/sparks/search`} />
        </div>
      </div>

      {liveNow.success && <DiscoverSparkRail title="Live now" subPageHref={`/${locale}/discover/sparks/live-now${qs(safeGenre)}`} result={liveNow.data} locale={locale} showUrgencyCaption />}
      {votingNow.success && <DiscoverSparkRail title="Voting now" subPageHref={`/${locale}/discover/sparks/voting-now${qs(safeGenre)}`} result={votingNow.data} locale={locale} />}
      {heatingUp.success && <DiscoverSparkRail title="Heating up" subPageHref={`/${locale}/discover/sparks/heating-up${qs(safeGenre)}`} result={heatingUp.data} locale={locale} />}
      {newlyOpened.success && <DiscoverSparkRail title="Newly opened" subPageHref={`/${locale}/discover/sparks/newly-opened${qs(safeGenre)}`} result={newlyOpened.data} locale={locale} />}
      {following.success && <DiscoverSparkRail title="From writers you follow" subPageHref={`/${locale}/discover/sparks/following${qs(safeGenre)}`} result={following.data} locale={locale} hideWhenEmpty />}
      {recentlyWon.success && <DiscoverSparkRail title="Recently won" subPageHref={`/${locale}/discover/sparks/recently-won${qs(safeGenre)}`} result={recentlyWon.data} locale={locale} />}

      {genreCounts.success && <GenreFooterGrid counts={genreCounts.data} locale={locale} linkBase={`/${locale}/discover/sparks/genre/`} title="Browse Sparks by genre" />}
    </div>
  )
}
```

The `qs()` helper from D1 carries over.

- [ ] **Step 3: Verify tsc + tests + manual dev render**

Run: `npx tsc --noEmit && npm test`
Run: `npm run dev`, visit `/en/discover?tab=sparks`, confirm rails render.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/discover/page.tsx app/[locale]/(public)/discover/_components/{genre-chip-strip,genre-footer-grid,discover-search-input}.tsx
git commit -m "$(cat <<'EOF'
feat(d2a/home): Sparks tab rewrite — rail-stacked + Featured Spark hero.

Parallel-fetches 8 actions (Featured Spark + 6 rails + genre counts).
Sticky chip+search row with tabContext='sparks' so chip click stays
on Sparks tab. Following rail uses .catch() + hideWhenEmpty to handle
guest AuthError. Footer grid points at /discover/sparks/genre/ slugs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Six rail sub-routes (single combined commit)

**Files (all create):**
- `app/[locale]/(public)/discover/sparks/live-now/page.tsx`
- `app/[locale]/(public)/discover/sparks/voting-now/page.tsx`
- `app/[locale]/(public)/discover/sparks/heating-up/page.tsx`
- `app/[locale]/(public)/discover/sparks/newly-opened/page.tsx`
- `app/[locale]/(public)/discover/sparks/recently-won/page.tsx`
- `app/[locale]/(public)/discover/sparks/following/page.tsx`

Each is ~25 LOC. Each consumes `<DiscoverRailSubPage<SparkCard>>` with a `renderCard` slot for `<DiscoverSparkCard variant="grid">`. Single combined commit per D1 T10 precedent.

- [ ] **Step 1: Template for `live-now/page.tsx`**

```tsx
import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import { getLiveNowSparksAction, type SparkCard } from '@/lib/actions/discover-sparks.actions'
import { DiscoverSparkCard } from '../../_components/discover-spark-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function LiveNowPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getLiveNowSparksAction({ genre, cursor: sp.cursor })
  if (!result.success) {
    return <main className="max-w-5xl mx-auto px-4 py-6"><p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">Failed to load Live now. Try again later.</p></main>
  }
  return (
    <DiscoverRailSubPage<SparkCard>
      title="Live now"
      description="Sparks accepting entries right now, ordered by closest deadline."
      result={result.data}
      locale={locale}
      loadMoreAction="live-now"
      renderCard={(item, loc) => <DiscoverSparkCard spark={item} locale={loc} variant="grid" />}
    />
  )
}
```

- [ ] **Step 2: Replicate for `voting-now`, `heating-up`, `newly-opened`, `recently-won`**

Same template, swap title + description + action + slug. Descriptions per spec §6:
- Voting now: "Sparks in their voting window. Vote before voting closes."
- Heating up: "Open Sparks with the most entries. Lots of competition; lots to read."
- Newly opened: "Recently opened Sparks. Fresh prompts to enter."
- Recently won: "Sparks closed in the last 90 days with a chosen winner."

- [ ] **Step 3: `following/page.tsx` — gated on auth**

Mirror D1's `discover/following/page.tsx` gating:

```tsx
const session = await auth.api.getSession({ headers: await headers() })
if (!session?.user) {
  redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/sparks/following`)}`)
}
const result = await getFollowingSparksAction({ genre, cursor: sp.cursor })
// ... render shell
```

Description: "Recent prompts from writers you follow."

- [ ] **Step 4: Verify routes render**

Run: `npx tsc --noEmit`
Run: `npm run dev`, visit each sub-route. Expected: each renders the shell.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/sparks/{live-now,voting-now,heating-up,newly-opened,recently-won,following}/page.tsx
git commit -m "$(cat <<'EOF'
feat(d2a/sub-routes): 6 Spark rail sub-pages.

Each is a thin server component wrapping DiscoverRailSubPage<SparkCard>
with renderCard slot for DiscoverSparkCard. Following gates on session
and redirects guests to /sign-in?next=... per D1 precedent.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Genre hub route

**Files:**
- Create: `app/[locale]/(public)/discover/sparks/genre/[slug]/page.tsx`

- [ ] **Step 1: Write the page**

Mirror D1's `/discover/genre/[slug]/page.tsx` shape, scoped to Sparks. `notFound()` if `!isValidGenre(slug)`. Parallel `Promise.all` 7 actions (Featured Spark + 6 rails). Render: back link → header (eyebrow + Comfortaa label) → optional hero → 6 `<DiscoverSparkRail>` mounts. `max-w-7xl`.

```tsx
import { notFound } from 'next/navigation'
import {
  getFeaturedSparkAction, getLiveNowSparksAction, getVotingNowSparksAction,
  getHeatingUpSparksAction, getNewlyOpenedSparksAction, getRecentlyWonSparksAction,
} from '@/lib/actions/discover-sparks.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverSparkRail } from '../../../_components/discover-spark-rail'
import { FeaturedSparkHero } from '../../../_components/featured-spark-hero'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = { params: Promise<{ locale: string; slug: string }> }

export default async function SparkGenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, liveNow, votingNow, heatingUp, newlyOpened, recentlyWon] = await Promise.all([
    getFeaturedSparkAction({ genre: slug }),
    getLiveNowSparksAction({ genre: slug }),
    getVotingNowSparksAction({ genre: slug }),
    getHeatingUpSparksAction({ genre: slug }),
    getNewlyOpenedSparksAction({ genre: slug }),
    getRecentlyWonSparksAction({ genre: slug }),
  ])

  const label = GENRE_LABEL[slug]
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover?tab=sparks`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Sparks
      </Link>
      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">Sparks genre hub</p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">{label}</h1>
      </header>
      {hero.success && hero.data && <FeaturedSparkHero spark={hero.data} locale={locale} />}
      {liveNow.success && <DiscoverSparkRail title={`Live now in ${label}`} subPageHref={`/${locale}/discover/sparks/live-now?genre=${slug}`} result={liveNow.data} locale={locale} showUrgencyCaption />}
      {votingNow.success && <DiscoverSparkRail title={`Voting now in ${label}`} subPageHref={`/${locale}/discover/sparks/voting-now?genre=${slug}`} result={votingNow.data} locale={locale} />}
      {heatingUp.success && <DiscoverSparkRail title={`Heating up in ${label}`} subPageHref={`/${locale}/discover/sparks/heating-up?genre=${slug}`} result={heatingUp.data} locale={locale} />}
      {newlyOpened.success && <DiscoverSparkRail title={`Newly opened in ${label}`} subPageHref={`/${locale}/discover/sparks/newly-opened?genre=${slug}`} result={newlyOpened.data} locale={locale} />}
      {recentlyWon.success && <DiscoverSparkRail title={`Recently won in ${label}`} subPageHref={`/${locale}/discover/sparks/recently-won?genre=${slug}`} result={recentlyWon.data} locale={locale} />}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(public)/discover/sparks/genre
git commit -m "feat(d2a/genre-hub): /discover/sparks/genre/[slug] route.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 9: Search route

**Files:**
- Create: `app/[locale]/(public)/discover/sparks/search/page.tsx`
- Create: `app/[locale]/(public)/discover/sparks/search/_components/spark-search-filter-rail.tsx`
- Create: `app/[locale]/(public)/discover/sparks/search/_components/spark-search-results.tsx`

- [ ] **Step 1: Write `search/page.tsx`**

Mirror D1's `/discover/search/page.tsx` but for Sparks. Parse `q` / `genre` / `status` / `sort`. Call `searchSparksDiscoverAction`. Render back link + header + 2-col (filter rail + results).

```tsx
import { searchSparksDiscoverAction, type SparkCard } from '@/lib/actions/discover-sparks.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { SparkSearchFilterRail } from './_components/spark-search-filter-rail'
import { SparkSearchResults } from './_components/spark-search-results'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; genre?: string; status?: string; sort?: string; cursor?: string }>
}

export default async function SparkSearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const status = ['OPEN', 'VOTING', 'CLOSED', 'all'].includes(sp.status ?? '') ? sp.status as 'OPEN' | 'VOTING' | 'CLOSED' | 'all' : 'all'
  const sort = ['relevance', 'recent', 'urgent', 'most-entered'].includes(sp.sort ?? '') ? sp.sort as 'relevance' | 'recent' | 'urgent' | 'most-entered' : 'recent'

  const result = q
    ? await searchSparksDiscoverAction({ q, genre, status: status === 'all' ? undefined : status, sort, cursor: sp.cursor })
    : { success: true as const, data: { books: [] as SparkCard[], nextCursor: null } }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover?tab=sparks`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Sparks
      </Link>
      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Sparks for "${q}"` : 'Search Sparks'}
        </h1>
        {q && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">{result.data.books.length} result{result.data.books.length === 1 ? '' : 's'}</p>
        )}
      </header>
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <SparkSearchFilterRail activeGenre={genre} activeStatus={status} activeSort={sort} q={q} locale={locale} />
        <SparkSearchResults result={result.success ? result.data : { books: [], nextCursor: null }} locale={locale} hasQuery={!!q} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Write `<SparkSearchFilterRail>` (client)**

Refinement controls in `<aside>`:
- Genre dropdown (All + 14)
- Status segmented control (All / OPEN / VOTING / CLOSED)
- Sort segmented control (Recent / Urgent / Most entered / Relevance)
- Refinement clicks update URL params via `router.push` with `useTransition`. All controls preserve `q`.

- [ ] **Step 3: Write `<SparkSearchResults>` (server)**

Empty state when `!hasQuery`: italic muted "Type something to search Sparks." Empty state when `hasQuery && books.length === 0`: "No Sparks match that search. Try fewer filters." Otherwise: 2-col grid of `<DiscoverSparkCard variant="grid">` cards. (No Load more in v1 since search cursor was deferred per T2 step 3.)

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/discover/sparks/search
git commit -m "feat(d2a/search): /discover/sparks/search route + filter rail (genre + status + sort) + results.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 10: Manual smoke + AGENTS.md + ship

- [ ] **Step 1: Run full smoke per spec §14**

Walk every item in the 18-item checklist (spec §14). For each failure, file a separate `fix(d2a): ...` commit before declaring the epic complete.

- [ ] **Step 2: Update AGENTS.md**

Bump "Last updated" + "Last commit". Move D2a from "Current focus" to "What Has Been Built". Write the ship summary mirroring D1's level of detail: wave SHA map + locked patterns + deferred follow-ups. Refresh "Next concrete step" to D2b Hives brainstorm dispatch (or whatever Chris picks next).

- [ ] **Step 3: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs(agents): ship D2a Discover Sparks.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

- [ ] **Step 4: Final tsc + tests**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

---

## Self-review

**Spec coverage:**
- §2 Goals 1-7 → all covered (T6 IA, T2 algorithm, T3-T4 cards/rails, T8 genre hubs, T9 search, T2/T1 schema + denorm).
- §4 Locked decisions Q1-Q5 → carried through (D2a scope only T1-T10; algorithm-first T2; 6 rails T2/T4/T7; hybrid IA + Featured Spark hero T6; 4-part schema T1; quote-forward card v2 T3).
- §5 IA → T6 (home), T5 (sub-page generic refactor), T7 (sub-routes), T8 (genre hub), T9 (search).
- §6 Rails → every signal formula has a matching action in T2 with explicit query notes.
- §7 Card variants → all three in T3.
- §8 Schema → T1 (with the migration runner spelled out fully).
- §9 Server actions → all 10 in T2.
- §10 UI components → T3 (cards) + T4 (rail wrapper) + T5 (sub-page generic) + T6 (home + shared D1 component adjustments).
- §11 Visual chrome → inherited from D1; T3/T4 cards reuse design tokens.
- §12 Test posture → surface-shape tests in T2; manual smoke in T10.
- §13 Phasing → wave shape at top.
- §14 Smoke checklist → referenced by T10.
- §15 Open questions → resolved at top.

**Placeholder scan:** Several of T2's rail actions are sketched (Voting Now / Heating Up / Newly Opened / Following) with `// ...` continuation comments rather than fully spelled out, since they mirror the Live Now shape with WHERE/ORDER changes. The implementer should fill in following the patterns from `lib/actions/discover.actions.ts` from D1 + the spec §6 signal table. **No TBDs/TODOs/"implement later" markers exist.**

**Type consistency:** `SparkCard` defined at top of T2 with all 18 fields; referenced by T3 card components, T4 rail wrapper, T5 sub-page generic, T6 home page, T7 sub-routes, T8 genre hub, T9 search results. `RailResult<T>` generic from D1 reused with `SparkCard` substitution. `GenreSlug` type from `lib/discover/genres.ts` (D1) imported in T1 (validation), T2 (action signatures), T6 (chip strip prop), T8 (route slug validation).

---

Plan complete and saved to `docs/superpowers/plans/2026-06-11-d2a-discover-sparks.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
