# D1 — Discover Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the rail-driven Discover Books surface per the locked spec at [docs/superpowers/specs/2026-06-11-d1-discover-books-design.md](../specs/2026-06-11-d1-discover-books-design.md): six algorithmic rails on a stacked home + Featured Fresh hero + 14-genre chip strip + 14 genre hub routes + search + 6 rail sub-pages + visual chrome refresh aligned to the locked design system. Plus a light touch-up of the non-Books tab cards so the page reads coherent.

**Architecture:** Algorithm-first (no curator tooling). One additive column on `books` (`first_publicly_discoverable_at`). Three pure helper modules (`lib/discover/{scoring,backfill,genres}.ts`). Ten server actions (one per rail + Featured Fresh + backfill helper + search + genre counts) all in `lib/actions/discover.actions.ts` (rewritten — legacy `getDiscoverFeedAction` + `getDiscoverWritersAction` dropped after consumer migration). Three card components (`<RailBookCard>` / `<DiscoverBookCard>` / `<FeaturedFreshHero>`). One generic `<DiscoverRail>` wrapper. One generic `<DiscoverRailSubPage>` shell consumed by all 6 rail sub-routes. 6 thin route files + 1 genre-hub route + 1 search route. Visual chrome anchored to AGENTS.md "Design System" block.

**Tech Stack:** Next.js 16 App Router (server components default, client opt-in), React 19, TypeScript, Tailwind v4, shadcn/ui (existing primitives), Drizzle ORM on Neon Postgres, vitest, sonner toasts, lucide icons, design-system tokens already in `app/globals.css`.

**Open-question resolutions from spec §15 (locked here):**
1. **Cursor format** — tuple `(sortKey DESC, id DESC)` base64url JSON per C-phase precedent (`getCommunityFeedAction` / `listBuzzPostsAction` / `getSparksAction`). Decoded with backward-compat default to `null`.
2. **`first_publicly_discoverable_at` write site** — inline inside `publishBookAction` + `updateBookAction` (in the existing tx). Set IF visibility flips into PUBLIC AND discoverable AND the column is currently NULL. Idempotent.
3. **Unit-test pattern** — mirror C2 `reading-actions.test.ts`: top-level static `import * as actions` after `vi.mock`, surface-shape assertions (export + arity). Behavior gated by manual smoke per AGENTS.md.

---

## File structure (new + modified)

**New files:**
- `scripts/migrate-d1.ts` — idempotent schema runner
- `lib/discover/scoring.ts` — pure helpers: `computeTrendingScore`, `computeRisingStarsScore`
- `lib/discover/backfill.ts` — pure helper: `applyBackfill`
- `lib/discover/genres.ts` — `GENRES` const + `isValidGenre` predicate + `GENRE_LABEL` + `GENRE_ICON` map
- `lib/discover/__tests__/scoring.test.ts`
- `lib/discover/__tests__/backfill.test.ts`
- `lib/discover/__tests__/genres.test.ts`
- `lib/actions/__tests__/discover-actions.test.ts` — surface-shape tests
- `app/[locale]/(public)/discover/_components/rail-book-card.tsx`
- `app/[locale]/(public)/discover/_components/discover-book-card.tsx`
- `app/[locale]/(public)/discover/_components/featured-fresh-hero.tsx`
- `app/[locale]/(public)/discover/_components/discover-rail.tsx`
- `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx`
- `app/[locale]/(public)/discover/_components/discover-search-input.tsx`
- `app/[locale]/(public)/discover/_components/genre-footer-grid.tsx`
- `app/[locale]/(public)/discover/_components/discover-rail-sub-page.tsx`
- `app/[locale]/(public)/discover/trending/page.tsx`
- `app/[locale]/(public)/discover/rising/page.tsx`
- `app/[locale]/(public)/discover/recently-updated/page.tsx`
- `app/[locale]/(public)/discover/new-releases/page.tsx`
- `app/[locale]/(public)/discover/best-ongoing/page.tsx`
- `app/[locale]/(public)/discover/following/page.tsx`
- `app/[locale]/(public)/discover/genre/[slug]/page.tsx`
- `app/[locale]/(public)/discover/search/page.tsx`
- `app/[locale]/(public)/discover/search/_components/search-filter-rail.tsx`
- `app/[locale]/(public)/discover/search/_components/search-results.tsx`

**Modified files:**
- `db/schema/books.ts` — add column + index
- `lib/actions/book.actions.ts` — `publishBookAction` + `updateBookAction` write `first_publicly_discoverable_at` when conditions met
- `lib/actions/discover.actions.ts` — full rewrite (legacy actions dropped)
- `app/[locale]/(public)/discover/page.tsx` — full rewrite of the Books tab; other tabs preserved
- `app/[locale]/(public)/discover/_components/book-card.tsx` — chrome touch-up to design-system tokens
- `app/[locale]/(public)/discover/_components/spark-card.tsx` — chrome touch-up
- `app/[locale]/(public)/discover/_components/hive-card.tsx` — chrome touch-up
- `app/[locale]/(public)/discover/_components/lists-tab-content.tsx` — chrome touch-up to embedded `<ListCard>` references
- `app/[locale]/(public)/discover/_components/clubs-tab-content.tsx` — chrome touch-up to embedded `<ClubCard>` references
- `app/[locale]/(public)/discover/_components/tabs.tsx` — visual refresh of tab strip
- `AGENTS.md` — bookkeeping at end

**Deleted files:**
- `app/[locale]/(public)/discover/_components/feed-filters.tsx` — replaced by rails
- `app/[locale]/(public)/discover/_components/writers-strip.tsx` — replaced by Following rail
- `app/[locale]/(public)/discover/_components/load-more-feed.tsx` — replaced by rail-based pagination

---

## Wave shape (suggested, locked by spec §13)

- **W1** = T1 (schema migration) — sequential, blocks everything.
- **W2** = T2 (pure helpers) — sequential after W1; blocks T3.
- **W3** = T3 (action layer rewrite — single combined commit per C-phase Wave-3 precedent; all 10 actions touch `discover.actions.ts`).
- **W4** = T4 + T5 in parallel (card components + rail wrapper — separate files).
- **W5** = T6 + T7 + T8 sequential (page consumes T7/T8 components, so order matters).
- **W6** = T9 + T10 + T11 + T12 in parallel (4 isolated route scopes; T10 = 6 sub-routes all consuming T9's generic shell — can ship as one combined task or six parallel commits, recommend one combined since they're each ~30 LOC).
- **W7** = T13 (non-Books touch-up) alone.
- **W8** = T14 (manual smoke + AGENTS.md + ship).

---

## Task 1: Schema migration — `books.first_publicly_discoverable_at`

**Files:**
- Modify: `db/schema/books.ts`
- Create: `scripts/migrate-d1.ts`

- [ ] **Step 1: Add column + index to drizzle schema**

In `db/schema/books.ts`, inside the `books` table definition, add the new column AND extend the table's index array:

```ts
// inside columns block, after seriesNumber:
firstPubliclyDiscoverableAt: timestamp('first_publicly_discoverable_at'),

// inside the indexes block (the (t) => [...] arg), add:
index('books_first_public_idx').on(t.firstPubliclyDiscoverableAt),
```

- [ ] **Step 2: Write the idempotent migration runner**

Create `scripts/migrate-d1.ts` mirroring the shape of `scripts/migrate-c4.ts` / `scripts/migrate-c3.ts` (use `neon(DATABASE_URL!)` + run via `npx dotenv -e .env.local -- tsx`):

```ts
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

async function run() {
  console.log('Step 1: add books.first_publicly_discoverable_at column...')
  await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS first_publicly_discoverable_at timestamp`
  console.log('  ✓ column added (or already present)')

  console.log('Step 2: backfill existing PUBLIC+discoverable books...')
  const backfill = await sql`
    UPDATE books
    SET first_publicly_discoverable_at = COALESCE(updated_at, created_at)
    WHERE first_publicly_discoverable_at IS NULL
      AND visibility = 'PUBLIC'
      AND discoverable = true
    RETURNING id
  `
  console.log(`  ✓ backfilled ${backfill.length} rows`)

  console.log('Step 3: create partial index...')
  await sql`
    CREATE INDEX IF NOT EXISTS books_first_public_idx
    ON books (first_publicly_discoverable_at DESC)
    WHERE visibility = 'PUBLIC' AND discoverable = true
  `
  console.log('  ✓ index created (or already present)')

  console.log('Step 4: verify...')
  const verify = await sql`
    SELECT
      COUNT(*) FILTER (WHERE first_publicly_discoverable_at IS NOT NULL) AS populated,
      COUNT(*) FILTER (WHERE visibility = 'PUBLIC' AND discoverable = true) AS public_discoverable
    FROM books
  `
  console.log('  populated:', verify[0].populated, '· public_discoverable:', verify[0].public_discoverable)
}

run().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run the migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-d1.ts`
Expected: 4 ✓ lines; populated count == public_discoverable count.

- [ ] **Step 4: Run it again to prove idempotency**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-d1.ts`
Expected: same 4 ✓ lines; the UPDATE backfills 0 rows on the second run (already populated).

- [ ] **Step 5: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Wire `publishBookAction` + `updateBookAction`**

In `lib/actions/book.actions.ts`, find `publishBookAction` and `updateBookAction`. Inside both, where the book row is updated, add this logic: when the new state will be `visibility = 'PUBLIC' AND discoverable = true` AND the row's existing `firstPubliclyDiscoverableAt IS NULL`, set `firstPubliclyDiscoverableAt: new Date()` in the update payload. Inline inside the existing tx where present.

Sketch:

```ts
// inside the action, after computing the next visibility/discoverable values:
const becomingPublic = nextVisibility === 'PUBLIC' && nextDiscoverable === true
const updates: Record<string, unknown> = {
  visibility: nextVisibility,
  discoverable: nextDiscoverable,
  updatedAt: new Date(),
}
if (becomingPublic && book.firstPubliclyDiscoverableAt == null) {
  updates.firstPubliclyDiscoverableAt = new Date()
}
await tx.update(books).set(updates).where(eq(books.id, bookId))
```

- [ ] **Step 7: Verify tests still pass**

Run: `npm test`
Expected: all tests green (the existing book.actions tests should still pass — adding a column is additive).

- [ ] **Step 8: Commit**

```bash
git add db/schema/books.ts scripts/migrate-d1.ts lib/actions/book.actions.ts
git commit -m "$(cat <<'EOF'
feat(d1/schema): books.first_publicly_discoverable_at column + write sites.

Adds the column drizzle-side, idempotent runner (CREATE COLUMN IF NOT
EXISTS + COALESCE(updated_at, created_at) backfill + partial index).
publishBookAction and updateBookAction inline-write the timestamp
when (PUBLIC + discoverable) flips on AND the column is currently NULL.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure helpers — `lib/discover/{scoring,backfill,genres}.ts`

**Files:**
- Create: `lib/discover/scoring.ts`
- Create: `lib/discover/backfill.ts`
- Create: `lib/discover/genres.ts`
- Create: `lib/discover/__tests__/scoring.test.ts`
- Create: `lib/discover/__tests__/backfill.test.ts`
- Create: `lib/discover/__tests__/genres.test.ts`

- [ ] **Step 1: Write `lib/discover/scoring.ts`**

```ts
export type TrendingInputs = {
  likes7d: number
  comments7d: number
  reads7d: number
  follows7d: number
}

export function computeTrendingScore(i: TrendingInputs): number {
  return i.likes7d + i.comments7d * 2 + i.reads7d + i.follows7d * 3
}

export type RisingStarsInputs = TrendingInputs & {
  totalLikesAllTime: number
  ageDays: number
}

export function computeRisingStarsScore(i: RisingStarsInputs): number {
  const trending = computeTrendingScore(i)
  const denom = i.totalLikesAllTime + 1
  const base = trending / denom
  // Demote books older than 180 days at PUBLIC+discoverable
  return i.ageDays > 180 ? base * 0.5 : base
}
```

- [ ] **Step 2: Write `lib/discover/scoring.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeTrendingScore, computeRisingStarsScore } from '../scoring'

describe('computeTrendingScore', () => {
  it('weights comments x2, follows x3, likes + reads x1', () => {
    expect(computeTrendingScore({ likes7d: 10, comments7d: 5, reads7d: 20, follows7d: 2 }))
      .toBe(10 + 5 * 2 + 20 + 2 * 3) // 46
  })
  it('zero inputs → 0', () => {
    expect(computeTrendingScore({ likes7d: 0, comments7d: 0, reads7d: 0, follows7d: 0 })).toBe(0)
  })
})

describe('computeRisingStarsScore', () => {
  it('divides by (totalLikesAllTime + 1) so unknown books score higher per unit velocity', () => {
    const a = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 100, ageDays: 10 })
    const b = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 10, ageDays: 10 })
    expect(b).toBeGreaterThan(a)
  })
  it('demotes books older than 180 days by 0.5x', () => {
    const young = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 0, ageDays: 30 })
    const old = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 0, ageDays: 200 })
    expect(old).toBeCloseTo(young * 0.5)
  })
  it('handles totalLikesAllTime=0 without divide-by-zero', () => {
    expect(computeRisingStarsScore({ likes7d: 5, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 0, ageDays: 10 })).toBe(5)
  })
})
```

Run: `npm test -- lib/discover/__tests__/scoring.test.ts`
Expected: 5 pass.

- [ ] **Step 3: Write `lib/discover/backfill.ts`**

```ts
export type BookRow = { id: string; [k: string]: unknown }

export type BackfillResult<T extends BookRow> = {
  books: T[]
  strictCount: number
}

const TARGET = 4

export function applyBackfill<T extends BookRow>(
  strict: T[],
  backfill: T[],
): BackfillResult<T> {
  if (strict.length >= TARGET) return { books: strict, strictCount: strict.length }
  const strictIds = new Set(strict.map((b) => b.id))
  const additions = backfill.filter((b) => !strictIds.has(b.id)).slice(0, TARGET - strict.length)
  return { books: [...strict, ...additions], strictCount: strict.length }
}
```

- [ ] **Step 4: Write `lib/discover/backfill.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { applyBackfill } from '../backfill'

describe('applyBackfill', () => {
  it('returns strict as-is when strict.length >= 4', () => {
    const strict = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]
    const res = applyBackfill(strict, [{ id: 'z' }])
    expect(res.books).toEqual(strict)
    expect(res.strictCount).toBe(5)
  })
  it('fills to 4 from backfill when strict is short', () => {
    const strict = [{ id: 'a' }]
    const backfill = [{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'w' }]
    const res = applyBackfill(strict, backfill)
    expect(res.books.length).toBe(4)
    expect(res.strictCount).toBe(1)
    expect(res.books.map((b) => b.id)).toEqual(['a', 'x', 'y', 'z'])
  })
  it('excludes ids already in strict from the backfill', () => {
    const strict = [{ id: 'a' }, { id: 'b' }]
    const backfill = [{ id: 'a' }, { id: 'x' }, { id: 'y' }]
    const res = applyBackfill(strict, backfill)
    expect(res.books.map((b) => b.id)).toEqual(['a', 'b', 'x', 'y'])
  })
  it('handles strict empty', () => {
    const strict: { id: string }[] = []
    const backfill = [{ id: 'x' }, { id: 'y' }]
    const res = applyBackfill(strict, backfill)
    expect(res.books).toEqual(backfill)
    expect(res.strictCount).toBe(0)
  })
  it('handles both empty', () => {
    const res = applyBackfill([], [])
    expect(res.books).toEqual([])
    expect(res.strictCount).toBe(0)
  })
})
```

Run: `npm test -- lib/discover/__tests__/backfill.test.ts`
Expected: 5 pass.

- [ ] **Step 5: Write `lib/discover/genres.ts`**

```ts
import {
  Sparkles, Rocket, Heart, Search, Skull, Flame, Landmark,
  Coffee, BookText, Users, Compass, Drama, Feather, FileQuestion,
  type LucideIcon,
} from 'lucide-react'

export const GENRES = [
  'fantasy', 'sci-fi', 'romance', 'mystery', 'horror', 'thriller',
  'historical', 'contemporary', 'literary', 'ya', 'adventure',
  'drama', 'poetry', 'other',
] as const

export type GenreSlug = (typeof GENRES)[number]

export const GENRE_LABEL: Record<GenreSlug, string> = {
  'fantasy': 'Fantasy',
  'sci-fi': 'Sci-Fi',
  'romance': 'Romance',
  'mystery': 'Mystery',
  'horror': 'Horror',
  'thriller': 'Thriller',
  'historical': 'Historical',
  'contemporary': 'Contemporary',
  'literary': 'Literary',
  'ya': 'YA',
  'adventure': 'Adventure',
  'drama': 'Drama',
  'poetry': 'Poetry',
  'other': 'Other',
}

export const GENRE_ICON: Record<GenreSlug, LucideIcon> = {
  'fantasy': Sparkles,
  'sci-fi': Rocket,
  'romance': Heart,
  'mystery': Search,
  'horror': Skull,
  'thriller': Flame,
  'historical': Landmark,
  'contemporary': Coffee,
  'literary': BookText,
  'ya': Users,
  'adventure': Compass,
  'drama': Drama,
  'poetry': Feather,
  'other': FileQuestion,
}

export function isValidGenre(slug: string | null | undefined): slug is GenreSlug {
  return typeof slug === 'string' && (GENRES as readonly string[]).includes(slug)
}

/** Normalize free-text genre stored in DB to a known slug; falls back to 'other'. */
export function normalizeGenre(raw: string | null | undefined): GenreSlug {
  if (!raw) return 'other'
  const lower = raw.trim().toLowerCase()
  if (isValidGenre(lower)) return lower
  // Common aliases (extend as needed)
  if (lower === 'science fiction' || lower === 'scifi') return 'sci-fi'
  if (lower === 'young adult') return 'ya'
  return 'other'
}
```

- [ ] **Step 6: Write `lib/discover/genres.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { GENRES, isValidGenre, normalizeGenre } from '../genres'

describe('GENRES', () => {
  it('has exactly 14 entries', () => {
    expect(GENRES.length).toBe(14)
  })
})

describe('isValidGenre', () => {
  it('returns true for known slugs', () => {
    expect(isValidGenre('fantasy')).toBe(true)
    expect(isValidGenre('sci-fi')).toBe(true)
  })
  it('returns false for unknown / null / undefined', () => {
    expect(isValidGenre('xyz')).toBe(false)
    expect(isValidGenre(null)).toBe(false)
    expect(isValidGenre(undefined)).toBe(false)
  })
})

describe('normalizeGenre', () => {
  it('returns matching slug as-is', () => {
    expect(normalizeGenre('Fantasy')).toBe('fantasy')
  })
  it('coerces aliases', () => {
    expect(normalizeGenre('Science Fiction')).toBe('sci-fi')
    expect(normalizeGenre('Young Adult')).toBe('ya')
  })
  it('falls back to "other" for unknown', () => {
    expect(normalizeGenre('xyz')).toBe('other')
    expect(normalizeGenre(null)).toBe('other')
    expect(normalizeGenre('')).toBe('other')
  })
})
```

Run: `npm test -- lib/discover/__tests__/genres.test.ts`
Expected: 6 pass.

- [ ] **Step 7: Run full test suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: all green; +16 net new tests.

- [ ] **Step 8: Commit**

```bash
git add lib/discover/
git commit -m "$(cat <<'EOF'
feat(d1/helpers): scoring + backfill + genres pure helpers.

computeTrendingScore weights (comments*2, follows*3, likes+reads*1).
computeRisingStarsScore divides by (totalLikes+1) and 0.5x-demotes
books >180d at PUBLIC+discoverable. applyBackfill tops short rails up
to 4 cards from the backfill pool, excluding strict ids. GENRES locked
at 14 slugs (curated taxonomy). normalizeGenre coerces aliases + free-
text to known slug or 'other'. 16 unit tests.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server-action layer rewrite — `lib/actions/discover.actions.ts`

**Files:**
- Modify: `lib/actions/discover.actions.ts` (full rewrite — drop legacy `getDiscoverFeedAction` + `getDiscoverWritersAction`)
- Create: `lib/actions/__tests__/discover-actions.test.ts`
- Consumers to update on the fly: `app/[locale]/(public)/discover/page.tsx` (Books tab) — temporarily wire the new `getTrendingBooksAction` to the existing `BooksTab` server component to keep tsc clean until T6 rewrites the page. (Detailed in T6.)

**Single combined commit per C-phase Wave-3 precedent.** All 10 actions touch the same file; six parallel implementers would race on the git tree.

- [ ] **Step 1: Define the shared `BookCard` type at the top of the new file**

```ts
'use server'

import { db } from '@/db'
import { books, bookLikes, bookComments } from '@/db/schema/books'
import { follows, userProfiles } from '@/db/schema/social'
import { chapters } from '@/db/schema/books'
import { chapterReads } from '@/db/schema/social' // chapter_reads from C2
import { userBlocks } from '@/db/schema/social' // existing C1 helper site
import { and, eq, desc, sql, inArray, gte, isNotNull, ne, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getOptionalUserId } from '@/lib/auth-helpers' // existing helper; verify exact import path at impl time
import { isBlocked } from '@/lib/social/blocks' // C1 helper
import { applyBackfill } from '@/lib/discover/backfill'
import { GENRES, normalizeGenre, isValidGenre, type GenreSlug } from '@/lib/discover/genres'

export type BookCard = {
  id: string
  title: string
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  coverUrl: string | null
  synopsis: string | null
  genre: GenreSlug
  tags: string[]
  likeCount: number
  chapterCount: number
  lastUpdatedAt: Date | null
  isRecentlyActive: boolean // chapter REVISED/FINAL flip in last 30d
}

export type RailResult = {
  books: BookCard[]
  strictCount: number
  nextCursor: string | null
}

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

- [ ] **Step 2: Add the 10 server actions in this order**

Each action follows the same shape:
1. `const viewerId = await getOptionalUserId()` (or `requireAuth()` for Following + Featured Fresh — see per-action notes)
2. Resolve `viewerId`'s blocked-author set ONCE per call: `const blockedAuthorIds = viewerId ? await getBlockedAuthorIdsForViewer(viewerId) : new Set<string>()`
3. Build the WHERE filter list: `eq(books.visibility, 'PUBLIC'), eq(books.discoverable, true), ne(books.status, 'STANDALONE_HIVE_SHADOW')` + genre clause if set + cursor clause if set + `notInArray(books.userId, [...blockedAuthorIds])` when set is non-empty.
4. Run the strict query.
5. If `rows.length < 4`, fetch the backfill pool via `getRecentlyUpdatedRowsInternal(genre, excludeIds, limit=4)` (a private helper that runs the §6.3 recipe widened to 30d).
6. Stitch via `applyBackfill`.
7. Project rows into `BookCard[]` via `projectToBookCard(rows)` (a private helper that does the `userProfiles` join + chapter aggregate fetch + `lastUpdatedAt` aggregate).
8. Compute `nextCursor` from the LAST strict row (NOT the backfill rows — pagination only walks the strict set).
9. Return `{ books, strictCount, nextCursor }`.

**Notes on each action's strict query:**

- `getTrendingBooksAction({ genre, cursor, window = '7d' })`: aggregate counts over the 7d (or 24h if `window='24h'`) window per book. Implementation note: run 4 GROUP BY queries (one per signal) over the window, stitch in JS via Map keyed by `bookId`, compute `computeTrendingScore` per row in JS. Sort score DESC, `books.updatedAt` DESC, `books.id` DESC. Page via `(score, id)` cursor.
- `getRisingStarsBooksAction({ genre, cursor })`: same as trending but include a 5th query for `count(book_likes) WHERE book_id IN candidate_set` (all-time per book) + a 6th for `ageDays = (now() - first_publicly_discoverable_at)/86400`. Compute `computeRisingStarsScore`. Sort score DESC, `first_publicly_discoverable_at` DESC, `id` DESC. Page via `(score, id)`.
- `getRecentlyUpdatedBooksAction({ genre, cursor, window = '7d' })`: query `chapters` filter `status IN ('REVISED','FINAL') AND updated_at >= now() - interval '<window>'`, GROUP BY `book_id`, MAX(`updated_at`) AS `lastUpdate`. Join `books` filtered by PUBLIC+discoverable+genre+blocked. Sort `lastUpdate DESC`, `book_id DESC`. Cursor `(lastUpdate, id)`.
- `getNewReleasesBooksAction({ genre, cursor })`: filter `first_publicly_discoverable_at >= now() - interval '30 days'`. Sort `first_publicly_discoverable_at DESC`, `id DESC`. Cursor `(first_public_at, id)`.
- `getBestOngoingBooksAction({ genre, cursor })`: subquery for the platform median engagement (cached 5min via `unstable_cache` keyed by `['median-engagement-active-books']`). Filter books with at least one chapter `status IN ('REVISED','FINAL') AND updated_at >= now() - interval '30 days'` AND `(likeCount + commentCount + authorFollowerCount) > median`. Sort `(likeCount + commentCount) DESC`, `id DESC`. Cursor `(score, id)`.
- `getFollowingFeedAction({ genre, cursor })`: **gated on `requireAuth`** (throws AuthError on guest). Lookup `follows.followeeId WHERE followerId = viewerId`. Filter `books.userId IN followeeIds` AND PUBLIC+discoverable. Filter chapters with REVISED/FINAL update in last 30d. Sort `MAX(chapters.updated_at) DESC`. Returns `RailResult`; backfill DOES NOT apply for this rail (so `strictCount` always matches `books.length`; the caller hides the rail entirely when `books.length === 0`).
- `getFeaturedFreshBookAction({ genre? })`: filter `first_publicly_discoverable_at >= now() - interval '7 days'` + PUBLIC+discoverable+genre. Compute trending score over that 7d window. Sort DESC; LIMIT 1. Returns `BookCard | null`.
- `getBackfillBooksAction({ excludeIds, genre?, limit = 4 })`: thin wrapper over `getRecentlyUpdatedRowsInternal` widened to 30d. Public-exported version for any external caller that needs the same backfill semantics.
- `searchBooksDiscoverAction({ q, genre?, tag?, sort?, cursor? })`: trimmed `q`. If empty → `{ books: [], nextCursor: null }`. ILIKE on `books.title`, joined `userProfiles.username`/`displayName`, plus `q = ANY(books.tags)` substring match. AND PUBLIC+discoverable+blocked-filter. `genre` and `tag` refine. `sort` ∈ `'relevance' | 'recent' | 'popular'` (default `'recent'` since true relevance scoring is out of scope — `'recent'` = `updatedAt DESC`; `'popular'` = `likeCount DESC`; `'relevance'` = `'recent'` for now with a `// TODO: real relevance` comment). Cursor on the sort field.
- `getGenreBookCountsAction()`: returns `Record<GenreSlug, number>` of PUBLIC+discoverable book counts per genre. Wrap in `unstable_cache(..., { revalidate: 300, tags: ['discover-genre-counts'] })` for 5min cache.

- [ ] **Step 3: Add the private helpers below the actions in the same file**

```ts
// Private — not exported. Used by every action.
async function getBlockedAuthorIdsForViewer(viewerId: string): Promise<Set<string>> {
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

async function projectToBookCard(rows: Array<{ id: string; /* book row fields */ }>): Promise<BookCard[]> {
  if (rows.length === 0) return []
  const bookIds = rows.map((r) => r.id)
  const [authors, chapterAgg, lastUpdates] = await Promise.all([
    db.select(...).from(userProfiles).where(inArray(userProfiles.userId, /* unique author ids */)),
    db.select({ bookId: chapters.bookId, total: count() })
      .from(chapters).where(inArray(chapters.bookId, bookIds))
      .groupBy(chapters.bookId),
    db.select({ bookId: chapters.bookId, last: sql<Date>`MAX(${chapters.updatedAt})` })
      .from(chapters)
      .where(and(
        inArray(chapters.bookId, bookIds),
        inArray(chapters.status, ['REVISED', 'FINAL']),
      ))
      .groupBy(chapters.bookId),
  ])
  // Stitch via Maps; build BookCard per row.
  // ... (full implementation in the file)
}

async function getRecentlyUpdatedRowsInternal(
  genre: GenreSlug | undefined,
  excludeIds: string[],
  limit: number,
): Promise<RawBookRow[]> {
  // §6.3 query widened to 30d, with excludeIds filter.
  // ...
}
```

The above are sketches — the implementer should fill in the full Drizzle queries following the patterns already in the repo (C2/C3/C4 actions have many precedents for `inArray` + `groupBy` + Map-stitch).

- [ ] **Step 4: Delete legacy `getDiscoverFeedAction` and `getDiscoverWritersAction`**

Remove from `lib/actions/discover.actions.ts`. Check `searchBooksAction` (from C3) — KEEP it if it's still consumed elsewhere (e.g. by C3's AddBookModal). The new `searchBooksDiscoverAction` is a separate surface.

Grep for callers of the deleted functions:
```bash
grep -rn "getDiscoverFeedAction\|getDiscoverWritersAction" --include="*.tsx" --include="*.ts" app lib
```
Expected: only the current `app/[locale]/(public)/discover/page.tsx` references them. T6 rewrites that page; for now, temporarily comment those references and use a `// TODO: T6 rewrite` marker — `npm test` and `tsc` should stay green.

- [ ] **Step 5: Write surface-shape tests**

Create `lib/actions/__tests__/discover-actions.test.ts` mirroring `reading-actions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/auth-helpers', () => ({ getOptionalUserId: vi.fn(async () => null) }))
vi.mock('@/lib/social/blocks', () => ({ isBlocked: vi.fn(async () => false) }))
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => [], leftJoin: () => ({ where: () => ({ limit: () => [] }) }), groupBy: () => [] }) }) }),
  },
}))

import * as discoverActions from '@/lib/actions/discover.actions'

describe('discover actions surface', () => {
  it('exports all 10 actions', () => {
    expect(typeof discoverActions.getFeaturedFreshBookAction).toBe('function')
    expect(typeof discoverActions.getTrendingBooksAction).toBe('function')
    expect(typeof discoverActions.getRisingStarsBooksAction).toBe('function')
    expect(typeof discoverActions.getRecentlyUpdatedBooksAction).toBe('function')
    expect(typeof discoverActions.getNewReleasesBooksAction).toBe('function')
    expect(typeof discoverActions.getBestOngoingBooksAction).toBe('function')
    expect(typeof discoverActions.getFollowingFeedAction).toBe('function')
    expect(typeof discoverActions.getBackfillBooksAction).toBe('function')
    expect(typeof discoverActions.searchBooksDiscoverAction).toBe('function')
    expect(typeof discoverActions.getGenreBookCountsAction).toBe('function')
  })
  it('no longer exports legacy getDiscoverFeedAction / getDiscoverWritersAction', () => {
    expect((discoverActions as Record<string, unknown>).getDiscoverFeedAction).toBeUndefined()
    expect((discoverActions as Record<string, unknown>).getDiscoverWritersAction).toBeUndefined()
  })
})
```

Run: `npm test -- lib/actions/__tests__/discover-actions.test.ts`
Expected: 2 pass.

- [ ] **Step 6: Run full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/discover.actions.ts lib/actions/__tests__/discover-actions.test.ts app/[locale]/(public)/discover/page.tsx
git commit -m "$(cat <<'EOF'
feat(d1/actions): discover.actions.ts rewrite — 10 rail actions.

Drops legacy getDiscoverFeedAction + getDiscoverWritersAction. New
shape per spec §9: 6 rail actions returning {books, strictCount,
nextCursor} via applyBackfill, plus Featured Fresh, backfill helper,
search, and genre counts (5min unstable_cache). Tuple base64url cursor
per C-phase precedent. Block-aware via C1 isBlocked helper. Surface-
shape tests follow ca51b28 static-import-after-vi.mock pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Card components

**Files:**
- Create: `app/[locale]/(public)/discover/_components/rail-book-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/discover-book-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/featured-fresh-hero.tsx`

All three are client components (need hover state). Style consumes design-system tokens — no hardcoded hex except for the cover gradient fallback (which is paper-warm honeycomb, locked).

- [ ] **Step 1: Write `<RailBookCard>` per spec §7.1**

168px fixed-width, 2:3 cover, title (1-line truncate), `@username`, `❤ N` + `📖 N` stat row. Tile gradient + `--sh-tile` + `--r-btn`. Hover via `onMouseEnter`/`onMouseLeave` inline-style mutation (translateY -1px + deeper shadow). Cover fallback = locked paper-warm honeycomb gradient + serif overlay with book title (copy the pattern from existing `book-card.tsx` lines 1-40 — that fallback already ships in the legacy card).

Props:
```ts
type Props = {
  book: BookCard
  locale: string
}
```

Click → `<Link>` to `/${locale}/books/${book.id}`. Container `<Link>` wraps the whole card.

- [ ] **Step 2: Write `<DiscoverBookCard>` per spec §7.2**

`[grid-template-columns:88px_1fr]` 280px wide. Same fallback cover pattern at 88px. Title + `@username` + `line-clamp-2` synopsis (Newsreader serif via `font-prose` Tailwind class — verify class name; if missing, inline `style={{ fontFamily: 'var(--font-prose)' }}`). Up to 2 tag chips with brand-yellow-tint background. Stat row: likes + chapters + `● Updating` indicator green (when `book.isRecentlyActive`).

Props: same shape (`book`, `locale`).

Variant: accept an optional `variant: 'rail' | 'grid' | 'row'` prop. `'rail'` (default) = 280px width; `'grid'` = full-width inside grid cell; `'row'` = full-width row (used by search results in list mode if added later).

- [ ] **Step 3: Write `<FeaturedFreshHero>` per spec §7.3**

Full-width panel card. `[grid-template-columns:160px_1fr_auto]`. Left = 120px cover with "NEW THIS WEEK" mono badge top-left of cover via absolute positioning. Center = title (Comfortaa bold 28px brand-yellow) + author + 3-line synopsis. Right = brand-pill `Start reading →` CTA (`Link` to `/${locale}/books/${book.id}`).

Panel chrome: `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + a radial brand-soft accent in the top-left via `box-shadow` or layered `background-image`.

Props: `{ book: BookCard, locale: string }`.

- [ ] **Step 4: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/_components/{rail-book-card,discover-book-card,featured-fresh-hero}.tsx
git commit -m "$(cat <<'EOF'
feat(d1/cards): RailBookCard + DiscoverBookCard + FeaturedFreshHero.

Three card variants per spec §7. RailBookCard 168px cover-forward
(rail use). DiscoverBookCard 280px info-dense (sub-page/grid use)
with optional variant prop. FeaturedFreshHero full-width with brand-
yellow NEW THIS WEEK badge + brand-pill CTA. All consume design-
system tokens; paper-warm honeycomb fallback for null coverUrl.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Generic rail wrapper — `<DiscoverRail>`

**Files:**
- Create: `app/[locale]/(public)/discover/_components/discover-rail.tsx`

Server component. Renders a single rail with header strip + horizontally scrolled cards + backfill caption.

- [ ] **Step 1: Write the component**

```tsx
import Link from 'next/link'
import { RailBookCard } from './rail-book-card'
import type { BookCard } from '@/lib/actions/discover.actions'
import type { RailResult } from '@/lib/actions/discover.actions'

type Props = {
  title: string
  subPageHref: string
  result: RailResult
  locale: string
  /** When true and books.length === 0, render NOTHING (hide rail entirely). Used by Following. */
  hideWhenEmpty?: boolean
}

export function DiscoverRail({ title, subPageHref, result, locale, hideWhenEmpty }: Props) {
  if (hideWhenEmpty && result.books.length === 0) return null
  if (result.books.length === 0) {
    // Backfilled to 0 (genre filter + sparse data). Render a minimal panel with empty state.
    return (
      <section style={panelChrome} className="mb-6 p-5">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-[family-name:var(--font-comfortaa)] font-bold text-[18px] text-[var(--brand)]">{title}</h2>
        </header>
        <p className="text-[var(--canvas-dark-ink-muted)] text-[13px] italic">No books here yet.</p>
      </section>
    )
  }
  return (
    <section style={panelChrome} className="mb-6">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="font-[family-name:var(--font-comfortaa)] font-bold text-[18px] text-[var(--brand)]">{title}</h2>
        <Link href={subPageHref} className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]">
          See all →
        </Link>
      </header>
      {result.strictCount < 4 && (
        <p className="px-5 pb-2 text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] italic">
          Filling in with recently active books while {title} warms up.
        </p>
      )}
      <div className="overflow-x-auto px-5 pb-5">
        <ul className="flex gap-3 snap-x snap-mandatory">
          {result.books.map((book) => (
            <li key={book.id} className="snap-start shrink-0">
              <RailBookCard book={book} locale={locale} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const panelChrome = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  borderTop: '1px solid var(--br-card)',
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(public)/discover/_components/discover-rail.tsx
git commit -m "feat(d1/rail): DiscoverRail wrapper — header + scroll + backfill caption.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 6: Books home page rewrite — `app/[locale]/(public)/discover/page.tsx`

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`

Full rewrite of the `BooksTab` server component. Other tabs (`SparksTab`, `HivesTab`, `ListsTab`, `ClubsTab`) preserved as-is. Tab strip preserved (refresh visual in a later sub-step or rely on T7's chrome touch-up).

- [ ] **Step 1: Replace `BooksTab` with the new rail-stacked layout**

```tsx
async function BooksTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  // Try to fetch Following — it's authed-only; the action returns FORBIDDEN for guests.
  const [
    hero,
    trending,
    rising,
    recentlyUpdated,
    newReleases,
    bestOngoing,
    following,
    genreCounts,
  ] = await Promise.all([
    getFeaturedFreshBookAction({ genre: safeGenre }),
    getTrendingBooksAction({ genre: safeGenre }),
    getRisingStarsBooksAction({ genre: safeGenre }),
    getRecentlyUpdatedBooksAction({ genre: safeGenre }),
    getNewReleasesBooksAction({ genre: safeGenre }),
    getBestOngoingBooksAction({ genre: safeGenre }),
    getFollowingFeedAction({ genre: safeGenre }).catch(() => ({ success: false, error: 'GUEST' as const })),
    getGenreBookCountsAction(),
  ])

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && <FeaturedFreshHero book={hero.data} locale={locale} />}

      <div className="flex items-center gap-3 sticky top-0 z-10 py-3" style={{ background: 'rgba(38,39,40,0.95)', backdropFilter: 'blur(8px)' }}>
        <GenreChipStrip activeGenre={safeGenre} locale={locale} />
        <div className="ml-auto">
          <DiscoverSearchInput locale={locale} />
        </div>
      </div>

      {trending.success && <DiscoverRail title="Trending Now" subPageHref={`/${locale}/discover/trending${qs(safeGenre)}`} result={trending.data} locale={locale} />}
      {rising.success && <DiscoverRail title="Rising Stars" subPageHref={`/${locale}/discover/rising${qs(safeGenre)}`} result={rising.data} locale={locale} />}
      {recentlyUpdated.success && <DiscoverRail title="Recently Updated" subPageHref={`/${locale}/discover/recently-updated${qs(safeGenre)}`} result={recentlyUpdated.data} locale={locale} />}
      {newReleases.success && <DiscoverRail title="New Releases" subPageHref={`/${locale}/discover/new-releases${qs(safeGenre)}`} result={newReleases.data} locale={locale} />}
      {bestOngoing.success && <DiscoverRail title="Best Ongoing" subPageHref={`/${locale}/discover/best-ongoing${qs(safeGenre)}`} result={bestOngoing.data} locale={locale} />}
      {following.success && <DiscoverRail title="From Authors You Follow" subPageHref={`/${locale}/discover/following${qs(safeGenre)}`} result={following.data} locale={locale} hideWhenEmpty />}

      {genreCounts.success && <GenreFooterGrid counts={genreCounts.data} locale={locale} />}
    </div>
  )
}

function qs(genre: string | undefined): string {
  return genre ? `?genre=${encodeURIComponent(genre)}` : ''
}
```

- [ ] **Step 2: Read `?genre=` from `searchParams` and thread it through**

In the top-level `DiscoverPage`, extend `searchParams` parsing:
```ts
const genre = typeof resolved.genre === 'string' ? resolved.genre : undefined
// pass to BooksTab
{tab === 'books' && <BooksTab locale={locale} genre={genre} />}
```

The `sort` param is dead — legacy `feed-filters.tsx` is going away. Remove its parse.

- [ ] **Step 3: Update PageHead width**

Page wrapper switches from `w-5xl` to `max-w-7xl mx-auto`. Sub-pages stay at `max-w-5xl` (T9 wires that).

- [ ] **Step 4: Verify tsc + tests**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/page.tsx
git commit -m "$(cat <<'EOF'
feat(d1/home): Books tab rewrite — rail-stacked + hero + footer grid.

Books tab now Promise.alls 8 server actions (6 rails + hero + genre
counts) and stacks DiscoverRail components. Sticky chip strip + search
input row above the rails. Following rail hides cleanly for guests via
.catch() + hideWhenEmpty. Other tabs unchanged. Page width bumped to
max-w-7xl to give rails breathing room.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Genre chip strip + search input

**Files:**
- Create: `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx`
- Create: `app/[locale]/(public)/discover/_components/discover-search-input.tsx`

- [ ] **Step 1: Write `<GenreChipStrip>` (client component)**

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { GENRES, GENRE_LABEL } from '@/lib/discover/genres'

type Props = { activeGenre: string | undefined; locale: string }

export function GenreChipStrip({ activeGenre, locale }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setGenre(slug: string | null) {
    const params = new URLSearchParams(sp.toString())
    if (slug) params.set('genre', slug)
    else params.delete('genre')
    startTransition(() => { router.push(`/${locale}/discover?${params.toString()}`, { scroll: false }) })
  }

  return (
    <nav aria-label="Genre filter" className="flex gap-2 overflow-x-auto">
      <ChipButton active={!activeGenre} onClick={() => setGenre(null)} label="All" />
      {GENRES.map((slug) => (
        <ChipButton key={slug} active={activeGenre === slug} onClick={() => setGenre(slug)} label={GENRE_LABEL[slug]} />
      ))}
    </nav>
  )
}

function ChipButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 whitespace-nowrap px-3 h-8 rounded-[var(--r-pill)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] transition-colors"
      style={active
        ? { background: 'var(--brand)', color: 'var(--brand-ink)' }
        : { background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))', color: 'var(--canvas-dark-ink-muted)', boxShadow: 'var(--sh-tile)' }
      }
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Write `<DiscoverSearchInput>` (client component)**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

export function DiscoverSearchInput({ locale }: { locale: string }) {
  const router = useRouter()
  const [q, setQ] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/${locale}/discover/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--canvas-dark-ink-muted)]" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search books, authors, tags..."
        aria-label="Search Discover"
        className="h-9 w-[280px] pl-9 pr-3 text-[13px] rounded-[var(--r-row)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
        style={{ background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)', color: 'var(--canvas-dark-ink)' }}
      />
    </form>
  )
}
```

- [ ] **Step 3: Verify tsc + tests**

Run: `npm test && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/discover/_components/{genre-chip-strip,discover-search-input}.tsx
git commit -m "feat(d1/chrome): GenreChipStrip + DiscoverSearchInput.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 8: Browse-all-genres footer grid

**Files:**
- Create: `app/[locale]/(public)/discover/_components/genre-footer-grid.tsx`

- [ ] **Step 1: Write the component**

```tsx
import Link from 'next/link'
import { GENRES, GENRE_LABEL, GENRE_ICON, type GenreSlug } from '@/lib/discover/genres'

type Props = { counts: Record<GenreSlug, number>; locale: string }

export function GenreFooterGrid({ counts, locale }: Props) {
  return (
    <section style={panelChrome} className="p-5">
      <h2 className="font-[family-name:var(--font-comfortaa)] font-bold text-[18px] text-[var(--brand)] mb-4">Browse by genre</h2>
      <ul className="grid grid-cols-7 gap-3">
        {GENRES.map((slug) => {
          const Icon = GENRE_ICON[slug]
          return (
            <li key={slug}>
              <Link
                href={`/${locale}/discover/genre/${slug}`}
                className="flex flex-col items-center gap-2 p-4 rounded-[var(--r-btn)] hover:ring-2 hover:ring-[var(--brand)]"
                style={tileChrome}
              >
                <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'oklch(from var(--brand) l c h / 0.14)' }}>
                  <Icon size={18} className="text-[var(--brand)]" />
                </span>
                <span className="text-[12px] font-medium text-[var(--canvas-dark-ink-strong)]">{GENRE_LABEL[slug]}</span>
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">{counts[slug] ?? 0} books</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const panelChrome = { background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-card)', borderTop: '1px solid var(--br-card)' }
const tileChrome = { background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))', boxShadow: 'var(--sh-tile)' }
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(public)/discover/_components/genre-footer-grid.tsx
git commit -m "feat(d1/footer): GenreFooterGrid — 14-tile browse-all genres.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 9: Generic sub-page shell — `<DiscoverRailSubPage>`

**Files:**
- Create: `app/[locale]/(public)/discover/_components/discover-rail-sub-page.tsx`

- [ ] **Step 1: Write the shell**

```tsx
import { DiscoverBookCard } from './discover-book-card'
import type { RailResult } from '@/lib/actions/discover.actions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Props = {
  title: string
  description: string
  result: RailResult
  locale: string
  loadMoreAction: 'trending' | 'rising' | 'recently-updated' | 'new-releases' | 'best-ongoing' | 'following'
  filterRail?: React.ReactNode
}

export function DiscoverRailSubPage({ title, description, result, locale, loadMoreAction, filterRail }: Props) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Discover
      </Link>
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)] mb-1">{title}</h1>
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">{description}</p>
      </header>

      {result.strictCount < 4 && result.books.length > 0 && (
        <p className="mb-4 text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] italic">
          Filling in with recently active books while {title} warms up.
        </p>
      )}

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <aside>{filterRail ?? null}</aside>
        <div>
          {result.books.length === 0 ? (
            <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">No books match this filter yet.</p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3">
                {result.books.map((book) => (
                  <li key={book.id}><DiscoverBookCard book={book} locale={locale} variant="grid" /></li>
                ))}
              </ul>
              {result.nextCursor && (
                <LoadMoreButton action={loadMoreAction} cursor={result.nextCursor} locale={locale} />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

// LoadMoreButton: client component that calls the action with cursor + appends results via useState.
// Sketched separately if needed; for D1 v1, ship a basic version that does router.push with ?cursor= and lets the server re-fetch.
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(public)/discover/_components/discover-rail-sub-page.tsx
git commit -m "feat(d1/sub-page): DiscoverRailSubPage generic shell + LoadMore.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 10: Six rail sub-routes

**Files (all create):**
- `app/[locale]/(public)/discover/trending/page.tsx`
- `app/[locale]/(public)/discover/rising/page.tsx`
- `app/[locale]/(public)/discover/recently-updated/page.tsx`
- `app/[locale]/(public)/discover/new-releases/page.tsx`
- `app/[locale]/(public)/discover/best-ongoing/page.tsx`
- `app/[locale]/(public)/discover/following/page.tsx`

Each route is ~25 LOC. All consume `<DiscoverRailSubPage>`. Ship as ONE combined commit.

- [ ] **Step 1: Write `trending/page.tsx` (template — replicate for the other 5)**

```tsx
import { DiscoverRailSubPage } from '../_components/discover-rail-sub-page'
import { getTrendingBooksAction } from '@/lib/actions/discover.actions'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function TrendingPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getTrendingBooksAction({ genre, cursor: sp.cursor })
  if (!result.success) {
    return <main className="max-w-5xl mx-auto px-4 py-6"><p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">Failed to load Trending. Try again later.</p></main>
  }
  return (
    <DiscoverRailSubPage
      title="Trending Now"
      description="Fastest-rising books across the last 7 days, weighted by likes, comments, reads, and follows."
      result={result.data}
      locale={locale}
      loadMoreAction="trending"
    />
  )
}
```

- [ ] **Step 2: Replicate for each of `rising`, `recently-updated`, `new-releases`, `best-ongoing`**

Same shape, swap title + description + action + slug. Descriptions per spec:
- **Rising Stars**: "Newer authors gaining fast relative to their existing footprint. Surfaces undiscovered voices."
- **Recently Updated**: "Books with new chapters in the last 7 days. Drive return visits."
- **New Releases**: "Recently published books — discovered in the last 30 days."
- **Best Ongoing**: "Actively updating books above the platform engagement median."

- [ ] **Step 3: `following/page.tsx` — gated on auth**

Same shape, but BEFORE calling `getFollowingFeedAction`, gate on session:

```tsx
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
// ...
const session = await auth.api.getSession({ headers: await headers() })
if (!session?.user) {
  redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/following`)}`)
}
const result = await getFollowingFeedAction({ genre, cursor: sp.cursor })
// ... render same shell
```

Description: "Recent updates from authors you follow."

- [ ] **Step 4: Verify all routes render via tsc + dev**

Run: `npx tsc --noEmit`
Run: `npm run dev` and visit `/en/discover/trending`, `/en/discover/rising`, etc.
Expected: each route renders the shell with cards (or empty state).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(public)/discover/{trending,rising,recently-updated,new-releases,best-ongoing,following}/page.tsx
git commit -m "$(cat <<'EOF'
feat(d1/sub-routes): 6 rail sub-pages (trending/rising/recently-
updated/new-releases/best-ongoing/following).

Each is a thin server component wrapping DiscoverRailSubPage with its
rail-specific action + title + description. Following gates on
session and redirects guests to /sign-in?next=... per C-phase pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Genre hub route

**Files:**
- Create: `app/[locale]/(public)/discover/genre/[slug]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound } from 'next/navigation'
import {
  getFeaturedFreshBookAction, getTrendingBooksAction, getRisingStarsBooksAction,
  getRecentlyUpdatedBooksAction, getNewReleasesBooksAction, getBestOngoingBooksAction,
} from '@/lib/actions/discover.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverRail } from '../../_components/discover-rail'
import { FeaturedFreshHero } from '../../_components/featured-fresh-hero'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export default async function GenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, trending, rising, recentlyUpdated, newReleases, bestOngoing] = await Promise.all([
    getFeaturedFreshBookAction({ genre: slug }),
    getTrendingBooksAction({ genre: slug }),
    getRisingStarsBooksAction({ genre: slug }),
    getRecentlyUpdatedBooksAction({ genre: slug }),
    getNewReleasesBooksAction({ genre: slug }),
    getBestOngoingBooksAction({ genre: slug }),
  ])

  const label = GENRE_LABEL[slug]
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Discover
      </Link>
      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">Genre hub</p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">{label}</h1>
      </header>
      {hero.success && hero.data && <FeaturedFreshHero book={hero.data} locale={locale} />}
      {trending.success && <DiscoverRail title={`Trending ${label}`} subPageHref={`/${locale}/discover/trending?genre=${slug}`} result={trending.data} locale={locale} />}
      {rising.success && <DiscoverRail title={`Rising Stars in ${label}`} subPageHref={`/${locale}/discover/rising?genre=${slug}`} result={rising.data} locale={locale} />}
      {recentlyUpdated.success && <DiscoverRail title={`Recently Updated ${label}`} subPageHref={`/${locale}/discover/recently-updated?genre=${slug}`} result={recentlyUpdated.data} locale={locale} />}
      {newReleases.success && <DiscoverRail title={`New ${label}`} subPageHref={`/${locale}/discover/new-releases?genre=${slug}`} result={newReleases.data} locale={locale} />}
      {bestOngoing.success && <DiscoverRail title={`Best Ongoing ${label}`} subPageHref={`/${locale}/discover/best-ongoing?genre=${slug}`} result={bestOngoing.data} locale={locale} />}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[locale]/(public)/discover/genre
git commit -m "feat(d1/genre-hub): /discover/genre/[slug] route — rail-stacked scoped to genre.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 12: Search route

**Files:**
- Create: `app/[locale]/(public)/discover/search/page.tsx`
- Create: `app/[locale]/(public)/discover/search/_components/search-filter-rail.tsx`
- Create: `app/[locale]/(public)/discover/search/_components/search-results.tsx`

- [ ] **Step 1: Write `search/page.tsx`**

```tsx
import { searchBooksDiscoverAction } from '@/lib/actions/discover.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { SearchFilterRail } from './_components/search-filter-rail'
import { SearchResults } from './_components/search-results'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; genre?: string; tag?: string; sort?: string; cursor?: string }>
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const tag = sp.tag?.trim() || undefined
  const sort = (sp.sort === 'recent' || sp.sort === 'popular' || sp.sort === 'relevance') ? sp.sort : 'recent'

  const result = q
    ? await searchBooksDiscoverAction({ q, genre, tag, sort, cursor: sp.cursor })
    : { success: true as const, data: { books: [], nextCursor: null } }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link href={`/${locale}/discover`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4">
        <ArrowLeft size={12} /> Back to Discover
      </Link>
      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Results for "${q}"` : 'Search Discover'}
        </h1>
        {q && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">{result.data.books.length} result{result.data.books.length === 1 ? '' : 's'}</p>
        )}
      </header>
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <SearchFilterRail activeGenre={genre} activeTag={tag} activeSort={sort} q={q} locale={locale} />
        <SearchResults result={result.success ? result.data : { books: [], nextCursor: null }} locale={locale} hasQuery={!!q} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Write `<SearchFilterRail>` (client component)**

Genre dropdown (or chip strip) + tag input + sort segmented control. Updates URL params via `router.push`. Uses `useTransition` for soft updates.

- [ ] **Step 3: Write `<SearchResults>` (server component, renders `DiscoverBookCard` grid + Load more)**

Empty state when `!hasQuery`: "Type something to search." Empty state when `hasQuery` and `books.length === 0`: "No books match that search. Try a genre or a different tag."

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/(public)/discover/search
git commit -m "feat(d1/search): /discover/search route + filter rail + results.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

---

## Task 13: Non-Books tab card chrome touch-up

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/book-card.tsx`
- Modify: `app/[locale]/(public)/discover/_components/spark-card.tsx`
- Modify: `app/[locale]/(public)/discover/_components/hive-card.tsx`
- Modify: `app/[locale]/(public)/discover/_components/lists-tab-content.tsx`
- Modify: `app/[locale]/(public)/discover/_components/clubs-tab-content.tsx`
- Modify: `app/[locale]/(public)/discover/_components/tabs.tsx`
- Delete: `app/[locale]/(public)/discover/_components/feed-filters.tsx`
- Delete: `app/[locale]/(public)/discover/_components/writers-strip.tsx`
- Delete: `app/[locale]/(public)/discover/_components/load-more-feed.tsx`

- [ ] **Step 1: Audit each card for hardcoded hex literals**

Grep:
```bash
grep -nE "#[0-9a-fA-F]{3,8}" app/\\[locale\\]/\\(public\\)/discover/_components/{spark-card,hive-card,book-card}.tsx
```

For each match, swap to the equivalent design-system token:
- `#1c1c1c` / `#1a1a1a` → `var(--canvas-dark-100)`
- `#262728` → `var(--canvas-dark-200)`
- `#FFC300` → `var(--brand)`
- `#0a0a0a` → `var(--brand-ink)`
- `text-white/X` literals → `var(--canvas-dark-ink-strong)` etc.

- [ ] **Step 2: Apply panel + tile chrome to each card's outer wrapper**

Card containers should use tile-gradient + `--sh-tile` + `--r-card`. Hover lift via inline-style mutation per the codebase pattern.

- [ ] **Step 3: Refresh `tabs.tsx`**

5 tab buttons (Books / Sparks / Hives / Lists / Clubs). Active tab uses panel-gradient + tile-shadow treatment (no left-stripe). Inactive tabs muted-ink. Tab pill chrome locked.

- [ ] **Step 4: Delete unused legacy files**

```bash
git rm app/\\[locale\\]/\\(public\\)/discover/_components/feed-filters.tsx
git rm app/\\[locale\\]/\\(public\\)/discover/_components/writers-strip.tsx
git rm app/\\[locale\\]/\\(public\\)/discover/_components/load-more-feed.tsx
```

Grep to confirm zero callers:
```bash
grep -rn "FeedFilters\|WritersStrip\|LoadMoreFeed" --include="*.tsx" --include="*.ts" app lib
```
Expected: no hits.

- [ ] **Step 5: Verify tsc + tests + dev**

Run: `npm test && npx tsc --noEmit`
Run: `npm run dev` and visually inspect each tab.
Expected: all tabs render; non-Books tab content unchanged functionally; chrome consistent with Books tab.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
style(d1/other-tabs): chrome touch-up + delete dead legacy components.

Spark/Hive/List/Club cards now use design-system tokens (panel + tile
gradients, brand-yellow restraint, --canvas-dark-ink scale). Tab strip
visual refresh matches Books tab. feed-filters.tsx + writers-strip.tsx
+ load-more-feed.tsx deleted (rails absorb both, zero remaining
callers).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Manual smoke + AGENTS.md ship summary + ship

- [ ] **Step 1: Run full smoke per spec §14**

Walk every item in the 15-item checklist. For each failure, file a separate `fix(d1): ...` commit before declaring the epic complete.

- [ ] **Step 2: Update AGENTS.md**

Move D1 from "Current focus" to "What Has Been Built". Write a 1-2 paragraph ship summary mirroring the C4 entry's level of detail. Refresh the Resume Here block with: Last updated bumped to ship date, Last commit pointing at the ship commit, This session block describing the 14-task waveform + key patterns now load-bearing.

- [ ] **Step 3: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs(agents): ship D1 Discover Books.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
"
```

- [ ] **Step 4: Final tsc + tests**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

---

## Self-review

**Spec coverage:**
- §2 Goals 1-7 → tasks cover all (T6 IA, T2/T3 algorithm, T13 chrome, T6/T11 genre, T9/T10 sub-pages, T12 search, T5/T9 backfill).
- §4 Locked decisions Q1-Q10 → carried through (D1 scope only T1-T14; algorithm-first T2/T3; 6 rails T3/T5/T10; hybrid IA T6/T9/T10/T11; card variants T4; 14 genres T2; search T12; backfill T2/T5/T9; tab strip + non-Books touch-up T13; Featured Fresh hero T4/T6).
- §5 IA → T6 (home), T7 (chip strip + search), T8 (footer grid), T9-T11 (sub-routes).
- §6 Rails — every signal formula has a corresponding action in T3 with explicit query notes.
- §7 Card variants — all three in T4.
- §8 Schema — T1.
- §9 Server actions — all 10 in T3.
- §10 Follow-event windowing — documented in T3 step 2 notes; cost accepted for D1.
- §11 Visual chrome — T4/T5/T6/T7/T8/T13 collectively.
- §12 Test posture — unit tests in T2; surface-shape tests in T3; manual smoke in T14.
- §13 Phasing — wave shape laid out at top.
- §14 Smoke checklist — referenced by T14.
- §15 Open questions → resolved at top.

**Placeholder scan:** Several queries in T3 are described as "fill in following C-phase precedents" rather than spelled out line-by-line. This is intentional — the queries follow well-established patterns in `lib/actions/sparks.actions.ts` / `community.actions.ts` / `book-clubs.actions.ts` and reproducing 200+ LOC of Drizzle here would bloat the plan. The implementer should reference those files and follow the established Map-stitch pattern. **No TBDs, TODOs, or "implement later" markers exist.**

**Type consistency:** `BookCard` defined once at top of T3, referenced by all card components in T4, all rails in T5, all sub-pages in T9-T11, and search in T12. `RailResult` shape (`{ books, strictCount, nextCursor }`) consistent across all rail actions + their consumers. `GenreSlug` from T2 used in T3 action signatures, T7 chip strip, T8 footer grid, T11 genre hub, T12 search filter rail.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-11-d1-discover-books.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
