# Reading Lists Hub Redesign — Implementation Plan

**Date:** 2026-06-16
**Spec:** [docs/superpowers/specs/2026-06-16-reading-lists-hub-design.md](../specs/2026-06-16-reading-lists-hub-design.md)
**Cadence:** Mirrors Sparks Hub density-pass (T1-T6) cadence; 8 tasks total.
**Mockup:** `.superpowers/brainstorm/reading-lists-hub-2026-06-16/content/reading-lists-hub.html`

## Wave shape

- **W1 (T1-T2) Foundation** — pure helpers + action layer with projection widening. Sequential because T2 depends on coverPreviews shape decided in T2 itself.
- **W2 (T3-T6) Components** — hub primitives + rail + V2 card + ghost card. Parallelizable internally; T5 + T6 can run as one subagent each, T3 + T4 fit one combined subagent.
- **W3 (T7) Integration** — page rewrite + grid interleave + auth gate. Sequential after W2.
- **W4 (T8) Ship** — smoke + AGENTS.md + push. Chris-driven.

---

## T1 — Pure helpers + Zod (`lib/lists/pick-list-ghosts.ts` + unit tests)

**Files:**
- NEW `lib/lists/pick-list-ghosts.ts`
- NEW `lib/lists/__tests__/pick-list-ghosts.test.ts`

**Exports:**
- `type ListGhostVariant = 'create-list' | 'follow-curator' | 'themed-list-nudge' | 'trending-from-network' | 'like-a-book' | 'share-list-link'`
- `type ListGhostContext = { tab: 'all' | 'yours' | 'following' | 'liked'; ownCount: number; followingCount: number; likedListEmpty: boolean; allListsAreUntagged: boolean; hasHighFollowerList: boolean; trendingFromFriend: { title: string; curator: string } | null; dismissedKeys: Set<string> }`
- `pickListGhosts(ctx: ListGhostContext): ListGhostVariant[]` — returns 0-5 ghost variants in priority order, filtered against `dismissedKeys`. `GHOST_MAX = 5`, `TARGET_TOTAL = 6` (mirrors Sparks Hub T4 helper shape).

**Selection logic:**
- Returns `[]` when `ownCount + followingCount >= 6` (real cards fill the page on their own).
- Per-tab priority arrays push tab-relevant ghosts first (e.g. `yours` tab pushes `create-list`/`themed-list-nudge` ahead of generic suggestions).
- `like-a-book` only when `tab in ['all', 'liked'] && likedListEmpty`.
- `share-list-link` only when `hasHighFollowerList`.
- `trending-from-network` only when `trendingFromFriend !== null`.

**Tests (6):**
1. Returns empty when `realCount >= TARGET_TOTAL`.
2. `yours` tab with `ownCount === 0` pushes `create-list` first.
3. `following` tab with `followingCount === 0` pushes `follow-curator` first.
4. `liked` tab with `likedListEmpty === true` shows `like-a-book`.
5. Dismissed variants filtered out.
6. Caps at `GHOST_MAX = 5` even when many are eligible.

**Accept:** `npm test lib/lists/__tests__/pick-list-ghosts.test.ts` passes. tsc clean. Zero runtime imports beyond stdlib.

---

## T2 — Action layer + coverPreviews projection (`lib/actions/reading-lists-hub.actions.ts`)

**Files:**
- NEW `lib/actions/reading-lists-hub.actions.ts`
- EDIT `lib/actions/discover-lists.actions.ts` — extend projections to include `coverPreviews`
- EDIT `lib/actions/reading-lists.actions.ts` — extend `getListsAction` to include `coverPreviews`
- NEW `lib/actions/__tests__/reading-lists-hub-actions.test.ts`

**Shape:**
- `ListCard` type at the top of the new file:
  ```ts
  type ListCard = {
    id: string;
    title: string;
    description: string | null;
    genre: string | null;
    bookCount: number;
    followerCount: number;
    sourceTag: 'yours' | 'following' | 'liked' | null;
    curator: { userId: string; username: string | null; displayName: string | null; avatarUrl: string | null };
    coverPreviews: { bookId: string; coverUrl: string | null }[]; // top 3 per list
    updatedAt: Date;
  }
  ```

**Actions:**

### `getCommunityListsAction({ tab, sort, page })`
- Tab union `'all' | 'yours' | 'following' | 'liked'`. Sort union `'recent' | 'most-followed' | 'a-z' | 'most-books'`. Default sort `'recent'`.
- `PAGE_SIZE = 9`, `ALL_TAB_BUCKET_CAP = 54`, `SINGLE_BUCKET_CAP = 126`.
- Bucket builders:
  - **Yours:** `readingLists.userId = viewer AND kind = 'CUSTOM'`.
  - **Following:** innerJoin `readingListFollows` where `followerUserId = viewer`.
  - **Liked:** `readingLists.userId = viewer AND kind = 'LIKED'` (always ≤1 row).
- All-tab merges with JS dedup, precedence `yours > liked > following` to assign `sourceTag`.
- Returns `{ rows: ListCard[]; totalCount: number; hasMore: boolean }`.
- Parallel COUNT() query for accurate `totalCount`.

### `getViewerListStatsAction()`
- Returns `{ created: number; following: number; followers: number; booksSaved: number }`.
- 4 parallel COUNT queries: `readingLists where userId=viewer AND kind='CUSTOM'`; `readingListFollows where followerUserId=viewer`; `SUM(follower_count)` denorm across viewer's CUSTOM lists; `COUNT(DISTINCT bookId) FROM readingListBooks JOIN readingLists ON ... WHERE readingLists.userId=viewer`.
- Wrap in React `cache()` so layout + rail share one query per request.

### `getTrendingListsForRailAction({ limit })`
- Default `limit = 4`, max `30` (Hive Hub T7 precedent).
- Top N CUSTOM lists by follower gain in last 7d. Raw SQL: `LEFT JOIN readingListFollows ON ... AND created_at >= now() - interval '7 days'`, GROUP BY, ORDER BY new_followers DESC.
- Returns `Array<{ id: string; title: string; curator: { username, avatarUrl }; coverPreviews: { coverUrl }[]; newFollowersThisWeek: number }>`.

**`coverPreviews` projection widening:**
- New private helper `loadCoverPreviewsMap(listIds: string[])` shared across all 3 hub actions + `getDiscoverableListsAction`.
- Single query via window function:
  ```sql
  SELECT list_id, book_id, cover_url FROM (
    SELECT list_id, book_id, cover_url,
      ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY position) AS rn
    FROM reading_list_books
  ) sub WHERE rn <= 3 AND list_id IN (...);
  ```
- Returns `Map<listId, coverPreviews[]>`. Projection helpers in `discover-lists.actions.ts` consume the same Map.
- Reads `reading_list_books.cover_url` denorm directly — no books JOIN per the established Lists pattern.

**Tests (~10 behavior tests):**
- Each tab's bucket builder filters correctly.
- All-tab dedup precedence works (a list in both Yours and Following gets `sourceTag='yours'`).
- Sort options apply correctly.
- Page param + totalCount work.
- `kind='LIKED'` never appears in Following or All when the viewer doesn't own it.
- `coverPreviews` cap at 3.
- Empty list returns empty coverPreviews array, not null.

**Accept:** 9 new tests + 1 widening test green. tsc clean. Existing `discover-lists.actions.ts` consumers see `coverPreviews` added additively (legacy callers unaffected).

---

## T3 — Hub primitives (`<ListsTabStrip>` + `<ListsSortDropdown>` + `<ListsHubPagination>`)

**Files:**
- NEW `app/[locale]/(app)/reading-lists/_components/lists-tab-strip.tsx`
- NEW `app/[locale]/(app)/reading-lists/_components/lists-sort-dropdown.tsx`
- NEW `app/[locale]/(app)/reading-lists/_components/lists-hub-pagination.tsx`

**Byte-for-byte adaptations** of `<SparksTabStrip>` + `<SparksSortDropdown>` + `<SparksHubPagination>` siblings under `sparks/_components/`.

- **Tab strip:** 4 tabs (`All` · `Yours` · `Following` · `Liked`) with `· N` count suffixes. Active pill brand-yellow filled. Inline URL builder via `URLSearchParams` (does NOT use the shared `lib/discover/url-state.ts:buildUrl` per Sparks Hub W3 precedent — Hub URL contract is parallel-but-distinct from Discover).
- **Sort dropdown:** 4 options (Most recent default · Most followed · A → Z · Most books). Native `<select>`. Preserves `?tab=&page=` on change.
- **Pagination:** numbered-circle `‹ Prev · 1 · 2 · 3 · … · N · Next ›`. Active page `aria-current="page"`. Preserves `?tab=&sort=` across page links; `?page=1` strips param.

**Accept:** tsc clean. Visual match to /sparks siblings via design tokens.

---

## T4 — Right rail (`<ListsRightRail>`)

**Files:**
- NEW `app/[locale]/(app)/reading-lists/_components/lists-right-rail.tsx`

**Server component, 3 sticky panels** (matches /sparks W3 wave):

1. **Your list stats** — 2×2 grid of stat tiles. `Created` tile = flat `rgba(255, 195, 0, 0.10)` bg + `rgba(255, 195, 0, 0.22)` border (NO decorative gradient per Chris's review). Other 3 tiles use standard `--tile-bg` vertical gradient. Empty state: hidden when all 4 are zero AND guest path is gated upstream.
2. **Trending lists** — top 4 rows from `getTrendingListsForRailAction({ limit: 4 })`. Each row: mini 3-cover stack (22×28px, rotated -6°/0°/+6°, -8px overlap), title (line-clamp-1), `@curator · N new`.
3. **Suggested curators** — 2 rows. Reuses `getSuggestedWritersAction` filtered to writers with ≥1 public list (extends action with optional `requirePublicList: boolean` param OR new sibling `getSuggestedListCuratorsAction` — pick at impl time, document choice in commit).

`hidden xl:flex` so rail collapses below 1280px (matches /sparks).

**Accept:** server component renders without client-side state. tsc clean.

---

## T5 — Shared V2 card (`components/list/list-card.tsx` + thin re-exports)

**Files:**
- NEW `components/list/list-card.tsx`
- EDIT `app/[locale]/(public)/discover/_components/rail-list-card.tsx` → thin re-export with `size='sm'`
- EDIT `app/[locale]/(public)/discover/_components/list-grid-card.tsx` (or current Discover grid card path) → thin re-export with `size='md'`

**Card shape** (locked from mockup Section 2 Variant B without gradient):

- Outer panel: `--panel-bg` vertical gradient + `--br-card` + `--sh-card` + `--r-card` (20px). Min-height 280px. `transition: transform 0.15s, box-shadow 0.15s` hover lift.
- **Hero band:** 170px (size='md') or 130px (size='sm') tall. Flat `var(--canvas-dark-300)` bg with 1px bottom hairline `rgba(255,255,255,0.05)`. NO decorative color gradient.
- **Cover stack inside hero:** 3 × 70×105px (size='md') or 50×75px (size='sm'), rotated -8°/0°/+8°, `translateX(20px / -20px)` for outer covers, z-index middle on top, shadow `0 12px 30px rgba(0,0,0,0.7)`.
- **Genre pill** absolute top-right 14×14px from corner: 9px JetBrains Mono uppercase, 0.1em letter-spacing, `rgba(255,255,255,0.06)` bg, `--r-pill` radius, mid-muted text. Hidden when `genre === null`.
- **Body** (padding 14px 18px 18px, flex col, flex-1):
  - Title: 18px Comfortaa bold, `--canvas-dark-ink-strong`, line-height 1.2.
  - Curator row: 18px avatar + handle (`@username`, 11px mono muted).
  - Blurb: 2-line clamp Newsreader italic, 13px, `--canvas-dark-ink-muted`, line-height 1.4. **Fallback when null/empty:** `"<bookCount> books curated by @<handle>."`.
  - Footer (mt-auto): split row, top border `rgba(255,255,255,0.05)`. Left: `<bookCount> BOOKS`. Right: `<followerCount> FOLLOWERS`. Mono uppercase, 10px, 0.06em letter-spacing.
- **Source tag pill** (when on hub surface, `sourceTag !== null`): top-left absolute, 9px mono uppercase, color-coded per Sparks Hub pattern (yours=brand-yellow / liked=soft-purple / following=soft-blue).

**Props:**
```ts
{
  list: ListCard;
  size?: 'sm' | 'md'; // default 'md'
  showSourceTag?: boolean; // default false (true on hub)
  href: string; // full route built by caller
}
```

**Thin re-exports** preserve existing call-site signatures by mapping legacy props → new `<ListCard>` props. No new types exposed at re-export boundary.

**Accept:** /reading-lists hub + /discover?tab=lists + all 5 rail sub-routes render same component. tsc clean. No visual divergence between surfaces beyond `size` + `showSourceTag` differences.

---

## T6 — Ghost card + dismissal hook (`<ListGhostCard>` + `useDismissedListGhosts`)

**Files:**
- NEW `components/list/list-ghost-card.tsx`
- NEW `lib/lists/use-dismissed-list-ghosts.ts`

**Hook:**
- `useDismissedListGhosts()` returns `{ dismissed: Set<string>; dismiss: (variant: ListGhostVariant) => void }`.
- localStorage key `'lists-hub:dismissed-ghosts'`.
- Cross-tab `storage` event listener for sync (mirrors Sparks Hub).

**`<ListGhostCard>` client component:**
- 6 variants encoded in `COPY: Record<ListGhostVariant, { pill: string; glyph: string; title: string; body: string; cta: string; ctaHref?: string }>`.
- Dashed border `2px dashed rgba(255,255,255,0.12)` + flat transparent background (matches mockup).
- Corner pill top-left + dismiss X top-right.
- Glyph (28px lucide icon OR text glyph from COPY), title, body (max-width 200px), CTA brand-tinted pill.
- Variants:
  1. `create-list` → `/reading-lists?new=1` (or wherever the modal opens).
  2. `follow-curator` → `/discover?tab=people`.
  3. `themed-list-nudge` → opens the edit modal for the user's most-recent list (parent threads the id, like Sparks Hub T7).
  4. `trending-from-network` → `/discover/lists/[id]` (id threaded as prop).
  5. `like-a-book` → `/discover?tab=books`.
  6. `share-list-link` → opens share modal for the user's highest-follower list (id threaded as prop).

**Accept:** dismissals persist across reloads; cross-tab sync works; tsc clean.

---

## T7 — Page integration + `<ListsGrid>` + auth gate

**Files:**
- REWRITE `app/[locale]/(app)/reading-lists/page.tsx`
- NEW `app/[locale]/(app)/reading-lists/_components/lists-grid.tsx`

**Page (server component):**
- Parses `?tab=` / `?sort=` / `?page=` via inline `URLSearchParams` reader.
- Auth gate via `getOptionalUserId()` → if null, `redirect('/sign-in?next=/reading-lists')`.
- Parallel-fetches `getCommunityListsAction` + `getViewerListStatsAction` + `getTrendingListsForRailAction` + `getSuggestedListCuratorsAction` via `Promise.all`.
- Renders 1680px outer container → 2-col grid → header (title + "+ New list" CTA) → tab row (tab strip + sort dropdown) → `<ListsGrid>` main + `<ListsRightRail>` aside → pagination.
- "+ New list" CTA wires to existing list creation flow (modal or `/reading-lists/new` — match what's there today).
- Drops any legacy `cm-main`/`cm-wrap` chrome.

**`<ListsGrid>` (client component):**
- Mounts `useDismissedListGhosts()`.
- Computes ghost context (derives `ownCount` / `followingCount` from the page slice — accept v1 deferral matching Hives Hub T8: `hasHighFollowerList` and `trendingFromFriend` hardcoded false initially; document in commit body).
- Calls `pickListGhosts(ctx)` → interleaves ghost cards with real `<ListCard>` rows.
- Renders `<ListCard>` with `showSourceTag={true}` and `href={\`/reading-lists/${list.id}\`}`.

**Accept:**
- `/en/reading-lists` renders the hub when authed; guests bounce to `/sign-in?next=/reading-lists`.
- Tab switches preserve sort. Pagination preserves tab + sort.
- Ghost cards interleave correctly when grid has gaps.

---

## T8 — Smoke + AGENTS.md + push

Chris-driven. Smoke targets:

1. `/en/reading-lists` (no query) → All tab + recent sort default, page renders.
2. Tab strip has 4 pills with counts; click between tabs.
3. Sort dropdown changes order; default `Most recent`.
4. Real list cards render V2 shape: flat hero band + 3-cover stack + genre pill (when set) + Comfortaa title + curator handle + Newsreader blurb + split footer.
5. Source-tag pill appears top-left on hub cards (yours=brand-yellow / following=soft-blue / liked=soft-purple).
6. Ghost cards appear when the page has <6 real cards; dismiss X removes a ghost; dismissal persists across reload.
7. Right rail renders: Stats panel (Created tile flat brand-tinted, NO gradient) + Trending lists rows + Suggested curators with +Follow.
8. Pagination preserves `?tab=&sort=` across page links; `?page=1` strips param.
9. Guest visiting `/reading-lists` redirects to `/sign-in?next=/reading-lists`.
10. `/en/discover?tab=lists` cards render V2 shape (no source-tag pill since `showSourceTag={false}` on Discover).
11. All 5 rail sub-routes (`/discover/lists/trending`, `/discover/lists/recently-updated`, `/discover/lists/new`, `/discover/lists/most-followed`, `/discover/lists/following`) render `size='sm'` V2 cards.
12. `kind='LIKED'` never appears on `/discover` surfaces.
13. tsc clean + tests green.

After smoke passes → AGENTS.md update + push. Reading-lists Hub is then code-complete.

---

## Test target

- T1: +6 tests (pickListGhosts).
- T2: +10 tests (action shapes + projection).
- Total: ~+16 tests over baseline. Existing tests stay green throughout.

## Patterns this plan banks on (proven on Sparks + Hives Hubs)

1. **Aggregator composes sibling actions, returns `{ rows, totalCount, hasMore }`** with per-tab bucket builders + JS dedup with precedence for `All` tab. Same shape across all 3 hubs.
2. **`coverPreviews` via ROW_NUMBER() window** is the established pattern for "preview list per parent" (Hives Hub T1 used same shape for `memberPreviews`).
3. **Pure ghost-selection helper** keeps React + DB out of the "which suggestions?" decision.
4. **localStorage dismissal with `storage` event sync** — per-user UI nicety without server persistence.
5. **Shared `<EntityCard>` at `components/<entity>/<entity>-card.tsx`** consumed by hub + discover + rail sub-routes. Thin re-exports preserve legacy call-site signatures.
6. **`size='sm'|'md'` prop** is how rail cards differ from grid cards without forking the component.

## Open follow-ups likely to surface during smoke

1. T4 trade-off: extend `getSuggestedWritersAction` with `requirePublicList` flag VS new sibling action. Document choice at impl time.
2. T7 hub-context derivation deferrals: `hasHighFollowerList` + `trendingFromFriend` hardcoded false in v1; widen to real flags in follow-up commit.
3. `<ListGhostCard>` variants 3 (themed-list-nudge) + 6 (share-list-link) need parent to thread the right list id; same pattern as Sparks Hub `<SparksGrid>` interleave.
4. If smoke shows the 170px hero band looking top-heavy at narrower widths on `size='sm'`, drop hero to 130px (already speced).
5. Many existing lists have empty `description` — placeholder fallback masks the gap; consider a one-shot blurb-seed migration if real lists look bare.
