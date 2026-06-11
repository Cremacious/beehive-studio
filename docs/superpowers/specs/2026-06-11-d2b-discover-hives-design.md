# D2b — Discover Hives (Design Spec)

**Date:** 2026-06-11
**Sub-project of:** Discover Phase (D1 Books ✅ → D2a Sparks ✅ → **D2b Hives** → D3 Lists+Clubs → D4 cross-surface home)
**Status:** Design locked, awaiting implementation plan

---

## 1. Context and intent

D1 + D2a deepened the Books and Sparks tabs of `/discover` into rail-driven destinations matching Royal Road / writing-prompt-platform energy. The Hives tab still uses a basic 2-col PUBLIC hives grid via `getDiscoverableHivesAction` — same prototype-grade shape Books had pre-D1.

D2b deepens the Hives tab into a "find a writing group to participate in" surface using the same algorithm-first pattern + locked iOS design system + D2a's now-load-bearing generic `<DiscoverRailSubPage<TItem>>` shell with `renderCard` slot. After D2b ships, only D3 Lists+Clubs and D4 cross-surface home remain on the D-phase map.

Hives have one structural difference from Books/Sparks worth calling out: **joining is invite-mediated only**. There's no `hive_join_requests` table; users browse the discover surface, click into a hive's existing public dashboard, and contact the owner out-of-band if they want to join. This is intentional — adding a request-to-join flow is a separate sub-project that can land as a follow-up if Chris wants it after D2b smoke. D2b is pure discovery deepening.

## 2. Goals

1. Make the Hives tab feel like a destination — 5 algorithmic rails + Featured Hive hero + genre browse + search.
2. Algorithm-first (binding from D1): no curator tooling, no themed-collection admin work, no editorial picks.
3. Reuse D1 + D2a chrome end-to-end. Hive cards are Hive-specific (community-forward design with linked book thumb + member avatars + activity pulse), but the page assembly + chip strip + footer grid + sub-page shell are shared.
4. Genre browsing is a first-class affordance — Hives inherit genre from their linked book via `hives.book_id → books.genre` join. Same 14-genre vocabulary as D1/D2a; chip strip scopes home in place.
5. Sub-page per rail + member-count bucket filter chips (Small 2–5 / Mid 6–15 / Large 16+) on every sub-page's filter rail.
6. Search ships in D2b (name + description + owner) with genre + size + sort refinements.
7. Transparent low-volume backfill — rails backfill from "any active hive with recent activity" + labeled caption.

## 3. Non-goals (deferred)

- D3 Lists+Clubs, D4 cross-surface home.
- `hive_join_requests` table + request-to-join flow. Browsing → contact owner out-of-band is the v1 path. Future sub-project if smoke shows owners want a moderation queue.
- Hive completion timestamp + "Recently completed" rail. Most platforms have few COMPLETED hives at any time; not worth the schema add.
- Curated content slots (Featured Hive is purely algorithmic).
- Recommendations based on viewer's hive membership history.
- Hive search by topic/tag (Hives have no topic/tag taxonomy beyond linked-book genre).
- Mobile responsive; light mode. Project posture is desktop-dark-only.
- Inline card actions (quick-bookmark, save-for-later).

## 4. Decisions locked during brainstorm

| Q | Decision |
|---|----------|
| Q1 — Scope inside D2b | Discovery-only. No `hive_join_requests` flow. Browse → click → contact owner. |
| Q2 — Rail set | 5 rails: Trending now · Recently active · New communities · Looking for collaborators · From writers you follow (authed). Member-count bucket chips (Small/Mid/Large) live on sub-page filter rails — NOT as separate home rails. Genre = D1's 14 via linked book join. |
| Q3 — IA + hero | Hybrid IA mirroring D1/D2a (rail-stacked home + sub-page per rail + chip strip + genre hubs in place). Featured Hive hero = "Hidden gem" — `member_count <= 10 AND activity_score_7d > platform median`, sorted by activity DESC. Hidden if no qualifier. "HIDDEN GEM" mono badge. |
| Q4 — Schema + search | Ship all three additions: `first_publicly_discoverable_at` + `member_count` denorm + `last_activity_at` denorm + 4 indexes. Search ships in D2b — ILIKE name + description + owner; refinements genre + size + sort. |
| Q5 — Card style | Community-forward (B) — smaller cover thumb left of header, hive name + owner + "around {Book Title}" eyebrow, member avatar stack + count in recessed pill bar, activity pulse + genre at footer. ~280px wide. |

## 5. Page IA

`/[locale]/discover?tab=hives`, top to bottom:

1. **`PageHead`** — chrome already refreshed in D1.
2. **Tab strip** (5 entries Books / Sparks / Hives / Lists / Clubs). Already refreshed; Hives tab becomes the marquee experience like Sparks did in D2a.
3. **Featured Hive hero** — full-width "Hidden gem" spotlight. Hidden cleanly when no qualifier.
4. **Genre chip strip + search row** — sticky chip strip reuses D1's `<GenreChipStrip>` with `tabContext='hives'` (chip click updates `?tab=hives&genre=`). Persistent `<DiscoverSearchInput>` with `searchHref='/discover/hives/search'`.
5. **Five rails stacked** in this exact render order:
    1. Trending now
    2. Recently active
    3. New communities
    4. Looking for collaborators
    5. From writers you follow (authed-only; hidden for guests + authed-zero-follows)
6. **Browse Hives by genre footer grid** — reuses `<GenreFooterGrid>` with `linkBase='/discover/hives/genre/'` + `title='Browse Hives by genre'`. Counts derived from `hives → books` join + group by `books.genre`.

### Sub-routes spawned by D2b

| Route | Purpose |
|---|---|
| `/discover/hives/trending` | Sub-page for Trending now rail. |
| `/discover/hives/recently-active` | Sub-page for Recently active rail. |
| `/discover/hives/new` | Sub-page for New communities rail. |
| `/discover/hives/looking-for-collaborators` | Sub-page for Looking for collaborators rail. Size filter locked to Small. |
| `/discover/hives/following` | Sub-page for From writers you follow. Authed-only; guests redirect to `/sign-in?next=…`. |
| `/discover/hives/genre/[slug]` | 14 known slugs. Rail-stack scoped to genre. `notFound()` on unknown slug. |
| `/discover/hives/search` | Search results. Query: `?q=…&genre=…&size=…&sort=…&cursor=…`. |

## 6. Rails — signals and ordering

All rails filter through:
- PUBLIC + `discoverable = true` + `status = 'ACTIVE'` (COMPLETED hives never surface in discovery).
- Viewer block-aware filtering via new `getBlockedHiveOwnerIdsForViewer` helper (mirrors D1's `getBlockedAuthorIdsForViewer` on `owner_id`).

Pure helper `lib/discover/hive-activity-score.ts` exports:

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

Submissions weighted highest (actual writing throughput); word_logs weighted lowest (noisy — every chapter save fires one). Discussions get 2x because they require sustained thought. Buzz posts are 1x baseline. Chapter REVISED/FINAL flips at 3x because they represent the linked book moving forward.

### 6.1 Trending now

- **Filter:** PUBLIC + discoverable + ACTIVE + score signals over last 7d.
- **Strict criteria:** `activity_score_7d > 0` (any signal in window).
- **Sort:** `activity_score_7d DESC, last_activity_at DESC, id DESC`.
- **Cursor:** `(score, id)`.
- **Slug:** `trending`. Cheap-path projection still computes score (needed for sort).

### 6.2 Recently active

- **Filter:** PUBLIC + discoverable + ACTIVE + `last_activity_at >= now() - interval '7 days'`.
- **Sort:** `last_activity_at DESC, id DESC`.
- **Cursor:** `(last_activity_at, id)`.
- **Slug:** `recently-active`. Uses `last_activity_at` denorm directly — no score computation needed. `activityScore7d` set to 0 on returned cards (cheap-path).

### 6.3 New communities

- **Filter:** PUBLIC + discoverable + ACTIVE + `first_publicly_discoverable_at >= now() - interval '30 days'`.
- **Sort:** `first_publicly_discoverable_at DESC, id DESC`.
- **Cursor:** `(first_publicly_discoverable_at, id)`.
- **Slug:** `new`. Uses partial index. Cheap-path (no score).

### 6.4 Looking for collaborators

- **Filter:** PUBLIC + discoverable + ACTIVE + `member_count <= 5 AND last_activity_at >= now() - interval '30 days'`.
- **Sort:** `last_activity_at DESC, id DESC`.
- **Cursor:** `(last_activity_at, id)`.
- **Slug:** `looking-for-collaborators`. Member-count size filter locked to Small on this rail's sub-page.

### 6.5 From writers you follow

- **Authed-only.** Hidden entirely for guests AND authed-zero-follows.
- **Filter:** PUBLIC + discoverable + ACTIVE + `owner_id IN (follows.followee_id WHERE follower_id = viewer)`.
- **Sort:** `last_activity_at DESC, id DESC`.
- **Cursor:** `(last_activity_at, id)`.
- **Slug:** `following`. Calls `requireAuth()` directly (throws AuthError on guest); page-level `.catch()` handles. No backfill — Following hides cleanly when empty.

### 6.6 Fallback rule (per-rail backfill)

Every rail returning <4 strict cards backfills from **"Any PUBLIC + discoverable + ACTIVE hive with `last_activity_at` in last 30 days, ordered by `last_activity_at DESC`"**, excluding ids already in the strict set. Caption: `"Filling in with recently active Hives while [Rail Name] warms up."` Caption hides once strict criteria yield ≥4.

Implementation: each action returns `{ books, strictCount, nextCursor }` per D1/D2a `RailResult<HiveCard>` shape. `books` field name preserved for component reuse across D-phase.

### 6.7 Genre scoping (via linked book)

Every rail action takes optional `genre?: GenreSlug`. When set, the query joins `books ON books.id = hives.book_id` and adds `books.genre = <slug> AND books.genre IS NOT NULL`. Hero re-scopes too. Genre footer grid counts derive from the same `books`-joined GROUP BY.

### 6.8 Featured Hive hero ("Hidden gem")

`getFeaturedHiveAction({ genre? })`:
- **Filter:** PUBLIC + discoverable + ACTIVE + `member_count <= 10 AND activity_score_7d > 0`.
- **Threshold:** computed `activity_score_7d` must exceed the platform 7-day median. Median wrapped in `unstable_cache` (5min revalidate, key `['discover-hives-activity-median']`).
- **Sort:** `activity_score_7d DESC, last_activity_at DESC, id DESC`.
- **LIMIT 1.** Returns `HiveCard | null`. Hidden cleanly when null.
- **Slug usage:** spec uses the term "Hidden gem" for the hero's mono badge; sub-route slug not applicable (hero has no See-all link).

## 7. Schema changes

One idempotent migration runner `scripts/migrate-d2b.ts` (mirrors D1/D2a shape).

### Additions on `hives`

- `first_publicly_discoverable_at TIMESTAMP NULL` — set on first transition to `(visibility = 'PUBLIC' AND discoverable = true)`. Backfilled from `COALESCE(updated_at, created_at)` for existing rows already PUBLIC+discoverable. Wired into EVERY action that writes both `visibility` and `discoverable` together. **Audit pattern (now-load-bearing):** grep `lib/actions/hive.actions.ts` (and any sibling) for `discoverable: \w+` writes; apply the in-tx gate at every hit.
- `member_count INTEGER NOT NULL DEFAULT 1` denorm. Backfilled: `UPDATE hives SET member_count = (SELECT count(*) FROM hive_members WHERE hive_id = hives.id)`. Incremented in `acceptHiveInviteAction` + `joinHiveByLinkAction` (in-tx alongside member INSERT). Decremented in `leaveHiveAction` + `removeHiveMemberAction` (in-tx, GREATEST guard against underflow). Audit pattern: grep `hiveMembers` INSERT/DELETE writes.
- `last_activity_at TIMESTAMP NULL` denorm. Extend existing H1 `recordHiveActivityTx(tx, opts)` helper to additionally `UPDATE hives SET last_activity_at = now() WHERE id = opts.hiveId` in the same tx (~3-line change). Backfilled: `UPDATE hives SET last_activity_at = (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = hives.id)`.

### Indexes

- `hives_discoverable_visibility_idx ON (discoverable, visibility)` if missing.
- `hives_member_count_idx ON member_count`.
- `hives_last_activity_at_idx ON (last_activity_at DESC)`.
- Partial `hives_first_public_idx ON (first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true`.

## 8. Server actions

All in a NEW file `lib/actions/discover-hives.actions.ts` (keeps `hive.actions.ts` from growing further). All return `ActionResult<T>` per project posture.

| Action | Args | Returns | Used by |
|---|---|---|---|
| `getFeaturedHiveAction({ genre? })` | | `HiveCard \| null` | Featured Hive hero |
| `getTrendingHivesAction({ genre?, size?, cursor?, limit? })` | size ∈ 'small' \| 'mid' \| 'large' \| 'any' (default 'any') | `RailResult<HiveCard>` | Trending rail + sub-page |
| `getRecentlyActiveHivesAction({ genre?, size?, cursor?, limit? })` | | `RailResult<HiveCard>` | Recently active rail + sub-page |
| `getNewHivesAction({ genre?, size?, cursor?, limit? })` | | `RailResult<HiveCard>` | New rail + sub-page |
| `getLookingForCollaboratorsHivesAction({ genre?, cursor?, limit? })` | (size locked to Small internally) | `RailResult<HiveCard>` | Looking-for-collaborators rail + sub-page |
| `getFollowingHivesAction({ genre?, size?, cursor?, limit? })` | authed-only | `RailResult<HiveCard>` | Following rail + sub-page |
| `getHiveBackfillAction({ excludeIds, genre?, size?, limit? = 4 })` | | `HiveCard[]` | Universal backfill source |
| `searchHivesDiscoverAction({ q, genre?, size?, sort?, cursor? })` | required q (trimmed); sort ∈ 'relevance' \| 'recent' \| 'most-active' \| 'most-members' | `{ books: HiveCard[]; nextCursor: string \| null }` | Search page |
| `getHiveGenreCountsAction()` | none; `unstable_cache` 5min | `Record<GenreSlug, number>` | Footer grid |

### Type — `HiveCard`

```ts
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
  activityScore7d: number      // 0 when projection cheap-paths (Recently active / New / Following / cheap backfill source)
  buzzPosts7d: number          // 0 unless rail needs it (Featured hero + Trending only)
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>  // up to 4 (window LIMIT per hive_id)
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
}
```

### Size bucket helper

```ts
// in discover-hives.actions.ts or a sibling pure module:
export function sizeBucketCondition(size: 'small' | 'mid' | 'large' | 'any', col = hives.memberCount) {
  switch (size) {
    case 'small': return and(gte(col, 2), lte(col, 5))
    case 'mid':   return and(gte(col, 6), lte(col, 15))
    case 'large': return gte(col, 16)
    case 'any':
    default:      return sql`true`
  }
}
```

### Block helper

`getBlockedHiveOwnerIdsForViewer(viewerId)` mirrors D1's `getBlockedAuthorIdsForViewer` shape — single bidirectional `userBlocks` query → `Set<string>` for `notInArray` on `hives.ownerId`.

### Cheap-path optimization (per D2a §15 Q4 lesson)

`activityScore7d` + `buzzPosts7d` GROUP BY queries run ONLY on rails that sort or filter on them (Trending + Featured Hive hero + search "most-active" sort). Other rails set these to 0 in the projection. `memberPreviews` Map-stitch uses a window function (`ROW_NUMBER() OVER (PARTITION BY hive_id ORDER BY joined_at)` filter `<= 4`) so it costs one bounded query regardless of how many hives are in the result page.

### Pure helpers

- `lib/discover/hive-activity-score.ts` — per §6 formula. 4 unit tests.
- D1's `applyBackfill` + `GENRES` + `isValidGenre` + `normalizeGenre` all reused.

## 9. UI components

### New components in `app/[locale]/(public)/discover/_components/`

- `rail-hive-card.tsx` — locked B (Community-forward) design. Client component.
    - ~280px wide, 18px padding.
    - Header: 48px portrait linked-book thumb (paper-warm gradient fallback) left + name-meta cluster right (Comfortaa hive name 16px truncate, mono uppercase eyebrow `around {Book Title}`, mono `led by @owner` row with 14px owner avatar).
    - Members section: recessed pill bar (`rgba(255,255,255,0.04)` bg + 8px radius) containing overlapping member avatar stack (first 4, -6px margin overlap, 22px circles with brand-gradient fallback) + member count (`N members`).
    - Hairline divider.
    - Activity row: "● Active Xh ago" with green dot + glow + genre pill right-aligned mono uppercase.
    - Click → `<Link>` to `/[locale]/hive/[hiveId]`. Hover via `onMouseEnter`/`onMouseLeave` inline-style mutation → translateY(-1px) + deeper shadow.

- `discover-hive-card.tsx` — info-dense variant for sub-pages + search + grid + genre hubs.
    - Default `variant: 'rail' | 'grid' | 'row'`.
    - Adds line-clamp-2 description below header.
    - Stat row adds `buzzPosts7d` (when nonzero — only Trending + Featured rails populate it; gated on `> 0` so other rails don't show "0 buzz this week").
    - Visibility pill in addition to genre.
    - Optional brand-pill `Visit →` CTA on the right for `grid` variant.
    - Same panel + tile chrome with larger radius.

- `featured-hive-hero.tsx` — full-width hero. Client component.
    - 3-column layout: [linked book cover 160px portrait paper-warm fallback | center text column | right action column].
    - Top of card: status-colored thin strip (always brand-yellow since hero is always ACTIVE).
    - Center column: "HIDDEN GEM" mono badge (brand-yellow background brand-ink text) + Comfortaa brand-yellow hive name 28px + mono uppercase `around {Book Title}` eyebrow + line-clamp-3 description + owner byline.
    - Right column (vertical stack): member count number + activity pulse + week activity stat ("X actions this week") + brand-pill `Visit the Hive →` CTA.
    - Panel chrome outer with subtle brand-soft radial accent top-right matching D1/D2a hero pattern.
    - Hidden when `hive === null` (parent decides).

- `discover-hive-rail.tsx` — generic rail wrapper sibling of D1's `<DiscoverRail>` and D2a's `<DiscoverSparkRail>`. Server component. Typed for `RailResult<HiveCard>`. Includes backfill caption when `result.strictCount < 4 && result.books.length > 0`, `hideWhenEmpty` for the Following rail.

### Reused from D1/D2a

- `<GenreChipStrip>` — extend the `tabContext` union to include `'hives'` (chip click → `?tab=hives&genre=`).
- `<DiscoverSearchInput>` with `searchHref='/discover/hives/search'`.
- `<GenreFooterGrid>` with `linkBase='/discover/hives/genre/'` + `title='Browse Hives by genre'`.
- `<DiscoverRailSubPage<HiveCard>>` generic shell (already widened by D2a). Pass `renderCard={(item, loc) => <DiscoverHiveCard hive={item} locale={loc} variant="grid" />}` + `loadMoreHrefBase={`/${locale}/discover/hives/`}` + per-rail `emptyMessage`.

### Sub-page filter rail behavior

The 240px filter rail in each sub-page contains:

- Genre chip stack OR dropdown (single-select; matches D2a precedent — multi-select adds friction in v1).
- **Member-count bucket** segmented radiogroup: Any / Small (2–5) / Mid (6–15) / Large (16+). Default per-rail varies:
    - `/looking-for-collaborators` → defaults to Small AND locks the chip (no user override; rail's purpose requires Small).
    - All other rails → defaults to Any.
- Sort overrides per rail (optional). For v1 ship without rail-specific sort overrides; rails respect their primary signal as the only sort.

### Page widths

- Hives home + genre hubs — `max-w-7xl mx-auto`.
- Sub-pages + search — `max-w-5xl mx-auto`.

## 10. Visual chrome

Inherits D1 + D2a end-to-end. No new tokens. Brand-yellow restraint additions for D2b:

- Rail titles (existing).
- Active genre chip (existing).
- "HIDDEN GEM" hero badge.
- Active activity-pulse dot (green, NOT brand-yellow — exception to the "green dot for active" pattern that already exists in the codebase).
- Member-count badge in card stat row (alpha-tinted brand-yellow on the count chip).
- Search input focus ring (existing).
- Brand-pill CTAs: `Visit the Hive →` hero, `Visit →` grid card, `Enter the Hive →` if used anywhere.

Nowhere else.

## 11. Test posture

- **Unit tests** (vitest) for `computeHiveActivityScore7d`: zero inputs → 0, weight verification (submissions 4x, chapter 3x, discussions 2x, buzz 1x, word logs 0.5x), float precision sanity. 4 tests.
- **Surface-shape tests** for the 9 new server actions, mirroring C2 `reading-actions.test.ts` static-import-after-vi.mock pattern.
- **Manual smoke** per AGENTS.md convention. Checklist baked into §13.

## 12. Implementation phasing

Indicative breakdown for the writing-plans pass (final ordering / waves decided in the plan):

- **T1** Schema migration — `hives.first_publicly_discoverable_at` + `member_count` + `last_activity_at` + 4 indexes. Idempotent runner with all three backfills. Wire writer audit: apply in-tx first-public stamp gate at every `discoverable: \w+` writer in `hive.actions.ts`. Wire `member_count` increment/decrement at every `hive_members` INSERT/DELETE site (audit `hive.actions.ts` for `acceptHiveInviteAction`, `joinHiveByLinkAction`, `leaveHiveAction`, `removeHiveMemberAction` — exact names may differ, verify at impl time). Extend `recordHiveActivityTx` in `lib/hive/record-activity.ts` to UPDATE `last_activity_at` in same tx.
- **T2** Pure helper `computeHiveActivityScore7d` in `lib/discover/hive-activity-score.ts` + 4 unit tests.
- **T3** Server-action layer — single combined commit for all 9 actions in new `lib/actions/discover-hives.actions.ts`. Mirror D2a T2 shape.
- **T4** Card components — `<RailHiveCard>` + `<DiscoverHiveCard>` + `<FeaturedHiveHero>`.
- **T5** Generic Hive rail wrapper `<DiscoverHiveRail>`.
- **T6** Hives tab home rewrite (`HivesTab` server component) — consumes T4 cards + T5 rail wrapper + adjusted shared D1 components (`<GenreChipStrip>` gains `'hives'` to its `tabContext` union; `<GenreFooterGrid>` already accepts `linkBase`/`title` from D2a; `<DiscoverSearchInput>` already accepts `searchHref` from D2a).
- **T7** Six rail sub-routes — single combined commit (matches D1 T10 / D2a T7 precedent). 5 rail-slug routes + 1 size-locked Looking-for-collaborators route.
- **T8** Genre hub route — `/discover/hives/genre/[slug]/page.tsx`.
- **T9** Search route — `/discover/hives/search/page.tsx` + filter rail (genre + size + sort).
- **T10** Manual smoke + AGENTS.md update + ship.

Suggested 7-wave shape: W1=T1, W2=T2, W3=T3, W4=T4+T5 parallel (separate files; no import dependencies between them), W5=T6 alone (consumes shared D1 component prop adjustments), W6=T7+T8+T9 parallel (3 isolated route scopes), W7=T10.

## 13. Carry-forward smoke checklist

After ship:

1. `/en/discover?tab=hives` Hives home renders with rails populated. Rail order = Trending → Recently active → New → Looking for collaborators → Following (authed).
2. Featured Hive hero appears when a qualifying hidden gem exists (`member_count <= 10` + `activity_score_7d > median`); hidden cleanly when not.
3. Genre chip click re-scopes ALL rails + hero in place via `?tab=hives&genre=`. "All" resets.
4. A rail with <4 strict results shows the backfill caption + fills to 4 cards. Caption disappears once strict criteria yield ≥4.
5. "See all →" on each rail goes to the right sub-route. Sub-page shows full grid + filter rail with member-count buckets + Load more.
6. `/looking-for-collaborators` sub-page defaults Small bucket AND locks the chip; other rail sub-pages default Any with all 4 chips selectable.
7. Genre hub `/discover/hives/genre/fantasy` shows 5 rails + Featured Hive scoped to Fantasy. Unknown slug → 404.
8. Search input submits → `/discover/hives/search?q=…`. Filter rail (genre dropdown + size segmented + sort segmented) refines. Empty query state: "Type something to search Hives." Empty result state: "No Hives match that search."
9. From Writers You Follow rail: visible to authed users following ≥1 hive owner with an active hive; hidden for guests; hidden for authed-zero-follows.
10. Hive card click → `/[locale]/hive/[hiveId]` existing dashboard. No inline actions on rail cards.
11. Tab strip works; Books / Sparks / Lists / Clubs tabs render unchanged.
12. Brand-yellow restraint honored per §10. No surprises.
13. No pure-black backgrounds anywhere.
14. `first_publicly_discoverable_at` migration ran idempotently; backfill populated existing PUBLIC+discoverable rows; new flips set the column.
15. `member_count` migration ran idempotently; backfill matches `count(hive_members)` per hive; new join/leave flows increment + decrement correctly with GREATEST guard.
16. `last_activity_at` migration ran idempotently; backfill matches `MAX(hive_activity.created_at)` per hive; new activity events update the column in the same tx as the activity row insert.
17. Block-aware: a viewer who blocks a hive owner does NOT see that hive on any rail / sub-page / search result.
18. RailHiveCard reads clean at 280px: book thumb + name + owner + member avatars overlap correctly + activity pulse + genre. No clipping.
19. Featured Hive hero "Visit the Hive →" CTA routes correctly; "HIDDEN GEM" badge renders brand-yellow.

## 14. Open questions for plan-writing

- **`memberPreviews` window-function projection** — Postgres `ROW_NUMBER() OVER (PARTITION BY hive_id ORDER BY joined_at) <= 4` filter is one approach. Drizzle's raw SQL helper is the implementation path. Verify at impl time the query plan stays cheap (`EXPLAIN` shows index scan).
- **Activity median backfill performance** — `computeHiveActivityScore7d` median across all PUBLIC+discoverable+ACTIVE hives is a one-pass aggregate. With ~100s of hives at v1 it's instant. If platform grows past 10k discoverable hives, cache for longer (15min) or denormalize the median.
- **Size bucket on Trending sub-page UX** — Trending defaults to Any, but a writer hunting small-team hives may want size=Small as the URL state on first visit. Recommend at impl: Trending defaults to Any (most-active first, regardless of size), and the chip stays user-overridable.
- **`last_activity_at` granularity** — currently set to `now()` per activity event. If a hive fires 100 events in 5 minutes, that's 100 small UPDATEs. Acceptable for v1 (~100s of discoverable hives × low event rate). If write contention shows up later, batch the column update via cron or condition on `last_activity_at < now() - interval '1 minute'`.

---

End of design.
