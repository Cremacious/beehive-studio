# Reading Lists Hub Redesign — Design Spec

**Date:** 2026-06-16
**Status:** Locked (pending implementation plan)
**Surfaces:** `/[locale]/reading-lists` (personal hub) + `/[locale]/discover?tab=lists` + `/[locale]/discover/lists/...` sub-routes

## Why

Two parallel problems:

1. **`/reading-lists` is a thin personal page.** It shows the viewer's own lists in a flat grid. There's no community context, no nudge toward following curators, no parallel to /sparks or /hives hubs. After the Sparks Hub density pass + Hives Hub V2, /reading-lists is the odd surface out.
2. **`<ListCard>` is visually weak.** Today's card uses a 3-cover fan with -3°/0°/+3° rotation and -12px overlap. It reads as decorative more than informative. On `/discover?tab=lists` it competes with the bookstore-aisle grid for attention but loses every time.

This spec redesigns both surfaces at once because the same `<ListCard>` ships on both, and the personal-hub pattern is now proven enough to template directly off /sparks.

## What ships

### Surface 1 — `/[locale]/reading-lists` rewritten as a personal hub

Mirrors the /sparks density-pass shape:

- 1680px outer container, centered.
- 2-col `xl:grid-cols-[minmax(0,1fr)_300px]` layout (right rail collapses below 1180px).
- Header: title "Your reading lists" + subtitle + "+ New list" brand-pill CTA (no Import CTA in v1 — deferred).
- Tab row: iOS segmented pill strip on the left + sort dropdown on the right.
  - **Tabs:** `All` · `Yours` · `Following` · `Liked` — each with `· N` count suffix.
  - **Sort options:** Most recent (default) · Most followed · A → Z · Most books.
- 3-col grid (`grid-cols-3`), `PAGE_SIZE = 9`. Real `<ListCard>`s interleaved with `<ListGhostCard>`s via a `<ListsGrid>` client component (same pattern as `<SparksGrid>` / `<HivesGrid>`).
- Right rail (300px sticky, `height: calc(100vh - 100px)`):
  - **Panel 1 — Your list stats:** 2×2 grid of stat tiles. `Created` tile is brand-yellow-tinted (`rgba(255, 195, 0, 0.10)` flat, NOT a decorative gradient). Other tiles use the standard `--tile-bg` vertical gradient. Stats: Created · Following · Followers · Books saved.
  - **Panel 2 — Trending lists:** top 4 rows. Each row: a mini 3-cover stack (22×28px each, rotated -6°/0°/+6° with -8px overlap), title, `@curator · N new this week`.
  - **Panel 3 — Suggested curators:** 2 rows with avatar + handle + N lists + +Follow button. Reuses `getSuggestedWritersAction` filtered to writers with ≥1 public list.
- Numbered-circle pagination matching /sparks: `‹ Prev · 1 · 2 · 3 · … · N · Next ›`. Active page brand-yellow filled.
- **Auth gate:** guests redirect to `/sign-in?next=/reading-lists`.

**Tab semantics:**
- `All` — interleaves Yours + Following + Liked, deduped, precedence `yours > liked > following`.
- `Yours` — `readingLists.userId = viewer AND kind = 'CUSTOM'`.
- `Following` — joined via `readingListFollows` where `followerUserId = viewer`.
- `Liked` — `readingLists.userId = viewer AND kind = 'LIKED'` (always ≤1 row in practice — the auto-Liked list).

`Liked` stays excluded from `/discover` as today; the tab on the personal hub is fine because the viewer is the owner.

**Ghost card variants** (6 total, picked by `pickListGhosts` per tab + state):
- `create-list` — "Start your first themed list" (shown when `ownCount === 0`).
- `follow-curator` — "Follow a curator whose taste matches yours" (shown when `followingCount === 0`).
- `themed-list-nudge` — "Make a themed list — earns 3× more followers" (shown when `ownCount > 0 && allListsAreUntagged`).
- `trending-from-network` — "Trending: <list title> by @curator" (shown when a friend just followed a hot list).
- `like-a-book` — "Like a book to start your Liked list" (shown when `likedListEmpty`).
- `share-list-link` — "Your list has N followers — share it" (shown when `ownCount > 0 && a list has ≥10 followers`).

Same localStorage dismissal pattern as Sparks/Hives Hubs. Key: `'lists-hub:dismissed-ghosts'`.

### Surface 2 — `<ListCard>` Variant B (immersive hero, no decorative gradient)

Promotes the redesigned card to `components/list/list-card.tsx`, consumed by `/reading-lists` hub + `/discover?tab=lists` + `/discover/lists/genre/[slug]` + `/discover/lists/search` + the 5 rail sub-routes (Trending / Recently updated / New / Most followed / Following).

**Shape** (locked from mockup at `.superpowers/brainstorm/reading-lists-hub-2026-06-16/content/reading-lists-hub.html`):

```
┌─────────────────────────────────────┐
│  ▓▓▓▓ HERO BAND — flat canvas-300 ▓▓│   ← 170px tall, flat surface,
│      ┌──┐ ┌──┐ ┌──┐                 │     1px hairline border-bottom
│      │  │ │  │ │  │                 │
│      └──┘ └──┘ └──┘                 │   ← 3-cover stack: 70×105px each,
├─────────────────────────────────────┤     -8°/0°/+8° rotation, -20px overlap,
│  Cozy Magic & Tea Shops             │     z-index middle on top
│  • @chris                           │
│  "Atmospheric stories where the     │   ← Body: 18px Comfortaa title,
│   magic feels lived-in, not loud."  │     18px avatar + handle,
│  ─────────────────────────────────  │     2-line Newsreader italic blurb
│  12 BOOKS         48 FOLLOWERS      │   ← Split footer, mono uppercase
└─────────────────────────────────────┘
```

**Key rules:**
1. **NO decorative color gradients.** Hero band = flat `var(--canvas-dark-300)`. The card outer keeps the standard `--panel-bg` vertical depth gradient (load-bearing per Design System rule). 
2. **Cover stack is the visual hook** — same fan rotation as today but inside the hero band, slightly bolder (-8°/0°/+8° vs -3°/0°/+3°).
3. **Blurb required for V2.** If `description` is null/empty, render a 2-line muted placeholder: `"<N> books curated by @<handle>."`. The card layout assumes the blurb slot is filled.
4. **Genre pill** absolute top-right inside the hero band: 9px mono uppercase, `rgba(255,255,255,0.06)` bg, mid-muted text. Hidden when `genre` is null.
5. **Min-height 280px** so the grid rows stay uniform when interleaved with ghost cards.
6. **Hover:** `translateY(-2px)` + deepened shadow. No color change.

**Discoverable rules** stay identical to today: `kind = 'LIKED'` always excluded from `/discover`.

### Cross-surface scope (cleanup)

- `<RailListCard>` (the rail sub-route variant) and `<DiscoverListCard>` (the grid variant) both collapse into thin re-exports of the new `<ListCard>` with `size` prop (`'sm'` for rail, `'md'` for grid). Same pattern as the W3 Spark refactor at [cf4a72e](https://github.com/Cremacious/beehive-studio/commit/cf4a72e).
- Existing shared helpers `lib/utils/rel-time.ts` consumed unchanged.
- `<FeaturedListHero>` (the "Rising curator" hero on `/discover/lists`) untouched — different beast.

## What does NOT ship

- Schema changes. The current `readingLists` + `readingListFollows` + denorm `cover_url`/`title` on `readingListBooks` cover everything V2 needs.
- New activity event types.
- Drag-to-reorder cards.
- Bulk follow / unfollow.
- Mobile drawer for the rail (collapses below 1180px as today).
- The Spotify-style colored hero band Variant B originally proposed. Dropped per Chris's review.
- Import lists CTA. Out of scope; defer.

## Action layer

Three new server actions in NEW file `lib/actions/reading-lists-hub.actions.ts`:

1. **`getCommunityListsAction({ tab, sort, page })`** — the aggregator. Composes existing bucket actions:
   - Yours bucket: query `readingLists` directly (`userId = viewer AND kind = 'CUSTOM'`).
   - Following bucket: reuse `getFollowingListsAction` from `discover-lists.actions.ts`.
   - Liked bucket: query `readingLists` directly (`userId = viewer AND kind = 'LIKED'`).
   - All-tab: union all three, dedup by id with precedence `yours > liked > following`, cap to `ALL_TAB_BUCKET_CAP = 54`, sort by chosen `sort`.
   - `PAGE_SIZE = 9`, `SINGLE_BUCKET_CAP = 126`.
   - Returns `{ rows: ListCard[], totalCount: number, hasMore: boolean }`.

2. **`getViewerListStatsAction()`** — 4 parallel COUNT queries: Created · Following · Followers (SUM across all viewer's CUSTOM lists' `follower_count` denorm) · Books saved (DISTINCT count from `reading_list_books` joined to viewer's lists).

3. **`getTrendingListsForRailAction({ limit })`** — top N CUSTOM lists by `follower_count` gain in last 7d. Reuses existing `getTrendingListsAction` logic if available; otherwise raw SQL over `reading_list_follows.created_at`.

**Projection widening required:** `ListCard` type adds `memberPreviews → coverPreviews: { bookId, coverUrl }[]` (top 3 books per list via `ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY position)`). This is REQUIRED for V2 to render the cover stack — current `getDiscoverableListsAction` projection doesn't include covers for the grid card. Mirror pattern: H1's `getDiscoverableHivesAction` projection widening.

## Components landing

- `lib/lists/pick-list-ghosts.ts` — pure helper + 6 unit tests.
- `lib/lists/use-dismissed-list-ghosts.ts` — localStorage hook.
- `components/list/list-card.tsx` — the V2 shared card.
- `components/list/list-ghost-card.tsx` — 6 ghost variants.
- `app/[locale]/(app)/reading-lists/_components/lists-tab-strip.tsx` — iOS pill row.
- `app/[locale]/(app)/reading-lists/_components/lists-sort-dropdown.tsx` — native select.
- `app/[locale]/(app)/reading-lists/_components/lists-hub-pagination.tsx` — numbered circles.
- `app/[locale]/(app)/reading-lists/_components/lists-right-rail.tsx` — stats + trending + suggested.
- `app/[locale]/(app)/reading-lists/_components/lists-grid.tsx` — client interleave.
- `app/[locale]/(app)/reading-lists/page.tsx` — rewrite.

## Mockup reference

[.superpowers/brainstorm/reading-lists-hub-2026-06-16/content/reading-lists-hub.html](../../.superpowers/brainstorm/reading-lists-hub-2026-06-16/content/reading-lists-hub.html) — Section 1 (hub layout) and Section 2 Variant B (with gradient removed per Chris's review).

## Acceptance criteria

1. `/en/reading-lists` renders the new hub for authed users; guests redirect to `/sign-in?next=/reading-lists`.
2. Tab strip switches between buckets without full page reload (URL `?tab=` driven, server component re-renders).
3. Sort dropdown preserves tab on change; default `recent`.
4. Sparse buckets fill with contextually-picked ghost cards; dismissals persist across page reloads (localStorage).
5. Right rail panels render real data; rail collapses below 1180px.
6. `<ListCard>` V2 ships on `/reading-lists` AND `/discover?tab=lists` AND all `/discover/lists/...` sub-routes — single component, no visual divergence.
7. `kind = 'LIKED'` lists never appear on any `/discover` surface.
8. Pagination preserves `?tab=` + `?sort=` across page links; `?page=1` strips the param.
9. tsc clean; existing tests stay green; ≥6 new tests covering `pickListGhosts` variants.

## Risks

1. **Cover-preview projection cost.** The window function over `reading_list_books` adds one extra query per list page. Pattern is proven (Hives Hub T1 did the same for member avatars), but on first ship monitor query time at `PAGE_SIZE = 9`.
2. **Blurb-required assumption.** Many existing lists have no description. The placeholder fallback masks the gap on the surface; consider a one-shot migration script to seed default blurbs from genre + book count if real lists look empty after smoke.
3. **All-tab dedup precedence.** A list that's both Yours and in Following (impossible today, but if follow-self ever ships) would assign `yours` tag — non-issue for v1.
4. **`<ListCard>` size prop on rail.** The rail sub-routes (5 of them) render the card at narrower width (~240px). The 170px hero band may look top-heavy at that width. Smoke test: if it looks off, drop hero band to 130px when `size='sm'`.

## Out of scope follow-ups

1. Genre filter on the hub (currently only on `/discover`).
2. Bulk-actions toolbar (multi-select rows → unfollow / share / archive).
3. Drag-to-reorder Yours bucket.
4. Per-card "follow" optimistic button on `/discover` grid cards.
5. Mobile sidebar drawer for the rail.
