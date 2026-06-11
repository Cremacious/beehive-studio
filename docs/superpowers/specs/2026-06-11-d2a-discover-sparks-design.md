# D2a — Discover Sparks (Design Spec)

**Date:** 2026-06-11
**Sub-project of:** Discover Phase (D1 Books ✅ shipped → **D2a Sparks** → D2b Hives → D3 Lists+Clubs → D4 cross-surface home)
**Status:** Design locked, awaiting implementation plan

---

## 1. Context and intent

D1 deepened the Books tab of `/discover` from a flat directory into a Royal Road-style rail-driven destination. D2 was originally scoped to cover Sparks + Hives in one sub-project, but during brainstorm Chris locked a split: **D2a Sparks first, D2b Hives second** — each gets its own focused spec + plan, keeping ship size digestible and giving each entity's discovery surface a dedicated conversation.

This spec covers **D2a Sparks discovery** only. After D2a ships, D2b Hives gets its own brainstorm. The same algorithm-first lean + locked iOS-inspired design system from D1 carry over; D2a reuses D1's `<GenreChipStrip>` + `<GenreFooterGrid>` + `<DiscoverSearchInput>` + `<DiscoverRailSubPage>` + `applyBackfill` + chrome tokens directly.

Current Sparks tab at `/discover?tab=sparks` is a flat 2-col Active grid + linear Past list — same prototype-grade feel D1 Books had pre-deepening. D2a turns it into a rail-stacked surface with 6 rails, a Featured Spark hero, genre chip filtering, search, and per-rail sub-pages.

## 2. Goals

1. Make the Sparks tab feel like a destination — 6 algorithmic rails above the fold + Featured Spark hero + genre browse + search.
2. Algorithm-first (binding from D1): no curator tooling, no themed-round admin work, no editorial picks. Rails derive from existing tables + one denorm column.
3. Reuse D1's chrome + components wherever possible. Cards are Sparks-specific (quote-forward serif prompt design), but the page assembly + chip strip + footer grid + sub-page shell are shared with D1.
4. Genre browsing as first-class affordance — shared 14-genre vocabulary with D1; chip strip on Sparks home scopes all rails + hero in place.
5. Sub-page per rail with filter rail + cursor pagination.
6. Search ships in D2a (title/prompt + genre + status refinements).
7. Transparent low-volume backfill: rails backfill from "Active Sparks (next 30d)" with a labeled caption so the page stays alive without faking signal.

## 3. Non-goals (deferred)

- D2b Hives, D3 Lists+Clubs, D4 cross-surface home.
- Curated content slots (Featured Spark is purely algorithmic).
- Curator-set "themed rounds" / weekly challenges with admin tooling. If Beehive adds themed rounds later they'd be additive — `themedRoundId` FK on sparks or similar — and surface as a `/discover/sparks/themes` route. Out of scope here.
- Spark recommendations based on what the viewer has previously entered.
- Sparks tag system (Sparks adopt `genre` only; no separate tags column).
- Mobile responsive; light mode. Project posture is desktop-dark-only.
- Inline card actions (quick-enter, save-for-later).
- Mature content gating.

## 4. Decisions locked during brainstorm

| Q | Decision |
|---|----------|
| Q1 — Scope inside D2 | Split into D2a Sparks + D2b Hives. D2a is this spec; D2b gets its own. |
| Q2 — Rail set | 6 rails: Live now (with inline "Closing soon" urgency) · Voting now · Heating up · Newly opened · From writers you follow (authed) · Recently won. Taxonomy γ = reuse D1's 14-genre vocabulary as optional `sparks.genre`. |
| Q3 — IA + hero | Hybrid IA mirroring D1 (rail-stacked home + dedicated sub-page per rail + genre chip strip scopes home in place). Single algorithmic Featured Spark hero — most-urgent OPEN with `deadline ≤ 72h`, sorted by `entryCount DESC` then `deadline ASC`. Hidden when no qualifying Spark. "CLOSING SOON" mono badge. |
| Q4 — Schema changes | Ship all four additions: `sparks.genre TEXT NULL` + `sparks.first_publicly_discoverable_at TIMESTAMP NULL` + `sparks.entry_count INTEGER NOT NULL DEFAULT 0` denorm + 4 indexes (discoverable+visibility, status+deadline, status+voting_ends_at, partial first_public). |
| Q5 — Card style | Quote-forward serif prompt (italic Newsreader 2-line clamp) + status strip + status pill + genre pill + author + entry count pill + countdown. v2 layout (~260px, 22px padding, breathing room, hairline divider between prompt and meta). |

## 5. Page IA

`/[locale]/discover?tab=sparks` (Sparks tab), top to bottom:

1. **`PageHead`** — chrome refreshed in D1, unchanged here.
2. **Tab strip** — already refreshed in D1; the Sparks tab now becomes the marquee experience like Books did.
3. **Featured Spark hero** — full-width quote-style card. `status='OPEN'`, `deadline within next 72h`, sorted by `entryCount DESC` then `deadline ASC`, LIMIT 1. Layout: large italic serif prompt (Newsreader, ~28px) + "CLOSING SOON" mono badge top-right + author byline + entry count + big countdown + brand-pill `Enter the Spark →` CTA. Hidden cleanly if no qualifying Spark.
4. **Genre chip strip + search row** — sticky-ish strip. Reuses D1's `<GenreChipStrip>` (chip click updates `?genre=`) + `<DiscoverSearchInput>` (form submit routes to `/discover/sparks/search?q=…`). Chip selection re-scopes all rails AND hero in place.
5. **Six rails stacked** — each wraps the standard panel chrome (gradient + `--sh-card` + `--br-card`) and uses a Sparks-typed generic rail wrapper (`<DiscoverSparkRail>` — sibling of D1's `<DiscoverRail>`). Render order:
    1. Live now
    2. Voting now
    3. Heating up
    4. Newly opened
    5. From prompts by writers you follow (authed only; hidden for guests + zero-follow authed)
    6. Recently won
6. **Browse by genre footer grid** — reuses D1's `<GenreFooterGrid>` component. Counts come from new `getSparkGenreCountsAction` action. Each tile links to `/discover/sparks/genre/[slug]`.

### Sub-routes spawned by D2a

| Route | Purpose |
|---|---|
| `/discover/sparks/live-now` | Sub-page for Live Now rail. |
| `/discover/sparks/voting-now` | Sub-page for Voting Now rail. |
| `/discover/sparks/heating-up` | Sub-page for Heating Up rail. |
| `/discover/sparks/newly-opened` | Sub-page for Newly Opened rail. |
| `/discover/sparks/recently-won` | Sub-page for Recently Won rail. |
| `/discover/sparks/following` | Sub-page for From Writers You Follow. Authed-only; guests redirect to `/sign-in?next=…`. |
| `/discover/sparks/genre/[slug]` | 14 known slugs. Rail-stack scoped to genre. `notFound()` on unknown slug. |
| `/discover/sparks/search` | Search results. Query: `?q=…&genre=…&status=…&sort=…&cursor=…`. |

## 6. Rails — signals and ordering

All rails filter through:
- `canViewSpark` posture (PUBLIC visibility + `discoverable = true`) — existing C2 predicate.
- Viewer block-aware filtering via `getBlockedAuthorIdsForViewer` (the D1 helper — block applies on the Spark's `creatorId`).

### 6.1 Live now

- **Filter:** `status = 'OPEN' AND deadline > now()`.
- **Sort:** `deadline ASC, id DESC`. Cursor: `(deadline, id)`.
- **Inline urgency caption:** cards rendered in this rail get a "Closing soon" mono label above the prompt when `deadline - now() ≤ 48h`. Same rail; no separate Closing Soon rail.
- **Slug:** `live-now`.

### 6.2 Voting now

- **Filter:** `status = 'VOTING' AND voting_ends_at > now()`.
- **Sort:** `voting_ends_at ASC, id DESC`. Cursor: `(voting_ends_at, id)`.
- **Card variation:** displays total vote count (sum of entries' `like_count`) prominently in meta row + countdown to voting close.
- **Slug:** `voting-now`.

### 6.3 Heating up

- **Filter:** `status = 'OPEN' AND entry_count >= 3`.
- **Sort:** `entry_count DESC, deadline ASC, id DESC`. Cursor: `(entry_count, id)`.
- **Slug:** `heating-up`. Uses the new `entry_count` denorm + index.

### 6.4 Newly opened

- **Filter:** `status = 'OPEN' AND first_publicly_discoverable_at >= now() - interval '7 days'`.
- **Sort:** `first_publicly_discoverable_at DESC, id DESC`. Cursor: `(first_publicly_discoverable_at, id)`.
- **Slug:** `newly-opened`. Uses the new `first_publicly_discoverable_at` column + partial index.

### 6.5 From prompts by writers you follow

- **Authed-only.** Hidden entirely for guests AND authed-zero-follows.
- **Filter:** `creator_id IN (follows.followee_id WHERE follower_id = viewer)` AND `status != 'CLOSED'` (only currently-actionable Sparks; no historical noise from people you follow).
- **Sort:** `created_at DESC, id DESC`. Cursor: `(created_at, id)`.
- **Slug:** `following`. Calls `requireAuth` directly (throws AuthError on guest); page-level `.catch()` handles.

### 6.6 Recently won

- **Filter:** `status = 'CLOSED' AND voting_ends_at >= now() - interval '14 days' AND winner_entry_id IS NOT NULL`.
- **Sort:** `voting_ends_at DESC, id DESC`. Cursor: `(voting_ends_at, id)`.
- **Card variation:** displays winner's `@username` + "🏆 won Xd ago" label instead of countdown.
- **Slug:** `recently-won`.

### 6.7 Fallback rule (per-rail backfill)

Every rail returning <4 strict cards backfills from a fallback source, with a transparent mono caption: `"Filling in with active Sparks while [Rail Name] warms up."` Caption disappears once strict criteria yield ≥4 on their own.

- **Default fallback source** (used by Live Now / Voting Now / Heating Up / Newly Opened / Following): "All open Sparks ordered by `deadline ASC` (next 30 days)" — `status='OPEN' AND deadline BETWEEN now() AND now() + interval '30 days'`. Excludes ids already in the strict set.
- **Recently Won fallback source:** "All closed Sparks in last 90 days with winner_entry_id IS NOT NULL ordered by `voting_ends_at DESC`" (since the strict 14-day window is more likely to be sparse than the 7-day signals on other rails).

Implementation: each action returns `{ books, strictCount, nextCursor }` (using D1's `RailResult` shape but with `SparkCard` instead of `BookCard`). Rail component renders the caption when `strictCount < 4 && books.length > 0`. (`books` field name retained from D1 for shape reuse; spec-time clarification — refactor to a generic `items` if it bugs anyone at impl time.)

### 6.8 Genre scoping

Every rail's action takes optional `genre?: GenreSlug`. When set, `sparks.genre = <slug> AND sparks.genre IS NOT NULL` are added to the WHERE clause. The Featured Spark hero also re-scopes to the active genre. Chip strip click → URL `?genre=` update → rails re-fetch.

## 7. Card variants

Three card components ship in D2a, paralleling D1's three.

### 7.1 `<RailSparkCard>` (rail variant — the locked v2 design)

- **Width:** 260px fixed. Padding: 22px.
- **Layout (top → bottom):**
    - Thin status-colored top strip (`--spark-status-open` warm gold / `--brand` yellow / muted gray, 3px high).
    - Pills row: status pill (alpha-tinted by status token) + genre pill (only when `genre` set) + optional "Closing soon" mono label above prompt (Live Now rail only, when `deadline - now() ≤ 48h`).
    - Prompt: italic Newsreader serif 17px (`var(--font-prose)`), 2-line clamp, opening curly-quote prefix in brand-yellow.
    - Hairline divider (`--br-card`).
    - Meta row: author avatar + `@username` (left) + entries pill + countdown (right). Countdown uses status color (gold / brand-yellow / muted) + bold. Recently won variant shows "🏆 @winner won" instead of countdown.
- **Chrome:** tile gradient + `--sh-tile` + `--r-card`. Hover via `onMouseEnter`/`onMouseLeave` inline-style mutation → translateY(-1px) + deepened shadow.
- **Click:** `<Link>` to `/[locale]/sparks/[sparkId]`.

### 7.2 `<DiscoverSparkCard>` (info-dense for sub-pages + search + genre hubs)

- **Width:** ~320px in rail context, full-width row in vertical-list context (default `variant='rail' | 'grid' | 'row'`).
- **Layout:** wider variant of RailSparkCard with:
    - 3-line prompt clamp (instead of 2).
    - Visibility pill in addition to status + genre.
    - Author row with larger avatar + display name (not just `@username`).
    - Expanded meta row: entry count, vote total (when VOTING), winner badge (when CLOSED), countdown.
    - Optional brand-pill CTA on the right: `Enter →` (OPEN) / `Vote →` (VOTING) / `Read winner →` (CLOSED).
- **Chrome:** same panel + tile recipe, larger radius.
- **Used by:** sub-pages, genre hubs, search results.

### 7.3 `<FeaturedSparkHero>`

- **Layout:** full-width panel card. `[grid-template-columns:1fr_auto]`. Left = the prompt area (large italic Newsreader serif, ~28px, 3-line clamp, opening brand-yellow curly-quote). Right = action column with "CLOSING SOON" mono badge at top + big countdown timer + entry count line + brand-pill `Enter the Spark →` CTA.
- **Chrome:** panel gradient outer with subtle brand-soft radial accent in the top-right (mirroring D1's hero pattern).
- **Lifecycle:** rendered ONLY when the qualifying Spark exists. Hidden otherwise; no placeholder, no skeleton.

## 8. Schema changes

One idempotent migration runner `scripts/migrate-d2a.ts` (mirrors D1's shape).

### Additions on `sparks`

- `genre TEXT NULL` — optional. Zod-enforced against D1's 14 `GenreSlug` values at validation layer. No backfill (existing rows get NULL — surface in "All" chip view only when genre filter is off).
- `first_publicly_discoverable_at TIMESTAMP NULL` — set on first transition to `(visibility = 'PUBLIC' AND discoverable = true)`. Subsequent flips back to private + then re-public do NOT update. Backfilled for existing PUBLIC+discoverable rows: `COALESCE(updated_at, created_at)`. Wired into EVERY action that writes both `visibility` and `discoverable` together (audit pattern from D1: grep for `discoverable: \w+` writes).
- `entry_count INTEGER NOT NULL DEFAULT 0` — denorm. Backfilled to current counts via migration: `UPDATE sparks SET entry_count = (SELECT count(*) FROM spark_entries WHERE spark_id = sparks.id)`. Incremented in `submitSparkEntryAction` (in-tx). If entry-delete actions exist, decrement there too — audit and document. If no delete path, no decrement (acceptable; entries are not deletable today per C2).

### Indexes

- `sparks_discoverable_visibility_idx ON (discoverable, visibility)` (if not present).
- `sparks_status_deadline_idx ON (status, deadline)` — supports Live Now + Closing Soon + Heating Up.
- `sparks_status_voting_ends_idx ON (status, voting_ends_at)` — supports Voting Now.
- Partial `sparks_first_public_idx ON (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true` — supports Newly Opened.

### Validation layer

- `lib/validations/spark.ts` — add `genre` field to existing create/update schemas. Zod `.refine(isValidGenre)` or `.enum(GENRES)`.

## 9. Server actions

All in a new file `lib/actions/discover-sparks.actions.ts` (keeps `discover.actions.ts` from growing further). All return `ActionResult<T>` per project posture.

| Action | Args | Returns | Used by |
|---|---|---|---|
| `getFeaturedSparkAction({ genre? })` | optional genre slug | `SparkCard \| null` | Featured Spark hero |
| `getLiveNowSparksAction({ genre?, cursor?, limit? })` | | `RailResult<SparkCard>` | Live now rail + sub-page |
| `getVotingNowSparksAction({ genre?, cursor?, limit? })` | | `RailResult<SparkCard>` | Voting now rail + sub-page |
| `getHeatingUpSparksAction({ genre?, cursor?, limit? })` | | `RailResult<SparkCard>` | Heating up rail + sub-page |
| `getNewlyOpenedSparksAction({ genre?, cursor?, limit? })` | | `RailResult<SparkCard>` | Newly opened rail + sub-page |
| `getFollowingSparksAction({ genre?, cursor?, limit? })` | authed-only; throws AuthError on guest | `RailResult<SparkCard>` | Following rail + sub-page |
| `getRecentlyWonSparksAction({ genre?, cursor?, limit? })` | | `RailResult<SparkCard>` | Recently won rail + sub-page |
| `getSparkBackfillAction({ excludeIds, genre?, limit?, source? = 'open' \| 'closed' })` | | `SparkCard[]` | Inline backfill source for all rails |
| `searchSparksDiscoverAction({ q, genre?, status?, sort?, cursor? })` | required q (trimmed); status ∈ OPEN/VOTING/CLOSED/'all'; sort ∈ relevance/recent/urgent/most-entered | `{ books: SparkCard[]; nextCursor: string \| null }` | `/discover/sparks/search` |
| `getSparkGenreCountsAction()` | none; `unstable_cache` 5min | `Record<GenreSlug, number>` | Genre footer grid |

### Type — `SparkCard`

```ts
export type SparkCard = {
  id: string
  title: string                          // the prompt; C2 stores prompt as title
  status: 'OPEN' | 'VOTING' | 'CLOSED'
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'  // always PUBLIC on rails, but useful for hub/profile reuse
  genre: GenreSlug | null
  deadline: Date | null                  // null only when CLOSED, generally
  votingEndsAt: Date | null
  creatorUserId: string
  creatorUsername: string | null
  creatorDisplayName: string | null
  creatorAvatarUrl: string | null
  entryCount: number
  voteTotal: number                      // sum of entries' likeCount; populated only for VOTING / CLOSED rails
  winnerUserId: string | null
  winnerUsername: string | null
  winnerDisplayName: string | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
}
```

### Pure helpers

- `lib/discover/backfill.ts` — D1's `applyBackfill` is already generic over `{ id: string; [k: string]: unknown }`. Reuse directly. No new file.
- `lib/discover/genres.ts` — D1's `GENRES`, `isValidGenre`, `normalizeGenre`. Reuse directly.
- No new scoring helpers needed — Sparks rails sort by raw signals, not derived scores.

## 10. UI components

### New components in `app/[locale]/(public)/discover/_components/`

- `rail-spark-card.tsx` — variant A (locked v2 design). Client component (hover state).
- `discover-spark-card.tsx` — variant B for sub-pages + search + grids. Client component.
- `featured-spark-hero.tsx` — full-width hero. Client component (countdown updates via interval optional; for v1 it can be server-rendered).
- `discover-spark-rail.tsx` — generic rail wrapper sibling of D1's `<DiscoverRail>`, typed for `RailResult<SparkCard>`. Server component.

### Reused from D1

- `<GenreChipStrip>` (with `tabContext='sparks'` prop adjustment so chip click navigates to `?tab=sparks&genre=`).
- `<DiscoverSearchInput>` (form submit target swaps to `/discover/sparks/search?q=…`).
- `<GenreFooterGrid>` (consumes `getSparkGenreCountsAction` instead of book counts; tile click → `/discover/sparks/genre/[slug]`).
- `<DiscoverRailSubPage>` — already generic-shaped. Pass `result` typed as `RailResult<SparkCard>` and a `cardComponent` slot so it renders `DiscoverSparkCard` instead of `DiscoverBookCard`. **Refactor note:** D1's sub-page hardcodes `<DiscoverBookCard>` for the result list. T9-ish task here is to widen it to accept a `renderCard` prop or split into `DiscoverRailSubPage<TItem>` generic. Pick at plan time.

### Page changes

- `app/[locale]/(public)/discover/page.tsx` — `SparksTab` server component rewrite. Parallel-fetches Featured Spark + 6 rail actions + genre counts. Stacks the same chrome as D1 Books home: hero → sticky chip+search row → 6 rails → footer grid.
- 6 new sub-routes under `app/[locale]/(public)/discover/sparks/` (`live-now/`, `voting-now/`, `heating-up/`, `newly-opened/`, `recently-won/`, `following/` — each a thin `page.tsx` calling its rail's action). Following gates on session + redirects guests.
- New genre hub at `app/[locale]/(public)/discover/sparks/genre/[slug]/page.tsx`. Mirrors D1's `/discover/genre/[slug]/page.tsx` scoped to Sparks with the rail-stack.
- New search at `app/[locale]/(public)/discover/sparks/search/page.tsx` + `_components/search-filter-rail.tsx` (Sparks-specific — has a status filter dropdown in addition to genre + sort).

## 11. Visual chrome

Inherits D1's locked design system end-to-end. No new tokens. Brand-yellow restraint:

- Rail titles
- Active genre chip
- "CLOSING SOON" hero badge
- VOTING status pill + countdown (gold accent for OPEN; brand-yellow for VOTING)
- Search input focus ring
- Brand-pill CTAs (Enter the Spark →, Enter →, Vote →, Read winner →)
- Winner trophy badge ("🏆 @winner won")
- Quote mark prefix on prompt (brand-yellow `"`)

Nowhere else. Closed Sparks render with muted ink and no brand-yellow accents.

### Page widths

- Sparks home (rail-stacked) — `max-w-7xl mx-auto` (matches D1 Books home).
- All sub-pages, genre hubs, search — `max-w-5xl mx-auto` (matches D1).

## 12. Test posture

- **Surface-shape tests** for the 10 new server actions, mirroring C2 `reading-actions.test.ts` static-import-after-vi.mock pattern (the ca51b28 lesson is still load-bearing).
- **No unit tests for new pure helpers** — D1's `applyBackfill` already has tests; no new helpers in D2a.
- **Manual smoke** per AGENTS.md convention. Smoke checklist baked into §14.

## 13. Implementation phasing

Indicative breakdown for the writing-plans pass (final ordering / waves decided in the plan):

- **T1** Schema migration — `sparks.genre` + `first_publicly_discoverable_at` + `entry_count` + 4 indexes. Idempotent runner with backfill + write-site grep + wire all writers. Mirror D1 T1 shape exactly.
- **T2** Server-action layer — single combined commit for all 10 actions in new `lib/actions/discover-sparks.actions.ts`. Plus surface-shape test file. Mirror D1 T3 shape.
- **T3** Card components — `<RailSparkCard>` + `<DiscoverSparkCard>` + `<FeaturedSparkHero>`. Three commits or one combined; implementer choice.
- **T4** Generic Spark rail wrapper `<DiscoverSparkRail>` (sibling of D1's `<DiscoverRail>`).
- **T5** Sparks tab home page rewrite (`SparksTab` server component) — consumes T3 cards + T4 rail wrapper + reused chip strip + reused search input + reused genre footer grid.
- **T6** Generic sub-page refactor — widen D1's `<DiscoverRailSubPage>` to accept a `renderCard` prop or split into `<DiscoverRailSubPage<TItem>>` generic. Land in one commit; D1's Books sub-pages stay functional via the existing default.
- **T7** Six rail sub-routes — single combined commit (matches D1 T10 precedent).
- **T8** Genre hub route — `/discover/sparks/genre/[slug]/page.tsx`.
- **T9** Search route — `/discover/sparks/search/page.tsx` + filter rail (Sparks-specific: status dropdown in addition to D1's genre + tag + sort).
- **T10** Manual smoke + AGENTS.md update + ship.

Suggested 7-wave shape: W1=T1, W2=T2, W3=T3, W4=T4, W5=T5+T6 sequential (T5 consumes T6's refactor — order matters), W6=T7+T8+T9 parallel (4 isolated route scopes), W7=T10.

## 14. Carry-forward smoke checklist

After ship:

1. `/en/discover?tab=sparks` Sparks home renders with rails populated. Rail order = Live now → Voting now → Heating up → Newly opened → Following (authed) → Recently won.
2. Featured Spark hero appears when a qualifying OPEN spark with `deadline ≤ 72h` exists; hidden cleanly when not.
3. Genre chip click re-scopes ALL rails + hero in place without navigation. "All" chip resets.
4. A rail with <4 strict results shows the backfill caption + fills to 4 cards. Caption disappears once strict criteria yield ≥4.
5. "See all →" on each rail goes to its sub-route. Sub-page shows full grid (`<DiscoverSparkCard variant='grid'>`) + filter rail + Load more.
6. Genre hub `/discover/sparks/genre/fantasy` shows the 6 rails scoped to Fantasy. Unknown slug → 404.
7. Search input submits → `/discover/sparks/search?q=…` results page. Filter rail (genre + status + sort) refines.
8. From Writers You Follow rail: visible to authed users who follow ≥1 author with a non-CLOSED spark. Hidden for guests. Hidden for authed-zero-follows.
9. Spark card click → `/[locale]/sparks/[sparkId]` detail page. No inline actions on rail cards (intentional).
10. Quote-forward card design: italic serif prompt, 2-line clamp, opening brand-yellow quote mark, status strip + pill row, hairline divider, author + entries pill + countdown meta row. Reads clean and uncluttered at 260px.
11. Tab strip works; Books / Hives / Lists / Clubs tabs render unchanged.
12. Brand-yellow restraint honored (per §11 list). No surprises.
13. No pure-black backgrounds anywhere.
14. `first_publicly_discoverable_at` migration ran idempotently; backfill populated existing rows; new creates set the column correctly.
15. Block-aware: a viewer who blocks a Spark creator should NOT see that creator's Sparks on any rail / sub-page / search result.
16. Closing Soon urgency caption appears on Live Now rail cards where `deadline ≤ 48h`; absent on cards beyond that window.
17. Sub-page status filter (e.g. `/live-now`'s filter rail) is locked to the rail's status (can't be loosened to ALL — it would defeat the rail's purpose; refine to genre + sort only).
18. `entry_count` denorm increments correctly when a new spark entry is submitted; existing rows' counts match `count(spark_entries)` after the backfill migration.

## 15. Open questions for plan-writing

- Whether to widen D1's `<DiscoverRailSubPage>` to accept a `renderCard` prop OR split into a generic. Recommendation in plan: generic with `<DiscoverRailSubPage<TItem>>` and a `renderCard` slot — cleaner long-term; benefits D2b Hives + D3 Lists/Clubs too.
- Backfill source for Recently Won rail — locked to "closed in last 90 days" but worth re-confirming at impl time: maybe widen to 180d if 90d still produces empty rails in dev.
- Whether `getFeaturedSparkAction` should fallback to "most-entered OPEN with the soonest deadline (any horizon)" if nothing qualifies in the 72h window. v1: no fallback, just hide. If smoke shows the hero is always hidden in dev, widen the window at impl time.
- Whether to drop `voteTotal` from `SparkCard` when the spark is OPEN (since votes only accumulate during VOTING). Probably yes — set to 0 / not computed for OPEN. Document in projection helper.

---

End of design.
