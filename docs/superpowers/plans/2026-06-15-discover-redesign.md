# Discover Redesign — Bookstore Aisle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape all 6 Discover tabs (`/[locale]/discover?tab={home|books|sparks|hives|lists|clubs}`) into a persistent left sidebar + 4-col card grid, replacing the D1-D4 rail-driven surface. Spec at [docs/superpowers/specs/2026-06-15-discover-redesign-design.md](../specs/2026-06-15-discover-redesign-design.md) ([253fba6](https://github.com/Cremacious/beehive-studio/commit/253fba6)).

**Architecture:** Shared two-column shell (`<DiscoverShell>`) + 6 filter primitives + per-tab `<XxxFilters>`/`<XxxGrid>` pairs. URL is the source of truth for every filter (server-rendered first paint). Extend the 5 existing entity search actions with new filter input shapes — NO schema changes, NO new tables. Add ONE new server action (`searchHomeMixedAction`) for cross-entity Home. Retire D1-D4's rail / hero / chip wrappers from Discover composition (kept in repo). Delete legacy `/discover/[entity]/...` sub-routes — external bookmarks 404 (acceptable trade).

**Reference precedent:** Spec §3-§9 is the single source of truth. D3a plan at [docs/superpowers/plans/2026-06-11-d3a-discover-lists.md](2026-06-11-d3a-discover-lists.md) is the closest structural mirror for action extension shape; D-phase polish round 2 ([f52c3b1](https://github.com/Cremacious/beehive-studio/commit/f52c3b1)) is the precedent for replacing per-tab structural components atomically.

**Resolved deferred decisions:**
1. **Books `Ongoing/Completed`** → derivation, NOT schema. Ongoing = `status='PUBLISHED' AND updated_at >= now() - interval '90 days'`. Completed = `status='PUBLISHED' AND updated_at < now() - interval '90 days'`. Follow-up to add explicit `completion_status` column if user feedback shows the heuristic misclassifies.
2. **Sub-route URL aliases** → DELETE. Legacy `/discover/[entity]/{trending|recently-active|new|...}` routes were internal D1-D4 navigation. External bookmarks acceptable as 404. Documented risk in §13 of the spec; follow-up to add 308 redirects if 404 traffic shows up.
3. **Facet count strategy** → defer to v2. Filter UI ships without `(count)` annotations. Each filter option carries a `// TODO(plan): facet counts` comment for later wiring via a sibling `countXxxByFacetAction`.

**Pattern carry-forward from D-phase that must hold here:**
- Block-aware filters (`buildPublicXxxFilters` helpers from D1-D3b — KEEP, extend with new where-conditions).
- Cursor pagination uses tuple `(sortKey, id)` base64url JSON (matches polish round 4 [641eca7](https://github.com/Cremacious/beehive-studio/commit/641eca7)).
- 14-genre vocabulary unchanged — referenced from `lib/discover/genres.ts` (existing).
- Brand-yellow restraint: section headings + active chip border + sort dropdown active state + "OPEN" pill (existing) ONLY. NOT body checkboxes, NOT filter row hover.

---

## File structure

**New components:**
- `app/[locale]/(public)/discover/_components/discover-shell.tsx` — shared 2-col shell.
- `app/[locale]/(public)/discover/_components/filter-sidebar.tsx` — sidebar chrome + "Clear all" link.
- `app/[locale]/(public)/discover/_components/filter-section.tsx` — collapsible filter group.
- `app/[locale]/(public)/discover/_components/filter-search-input.tsx` — debounced text input.
- `app/[locale]/(public)/discover/_components/filter-checkbox-group.tsx`
- `app/[locale]/(public)/discover/_components/filter-radio-group.tsx`
- `app/[locale]/(public)/discover/_components/filter-dropdown.tsx` — native `<select>`.
- `app/[locale]/(public)/discover/_components/active-filter-chips.tsx` — dismissible chip row.
- `app/[locale]/(public)/discover/_components/slim-featured-strip.tsx`
- `app/[locale]/(public)/discover/_components/sort-header.tsx` — `{count} · Sort: {opt} ▾`.
- `app/[locale]/(public)/discover/_components/book-grid-card.tsx`
- `app/[locale]/(public)/discover/_components/spark-grid-card.tsx`
- `app/[locale]/(public)/discover/_components/hive-grid-card.tsx`
- `app/[locale]/(public)/discover/_components/list-grid-card.tsx`
- `app/[locale]/(public)/discover/_components/club-grid-card.tsx`
- `app/[locale]/(public)/discover/_components/books-filters.tsx`
- `app/[locale]/(public)/discover/_components/books-grid.tsx`
- `app/[locale]/(public)/discover/_components/sparks-filters.tsx`
- `app/[locale]/(public)/discover/_components/sparks-grid.tsx`
- `app/[locale]/(public)/discover/_components/hives-filters.tsx`
- `app/[locale]/(public)/discover/_components/hives-grid.tsx`
- `app/[locale]/(public)/discover/_components/lists-filters.tsx`
- `app/[locale]/(public)/discover/_components/lists-grid.tsx`
- `app/[locale]/(public)/discover/_components/clubs-filters.tsx`
- `app/[locale]/(public)/discover/_components/clubs-grid.tsx`
- `app/[locale]/(public)/discover/_components/home-filters.tsx`
- `app/[locale]/(public)/discover/_components/home-grid.tsx`
- `lib/discover/url-state.ts` — URL param parsers + builders (typed).
- `lib/discover/url-state.test.ts`
- `lib/actions/discover-home-mixed.actions.ts` — new `searchHomeMixedAction`.
- `lib/actions/__tests__/discover-home-mixed-actions.test.ts`

**Modified:**
- `app/[locale]/(public)/discover/page.tsx` — full rewrite, dispatches to `<DiscoverShell>` with per-tab pair.
- `lib/actions/discover-books.actions.ts` — extend `searchBooksAction` with `length`, `status`, `series`, `updated` filters.
- `lib/actions/discover-sparks.actions.ts` — extend `searchSparksAction` with `state`, `wordLimit`, `timeLeft`, `creator` filters.
- `lib/actions/discover-hives.actions.ts` — extend `searchHivesAction` with `openStates`, `linked` filters.
- `lib/actions/discover-lists.actions.ts` — extend `searchListsAction` with `popularity`, `updated`, `curator` filters.
- `lib/actions/discover-clubs.actions.ts` — extend `searchClubsAction` with `accessStates`, `currentBook` filters.
- `app/globals.css` — add `--w-discover-sidebar: 240px` token.
- `AGENTS.md` — bookkeeping at W6 ship.

**Deleted (legacy D1-D4 sub-routes — see resolved decision 2):**
- All sub-routes under `app/[locale]/(public)/discover/books/{trending,new,...}/page.tsx` (6 D1)
- All sub-routes under `app/[locale]/(public)/discover/sparks/{...}/page.tsx` (6 D2a)
- All sub-routes under `app/[locale]/(public)/discover/hives/{...}/page.tsx` (5 D2b)
- All sub-routes under `app/[locale]/(public)/discover/lists/{...}/page.tsx` (5 D3a)
- All sub-routes under `app/[locale]/(public)/discover/clubs/{...}/page.tsx` (5 D3b)
- Genre hub routes `app/[locale]/(public)/discover/{books,sparks,hives,lists,clubs}/genre/[slug]/page.tsx` (5 × 14 = stays as 5 dir trees; deleted with parents above)
- Entity search routes `app/[locale]/(public)/discover/{books,sparks,hives,lists,clubs}/search/page.tsx` (5)
- Their per-route `_components/` subdirs (filter rails + results components)

**Retired from Discover composition (NOT deleted — kept in repo for potential future reuse):**
- `discover-rail.tsx`, `discover-{spark,hive,list,club}-rail.tsx` (5 wrappers)
- `featured-{fresh,spark,hive,list,club}-hero.tsx` (5 heroes)
- `for-you-rail.tsx`, `genre-chip-strip.tsx`, `genre-footer-grid.tsx`, `discover-rail-sub-page.tsx`
- `rail-{book,spark,hive,list,club}-card.tsx` (5 rail card variants; the new `*-grid-card.tsx` siblings replace them in the redesign)
- `discover-{book,spark,hive,list,club}-card.tsx` (5 detail card variants — replaced by grid cards)

---

## Wave 1 — Foundation (sidebar shell + filter primitives + URL state)

No server actions or per-entity wiring yet. Lands the shared chrome + URL state helper as standalone testable pieces.

### Task 1.1: Tokens + URL state helper

**Files:** `app/globals.css`, `lib/discover/url-state.ts`, `lib/discover/url-state.test.ts`

- [ ] Add `--w-discover-sidebar: 240px;` to `:root` block in `app/globals.css` near existing chrome width tokens.
- [ ] Create `lib/discover/url-state.ts` exporting typed parsers + builders:
   ```ts
   export type TabId = 'home' | 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'
   export type SortDirection = 'asc' | 'desc'

   export function parseTab(raw: string | undefined): TabId { /* default 'home', allow-list */ }
   export function parseMultiSelect(raw: string | undefined): string[] { /* comma-split, trim, dedupe */ }
   export function parseRadio<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T
   export function parseInt(raw: string | undefined, fallback: number): number
   export function parseString(raw: string | undefined, maxLen = 200): string | undefined

   export function buildUrl(tab: TabId, params: Record<string, string | string[] | undefined>): string
   export function toggleMulti(current: string[], value: string): string[]  /* add if missing, remove if present */
   ```
- [ ] Write vitest unit tests for every helper (>= 12 tests covering edge cases: empty string, missing param, single value, multi value, unknown radio falls to fallback, buildUrl drops undefined entries, toggleMulti add/remove).
- [ ] Run `npm test -- url-state` — expect all pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/url-state): typed URL param parsers + builders for filter state`

### Task 1.2: Filter primitives (sidebar chrome)

**Files:** `discover/_components/{filter-sidebar,filter-section,filter-search-input,filter-checkbox-group,filter-radio-group,filter-dropdown,active-filter-chips,sort-header,slim-featured-strip}.tsx`

- [ ] `<FilterSidebar>` (server component): renders `<aside style={{ width: 'var(--w-discover-sidebar)' }}>` with `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` panel chrome + `var(--br-card)` hairline + `var(--sh-card)` shadow + scrollable body. Props: `{ title: string; clearHref: string | null; children: ReactNode }`. Header is `<header>` with brand-yellow `<h2 className="text-[11px] font-bold tracking-[.08em] uppercase text-[var(--brand)]">FILTERS</h2>` + right-aligned `Clear all (N)` `<Link>` when `clearHref` non-null.
- [ ] `<FilterSection>` (client — needs `useState` for collapse): `{ label: string; defaultOpen?: boolean; children: ReactNode }`. Header is a `<button>` with `▾`/`▸` toggle + brand-yellow uppercase label. Body conditional on `open` state.
- [ ] `<FilterSearchInput>` (client): `{ name: string; placeholder: string; initialValue?: string }`. Renders recessed input with `var(--canvas-dark-100)` bg + `var(--sh-inset)`. On change, 400ms debounce → `router.replace()` with the new URL via `useRouter` + `useSearchParams` + `usePathname`.
- [ ] `<FilterCheckboxGroup>` (client): `{ name: string; options: Array<{ value: string; label: string }>; selected: string[] }`. Each option is a labeled checkbox. On click, calls `toggleMulti(selected, value)` and `router.replace` with the joined URL. `// TODO(plan): facet counts` comment.
- [ ] `<FilterRadioGroup>` (client): `{ name: string; options: Array<{ value: string; label: string }>; selected: string | undefined }`. Each option is a radio. On click, `router.replace` with new value (or omitted if `value === fallback`).
- [ ] `<FilterDropdown>` (client): native `<select>` with sidebar-tuned styling. `{ name: string; options: Array<{ value: string; label: string }>; selected: string | undefined }`.
- [ ] `<ActiveFilterChips>` (client): `{ chips: Array<{ label: string; removeHref: string }> }`. Each chip is `<Link>` with `✕` icon. Renders nothing when `chips.length === 0`.
- [ ] `<SortHeader>` (server): `{ count: number; sortOptions: Array<{ value: string; label: string }>; selected: string }`. Renders `{count.toLocaleString()} {entityNoun} · Sort: <FilterDropdown />`.
- [ ] `<SlimFeaturedStrip>` (server): `{ kind: 'book' | 'spark' | 'hive' | 'list' | 'club' | 'mixed'; featured: { title: string; caption: string; href: string } | null }`. Returns `null` when `featured === null`. Otherwise renders single-line banner `★ FEATURED · {title} — {caption}` brand-yellow on `linear-gradient(90deg, oklch(from var(--brand) l c h / 0.20), transparent)` background, wraps the whole line in `<Link href={featured.href}>`.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/primitives): filter sidebar + 6 filter controls + sort header + featured strip`

### Task 1.3: `<DiscoverShell>` + page.tsx scaffold

**Files:** `discover/_components/discover-shell.tsx`, `discover/page.tsx`

- [ ] `<DiscoverShell>` (server): `{ tab: TabId; sidebar: ReactNode; main: ReactNode }`. Renders 2-col layout — sidebar (240px fixed) + main (flex-1) with gap-6, max-width 1600px, mx-auto, px-6 py-8. Stacked above tab strip (which lives in `page.tsx` already).
- [ ] Rewrite `app/[locale]/(public)/discover/page.tsx`:
   ```tsx
   export default async function DiscoverPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
     const { locale } = await params
     const sp = await searchParams
     const tab = parseTab(typeof sp.tab === 'string' ? sp.tab : undefined)

     return (
       <div className="discover-root">
         <PageHead>
           <Tabs activeTab={tab} locale={locale} />
         </PageHead>
         <DiscoverShell tab={tab} sidebar={renderSidebar(tab, sp, locale)} main={renderMain(tab, sp, locale)} />
       </div>
     )
   }

   function renderSidebar(tab: TabId, sp: SP, locale: string): ReactNode {
     switch (tab) {
       case 'home': return <HomeFilters sp={sp} locale={locale} />
       case 'books': return <BooksFilters sp={sp} locale={locale} />
       case 'sparks': return <SparksFilters sp={sp} locale={locale} />
       case 'hives': return <HivesFilters sp={sp} locale={locale} />
       case 'lists': return <ListsFilters sp={sp} locale={locale} />
       case 'clubs': return <ClubsFilters sp={sp} locale={locale} />
     }
   }
   // identical switch for renderMain → returns <XxxGrid sp={sp} locale={locale} />
   ```
- [ ] Each per-tab `<XxxFilters>` and `<XxxGrid>` ships in later waves as stubs first, real wiring after action extensions land. For W1: create stub files that return `<div>TODO: {tab} {kind}</div>` so the shell compiles.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Run dev server, navigate to `/en/discover?tab=books`, confirm sidebar + main stubs render.
- [ ] Commit `feat(discover/shell): DiscoverShell + page rewrite + 12 stub filter/grid components`

---

## Wave 2 — Action extensions

5 sequential extension commits (one per entity action). Each extension is additive — all new inputs optional, all existing call sites preserved. Surface-shape tests added for every new input variant.

### Task 2.1: Books — `searchBooksAction` extension

**File:** `lib/actions/discover-books.actions.ts`, `lib/actions/__tests__/discover-books-actions.test.ts`

- [ ] Read `searchBooksAction` current signature. Confirm it accepts `{ q?, genre?, sort?, cursor? }` per polish round 4.
- [ ] Extend input schema (Zod):
   ```ts
   const searchBooksInput = z.object({
     q: z.string().max(200).optional(),
     genres: z.array(z.string()).max(14).optional(),  // multi-select; old `genre` keeps working
     length: z.enum(['any', 'short', 'novella', 'novel', 'epic']).optional(),
     status: z.enum(['any', 'ongoing', 'completed']).optional(),
     series: z.enum(['any', 'standalone', 'in-series']).optional(),
     updated: z.enum(['anytime', 'week', 'month']).optional(),
     sort: z.enum(['trending', 'recent', 'most-liked', 'a-z']).optional(),
     cursor: z.string().optional(),
   })
   ```
- [ ] WHERE-clause additions in `buildPublicBookFilters`:
   - `genres`: `inArray(books.genre, genres)` when non-empty.
   - `length`: word-count bucket — `lt(wc, 20000)` / `between(wc, 20000, 50000)` / `between(wc, 50000, 120000)` / `gt(wc, 120000)`.
   - `status`: Ongoing = `gte(books.updatedAt, now - 90d)`. Completed = `lt(books.updatedAt, now - 90d)`. `status='PUBLISHED'` already in base filter.
   - `series`: standalone = `isNull(books.seriesName)`. in-series = `isNotNull(books.seriesName)`.
   - `updated`: `gte(books.updatedAt, now - {7|30}d)`.
- [ ] Add surface-shape tests for each new input variant (8 cases). Use existing test file pattern.
- [ ] Run `npm test -- discover-books` + `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/books): extend searchBooksAction — length/status/series/updated/multi-genre filters`

### Task 2.2: Sparks — `searchSparksAction` extension

Mirror Task 2.1 shape.

- [ ] Add Zod fields: `state: 'live'|'voting'|'ended'|'all'`, `wordLimit: 'any'|'flash'|'medium'|'long'`, `timeLeft: 'any'|'24h'|'week'`, `creator: 'anyone'|'following'`. Preserve `genres[]` extension.
- [ ] WHERE additions:
   - `state=live` → `votingDeadline > now AND winnerEntryId IS NULL` (currently-accepting branch).
   - `state=voting` → `votingDeadline > now AND votingStart <= now`.
   - `state=ended` → `winnerEntryId IS NOT NULL OR votingDeadline < now`.
   - `wordLimit`: flash = `lt(sparks.wordLimit, 500)`; medium = `between(500, 2000)`; long = `gte(2000)`.
   - `timeLeft`: 24h = `lt(votingDeadline, now + 24h)`; week = `lt(votingDeadline, now + 7d)`.
   - `creator=following`: subquery on `follows` table (mirror D2a Following rail).
- [ ] Surface-shape tests (8 cases).
- [ ] Run `npm test -- discover-sparks` + `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/sparks): extend searchSparksAction — state/wordLimit/timeLeft/creator filters`

### Task 2.3: Hives — `searchHivesAction` extension

- [ ] Add Zod fields: `openStates: ('collaborators'|'open-to-join')[]`, `linked: ('has-book'|'standalone')[]`. Existing `size` + `activity` filters preserved per D2b.
- [ ] WHERE additions:
   - `openStates.includes('collaborators')` → `lookingForCollaborators = true`.
   - `openStates.includes('open-to-join')` → `openJoin = true`. Treat as OR within group.
   - `linked.includes('has-book')` → `bookId IS NOT NULL`.
   - `linked.includes('standalone')` → `bookId IS NULL`. OR-within-group.
- [ ] Surface-shape tests (4 cases).
- [ ] Run `npm test -- discover-hives` + `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/hives): extend searchHivesAction — openStates + linked filters`

### Task 2.4: Lists — `searchListsAction` extension

- [ ] Add Zod fields: `popularity: 'any'|'10+'`, `updated: 'anytime'|'month'`, `curator: 'anyone'|'following'`. Preserve `size` per D3a.
- [ ] WHERE additions:
   - `popularity='10+'` → `gte(reading_lists.follower_count, 10)` (denorm column from D3a).
   - `updated='month'` → `gte(reading_lists.last_updated_at, now - 30d)`.
   - `curator='following'` → subquery on `follows`.
- [ ] Surface-shape tests (6 cases).
- [ ] Commit `feat(discover/lists): extend searchListsAction — popularity/updated/curator filters`

### Task 2.5: Clubs — `searchClubsAction` extension

- [ ] Add Zod fields: `accessStates: ('open'|'approval')[]`, `currentBook: ('has-current'|'between')[]`. Preserve `size`+`activity` per D3b.
- [ ] WHERE additions:
   - `accessStates.includes('open')` → `openJoin = true`. `accessStates.includes('approval')` → `openJoin = false`. OR-within-group.
   - `currentBook.includes('has-current')` → `current_book_id IS NOT NULL`. `currentBook.includes('between')` → `current_book_id IS NULL`. OR-within-group.
- [ ] Surface-shape tests (4 cases).
- [ ] Commit `feat(discover/clubs): extend searchClubsAction — accessStates + currentBook filters`

---

## Wave 3 — Per-entity grid cards (parallel)

5 card components. Can be parallelized across subagents — each is independent, presentation-only, no action dependencies.

### Task 3.1: `<BookGridCard>`

**File:** `discover/_components/book-grid-card.tsx`

- [ ] Client component. Props: `{ book: BookCardData; locale: string }` where `BookCardData = { id, title, authorUsername, authorDisplayName, coverUrl, genre, seriesName?, seriesNumber? }`.
- [ ] Renders 2:3 aspect cover image with `next/image` (paper-warm gradient fallback when `coverUrl` null). Below: Comfortaa bold title (line-clamp-2), mono `@authorUsername` (truncate). Optional genre pill bottom-right when set. Optional series line via existing `<SeriesLine>` from `components/book/series-line.tsx`.
- [ ] Wrap full card in `<Link href={\`/${locale}/books/${book.id}\`}>`. Tile-shadow hover lift.
- [ ] Commit `feat(discover/cards): BookGridCard`

### Task 3.2-3.5: Spark / Hive / List / Club grid cards

Same shape as 3.1, one per entity. Each card MUST keep behavior parity with its existing RailXxxCard sibling (the redesign reshapes layout, not data contract). Reference the existing `rail-{spark,hive,list,club}-card.tsx` for visual specs; clone the data presentation but rebuild the chrome on the new grid card grid.

- [ ] **Sparks**: countdown badge (`⚡ {h}h LEFT` brand-yellow / `🗳 VOTING` muted / `○ ENDED` muted) + prompt excerpt + mono `@creator · {wordLimit}w · {entryCount} entries`.
- [ ] **Hives**: 32×46px linked-book thumb (or dashed-border standalone placeholder) + Comfortaa name + mono `around {book}` / `standalone hive` + overlapping avatar stack (4 max) + activity dot.
- [ ] **Lists**: fanned 3-cover book stack at top (rotation -3°/0°/+3°, -12px overlap, 28×42px each) + Comfortaa title + mono `@curator · {bookCount} books · {followerCount} followers`.
- [ ] **Clubs**: 32×46px current_book cover (dashed "between reads" placeholder otherwise) + Comfortaa name with optional brand-yellow `OPEN` pill when `openJoin` + mono `reading {book}` or italic muted `picking the next book` + avatar stack + activity dot.
- [ ] Each card commits separately: `feat(discover/cards): {Spark|Hive|List|Club}GridCard`.

---

## Wave 4 — Books vertical slice (filter + grid + active chips)

Wire the FIRST full tab end-to-end. Sparks/Hives/Lists/Clubs (W5) parallel-clone this slice; Home (W6) builds on it.

### Task 4.1: `<BooksFilters>` sidebar

**File:** `discover/_components/books-filters.tsx`

- [ ] Server component. Reads parsed search params (call via `parseString`/`parseMultiSelect`/`parseRadio` helpers from W1).
- [ ] Renders `<FilterSidebar title="FILTERS" clearHref={countActive(sp) > 0 ? \`/${locale}/discover?tab=books\` : null}>`.
- [ ] Children — `<FilterSection>` per spec §4.2: Search · Genre · Length · Status · Series · Updated. Each section composes the right primitive with the parsed value.
- [ ] Genre options sourced from `lib/discover/genres.ts` (existing 14-tuple constant).
- [ ] Commit `feat(discover/books): BooksFilters sidebar wiring (6 controls)`

### Task 4.2: `<BooksGrid>` main content

**File:** `discover/_components/books-grid.tsx`

- [ ] Server component. Reads parsed sp, calls extended `searchBooksAction({ ...filters })`.
- [ ] Renders `<SlimFeaturedStrip kind="book" featured={featured} />` (when `searchBooksAction` returns a featured pick — keep existing D1 "Featured Fresh" qualifier logic).
- [ ] Renders `<SortHeader count={totalCount} sortOptions={BOOKS_SORT_OPTIONS} selected={sp.sort ?? 'trending'} entityNoun="books" />`.
- [ ] Renders `<ActiveFilterChips chips={chipsFromSp(sp, locale)} />` — helper builds the chip array from the current sp.
- [ ] 4-col grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`) of `<BookGridCard>`s.
- [ ] Empty state when `items.length === 0` — italic muted "No books match these filters. Try clearing one." + link.
- [ ] Load-more button at bottom when `hasMore` — calls action with `cursor` via client form action (or `<Link>` with cursor in URL for v1 simplicity).
- [ ] Commit `feat(discover/books): BooksGrid wiring — sidebar→action→grid roundtrip`

### Task 4.3: Smoke

- [ ] Run `npm run dev`, navigate to `/en/discover?tab=books`, exercise EVERY filter at least once:
   1. Empty filters render all books.
   2. Pick genre `?genre=fantasy` — grid filters.
   3. Pick length=novel — grid narrows.
   4. Pick status=ongoing — grid narrows.
   5. Pick series=standalone — `isNull(seriesName)` filter applied.
   6. Pick updated=week — only books updated in last 7d.
   7. Toggle search input — debounce works, results filter.
   8. Sort dropdown change — order reflows.
   9. Active filter chips render above grid; click `✕` removes that filter.
   10. "Clear all (N)" wipes to `?tab=books` bare URL.
   11. Refresh `?tab=books&genre=fantasy&length=novel` — server-renders same filtered state.
   12. As guest (logout), confirm no following affordance.
- [ ] If any failure → `fix(discover/books): ...` follow-up commit before moving on.

---

## Wave 5 — Sparks / Hives / Lists / Clubs vertical slices (parallel-eligible)

Each tab is an independent clone of W4's Books vertical slice. Can be dispatched in parallel — no cross-tab dependencies.

### Task 5.1: Sparks slice
- [ ] `<SparksFilters>` — 6 controls per spec §4.3 (Search · State · WordLimit · Genre · TimeLeft · Creator). Header sort options: Ending soon / Most recent / Most entries.
- [ ] `<SparksGrid>` — calls extended `searchSparksAction`. Slim featured strip (top featured live spark when one exists). 3-col grid of `<SparkGridCard>` (sparks are denser than books). Sort options per spec §4.3.
- [ ] Smoke 12 scenarios mirroring W4.3.
- [ ] 2 commits: `feat(discover/sparks): SparksFilters` + `feat(discover/sparks): SparksGrid`.

### Task 5.2: Hives slice
- [ ] `<HivesFilters>` — 6 controls per spec §4.4 (Search · Genre · Size · OpenState · Activity · Linked).
- [ ] `<HivesGrid>` — 3-col grid of `<HiveGridCard>`. Sort: Most active / Most recent / Most members.
- [ ] Smoke.
- [ ] 2 commits.

### Task 5.3: Lists slice
- [ ] `<ListsFilters>` — 6 controls per spec §4.5 (Search · Genre · Size · Popularity · Updated · Curator).
- [ ] `<ListsGrid>` — 3-col grid of `<ListGridCard>`. Sort: Most followed / Most recent / Most books.
- [ ] Smoke.
- [ ] 2 commits.

### Task 5.4: Clubs slice
- [ ] `<ClubsFilters>` — 6 controls per spec §4.6 (Search · Genre · Size · Access · Activity · CurrentBook).
- [ ] `<ClubsGrid>` — 3-col grid of `<ClubGridCard>`. Sort: Most active / Most recent / Most members.
- [ ] Smoke.
- [ ] 2 commits.

---

## Wave 6 — Home tab (cross-entity)

### Task 6.1: `searchHomeMixedAction`

**Files:** `lib/actions/discover-home-mixed.actions.ts`, `lib/actions/__tests__/discover-home-mixed-actions.test.ts`

- [ ] New server action `searchHomeMixedAction({ q?, show?, genres?, from?, sort?, cursor? })`. `show` is `('books'|'sparks'|'hives'|'lists'|'clubs')[]`; default = all 5 checked.
- [ ] Implementation: parallel-fire the 5 extended search actions scoped to the checked entities; each request asks for ~6 rows (so the interleaved grid hydrates with a roughly equal mix). Interleave round-robin per the existing D4 ForYouRail pattern.
- [ ] Return `{ items: Array<{ kind: 'book'|'spark'|'hive'|'list'|'club', data: BookCard | SparkCard | HiveCard | ListCard | ClubCard }>, hasMore, totalCount, featured: SlimFeaturedSource | null }`.
- [ ] Featured source: priority order Books → Sparks → Hives → Lists → Clubs (first non-null wins). Source the data from the respective entity's featured qualifier; pass through to `<SlimFeaturedStrip kind={kind} featured={...} />`.
- [ ] Surface-shape tests (5+ cases): default all-entities · scope to books only · scope to sparks+hives · `from=following` authed · `from=following` guest (no Following filter).
- [ ] Commit `feat(discover/home): searchHomeMixedAction — cross-entity interleaved search`

### Task 6.2: `<HomeFilters>` + `<HomeGrid>`

- [ ] `<HomeFilters>` — 6 controls per spec §4.1 (Search · Show · Genre · From · Updated · Activity). Show is a `<FilterCheckboxGroup>` with 5 entity options.
- [ ] `<HomeGrid>` — calls `searchHomeMixedAction`. Renders `<SlimFeaturedStrip kind={featured.kind} ... />` from the featured source. 3-col grid where each cell dispatches on `item.kind` to the right `<XxxGridCard>` (polymorphic by entity).
- [ ] Smoke `/en/discover?tab=home`: (1) renders all 5 entity types interleaved · (2) `?show=books,sparks` narrows · (3) genre + sort + from filters work · (4) guest sees no Following affordance · (5) refresh preserves URL state · (6) clear-all returns to bare `?tab=home`.
- [ ] 2 commits: `feat(discover/home): HomeFilters` + `feat(discover/home): HomeGrid + interleaved dispatch`.

---

## Wave 7 — Legacy cleanup + ship

### Task 7.1: Delete legacy sub-routes

Per resolved deferred decision 2 (DELETE, not redirect).

- [ ] `git rm -r app/[locale]/(public)/discover/books/` (preserves the new `_components/` subdir under `discover/` — only sub-route dirs removed; double-check the path).
- [ ] `git rm -r app/[locale]/(public)/discover/sparks/`
- [ ] `git rm -r app/[locale]/(public)/discover/hives/`
- [ ] `git rm -r app/[locale]/(public)/discover/lists/`
- [ ] `git rm -r app/[locale]/(public)/discover/clubs/`
- [ ] `npm test` — all green; `npx tsc --noEmit` — clean.
- [ ] Single combined commit `chore(discover): delete legacy D1-D4 sub-routes + per-entity search routes (~26 routes)`. List the deleted directories in commit body.

### Task 7.2: Retire D1-D4 rails/heroes from Discover composition

Per spec §10. The components themselves stay on disk; only their imports from Discover surface go.

- [ ] Grep usages of `<DiscoverRail>`, `<Discover{Spark,Hive,List,Club}Rail>`, `<Featured{Fresh,Spark,Hive,List,Club}Hero>`, `<ForYouRail>`, `<GenreChipStrip>`, `<GenreFooterGrid>`, `<DiscoverRailSubPage>` across the codebase.
- [ ] Confirm zero remaining callers under `app/[locale]/(public)/discover/`. Outside-of-Discover callers (if any from other surfaces) — preserve.
- [ ] If all callers are gone, files stay on disk but are dead-code. Note in commit body that physical deletion is deferred.
- [ ] Commit `chore(discover): retire D1-D4 rails/heroes/chips from Discover composition`

### Task 7.3: AGENTS.md bookkeeping + ship

- [ ] Update AGENTS.md Resume Here block: Last updated → 2026-06-15+ ship date · Last commit → this ship SHA · Current focus → "Discover redesign shipped · ready for smoke" · Next concrete step → "Chris exercises spec §12 acceptance criteria across all 6 tabs."
- [ ] Append a new "Discover Redesign (Bookstore Aisle)" entry to "What Has Been Built" section with: dates, wave SHA map, decisions resolved at plan-time, deferred follow-ups, and the new patterns now load-bearing (URL-as-source-of-truth, filter primitives reusable across tabs, `<DiscoverShell>` 2-col template).
- [ ] Move D1-D4 entries into "Prior shipping" or archive to `AGENTS-archive.md` if the active doc would grow past ~1100 lines (matches archive pattern from [7363218](https://github.com/Cremacious/beehive-studio/commit/7363218)).
- [ ] Commit `docs(agents): discover redesign shipped — bookstore aisle pattern locked across 6 tabs`.

### Task 7.4: Final smoke checklist (all 12 spec §12 criteria)

- [ ] `/en/discover` (no `?tab=`) → Home tab default render.
- [ ] Toggle filters on every tab → URL writes, grid reloads in place.
- [ ] Active chips above grid, `✕` removes filter.
- [ ] "Clear all (N)" wipes to bare `?tab=X`.
- [ ] Sort dropdown reorders grid.
- [ ] Slim featured strip shows when qualifier exists, hidden otherwise.
- [ ] Each tab's sidebar shows the 6 controls listed in spec §4.
- [ ] Books grid renders 4 columns at standard width.
- [ ] All 5 entity search actions return scoped results matching URL params.
- [ ] Home `Show` filter narrows interleaved grid.
- [ ] Guest sees no Following affordance.
- [ ] URL bookmark survives refresh.

---

## Deferred follow-ups (write these into AGENTS.md at ship)

1. **Mobile sidebar** — sidebar drawer/sheet on `< sm` breakpoint. Pure UI, no schema. Spec §11 follow-up.
2. **Facet counts** — wire `(count)` annotations on filter options via a sibling `countXxxByFacetAction` per entity. UI ready; needs action work.
3. **Saved filter presets** — new schema `user_discover_presets`. Spec §11.
4. **Cross-entity genre hubs** — `/discover/genre/[slug]` currently Books-only. Could expand to a true cross-entity hub.
5. **Books `completion_status` explicit field** — if the 90-day Ongoing/Completed heuristic misclassifies, add a schema field and migrate.
6. **Sub-route URL redirects** — if external bookmark 404s are observed in logs, add 308 redirects from the deleted legacy routes to the equivalent `?tab=X&...` URLs.
7. **Search autocomplete / typeahead** — v1 inputs are vanilla debounced text. Could add per-entity autocomplete with cached suggestions.

---

## Self-review notes

- **Spec coverage:** All 12 spec §12 acceptance criteria mapped to W4-W6 smoke tasks. All 6 tabs covered (Home in W6, others in W4/W5). All 3 deferred decisions resolved at plan-top. NO TBD/TODO in tasks (the `// TODO(plan): facet counts` inline comment is intentional and tracked as deferred follow-up #2).
- **Type consistency:** `searchHomeMixedAction` returns `{ kind, data }` discriminated union; `<HomeGrid>` polymorphic dispatch matches. Filter primitive prop names (`name`, `options`, `selected`) consistent across the 6 primitives. URL state helpers use `TabId` union consistently.
- **File responsibility:** 14 new components average ~100 LOC each. URL state helper is ~120 LOC standalone testable. 5 action extensions are additive (no logic churn on existing rails).
