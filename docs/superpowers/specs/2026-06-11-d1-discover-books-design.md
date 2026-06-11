# D1 — Discover Books (Design Spec)

**Date:** 2026-06-11
**Sub-project of:** Discover Phase (D1 → D4 decomposition)
**Status:** Design locked, awaiting implementation plan

---

## 1. Context and intent

The current `/[locale]/discover` page is a flat 5-tab directory (Books / Sparks / Hives / Lists / Clubs). Visually it predates the iOS-inspired design system that landed across the studio editor + hive routes + community phase. Functionally it surfaces minimal signal — one sort dropdown (trending / popular / new), a single genre filter, and a basic card grid. For a writing platform that explicitly wants to **rival Royal Road and Wattpad on the reader side** and serve as a **DeviantArt-style creative-sharing home** on the broader side, this is a prototype-grade surface.

This spec covers **D1 — Discover Books**, the first of four sub-projects:

- **D1 — Discover Books** (this spec): deepen the Books surface into a rail-driven, genre-aware discovery home that rivals Royal Road's algorithmic-first model. Visual refresh of the surrounding `/discover` chrome rides D1.
- **D2 — Discover Sparks + Hives** (future): deepen Sparks (live now / voting / recently won) and Hives (active groups, member buckets, activity heat).
- **D3 — Discover Lists + Clubs** (future): deepen Lists as a curation discovery surface and Clubs as the Facebook-groups vision.
- **D4 — Cross-surface home + personalization** (future): `/discover` root becomes a curated mixed feed across all 5 entity types plus a "for you" rail once enough signal exists.

D2–D4 are explicitly out of scope here. D1 ships the visual refresh as part of its surface; non-Books tabs get only enough chrome touch-up to not visually clash with the new Books surface — their functional deepening waits for D2 / D3.

## 2. Goals

1. Make `/discover` (Books tab) feel like a destination, not a directory. Rail-stacked home with six discovery surfaces above the fold.
2. Algorithmic-first: no curator tooling, no editorial calendar. Every rail derives from existing tables; nothing requires admin intervention.
3. Visual chrome matches the locked design system (cool-gray panels, brand-yellow restraint, tile gradients, Comfortaa headings, JetBrains Mono labels) — see AGENTS.md "Design System" block.
4. Genre browsing is a first-class affordance: chip strip on home scopes all rails; dedicated `/discover/genre/[slug]` sub-routes mirror the home scoped to genre.
5. Sub-page per rail: every rail's "See all →" link goes to a full-grid page with filter rail + pagination.
6. Search ships in D1 — title / author / tag, mirroring C3's `searchBooksAction` shape.
7. Transparent low-volume behavior: rails backfill from "Recently Updated" with a labeled caption so the page stays alive without faking signal.

## 3. Non-goals (deferred)

- Sparks / Hives / Lists / Clubs functional deepening (D2 / D3).
- Cross-surface mixed-feed home + personalization layer (D4).
- Inline rail-card actions (quick-like, save-for-later, bookmark-from-card).
- Curated content slots (Editor's Picks, Featured This Week, Staff Recommends).
- Completion-status enum on books (Ongoing / Complete / Hiatus) and the dependent "Best Completed" rail. Best Ongoing is approximated for D1 via "actively updating in last 30 days."
- Maturity ratings / content warnings.
- Recommendation engine ("because you read X"). Rails are signal-based, not collaborative-filtering-based.
- Sub-tag rails (e.g. "Books tagged 'LitRPG'"). Tags are searchable and visible on cards; dedicated tag routes are a future axis.
- Mobile responsive treatment. Project posture is desktop-dark-only.
- Light mode.

## 4. Decisions locked during brainstorm

| Q | Decision |
|---|----------|
| Q1 — Decomposition | D1 Books first; visual refresh rides D1; D2/D3/D4 deferred. |
| Q2 — Curation lean | Algorithm-first. No curator tooling. |
| Q3 — Rail set | Trending Now, Rising Stars, Recently Updated, New Releases, Best Ongoing (approx), From Authors You Follow (authed), Genre Hubs as drill-down. Most Popular and Best Completed dropped. |
| Q4 — Home IA | Hybrid: rail-stacked home + dedicated sub-page per rail. Genre chip strip on home scopes ALL rails in place; doesn't navigate. |
| Q5 — Card density | Compact cover-forward (A) for rails (~168px). Info-dense (B) for sub-pages (~280px). Featured Fresh hero is a third full-width variant. |
| Q6 — Genre taxonomy | Curated 14-genre list matching wiki vocabulary. Free-text tags stay as secondary axis on cards + search. |
| Q7 — Search | Ship in D1. Full title / author / tag. Server action mirrors C3's `searchBooksAction`. Route `/discover/search?q=…&genre=…&tag=…`. |
| Q8 — Low-volume strategy | Backfill rails below 4 cards with "Recently Updated within 30 days" + labeled caption. Caption auto-vanishes once strict criteria yield ≥4. |
| Q9 — Other tabs in D1 | Tab strip stays. Sparks / Hives / Lists / Clubs tabs get LIGHT visual card touch-up only; functional deepening waits for D2 / D3. |
| Q10 — Top of page | Algorithmic "Featured Fresh" single-book hero (≤7 days new, velocity-sorted in that window). Hidden if no qualifying book. |

## 5. Page IA

`/[locale]/discover` (Books tab — default when no `?tab` set), top to bottom:

1. **`PageHead`** (visually refreshed — chrome only). Eyebrow `Find your next read & your next circle` / Comfortaa title `Discover` / subtitle `Books, sparks, lists, clubs, and hives from across the community.` Copy unchanged; visual treatment migrated to design-system tokens.
2. **Tab strip** — 5 entries (Books / Sparks / Hives / Lists / Clubs). Active tab uses panel-gradient + tile-shadow treatment (no left-stripe per locked design system convention). Visually refreshed for D1; the other 4 tabs keep current content with a light card touch-up so nothing clashes.
3. **Featured Fresh hero** — single full-width book card spotlighting one book with `first_publicly_discoverable_at` within the last 7 days, sorted by velocity in that window. Hero card layout: 120px portrait cover (or honeycomb fallback) + Comfortaa title (24px) + `@username` + "New this week" mono badge on the cover corner + 3-line synopsis + brand-pill `Start reading →` CTA. Hidden entirely if no qualifying book exists.
4. **Genre chip strip + search row** — sticky-ish strip beneath the hero. Left: `All` reset chip + 14 genre chips. Right: recessed search input (`--canvas-dark-100` + `--sh-inset` + `--r-row` + Search lucide icon + brand-yellow focus ring). Submit → `/discover/search?q=…`. Genre chip click stays on home and re-scopes all rails below.
5. **Rails stack** — six rails, vertically stacked. Each rail = panel-chrome wrapper + header strip (Comfortaa brand-yellow rail title + mono "See all →" link to the rail's sub-route) + horizontally scrolled row of compact A-cards (`scroll-snap-x mandatory` for snap stops). Each rail has its own server action; all run in parallel via `Promise.all` in the page server component. Rails render in this exact order:
    1. Trending Now
    2. Rising Stars
    3. Recently Updated
    4. New Releases
    5. Best Ongoing
    6. From Authors You Follow (authed only)
6. **Browse-all-genres footer grid** — 14-tile grid (Wiki-style icon chip + label + book count badge) linking to `/discover/genre/[slug]`. Sits below the last rail.

### Sub-routes spawned by D1

| Route | Purpose |
|---|---|
| `/discover/trending` | Sub-page for Trending Now rail. |
| `/discover/rising` | Sub-page for Rising Stars rail. |
| `/discover/recently-updated` | Sub-page for Recently Updated rail. |
| `/discover/new-releases` | Sub-page for New Releases rail. |
| `/discover/best-ongoing` | Sub-page for Best Ongoing rail. |
| `/discover/following` | Sub-page for From Authors You Follow. Authed-only; redirects to `/sign-in?next=…` for guests. |
| `/discover/genre/[slug]` | 14 known slugs (one per locked genre). Same rail-stack as home, scoped to genre. |
| `/discover/search` | Search results page. Query: `?q=…&genre=…&tag=…&sort=…`. |

## 6. Rails — signals and ordering

All rails filter through `canReadBook` posture: PUBLIC visibility + `discoverable = true` + viewer-bidirectional-block check via existing C-phase `isBlocked` helper. Author of the book is never blocked from their own book in any query (consistent with project posture, though irrelevant on Discover since author-owned PRIVATE/FRIENDS books are excluded by the discoverability filter anyway).

### 6.1 Trending Now

- **Signal:** `score = likes_7d + comments_7d * 2 + chapter_reads_7d + follows_7d * 3` summed over the trailing 7 days per book.
- **Source tables:** `book_likes` (filter `created_at >= now() - interval '7 days'`), `book_comments` (same), `chapter_reads` (joined via `chapters.book_id`, same window), `follows` (filter on the BOOK AUTHOR's follower count delta in the window — implementation note: follow events are author-scoped not book-scoped, so this term may need a denorm or a derived count; see §10).
- **Order:** score DESC, `books.updated_at` DESC tiebreak.
- **Slug:** `trending`. Default sub-page sort = same. Sub-page also exposes "24h velocity" toggle (same formula but 1-day window).

### 6.2 Rising Stars

- **Signal:** `score = trending_score / (total_likes_all_time + 1)`. Books first PUBLIC+discoverable >180 days ago multiplied by 0.5 (demote established authors so newer authors surface).
- **Source tables:** Same as Trending plus `count(book_likes WHERE book_id = X)` for the denominator.
- **Order:** score DESC, `first_publicly_discoverable_at` DESC tiebreak.
- **Slug:** `rising`.

### 6.3 Recently Updated

- **Signal:** `MAX(chapters.updated_at)` per book where the chapter is REVISED or FINAL AND that flip happened in the trailing 7 days.
- **Source tables:** `chapters` (filter `status IN ('REVISED', 'FINAL') AND updated_at >= now() - interval '7 days'`), joined `books`.
- **Order:** `MAX(chapters.updated_at)` DESC.
- **Slug:** `recently-updated`.

### 6.4 New Releases

- **Signal:** `first_publicly_discoverable_at >= now() - interval '30 days'`.
- **Source tables:** `books` — requires a `first_publicly_discoverable_at` timestamp column. **New column needed**, see §8. Backfill = MIN(`updated_at`) of rows that were ever PUBLIC+discoverable, or `created_at` as fallback.
- **Order:** `first_publicly_discoverable_at` DESC.
- **Slug:** `new-releases`.

### 6.5 Best Ongoing

- **Signal:** books with at least one chapter REVISED or FINAL flip in the last 30 days AND `(total_likes + total_comments + total_follows_of_author)` above the platform median for currently-active books.
- **Implementation note:** "platform median for currently-active books" can be precomputed lazily (e.g. recompute on every page hit, cached at module level for 5 minutes via a simple `unstable_cache`). The expensive query runs once per cache window.
- **Order:** `(total_likes + total_comments)` DESC.
- **Slug:** `best-ongoing`.

### 6.6 From Authors You Follow

- **Visibility:** authed-only. Hidden entirely for guests AND for authed viewers who follow zero authors.
- **Signal:** books authored by users the viewer follows, where the book is PUBLIC+discoverable AND has at least one chapter REVISED-or-FINAL update in the last 30 days.
- **Source tables:** `follows` (viewer's `followee_ids`), `books` (joined on `user_id IN followee_ids`), `chapters` (joined for last update timestamp).
- **Order:** `MAX(chapters.updated_at)` DESC.
- **Slug:** `following`.

### 6.7 Fallback rule (uniform across all 6 rails)

When a rail returns <4 cards from its strict criteria, the page fetches up to (4 − strictCount) additional cards from "Recently Updated within last 30 days" (the same query as §6.3 but widened to 30 days), excluding any book already in the strict set. A mono caption renders below the rail title:

> `Filling in with recently active books while [Rail Name] warms up.`

Caption is hidden once strict criteria yield ≥4. Implementation: the server action returns `{ books: BookCard[], strictCount: number }`; the rail component renders the caption when `strictCount < 4 && books.length > 0`.

### 6.8 Genre scoping

When a genre chip is active on home (or on a `/discover/genre/[slug]` page), every rail re-runs with `books.genre = <slug>` in the WHERE clause. The Featured Fresh hero also re-scopes. Implementation: every rail server action takes optional `genre?: string` param.

## 7. Card variants

Three card components ship in D1.

### 7.1 `<RailBookCard>` (variant A)

- **Width:** 168px fixed.
- **Layout:** cover (full width, 2:3 aspect) + title (Comfortaa 13px semibold, 1-line truncate) + author (mono 11px) + 2-stat row (`❤ N` + `📖 N`).
- **Cover fallback:** when `coverUrl` is null, render the locked paper-warm honeycomb gradient + book title in serif overlay (same fallback as legacy `BookCard`).
- **Chrome:** tile gradient (`linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`) + `var(--sh-tile)` + `var(--r-btn)`. Hairline top via `box-shadow: 0 1px 0 var(--br-card) inset`.
- **Hover:** `translateY(-1px)` + deepened shadow via `onMouseEnter` / `onMouseLeave` inline-style mutation (per the codebase pattern documented in C2 patterns).
- **Click:** routes to `/[locale]/books/[bookId]`.

### 7.2 `<DiscoverBookCard>` (variant B)

- **Width:** ~280px (rail context) or full-width row (vertical-list context on search and sub-pages).
- **Layout:** `[grid-template-columns:88px_1fr]`. Left = 88px cover. Right = title + `@username` + `line-clamp-2` synopsis (Newsreader serif 11px) + tag chip row (up to 2 tags, brand-yellow-tint) + stat row (likes + chapters + `● Updating` indicator when last chapter REVISED/FINAL flip in last 30 days).
- **Chrome:** same panel/tile recipe as A, larger radius (`--r-card`).
- **Used by:** sub-pages, search results, genre hub grids.

### 7.3 `<FeaturedFreshHero>`

- **Layout:** full-width panel card. `[grid-template-columns:160px_1fr_auto]`. Left = 120px portrait cover with "New this week" mono badge inline on the corner. Center = title (Comfortaa 28px brand-yellow) + author row + 3-line synopsis. Right = brand-pill `Start reading →` CTA.
- **Chrome:** panel gradient outer (matches other home panels but with a faint brand-yellow inner glow on the cover side via `radial-gradient`).
- **Lifecycle:** rendered ONLY when the qualifying-book query returns a row. Hidden entirely otherwise (no placeholder, no skeleton).

## 8. Schema changes

D1 needs ONE additive column on `books` to support New Releases reliably.

### `books.first_publicly_discoverable_at timestamp NULL`

- Set to `now()` the first time a book transitions to `(visibility = 'PUBLIC' AND discoverable = true)`. Subsequent flips back to private + then re-public do NOT update this column — it captures the first public moment for "new release" purposes.
- Wired into `updateBookAction` + `publishBookAction` + `createBookAction` (if a book is created with PUBLIC+discoverable straight out of the wizard).
- Backfill via idempotent runner `scripts/migrate-d1.ts`: for every row where the column is NULL AND `visibility = 'PUBLIC' AND discoverable = true`, set `first_publicly_discoverable_at = updated_at` (or `created_at` if `updated_at` is null).
- Index: `books_first_public_idx ON (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`.

No other schema changes required. Genre stays as TEXT (Zod-enforced at the validation layer against the 14 locked values; doesn't move to a Postgres enum because that would force a real migration of free-text data — Zod normalization is cheaper).

## 9. Server actions

All actions live in `lib/actions/discover.actions.ts` (the existing file gains new exports; the legacy `getDiscoverFeedAction` and `getDiscoverWritersAction` are dropped — replaced by the rail-specific actions). All actions return `ActionResult<T>` per the project posture.

| Action | Args | Returns | Used by |
|---|---|---|---|
| `getFeaturedFreshBookAction({ genre? })` | optional genre slug | `BookCard \| null` | Featured Fresh hero |
| `getTrendingBooksAction({ genre?, limit?, cursor?, window? })` | genre, limit (default 12), cursor, window ('24h' \| '7d'; default '7d') | `{ books, strictCount, nextCursor }` | Rail + `/discover/trending` |
| `getRisingStarsBooksAction({ genre?, limit?, cursor? })` | same | `{ books, strictCount, nextCursor }` | Rail + `/discover/rising` |
| `getRecentlyUpdatedBooksAction({ genre?, limit?, cursor?, window? })` | window default '7d' for rail, '30d' for backfill helper | `{ books, strictCount, nextCursor }` | Rail + `/discover/recently-updated` + backfill source |
| `getNewReleasesBooksAction({ genre?, limit?, cursor? })` | | `{ books, strictCount, nextCursor }` | Rail + `/discover/new-releases` |
| `getBestOngoingBooksAction({ genre?, limit?, cursor? })` | | `{ books, strictCount, nextCursor }` | Rail + `/discover/best-ongoing` |
| `getFollowingFeedAction({ genre?, limit?, cursor? })` | authed-only; returns FORBIDDEN for guests | `{ books, strictCount, nextCursor }` | Rail + `/discover/following` |
| `getBackfillBooksAction({ excludeIds, genre?, limit })` | books already in the strict set to exclude | `BookCard[]` | Called inline by rail actions to top up below the threshold |
| `searchBooksDiscoverAction({ q, genre?, tag?, sort?, cursor? })` | required q, optional refinements; sort ∈ relevance / recent / popular | `{ books, nextCursor }` | `/discover/search` |
| `getGenreBookCountsAction()` | none; `unstable_cache` 5min | `Record<genreSlug, number>` | Browse-all-genres footer grid badges |

Pure helpers live in `lib/discover/`:

- `lib/discover/scoring.ts`: `computeTrendingScore({likes_7d, comments_7d, reads_7d, follows_7d}) → number`, `computeRisingStarsScore({...trending, totalLikes, ageDays}) → number`, both pure and unit-tested.
- `lib/discover/backfill.ts`: `applyBackfill(strictRows, backfillRows, target=4) → { books, strictCount }` pure shape-only logic.
- `lib/discover/genres.ts`: `GENRES = readonly tuple` of the 14 slugs + display labels + lucide icons; `isValidGenre(slug)` predicate.

## 10. Data layer note — follow-event windowing

The Trending Now formula references `follows_7d` (new followers gained by the BOOK's AUTHOR in the trailing 7 days). The existing `follows` table is author-scoped; computing per-book attribution requires joining `follows.followee_id = books.user_id` and filtering `follows.created_at >= now() - interval '7 days'`. This is fine for D1's scale but the query gets expensive at high book volume. For now we accept the cost; if performance becomes an issue, denormalize a `books.follows_7d` int column refreshed nightly via cron.

## 11. Visual chrome refresh

The Books home + sub-routes get a complete chrome refresh aligned to the locked design system (see AGENTS.md "Design System" block). Key surface treatments:

- **Page backdrop:** `bg-[#262728]` (the `(app)` layout already provides this; the `(public)/layout.tsx` already does too — no layout-level change needed).
- **Page width:** Books home = `max-w-7xl`. Sub-pages and genre hubs = `max-w-5xl`. Search results = `max-w-5xl`.
- **Rail wrappers:** panel gradient (`linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`) + `var(--r-card)` + `var(--sh-card)` + `var(--br-card)` hairline top.
- **Headings:** rail titles = Comfortaa bold 18px `text-[var(--brand)]`. Book card titles = Comfortaa semibold 13px `text-[var(--canvas-dark-ink-strong)]`.
- **Labels:** "See all →", "filling in" captions, stat counts, section headers all use JetBrains Mono uppercase tracking-wider muted ink.
- **Genre chips:** at rest = tile-gradient + `--r-pill` + mono uppercase label. Active = `bg-[var(--brand)] text-[var(--brand-ink)]`.
- **Search input:** recessed (`--canvas-dark-100` + `--sh-inset` + `--r-row` + Search lucide icon). Focus state = 2px brand-yellow ring.
- **Featured Fresh hero CTA:** brand pill (`h-9 px-5 rounded-[var(--r-pill)]`). NO drop-shadow glow per the design system rule.
- **Brand-yellow restraint:** rail titles · active genre chip · Featured Fresh "New this week" badge · search input focus ring · Start reading CTA · `● Updating` indicator on B-cards · Browse-all-genres footer grid icon chips. Nowhere else.

**Non-Books tab card touch-up:**

- `<SparkCard>`, `<HiveCard>`, `<ListCard>`, `<ClubCard>` (as used inside the existing tab content components) get the same panel/tile gradient treatment. Functional logic stays exactly as-is; only the chrome moves. Any literal hex colors (`bg-[#1c1c1c]` etc.) swap to design-system tokens.
- `feed-filters.tsx` (legacy sort dropdown on Books tab) is DELETED — replaced by the rail set.
- `writers-strip.tsx` (legacy writer row below Books feed) is DELETED — its function is absorbed by the "From Authors You Follow" rail.

## 12. Test posture

- **Unit tests** (vitest) for the pure helpers:
    - `lib/discover/scoring.ts`: trending score basics, rising score age-demotion factor, zero-engagement floors, divide-by-zero guards.
    - `lib/discover/backfill.ts`: backfill below threshold, no backfill at-or-above, exclusion of strict set, deterministic order.
    - `lib/discover/genres.ts`: `isValidGenre` truthy / falsy.
- **Surface-shape tests** for every new server action mirroring the C-phase pattern (top-level static `import * as actions` after `vi.mock` — see C2 `reading-actions.test.ts`).
- **No behavior tests** for the rail queries themselves — manual smoke per AGENTS.md convention.
- **Manual smoke checklist** baked into the implementation plan: walk the home (rails populate / backfill caption appears when sparse / Featured Fresh visible-or-hidden); each sub-route; each genre hub; search with various query / genre / tag combinations; authed-vs-guest behavior for the Following rail.

## 13. Implementation phasing

Indicative task breakdown for the writing-plans pass (final ordering / waves decided in the plan):

- T1 Schema migration — `books.first_publicly_discoverable_at` + idempotent runner + backfill.
- T2 Pure helpers — `lib/discover/{scoring,backfill,genres}.ts` + unit tests.
- T3 Server actions — rewrite `lib/actions/discover.actions.ts` with the 10 new actions. Delete legacy `getDiscoverFeedAction` + `getDiscoverWritersAction` after migrating the page consumer.
- T4 Card components — `<RailBookCard>`, `<DiscoverBookCard>`, `<FeaturedFreshHero>` under `app/[locale]/(public)/discover/_components/`.
- T5 Rail component — `<DiscoverRail>` generic wrapper (header + horizontal scroll + caption + cards) consumed by all six rail mounts.
- T6 Books home page rewrite — replace current `BooksTab` server component with the new IA. Parallel `Promise.all` of the 6 rail actions + hero + browse-grid counts.
- T7 Genre chip strip + Search input — sticky-ish row with `useTransition` for chip selection; search input submits to `/discover/search?q=…`.
- T8 Browse-all-genres footer grid — `<GenreFooterGrid>` with icon chips + counts.
- T9 Sub-page shell — generic `<DiscoverRailSubPage>` that takes (server-loaded title + first page of B-cards + filter rail + Load-more cursor). Consumed by 6 sub-routes.
- T10 Six sub-route page files — one per rail at `/discover/[rail-slug]/page.tsx`. Each is a thin server component wrapping `<DiscoverRailSubPage>` with its rail-specific action.
- T11 Genre hub page — `/discover/genre/[slug]/page.tsx`. Same as Books home, scoped to genre. Includes 404 for unknown slugs.
- T12 Search page — `/discover/search/page.tsx` + `<SearchFilterRail>` + `<SearchResults>` client component with `useTransition` for cursor pagination.
- T13 Non-Books tab card touch-up — apply design-system tokens to `<SparkCard>`, `<HiveCard>`, `<ListCard>`, `<ClubCard>`. Delete `feed-filters.tsx` and `writers-strip.tsx`. No functional changes.
- T14 Manual smoke + AGENTS.md update + ship.

## 14. Carry-forward smoke checklist

To be exercised after ship:

1. Books home renders with rails populated; rail order = Trending, Rising, Recently Updated, New Releases, Best Ongoing, Following (authed).
2. Featured Fresh hero appears when a qualifying book exists; hidden cleanly when not.
3. Genre chip click re-scopes ALL rails + the hero, without page navigation. "All" chip resets.
4. A rail with <4 strict results shows the backfill caption + fills to 4 cards. Caption disappears once strict criteria yield ≥4.
5. "See all →" on each rail goes to the right sub-route; sub-page shows the same rail's full list with filter rail + Load more.
6. Genre hub `/discover/genre/fantasy` shows all 6 rails scoped to Fantasy. Unknown slug → 404.
7. Search input submits → results page shows B-cards; filter rail (genre + tag + sort) refines.
8. From Authors You Follow rail: visible to authed users who follow ≥1 author with a recent update; hidden for guests; hidden for authed-zero-follows.
9. Card click routes to `/[locale]/books/[bookId]` reader page. No inline actions on rail cards (intentional).
10. Tab strip works; Sparks/Hives/Lists/Clubs tabs render with their existing content + the touched-up card chrome — nothing visually clashes.
11. Brand-yellow appears ONLY in the sanctioned places listed in §11.
12. No pure-black backgrounds anywhere on the surface.
13. `first_publicly_discoverable_at` migration ran idempotently; backfill populated existing rows; new publishes set the column correctly.
14. Page width: home = `max-w-7xl`; sub-pages + genre hubs + search = `max-w-5xl`.
15. Block-aware: a viewer who blocks the author of a Trending book should NOT see that book on any rail / sub-page / search result.

## 15. Open questions for plan-writing

- Exact unit-test mock pattern for the new rail actions (mirror C2 `reading-actions.test.ts`; vitest static-import after `vi.mock` per the `ca51b28` lesson).
- Cursor format for rail sub-pages: reuse C-phase tuple cursor `(sortKey DESC, id DESC)` base64url JSON, or simpler page-int? Recommendation in the plan: tuple cursor for consistency.
- Whether `first_publicly_discoverable_at` update should fire inside `publishBookAction`'s existing tx or as a sibling write. Likely inline (atomic + cheap).

---

End of design.
