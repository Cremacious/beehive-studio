# Discover Mode Toggle + Search Redesign

**Date:** 2026-06-17  
**Status:** Approved for implementation

---

## Summary

Two related changes to every tab on `/discover`:

1. **Move search input** from the left sidebar panel to a header row at the top of the main content area.
2. **Add the discovery mode toggle** (All / For You / Trending / Popular) to the sparks, hives, lists, clubs, and home tabs. Books already has it.

The result is a consistent header row on every tab: mode toggle flush left, search input flush right.

---

## Layout (all tabs)

### Before
```
[Sidebar: Search, Genre, ...]    [DiscoveryModeToggle]   (books only)
                                 [SortHeader]
                                 [Grid]
```

### After (Option B — approved)
```
[Sidebar: Genre, ...]            [DiscoveryModeToggle]  [Search input]
                                 [SortHeader]
                                 [Grid]
```

The header row is a `flex justify-between items-center gap-4` div rendered at the top of each `*-grid.tsx` component. The `DiscoveryModeToggle` is already a server component (renders as `<Link>` elements). The `FilterSearchInput` is already a client component and can be rendered directly by a server component.

The sidebar **loses its Search section** on every tab. The sidebar "Clear all (N)" button and `activeCount` no longer count `q` — search is a separate concern from the sidebar filters. Clearing sidebar filters preserves `q` and `mode` in the `clearHref`.

---

## Mode toggle semantics per tab

### Books (no change to logic)
| Mode | Behavior |
|------|----------|
| All | `searchBooksDiscoverAction` — search/filter driven |
| For You | `getForYouBooksAction` — personalized tiers (follows + taste vector) |
| Trending | `getTrendingBooksAction` |
| Popular | `getPopularBooksAction` |

### Sparks (new)
| Mode | Behavior |
|------|----------|
| All | existing default — `searchSparksDiscoverAction`, `sort: 'urgent'` |
| For You | `creator: 'following'` (existing param on `searchSparksDiscoverAction`) |
| Trending | `sort: 'urgent'` (ending soonest = highest urgency) |
| Popular | `sort: 'most-entered'` |

### Hives (new)
| Mode | Behavior |
|------|----------|
| All | existing default — `searchHivesDiscoverAction`, `sort: 'most-active'` |
| For You | new `source: 'following'` param (see §Server action extensions) |
| Trending | `sort: 'most-active'` |
| Popular | `sort: 'most-members'` |

### Lists (new)
| Mode | Behavior |
|------|----------|
| All | existing default — `searchListsDiscoverAction`, `sort: 'most-followed'` |
| For You | `curator: 'following'` (existing param on `searchListsDiscoverAction`) |
| Trending | `sort: 'recent'` (recently updated lists) |
| Popular | `sort: 'most-followed'` |

### Clubs (new)
| Mode | Behavior |
|------|----------|
| All | existing default — `searchClubsDiscoverAction`, `sort: 'most-active'` |
| For You | new `source: 'following'` param (see §Server action extensions) |
| Trending | `sort: 'most-active'` |
| Popular | `sort: 'most-members'` |

### Home (new)
| Mode | Behavior |
|------|----------|
| All | `from: 'anyone'` passed to `searchHomeMixedAction` |
| For You | `from: 'following'` passed to `searchHomeMixedAction` (existing param) |
| Trending | `from: 'anyone'` (v1 same as All — TODO: per-entity trending rails) |
| Popular | `from: 'anyone'` (v1 same as All — TODO: per-entity popular rails) |

The home sidebar currently has a "From: Anyone / Following" radio group. This is now **replaced by the mode toggle** and removed from the sidebar. The `from` param is no longer written to the URL; the grid derives it from `mode` at render time.

---

## Auth + default mode resolution (all tabs)

Reuse `resolveDefaultMode` + `hasAnyDiscoverySignalAction` unchanged for every tab:
- Authed + ≥1 signal (follow, like, or own book) → default `for-you`
- Authed + no signals → default `trending`
- Guest → default `trending`; For You button hidden from toggle

Silent guest fallback: if `?mode=for-you` arrives with no auth (direct URL), resolve to `trending` and proceed. No redirect needed.

---

## Server action extensions

Two actions need a new `source: 'following'` filter for the For You mode.

### `searchHivesDiscoverAction` addition
```ts
source?: 'following'   // new optional param
viewerId?: string      // required when source='following'; ignored otherwise
```
Implementation: when `source === 'following'` and `viewerId` is provided, add a WHERE clause:
```sql
AND h.owner_user_id IN (
  SELECT followee_id FROM follows WHERE follower_id = $viewerId
)
```
This returns hives owned by people the viewer follows. Same block/visibility guards already in the action apply.

### `searchClubsDiscoverAction` addition
```ts
source?: 'following'   // new optional param
viewerId?: string      // required when source='following'; ignored otherwise
```
Implementation: identical pattern — filter `book_clubs.owner_id IN (SELECT followee_id FROM follows WHERE follower_id = $viewerId)`.

Both actions must return gracefully (empty result set, no error) if `source='following'` but `viewerId` is null.

---

## TODO: Proper "For You" algorithms

The v1 "For You" on sparks, hives, lists, clubs, and home is intentionally simple (items from people you follow). A proper personalization algorithm — matching the books tier-1/tier-2/tier-3 approach with genre taste vectors, interaction signals, and trending fallback — should be built as a follow-up for each entity. Track this work per entity:

- [ ] Sparks For You: genre taste + entered-sparks signal + followed-creator boost
- [ ] Hives For You: genre affinity of linked books + hives with followed members (not just owners)
- [ ] Lists For You: genre affinity + liked-books overlap + followed-curator boost
- [ ] Clubs For You: hives-with-followed-members pattern applied to clubs
- [ ] Home For You: deduplicated cross-entity taste graph

---

## Sidebar `activeCount` and `clearHref` rules

After removing search from all sidebars:

1. `activeCount` must **not** include `q` (search is not a sidebar filter).
2. `clearHref` must **preserve** `q` and `mode` — clearing sidebar filters should not wipe the search term or the current mode.

Pattern:
```ts
const clearHref = buildUrl(tab, { q, mode: modeRaw }, `/${locale}/discover`)
```

---

## Files changed

| File | Change |
|------|--------|
| `lib/actions/discover-hives.actions.ts` | Add `source?: 'following'`, `viewerId?: string` to `searchHivesDiscoverAction` |
| `lib/actions/discover-clubs.actions.ts` | Add `source?: 'following'`, `viewerId?: string` to `searchClubsDiscoverAction` |
| `discover/_components/books-grid.tsx` | Add search to header row (already has mode toggle) |
| `discover/_components/books-filters.tsx` | Remove Search section; fix `activeCount` + `clearHref` |
| `discover/_components/sparks-grid.tsx` | Add mode toggle + search header row; add mode dispatch |
| `discover/_components/sparks-filters.tsx` | Remove Search section; fix `activeCount` + `clearHref` |
| `discover/_components/hives-grid.tsx` | Add mode toggle + search header row; add mode dispatch |
| `discover/_components/hives-filters.tsx` | Remove Search section; fix `activeCount` + `clearHref` |
| `discover/_components/lists-grid.tsx` | Add mode toggle + search header row; add mode dispatch |
| `discover/_components/lists-filters.tsx` | Remove Search section; fix `activeCount` + `clearHref` |
| `discover/_components/clubs-grid.tsx` | Add mode toggle + search header row; add mode dispatch |
| `discover/_components/clubs-filters.tsx` | Remove Search section; fix `activeCount` + `clearHref` |
| `discover/_components/home-grid.tsx` | Add mode toggle + search header row; add mode dispatch; derive `from` from mode |
| `discover/_components/home-filters.tsx` | Remove Search section; remove From section; fix `activeCount` + `clearHref` |

No new components. The header row is inlined in each `*-grid.tsx` (different `baseParams` per tab makes a shared wrapper less useful than it sounds).

---

## Search input sizing in header row

`FilterSearchInput` currently renders `w-full` inside its sidebar `<FilterSection>`. In the header row context it should be constrained to a fixed width so it doesn't crowd the mode toggle. Proposed: `w-48` (192px) or `w-56` (224px) via a wrapper `<div>`. The `FilterSearchInput` component itself stays unchanged — just wrap it.

---

## Non-goals / deferred

- Sort dropdown is NOT removed. It stays below the header row (in `SortHeader`), still under the user's control.
- Active filter chips remain below sort, unchanged.
- No new server actions for home Trending/Popular — v1 reuses `from: 'anyone'`.
- No changes to genre chip strips, genre hubs, or rail sub-pages.
- No mobile drawer changes.
