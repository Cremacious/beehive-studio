# D4 — Discover Home (Design Spec)

**Date:** 2026-06-11
**Sub-project of:** Discover Phase (D1 ✅ → D2a ✅ → D2b ✅ → D3a ✅ → D3b ✅ → **D4 Home**) — FINAL D-phase deliverable.
**Status:** Locked autonomously by pattern application, awaiting execution.

---

## 1. Intent

D1-D3b deepened all 5 entity tabs (Books · Sparks · Hives · Lists · Clubs). The `/discover` root currently defaults to `?tab=books` — the entire surface is "tab-first." D4 adds a new **Home** tab (the new default) that surfaces the top of each entity's discovery rail in one cross-entity scrollable home, plus a "From writers you follow" personalized aggregate when authed.

After D4 ships, the Discover Phase is COMPLETE.

## 2. Decisions

| Q | Decision |
|---|----------|
| Q1 — IA | Add 6th tab `Home` as the FIRST in the tab strip + the new default when no `?tab=` set. Existing 5 tabs preserved with no changes to their content. |
| Q2 — Rails (cross-entity, 6 max) | "Top books trending now" · "Sparks live right now" · "Active hives" · "Most-followed lists" · "Active clubs" · "For you — from writers you follow" (authed only, aggregates first 2 books + 2 sparks + 2 hives + 2 lists + 2 clubs). |
| Q3 — Hero | Reuses D1's `<FeaturedFreshHero>` for the marquee. Single hero — no per-entity hero competition on the home. The "newly published book" signal is most universal. |
| Q4 — Cards | Reuse existing rail card components per entity (no new card variants). Each rail shows up to 6 cards (compact rail format) + "See all in {Entity} →" link routing to the entity's tab home. |
| Q5 — Personalization | "For you" rail = first 2 of each entity's `getFollowing*Action`. Hidden when guest OR authed-zero-follows across all entities. Single mixed-card row using existing rail card variants. |
| Q6 — Schema | NO schema changes. Reuses all existing actions. |

## 3. Page IA

`/[locale]/discover` (no `?tab=` → defaults to `home`):

1. PageHead → tab strip (now 6 tabs: Home · Books · Sparks · Hives · Lists · Clubs).
2. **Featured Fresh hero** (reused from D1 — `<FeaturedFreshHero>` with `getFeaturedFreshBookAction()`, hidden when no qualifier).
3. **Cross-entity rails** stacked:
   - Top books trending — first 6 from `getTrendingBooksAction()`. "See all books →" routes to `/discover?tab=books`. Reuses `<DiscoverRail>` + `<RailBookCard>`.
   - Sparks live right now — first 6 from `getLiveNowSparksAction()`. "See all sparks →" routes to `/discover?tab=sparks`. Reuses `<DiscoverSparkRail>` + `<RailSparkCard>` (with `showUrgencyCaption`).
   - Active hives — first 6 from `getRecentlyActiveHivesAction()`. "See all hives →" routes to `/discover?tab=hives`. Reuses `<DiscoverHiveRail>` + `<RailHiveCard>`.
   - Most-followed lists — first 6 from `getMostFollowedListsAction()`. "See all lists →" routes to `/discover?tab=lists`. Reuses `<DiscoverListRail>` + `<RailListCard>`.
   - Active clubs — first 6 from `getActiveClubsAction()`. "See all clubs →" routes to `/discover?tab=clubs`. Reuses `<DiscoverClubRail>` + `<RailClubCard>`.
4. **For You (personalized, authed-only)** — special mixed-entity rail. Top 2 of each entity from the Following actions (`getFollowingFeedAction` for books — verify exact name; `getFollowingSparksAction`; `getFollowingHivesAction`; `getFollowingListsAction`; `getFollowingClubsAction`). Hidden when guest OR total count = 0. Renders as one row with interleaved card variants per entity (cards keep their respective styles; rail layout is `overflow-x-auto`). New shared component `<ForYouRail>` orchestrates the mixed render.
5. Footer: "Browse all genres" — 14-tile grid linking to **Books** genre hubs (`/discover/genre/[slug]` — D1's existing route). Could expand to cross-entity genre hubs in a future polish pass.

## 4. Components

New under `app/[locale]/(public)/discover/_components/`:
- `for-you-rail.tsx` (server component) — mixed-entity rail. Props: `{ items: Array<{ kind: 'book' | 'spark' | 'hive' | 'list' | 'club', data: any }>, locale: string }`. Renders horizontal scroll with each item dispatched to its entity's RailCard variant. Hidden if `items.length === 0`.

Modified:
- `app/[locale]/(public)/discover/_components/tabs.tsx` — add 'home' as first tab in the union + TABS array.
- `app/[locale]/(public)/discover/page.tsx` — add `HomeTab` server component (the new default) parallel-fetching 6+ actions; tab parser updated to default to 'home' when no `?tab=` set.

## 5. Server actions

NO new actions. Pure orchestration of existing ones:
- `getFeaturedFreshBookAction()` — D1 hero
- `getTrendingBooksAction({})` — D1
- `getLiveNowSparksAction({})` — D2a
- `getRecentlyActiveHivesAction({})` — D2b
- `getMostFollowedListsAction({})` — D3a
- `getActiveClubsAction({})` — D3b
- `getFollowingFeedAction({})` — D1 (books) — verify exact name
- `getFollowingSparksAction({})`, `getFollowingHivesAction({})`, `getFollowingListsAction({})`, `getFollowingClubsAction({})` — D2a/D2b/D3a/D3b

All 5 Following actions throw AuthError on guest; HomeTab catches all 5 and hides "For you" rail if any throw OR if combined result is empty.

## 6. Visual chrome

Inherits design system end-to-end. No new tokens. Brand-yellow restraint additions: "FOR YOU" rail title is brand-yellow (existing rail-title pattern). "See all {Entity} →" link is mono uppercase muted hover brand-yellow (existing pattern). Page width `max-w-7xl` matching tab homes.

## 7. Phasing

~3 tasks (very small ship):
1. T1 Add 'home' tab + tab parser default + `<ForYouRail>` component + `HomeTab` server component composition. Single combined commit.
2. T2 Manual smoke + AGENTS.md ship.

Suggested 2-wave shape: W1=T1, W2=T2.

End of design.
