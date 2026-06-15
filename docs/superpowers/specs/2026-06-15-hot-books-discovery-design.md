# Hot Books Discovery Surface (Design Spec)

**Date:** 2026-06-15
**Replaces:** the slim "★ FEATURED · {title}" strip currently rendered at the top of `/discover?tab=books`.
**Status:** Locked via brainstorm session, awaiting implementation plan.
**Follow-on:** Pattern is intended to extend to Sparks / Hives / Lists / Clubs in a later pass; Books is the proving ground.

---

## 1. Intent

The current `/discover?tab=books` surface treats discovery as a sort-dropdown choice. To find what's hot a reader has to pick "Trending" from a dropdown, which mixes "what's currently popular" with "alphabetize" and "show most recent" in a single small affordance. Readers signal a preference once (sort) and the surface doesn't help them switch postures (browse trending vs browse personally relevant).

This redesign promotes discovery posture to a first-class prominent control — a 4-mode iOS segmented toggle at the top of the grid — and adds a personalized **For You** mode that ranks via a 3-tier hybrid of follow-graph signal, taste-vector genre match, and trending fallback.

After this ships, readers can scan today's hot stories without thinking about how to sort, and authed readers with any signal get a feed tailored to who they follow + what they like + what they write.

## 2. Decisions

| Q | Decision |
|---|----------|
| Q1 — Layout | iOS segmented control above the grid where the Featured strip used to live. Style matches the dark-iOS sidebar tile (`rgba(255,255,255,0.04)` container, brand-yellow active pill). Replaces the Featured strip entirely. |
| Q2 — Modes | **For You · Trending · Popular · All** (left to right). For You hidden for guests; guests see 3 modes. |
| Q3 — Sort dropdown | Narrowed from 4 options to 2: **Most recent · A-Z**. Mode picks the slice, sort orders it as a tie-breaker only. |
| Q4 — For You algorithm | 3-tier hybrid: (T1) books from followed authors not already liked/read; (T2) books matching viewer's top 3 genres ranked by trending score; (T3) trending books in the platform's top genres as fallback. Tiers stitched proportionally per page (6/4/2 split per 12-card page). |
| Q5 — Default mode | Authed + ≥1 signal → For You. Authed + zero signals → Trending. Guest → Trending. The For You button is hidden entirely for guests. |
| Q6 — Schema | NO schema changes. All signals computed at query time from existing tables (follows, bookLikes, books). |
| Q7 — Pagination | Each mode change resets to page 1. Mode survives filter changes. URL param `?mode=X` introduced. |

## 3. Page IA

`/[locale]/discover?tab=books` renders in this stacking order under the existing PageHead + tab strip + DiscoverShell sidebar:

1. **DiscoveryModeToggle** — iOS segmented control (new component). 4 buttons authed, 3 buttons guest (For You omitted).
2. **SortHeader** — existing component, but sort options narrowed to `Most recent · A-Z`.
3. **ActiveFilterChips** — unchanged.
4. **4-col grid** of `<BookGridCard>` — unchanged.
5. **NumberedPagination** — unchanged.

The slim `<SlimFeaturedStrip kind="book">` is dropped from the Books grid composition entirely.

## 4. DiscoveryModeToggle component

`app/[locale]/(public)/discover/_components/discovery-mode-toggle.tsx`

```tsx
type Mode = 'for-you' | 'trending' | 'popular' | 'all'

type Props = {
  current: Mode
  isAuthed: boolean
  /** Optional copy override per entity context. Default 'discover'. */
  context?: 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'
}
```

- Outer container: rounded-xl `rgba(255,255,255,0.04)` pill matching sidebar tile style.
- 3 buttons (guest) or 4 buttons (authed) inside, each ~110px wide. Active button is brand-yellow with `var(--brand-ink)` text.
- Icons: `Sparkles` (For You), `Flame` (Trending), `Star` (Popular), `Library` (All).
- Clicks navigate via `router.replace` using a small `useFilterNav`-style helper that writes `?mode=X` (omit when default).
- Renders nothing when only one mode is visible (defensive — current code paths always show ≥3).

## 5. Algorithm — For You 3-tier hybrid

### 5.1 Tier 1 — Followed authors

For viewerId V (where "already read" = the viewer has any row in `chapter_reads` for any chapter of the book):

```sql
SELECT b.* FROM books b
WHERE b.user_id IN (SELECT followee_id FROM follows WHERE follower_id = V)
  AND b.visibility = 'PUBLIC' AND b.discoverable = true
  AND b.status != 'STANDALONE_HIVE_SHADOW'
  AND b.id NOT IN (SELECT book_id FROM book_likes WHERE user_id = V)
  AND b.id NOT IN (SELECT book_id FROM chapter_reads WHERE user_id = V)
ORDER BY b.updated_at DESC
LIMIT 60
```

### 5.2 Tier 2 — Taste-vector genre match

Compute the viewer's top 3 genres:
```ts
type GenreSignal = Record<GenreSlug, number>
const tasteVector: GenreSignal = {}

// Books liked × 3
for (const like of viewerBookLikes) tasteVector[like.book.genre] += 3
// Authors followed × 2 — sum each followed author's most-recent published book's genre
for (const followee of followedAuthors) tasteVector[followee.lastBookGenre] += 2
// Books written × 1
for (const ownBook of viewerOwnBooks) tasteVector[ownBook.genre] += 1

const topGenres = Object.entries(tasteVector)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 3)
  .map(([slug]) => slug as GenreSlug)
```

Then fetch + rank:
```ts
SELECT * FROM books WHERE genre IN (topGenres) AND <public filters>
  AND id NOT IN (Tier 1 ids)
ORDER BY computeTrendingScore(7d signals) DESC
LIMIT 60
```

### 5.3 Tier 3 — Trending fallback

"Platform's most-followed 3 genres" = the 3 genres with the highest cumulative `follow` count when each follow is attributed to its followee's most-recently-published book's genre. Cached for 1 hour via `unstable_cache` since the value is platform-wide and stable.

```ts
SELECT * FROM books WHERE genre IN (platformTopGenres)
  AND <public filters>
  AND id NOT IN (Tier 1 ∪ Tier 2 ids)
ORDER BY computeTrendingScore(7d signals) DESC
LIMIT 60
```

### 5.4 Stitching

Per 12-card page: take up to 6 from Tier 1, 4 from Tier 2, 2 from Tier 3 (in that order). If a tier is short, the next tier picks up the slack so the page always fills to 12 (or fewer if total < 12).

### 5.5 Signal check

For default-mode resolution (§2.5), a viewer has "≥1 signal" if any of:
- `follows.follower_id = V` row exists, OR
- `book_likes.user_id = V` row exists, OR
- `books.user_id = V` row exists.

Single composite query returns a boolean; cached for the request via React `cache()`.

## 6. URL state

New optional `?mode=for-you|trending|popular|all` param.

- Default mode (per §2.5) omits the param.
- Mode switches preserve other filter params (q, genres, length, status, series, updated).
- Mode switches reset `?page=1` (drop the param).
- Filter changes preserve mode.
- Sort changes preserve mode.

## 7. Data layer

### 7.1 New action — `getForYouBooksAction`

```ts
export async function getForYouBooksAction(args: {
  viewerId: string
  page?: number
  /** Filter inputs — same shape as searchBooksDiscoverAction filters. */
  filters?: {
    genres?: string[]
    length?: 'any' | 'short' | 'novella' | 'novel' | 'epic'
    status?: 'any' | 'ongoing' | 'completed'
    series?: 'any' | 'standalone' | 'in-series'
    updated?: 'anytime' | 'week' | 'month'
  }
}): Promise<
  ActionResult<{
    books: BookCard[]
    totalCount: number
    tierBreakdown: { tier1: number; tier2: number; tier3: number }
  }>
>
```

Implements the 3-tier stitch. Each tier respects the user-supplied filters AND the public-discoverable filters from `buildPublicBookFilters`. Returns the page slice + total count (sum of distinct ids across all 3 tiers, capped at 180).

### 7.2 New action — `getPopularBooksAction`

```ts
export async function getPopularBooksAction(args: {
  page?: number
  filters?: { /* same */ }
}): Promise<ActionResult<{ books: BookCard[]; totalCount: number }>>
```

Filters PUBLIC + discoverable books, JOINs `book_likes` count, ORDER BY likeCount DESC + id DESC for tiebreak. Trivial implementation.

### 7.3 New helper — `hasAnyDiscoverySignalAction`

```ts
export async function hasAnyDiscoverySignalAction(
  viewerId: string,
): Promise<boolean>
```

`EXISTS` queries over follows, bookLikes, books. Wrapped in React `cache()` so the page can call it cheaply during mode resolution.

### 7.4 Existing `searchBooksDiscoverAction` — unchanged

Stays the canonical query for `mode=all` and for any filter-narrowed view. Sort enum trimmed in the UI layer (sort dropdown only exposes `recent` + `a-z`) but the action's enum stays wide for backwards compatibility.

### 7.5 Mode dispatch in BooksGrid

```ts
const mode = parseMode(sp)   // 'for-you' | 'trending' | 'popular' | 'all'
const resolved = mode ?? (await resolveDefaultMode(viewerId, isAuthed))

const result = await (() => {
  switch (resolved) {
    case 'for-you': return getForYouBooksAction({ viewerId, page, filters })
    case 'trending': return getTrendingBooksAction({ page, filters }) // extended
    case 'popular': return getPopularBooksAction({ page, filters })
    case 'all': return searchBooksDiscoverAction({ page, filters, sort })
  }
})()
```

`getTrendingBooksAction` needs to be extended with `page` + the filter shape; it currently exists but uses a different input contract. Plan resolves the input alignment.

## 8. Component changes

### Modified
- `app/[locale]/(public)/discover/_components/books-grid.tsx` — drops `<SlimFeaturedStrip>`, adds `<DiscoveryModeToggle>` above `<SortHeader>`. Sort options narrowed to `Most recent · A-Z`. Mode dispatch added. Page-resolver helper threaded through.

### New
- `app/[locale]/(public)/discover/_components/discovery-mode-toggle.tsx` — segmented control (see §4).
- `lib/discover/resolve-default-mode.ts` — pure helper that takes `(isAuthed, hasSignal)` → returns the default mode. Unit-tested.
- `lib/discover/taste-vector.ts` — pure helper that takes raw signal counts → returns top 3 genres. Unit-tested with deterministic ordering for tie-breaks (alphabetical fallback).
- `lib/actions/discover-for-you-books.actions.ts` — new file housing `getForYouBooksAction` + `getPopularBooksAction` + `hasAnyDiscoverySignalAction`. Kept separate from the existing `discover.actions.ts` to keep that file from growing.

### Untouched
- Sidebar filters, filter primitives, pagination, grid card. Mode affects WHICH books appear but not HOW they render.

## 9. URL examples

```
/en/discover?tab=books                          → default mode (resolved server-side)
/en/discover?tab=books&mode=trending            → explicit Trending
/en/discover?tab=books&mode=for-you             → explicit For You
/en/discover?tab=books&mode=popular&page=2      → Popular page 2
/en/discover?tab=books&mode=all&sort=a-z        → All, sorted A-Z (sort applies)
/en/discover?tab=books&mode=trending&genres=fantasy → Trending narrowed to fantasy
```

## 10. Design tokens reused

- `--brand` / `--brand-ink` for active toggle button.
- `--canvas-dark-ink` / `--canvas-dark-ink-muted` for inactive labels + meta text.
- `rgba(255, 255, 255, 0.04)` for the outer toggle container (matches sidebar tile).
- Toggle button radius: `9px` (inset within 12px-radius container — same nesting math as sidebar tiles).
- No new tokens introduced.

## 11. Apply-later (Sparks / Hives / Lists / Clubs)

The toggle component is built generic (accepts `context` prop). Each entity will get its own mode set in a follow-up:

| Tab | Mode set |
|---|---|
| Sparks | For You / Live / Ending Soon / All |
| Hives | For You / Most Active / Open Now / All |
| Lists | For You / Trending / Most Followed / All |
| Clubs | For You / Most Active / Open to Join / All |

Each entity's For You uses the same 3-tier hybrid pattern adapted to its data shape (follow-graph as Tier 1; genre overlap as Tier 2 — books-linked entities use the linked book's genre; trending fallback as Tier 3).

This spec covers **Books only**. Sister entities get separate specs once Books ships.

## 12. Out of scope (deferred)

1. **Live updates** — For You doesn't refresh in-place if the viewer follows someone mid-session. Static per request.
2. **ML scoring** — tier weights (×3, ×2, ×1) are static integers in v1. Could become tunable.
3. **Cross-entity Home For You** — the Discover Home tab keeps its current curated rail; doesn't get the toggle.
4. **Mode memory per pagination** — each mode resets to page 1 on switch.
5. **Search autocomplete inside modes** — out of scope (broader Discover deferred).
6. **Per-mode count caching** — every render runs the full count query; could memoize with `unstable_cache` keyed on filters if it becomes hot.
7. **Telemetry on mode clicks** — would help tune weights later; not in v1.

## 13. Acceptance criteria

When this ships:

1. `/en/discover?tab=books` no longer renders the slim `★ FEATURED` strip.
2. iOS segmented control appears at the top of the main content area with the active mode as a brand-yellow pill.
3. Guest viewers see 3 buttons (Trending / Popular / All); authed viewers see 4 (For You / Trending / Popular / All).
4. Default mode on first paint: For You for authed-with-signal, Trending for guests + zero-signal authed.
5. Switching modes updates the URL `?mode=X` and reloads the grid in place via Next.js navigation.
6. Sort dropdown only offers `Most recent · A-Z`.
7. For You results show a measurable mix of followed-author + genre-match + trending books (verified by manual smoke: follow 1 author, like 2 books, check that grid prioritizes those signals).
8. All existing filters (search, genres, length, status, series, updated) narrow within whichever mode is active.
9. Pagination respects mode (each page link preserves `?mode=X`).
10. URL `?mode=for-you` as a guest silently falls back to Trending without breaking the page.
11. Brand-yellow restraint preserved (active toggle pill + active pagination circle + filter chip border).

## 14. Risks

- **Cold-start UX** — authed users with no signal default to Trending; the For You button is still visible to them. Clicking it on a zero-signal account returns Tier 3 trending fallback. Acceptable per §2.5 but worth watching in smoke.
- **Tier query cost** — three sequential queries per For You request. Each is filterable so the worst case is a viewer with hundreds of follows. Acceptable for current scale; revisit if p95 latency degrades.
- **Tier 1 already-read filter** — `chapter_reads` join could be slow on large reader histories. Indexes already exist (`chapter_reads_user_book_idx` per H4 schema); manual smoke during plan will verify.
- **Genre normalization** — viewer's "top 3 genres" can have ties; deterministic alphabetical tiebreak documented in §5.2's helper.
- **For You feels samey across reloads** — by design (3-tier is deterministic). Could add a small rotation in a follow-up.
