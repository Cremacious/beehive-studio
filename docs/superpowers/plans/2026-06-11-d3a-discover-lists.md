# D3a — Discover Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the rail-driven Discover Lists surface per the locked spec at [docs/superpowers/specs/2026-06-11-d3a-discover-lists-design.md](../specs/2026-06-11-d3a-discover-lists-design.md): 5 algorithmic List rails (Trending / Recently updated / New / Most followed / Following) + Featured List "Rising curator" hero + 14 genre hubs + search + 5 rail sub-routes. Same D-phase patterns from D1/D2a/D2b apply.

**Architecture:** Algorithm-first. Three additive columns on `reading_lists` (`genre` + `first_publicly_discoverable_at` + `last_updated_at` denorm) + 3 indexes. 9 new server actions in NEW file `lib/actions/discover-lists.actions.ts`. Three new card components + 1 new rail wrapper. Reuses D2a's `<DiscoverRailSubPage<TItem>>` with `renderCard` slot. Extends `<GenreChipStrip>` `tabContext` union with `'lists'`.

**Reference precedent:** D2b plan at `docs/superpowers/plans/2026-06-11-d2b-discover-hives.md` is the closest structural mirror — same wave shape + same patterns. Read it before each task and adapt to Lists.

**Resolved open questions:**
1. `bookCoverPreviews` projection via Drizzle raw SQL window function `ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY position) <= 3` joining `books` for cover + title.
2. Featured List hero hidden cleanly when no qualifier (matches D2a/D2b precedent).
3. Search v1 ships without cursor (matches D2a/D2b precedent).
4. `followersGained7d` computed only on Trending rail; other rails set to 0.

---

## File structure

**New:**
- `scripts/migrate-d3a.ts`
- `lib/actions/discover-lists.actions.ts`
- `lib/actions/__tests__/discover-lists-actions.test.ts`
- `app/[locale]/(public)/discover/_components/rail-list-card.tsx`
- `app/[locale]/(public)/discover/_components/discover-list-card.tsx`
- `app/[locale]/(public)/discover/_components/featured-list-hero.tsx`
- `app/[locale]/(public)/discover/_components/discover-list-rail.tsx`
- `app/[locale]/(public)/discover/lists/trending/page.tsx`
- `app/[locale]/(public)/discover/lists/recently-updated/page.tsx`
- `app/[locale]/(public)/discover/lists/new/page.tsx`
- `app/[locale]/(public)/discover/lists/most-followed/page.tsx`
- `app/[locale]/(public)/discover/lists/following/page.tsx`
- `app/[locale]/(public)/discover/lists/genre/[slug]/page.tsx`
- `app/[locale]/(public)/discover/lists/search/page.tsx`
- `app/[locale]/(public)/discover/lists/search/_components/list-search-filter-rail.tsx`
- `app/[locale]/(public)/discover/lists/search/_components/list-search-results.tsx`

**Modified:**
- `db/schema/social.ts` — add 3 columns + 3 indexes to `readingLists`
- `lib/actions/reading-lists.actions.ts` — wire first-public stamp + `last_updated_at` updates at every relevant writer
- `app/[locale]/(public)/discover/page.tsx` — full rewrite of `ListsTab`
- `app/[locale]/(public)/discover/_components/genre-chip-strip.tsx` — extend `tabContext` union with `'lists'`
- `AGENTS.md` — bookkeeping at T8

---

## Task 1: Schema migration

Mirror D2b T1 structure (`docs/superpowers/plans/2026-06-11-d2b-discover-hives.md`).

**Files:** `db/schema/social.ts`, `scripts/migrate-d3a.ts`, `lib/actions/reading-lists.actions.ts`

- [ ] Add 3 columns to `readingLists` drizzle schema (`genre TEXT NULL`, `firstPubliclyDiscoverableAt TIMESTAMP NULL`, `lastUpdatedAt TIMESTAMP NULL`) and 3 indexes per spec §8.
- [ ] Write `scripts/migrate-d3a.ts` idempotent runner with 3 backfills (first_public from COALESCE(updated_at, created_at) for PUBLIC+discoverable+CUSTOM rows; last_updated_at from updatedAt). Mirror migrate-d2b.ts shape.
- [ ] Run migration twice cleanly (all backfills return 0 on second run).
- [ ] Audit `lib/actions/reading-lists.actions.ts` for `discoverable:` writers — grep + apply in-tx first-public stamp gate at each.
- [ ] Wire `last_updated_at = new Date()` UPDATE in same tx as readingListBooks INSERT (addBookToList) + DELETE (removeBookFromList). Audit `readingListBooks` write sites.
- [ ] tsc + tests clean (target 665/665 baseline).
- [ ] Commit `feat(d3a/schema): reading_lists first_public + last_updated_at + genre + 3 indexes`

## Task 2: Server-action layer

Mirror D2b T3 structure. Single combined commit for all 9 actions in NEW `lib/actions/discover-lists.actions.ts`.

- [ ] Define `ListCard` (17 fields per spec §9) + `RailResult<T=ListCard>` types at top.
- [ ] Private helpers: `getBlockedListOwnerIdsForViewer`, `buildPublicListFilters` (filters PUBLIC+discoverable+kind='CUSTOM'+genre+not-blocked), `projectToListCards` (Map-stitch authors + optional followersGained + always bookCoverPreviews via window function), `loadFollowersGained7dMap` (GROUP BY on follows.created_at), `loadBookCoverPreviewsMap` (window function via sql template + db.execute joining books for cover + title).
- [ ] All 9 actions per spec §9. Cheap-path: `followersGained7d` only on Trending. Cursor tuple base64url JSON. Search v1 without cursor.
- [ ] Surface-shape tests at `lib/actions/__tests__/discover-lists-actions.test.ts` mirroring D2b. Add db.execute to mock.
- [ ] tsc + tests clean (+2 from surface-shape tests).
- [ ] Single commit `feat(d3a/actions): discover-lists.actions.ts — 9 rail actions`

## Task 3: Card components + rail wrapper

3 client cards + 1 server rail wrapper. Can ship as single combined commit or split.

- [ ] `<RailListCard>` (client): book stack at top (3 fanned covers with rotation -2°/0°/+2° and -8px overlap, 60px each, paper-warm fallback) + Comfortaa title + curator byline + tags + meta row.
- [ ] `<DiscoverListCard>` (client): info-dense variant. `variant: 'rail' | 'grid' | 'row'`. Adds description + visibility pill + optional `View list →` CTA.
- [ ] `<FeaturedListHero>` (client): full-width with enlarged book stack + RISING CURATOR mono badge + Comfortaa brand-yellow title + follower count column + `View the list →` brand-pill CTA.
- [ ] `<DiscoverListRail>` (server): sibling of D2b's `<DiscoverHiveRail>` typed for `RailResult<ListCard>`.
- [ ] tsc + tests clean (still 665+2=667/667).
- [ ] Commit `feat(d3a/cards): RailListCard + DiscoverListCard + FeaturedListHero + DiscoverListRail`

## Task 4: Lists tab home rewrite

- [ ] Extend `<GenreChipStrip>` `tabContext` union with `'lists'` (chip click → `?tab=lists&genre=`).
- [ ] Rewrite `ListsTab` server component per spec §5: parallel-fetches 7 actions (Featured List + 5 rails + genre counts). Following uses `.catch()` + `hideWhenEmpty`. Footer grid with `linkBase` + `title`.
- [ ] Other tabs untouched.
- [ ] tsc + tests clean.
- [ ] Commit `feat(d3a/home): Lists tab rewrite — rail-stacked + Featured List hero`

## Task 5: 5 rail sub-routes (single combined commit)

- [ ] Create 5 page.tsx files per spec §5 sub-routes. Each ~30 LOC consumes `<DiscoverRailSubPage<ListCard>>` with `renderCard` slot for `<DiscoverListCard variant="grid">`.
- [ ] Following gates on session (mirror D1/D2a/D2b pattern).
- [ ] Per-rail emptyMessage copy.
- [ ] tsc + tests clean.
- [ ] Single commit `feat(d3a/sub-routes): 5 List rail sub-pages`

## Task 6: Genre hub route

- [ ] `/discover/lists/genre/[slug]/page.tsx` per D2b T8 pattern.
- [ ] `notFound()` if invalid slug.
- [ ] Parallel-fetches hero + 4 rails (no Following on genre hub).
- [ ] tsc clean.
- [ ] Commit `feat(d3a/genre-hub): /discover/lists/genre/[slug] route`

## Task 7: Search route + filter rail + results

- [ ] `search/page.tsx` parses q/genre/sort/cursor, calls `searchListsDiscoverAction`.
- [ ] `<ListSearchFilterRail>` (client): genre dropdown + sort segmented (Recent / Most followed / Most books / Relevance — relevance → most-followed with TODO).
- [ ] `<ListSearchResults>` (server): empty states + 2-col grid of DiscoverListCard variant="grid".
- [ ] tsc + tests clean.
- [ ] Commit `feat(d3a/search): /discover/lists/search route + filter rail + results`

## Task 8: Manual smoke + AGENTS.md + ship

- [ ] Manual smoke per spec §14 (Chris).
- [ ] Update AGENTS.md with ship summary, wave SHA map.
- [ ] Commit `docs(d3a): ship — D3a Discover Lists CODE-COMPLETE`

---

## Wave shape

- W1=T1, W2=T2, W3=T3, W4=T4, W5=T5+T6+T7 parallel, W6=T8.

End of plan.
