# Discover Redesign — Bookstore Aisle (Design Spec)

**Date:** 2026-06-15
**Replaces:** D1-D4 Discover Phase shape (rail-driven entity tabs, genre chip strip, featured heroes).
**Status:** Locked via brainstorm session, awaiting implementation plan.

---

## 1. Intent

The D1-D4 Discover phase built a deep rail-driven surface across all 5 entities (Books, Sparks, Hives, Lists, Clubs) plus a cross-entity Home tab. The rails are a discovery feed, optimized for serendipity. They are NOT optimized for "I know roughly what I want; let me filter." Readers who arrive with intent (a genre, a length, a recency window) currently have to scan rails and chip-filter from a 14-genre strip — a thin filter surface on a curated layout.

This redesign reshapes every Discover tab into an **ecommerce bookstore aisle**: a persistent left sidebar of filters plus a grid of cards. The shape is consistent across all 6 tabs. Curated signals (Featured Fresh, etc.) shrink from full-width heroes to single-line strips above the grid. Per-tab sidebars surface the filters that actually matter for that entity type.

After this ships, Discover is browseable like a bookstore. Today's rails do not survive on entity tabs.

## 2. Decisions

| Q | Decision |
|---|----------|
| Q1 — Layout | Persistent left sidebar (~240px) + main content grid. Same on every tab. Replaces today's rails on entity tabs entirely. |
| Q2 — Filter depth | "Curated essentials" — 6 controls per sidebar. Reaches ~90% of user intent without overwhelm. |
| Q3 — Featured treatment | "Slim featured strip" — 1-line `★ FEATURED · {title} — {caption}` banner above the grid. Hidden when no qualifier. Replaces today's full-width Featured hero card. |
| Q4 — Grid | 4-column responsive grid. Book covers + title + @author (no word count line). Other entity cards keep close to today's RailCard variants. |
| Q5 — URL state | Every filter is a query param. Bookmarkable, shareable, server-rendered first paint. Tab strip preserved at the top unchanged. |
| Q6 — Home tab | Adopts the same shape with a cross-entity "Show" filter (5 entity checkboxes). Main area renders an interleaved grid mixing all 5 entity card variants. |
| Q7 — Schema | NO schema changes. Reuses all D1-D4 server actions; adds new "search/filter" action variants with broader query input. |
| Q8 — Mobile | Out of scope for v1. Plan will note a follow-up for the drawer/sheet pattern. |

## 3. Page IA — shared shape

Every tab (`?tab=home|books|sparks|hives|lists|clubs`) renders the same outer structure:

1. **PageHead** with the existing 6-tab strip (`Home · Books · Sparks · Hives · Lists · Clubs`).
2. **Two-column layout** below the tab strip:
   - **Left sidebar** (`~240px`, persistent, scrollable independently): brand-yellow section headings, mono `--canvas-dark-ink-muted` labels, filter controls (search input · checkbox groups · radio groups · dropdowns), "Clear all (N)" link top-right when ≥1 filter active.
   - **Main content** (flex-1): slim featured strip · header row (`{count} · Sort: {option} ▾`) · active-filter chip row (chips dismissible with `✕`) · 4-column card grid · Load more.

The existing `<GenreChipStrip>`, `<DiscoverRail>` family, `<FeaturedFreshHero>`, `<FeaturedSparkHero>`, `<FeaturedHiveHero>`, `<FeaturedListHero>`, `<FeaturedClubHero>`, `<ForYouRail>`, and `<GenreFooterGrid>` components are **NOT used** by this redesign. They remain in the codebase for potential reuse but are dropped from the Discover composition.

## 4. Per-tab sidebars (6 controls each)

Sort is NOT a sidebar control — it lives in the main content header above the grid (`{count} · Sort: {option} ▾`). Sort options listed per tab below for completeness.

### 4.1 Home
Sidebar (6): **Search** (matches title/name/excerpt across all entities) · **Show** (5 checkboxes — Books · Sparks · Hives · Lists · Clubs, all checked by default) · **Genre** (14-genre multi-select) · **From** (radio — Anyone / Following; Following gated to authed only) · **Updated** (radio — Anytime · This week · This month) · **Activity** (radio — Any · Active recently).
Header sort options: Most recent · Most active · Trending.

### 4.2 Books
Sidebar (6): **Search** (title, author username, tag) · **Genre** · **Length** (radio bucket — Any · Short `<20k` · Novella `20-50k` · Novel `50-120k` · Epic `120k+`) · **Status** (checkbox — Ongoing · Completed; note: today `books.status` is DRAFT/PUBLISHED only — "Ongoing/Completed" needs a new schema field or derivation, to be decided in plan) · **Series** (radio — Any · Standalone only · Part of a series; via `series_name IS NULL` vs non-null) · **Updated** (radio — Anytime · This week · This month).
Header sort options: Trending · Most recent · Most liked · A-Z.

### 4.3 Sparks
Sidebar (6): **Search** (prompt, creator) · **State** (radio — Live (accepting) · Voting open · Ended · All) · **Word limit** (radio — Any · `<500` flash · `500-2000` · `2000+`) · **Genre** · **Time left** (radio — Any · `<24h` · This week) · **Creator** (radio — Anyone · Following).
Header sort options: Ending soon · Most recent · Most entries.

### 4.4 Hives
Sidebar (6): **Search** (hive name, linked book title) · **Genre** (via linked book's genre) · **Size** (radio — Any · Small `2-5` · Medium `6-15` · Large `16+`) · **Open state** (checkbox — Looking for collaborators · Open to join) · **Activity** (radio — Any · Active this week) · **Linked** (checkbox — Has a linked book · Standalone hive).
Header sort options: Most active · Most recent · Most members.

### 4.5 Lists
Sidebar (6): **Search** (list title, curator username) · **Genre** · **Size** (radio — Any · Small `1-5` books · Medium `6-20` · Large `20+`) · **Popularity** (radio — Any · `10+` followers) · **Updated** (radio — Anytime · This month) · **Curator** (radio — Anyone · Following).
Header sort options: Most followed · Most recent · Most books.

### 4.6 Clubs
Sidebar (6): **Search** (club name, current book) · **Genre** · **Size** (radio — Any · Intimate `2-5` · Medium `6-15` · Large `16+`) · **Access** (checkbox — Open to join · Approval required) · **Activity** (radio — Any · Active this week) · **Current book** (checkbox — Has a current read · Between books).
Header sort options: Most active · Most recent · Most members.

## 5. Card design

### 5.1 Books grid card
- 2:3 aspect cover image (with paper-warm fallback gradient).
- Comfortaa bold title, truncate-to-2-lines.
- Mono uppercase `@authorUsername`.
- Genre pill subtle bottom-right when present.
- Hover: subtle lift via existing tile-shadow tokens.

### 5.2 Sparks grid card
- Countdown badge top (`⚡ {timeLeft}` brand-yellow for Live, muted `🗳 VOTING` for voting, muted `○ ENDED` for ended).
- Comfortaa prompt excerpt (truncate-to-2-lines).
- Mono `@creator · {wordLimit}w · {entryCount} entries`.

### 5.3 Hives grid card
- 32×46px linked-book thumb (or dashed-border "no book" placeholder for standalone).
- Comfortaa hive name.
- Mono `around {linked book title}` or `standalone hive`.
- Overlapping member avatar stack (up to 4 circles, -3px margin).
- `🟢 today` / `5h ago` activity pulse.

### 5.4 Lists grid card
- Fanned 3-cover book stack at top (28×42px each, -2°/0°/+2° rotation, 1px overlap).
- Comfortaa list title.
- Mono `@curator · {bookCount} books · {followerCount} followers`.

### 5.5 Clubs grid card
- 32×46px current_book cover thumb (or dashed-border "between reads" placeholder).
- Comfortaa club name with optional "OPEN" brand-yellow pill when `openJoin=true`.
- Mono `reading {current book title}` or italic muted `picking the next book`.
- Member avatar stack + activity pulse.

### 5.6 Home interleaved grid
- 3-column grid (slightly wider cards because of mixed entity types).
- Each card renders in its own entity's visual style — books are book cards, sparks are spark cards, etc.
- Ordering: round-robin by entity (B, S, H, L, C, B, S, H, L, C) using existing D4 ForYouRail interleave pattern.
- Card width adjusts to grid; aspect-ratio per entity unchanged.

## 6. URL state contract

Every filter writes to query params. Server-renders first paint. Examples:

```
/discover?tab=books&genre=fantasy,dark-fantasy&length=novel&series=in-series&updated=week&sort=trending
/discover?tab=sparks&state=live&wordLimit=500-2000&timeLeft=24h&creator=following
/discover?tab=hives&genre=fantasy&size=small&open=collaborators&activity=week
/discover?tab=lists&genre=fantasy&size=medium&popularity=10&updated=month&curator=following
/discover?tab=clubs&genre=fantasy&access=open&activity=week&currentBook=has
/discover?tab=home&show=books,sparks,hives&genre=fantasy&from=following&sort=recent
```

- Multi-select stored as comma-delimited list.
- Single-select stored as single value.
- Missing/empty params = "Any" (no filter).
- "Clear all" returns to `/discover?tab={current}` (no other params).

## 7. Components

New under `app/[locale]/(public)/discover/_components/`:

- `discover-shell.tsx` — server component, renders the two-column layout (sidebar + main). Reads URL search params, dispatches to per-tab `<XxxFilters>` and `<XxxGrid>` components. Replaces the per-tab content components that today's page renders.
- `filter-sidebar.tsx` — shared chrome wrapper. Owns the brand-yellow section headings, "Clear all" link, scroll behavior, sidebar width (--w-discover-sidebar token).
- `filter-section.tsx` — collapsible filter group. Header `▾`/`▸` toggle. Default expanded.
- `filter-search-input.tsx` — debounced search input wired to URL param.
- `filter-checkbox-group.tsx` — multi-select checkbox list with `(count)` annotation per option.
- `filter-radio-group.tsx` — single-select radio list.
- `filter-dropdown.tsx` — native `<select>` styled for the sidebar.
- `active-filter-chips.tsx` — horizontal chip row above the grid, each chip dismissible with `✕`.
- `slim-featured-strip.tsx` — 1-line featured banner. Accepts `{ kind: 'book'|'spark'|'hive'|'list'|'club'|'mixed', featured: any, locale: string }`. Hidden when `featured === null`. On Home tab the source is whichever entity has a current Featured qualifier this week (priority order Books → Sparks → Hives → Lists → Clubs); ties broken by recency.
- Per-tab `<XxxFilters>` + `<XxxGrid>` server components — one pair each for Home, Books, Sparks, Hives, Lists, Clubs. Each `<XxxFilters>` composes shared filter primitives; each `<XxxGrid>` runs the server action with parsed filters and renders the card grid.
- Per-tab grid card components (some new, some lightly reskinned from existing `DiscoverXxxCard` / `RailXxxCard`):
   - `book-grid-card.tsx` (new, replaces today's DiscoverBookCard for this surface)
   - `spark-grid-card.tsx`
   - `hive-grid-card.tsx`
   - `list-grid-card.tsx`
   - `club-grid-card.tsx`

Modified:
- `app/[locale]/(public)/discover/page.tsx` — full rewrite. Reads tab + filter params, dispatches to `<DiscoverShell>` with the right per-tab pair.

Deprecated / removed from Discover composition (kept in repo for now):
- `discover-rail.tsx`, `discover-spark-rail.tsx`, `discover-hive-rail.tsx`, `discover-list-rail.tsx`, `discover-club-rail.tsx`
- `featured-fresh-hero.tsx`, `featured-spark-hero.tsx`, `featured-hive-hero.tsx`, `featured-list-hero.tsx`, `featured-club-hero.tsx`
- `for-you-rail.tsx`, `genre-chip-strip.tsx`, `genre-footer-grid.tsx`
- The 5 entity sub-routes (`/discover/books/...`, `/discover/sparks/...`, etc.) and their `discover-rail-sub-page.tsx` — to be decided in plan: deleted, or kept as deep-link aliases that redirect to the equivalent `?tab=X&...` URL.

## 8. Server actions

NO new server actions strictly required for v1 — each tab uses ONE consolidated search action per entity that accepts the full filter surface:

- `searchBooksAction({ q?, genres?[], length?, status?, series?, updated?, sort?, cursor? })` — extends D1's existing `searchBooksAction` with the new filter inputs. Returns `{ items: BookCard[], hasMore, nextCursor, totalCount, featured: FeaturedBook | null }`.
- `searchSparksAction({ q?, state?, wordLimit?, genres?[], timeLeft?, creator?, sort?, cursor? })` — extends D2a's `searchSparksAction`.
- `searchHivesAction({ q?, genres?[], size?, openStates?[], activity?, linked?[], sort?, cursor? })` — extends D2b's `searchHivesAction`.
- `searchListsAction({ q?, genres?[], size?, popularity?, updated?, curator?, sort?, cursor? })` — extends D3a's `searchListsAction`.
- `searchClubsAction({ q?, genres?[], size?, accessStates?[], activity?, currentBook?[], sort?, cursor? })` — extends D3b's `searchClubsAction`.
- `searchHomeMixedAction({ q?, show?[], genres?[], from?, sort?, cursor? })` — NEW. Parallel-fetches scoped subsets of each entity's search action, interleaves results round-robin, returns `{ items: Array<{ kind, data }>, hasMore }`.

The "count per filter option" affordances (e.g. `Fantasy (48)` in the sidebar) need lightweight count queries — the plan will decide whether to compute these inline with each `searchXxxAction` call or as a sibling `countXxxByFacetAction`.

## 9. Design tokens reused

- `--canvas-dark-200/-250/-300/-350` chrome scale, `--canvas-dark-ink` / `--canvas-dark-ink-muted` for body/labels.
- `--brand` for section headings, active filter chips, sort dropdown arrow, "Clear all" link on hover.
- `--r-card` (20px) for cards, `--r-row` (14px) for filter rows, `--r-pill` (999px) for chips.
- `--sh-card` / `--sh-tile` / `--sh-inset` shadow tokens unchanged.
- New token: `--w-discover-sidebar: 240px` added to `:root` in `app/globals.css`.

Restraint on brand-yellow preserved: filter section headings, active chip border, "OPEN" pill on club cards, Featured strip leading icon, sort dropdown active state. NOT on body checkboxes, NOT on filter row hover, NOT on grid card chrome.

## 10. What this replaces from D1-D4

The D1-D4 rails-and-heroes surface was load-bearing as of 2026-06-11. This redesign retires it from the Discover composition. The decision boundaries:

- **Kept:** the 6-tab strip · the 14-genre vocabulary · all 5 entity search server actions (extended, not replaced) · the existing entity card shapes (close cousins of today's RailXxxCard) · the brand-yellow restraint map · the cool-gray walnut chrome.
- **Retired from Discover:** all 5 `<DiscoverXxxRail>` wrappers · all 5 `<FeaturedXxxHero>` components · `<ForYouRail>` · `<GenreChipStrip>` · `<GenreFooterGrid>` · per-rail sub-routes under `/discover/[entity]/...`. Components remain in the repo for potential reuse elsewhere; the plan will decide deletion-vs-archive.

The deepening done in D1-D4 was not wasted — every server action they shipped is the foundation this redesign builds on. The shape is what changes.

## 11. Out of scope (deferred follow-ups)

1. **Mobile sidebar** — sidebar collapses to a drawer/sheet on small screens; design + breakpoints to be done in a separate pass.
2. **Saved filter presets** — "Save this view" / "My filters" — would need new schema (`user_discover_presets`).
3. **Search autocomplete / typeahead** — every search input is a vanilla debounced text input for v1.
4. **Cross-entity genre hubs** — today `/discover/genre/[slug]` is Books-only. Could expand to a true cross-entity hub.
5. **Books `Ongoing/Completed` filter** — needs a schema decision (new field on `books` or a derived heuristic).
6. **Sub-route URL aliases** — should the existing `/discover/books/trending` etc. redirect to `?tab=books&sort=trending` or 404? Decision deferred to plan.

## 12. Acceptance criteria (smoke targets)

When this ships:

1. `/discover` (no `?tab=`) renders Home tab with sidebar + interleaved grid; first paint server-rendered.
2. Toggling any filter in the sidebar writes the URL param and reloads the grid in place (Next.js navigation, no full page reload).
3. Active filter chips appear above the grid; clicking `✕` on a chip removes that filter from the URL.
4. "Clear all (N)" wipes all filter params, returns to the bare `?tab=X` URL.
5. Sort dropdown changes update the URL `&sort=` param and reorder the grid.
6. Slim featured strip appears when the entity has a qualifier; hidden cleanly otherwise.
7. Each entity tab's sidebar shows the 6 controls listed in §4.
8. Books grid renders 4 columns at standard width; collapses gracefully at smaller widths (mobile drawer behavior is out of scope, but the layout shouldn't break).
9. All 5 entity search actions return correctly-scoped results matching the URL params.
10. Home `Show` filter narrows the interleaved grid to the checked entity types.
11. Guest visitors see no `Following` filter affordance (or see it disabled with a tooltip).
12. URL bookmarks survive a fresh page load — refreshing `?tab=books&genre=fantasy&length=novel` re-renders the same filtered grid.

## 13. Risks

- **Filter explosion of cardinality** — server-side, every filter dimension multiplies the WHERE clause. Plan will audit query performance against the dev DB after wiring.
- **Sparse data exposes the redesign** — the dev DB has few entries per entity, so empty grids will be common during smoke. Real-data smoke depends on seed/imports.
- **Mobile breakage** — explicitly out of scope. Plan will add a mobile follow-up task.
- **Existing deep-links** — anyone who bookmarked `/discover/books/trending` from D1-D4 will need a redirect or a 404 plan.
- **Discoverability regression** — rails actively serendipitize ("here's something cool you didn't ask for"). Sidebar+grid is consent-driven discovery. Users who wanted the lobby experience may miss it. Mitigation: the slim featured strip preserves SOME curation; Home tab's interleaved grid preserves cross-entity exposure.
