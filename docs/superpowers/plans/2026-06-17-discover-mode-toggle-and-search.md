# Implementation Plan — Discover Mode Toggle + Search Redesign

**Spec:** `docs/superpowers/specs/2026-06-17-discover-mode-toggle-and-search-redesign.md`  
**Date:** 2026-06-17

---

## Goal

Move the search input from the sidebar to the header row on every `/discover` tab, and add the All / For You / Trending / Popular mode toggle to every tab (currently books-only).

---

## Wave Structure

```
Wave 1 (T1) — server action extensions (blocks T4 + T6 For You)
Wave 2 (T2–T7, parallel) — grid + filter rewrites for all 6 tabs
```

---

## T1 — Server action extensions (hives + clubs)

**Files:**
- `lib/actions/discover-hives.actions.ts`
- `lib/actions/discover-clubs.actions.ts`

**Hives (`searchHivesDiscoverAction`):**

Add two optional params to the args object immediately after `linked?`:
```ts
/** Filter to hives owned by users the viewer follows. */
source?: 'following'
/** Required when source='following'; ignored otherwise. */
viewerId?: string
```

Inside the function body, after the `blocked owner` filter block, add:
```ts
if (args.source === 'following' && args.viewerId) {
  conditions.push(
    inArray(
      hives.ownerUserId,
      db.select({ id: follows.followeeId })
        .from(follows)
        .where(eq(follows.followerId, args.viewerId))
    )
  )
}
```
(Use the existing `follows` table import already present in the file; add it if missing.)

Return empty result set (not an error) when `source='following'` but `viewerId` is null — the guard above handles this naturally since the `inArray` branch is only entered when `viewerId` is truthy.

**Clubs (`searchClubsDiscoverAction`):** Identical pattern — add `source?: 'following'` and `viewerId?: string`, add the same `inArray(bookClubs.ownerId, ...)` WHERE clause when both are present.

**Acceptance criteria:**
- `grep -n "source.*following" lib/actions/discover-hives.actions.ts` returns a match
- `grep -n "source.*following" lib/actions/discover-clubs.actions.ts` returns a match
- `npx tsc --noEmit` exits 0
- Calling either action with `source: 'following'` and a null/undefined `viewerId` does not throw — just applies no filter (covered by the `&& args.viewerId` guard)

---

## T2 — Books: add search to header row, remove from sidebar

**Files:**
- `app/[locale]/(public)/discover/_components/books-grid.tsx`
- `app/[locale]/(public)/discover/_components/books-filters.tsx`

**`books-grid.tsx`:**

The file already renders `<DiscoveryModeToggle>` as the first child of the returned `<div className="flex flex-col gap-4">`. Replace that single element with a flex row:

```tsx
<div className="flex items-center justify-between gap-4">
  <DiscoveryModeToggle
    tab="books"
    locale={locale}
    current={resolvedMode}
    isAuthed={isAuthed}
    baseParams={toggleBaseParams}
  />
  <div style={{ width: 192 }}>
    <FilterSearchInput
      name="q"
      placeholder="Title, author, tag…"
      initialValue={q ?? ''}
    />
  </div>
</div>
```

Add `FilterSearchInput` import from `'./filter-search-input'`.

`toggleBaseParams` already includes `q` — no change needed there. Search is preserved on mode switch.

**`books-filters.tsx`:**

Remove the entire `<FilterSection label="Search" defaultOpen>` block (lines containing `<FilterSearchInput ... />`).

Update `activeCount` — remove the `(q ? 1 : 0) +` term.

Update `clearHref` to preserve both `q` and `mode`:
```ts
const modeParam = pickRaw(sp, 'mode')
const clearHref =
  `/${locale}/discover?tab=books` +
  (modeParam ? `&mode=${encodeURIComponent(modeParam)}` : '') +
  (q ? `&q=${encodeURIComponent(q)}` : '')
```

Remove the `q` parse at the top of `BooksFilters` only if it was only used for `activeCount` and `clearHref`. Keep it if it still appears in the function body.

**Acceptance criteria:**
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/books-filters.tsx` returns no match
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/books-grid.tsx` returns a match
- `npx tsc --noEmit` exits 0

---

## T3 — Sparks: mode toggle + search header, mode dispatch

**Files:**
- `app/[locale]/(public)/discover/_components/sparks-grid.tsx`
- `app/[locale]/(public)/discover/_components/sparks-filters.tsx`

**`sparks-grid.tsx`:**

Add to imports:
```ts
import { DiscoveryModeToggle } from './discovery-mode-toggle'
import { FilterSearchInput } from './filter-search-input'
import { parseMode, type ModeId } from '@/lib/discover/url-state'
import { resolveDefaultMode } from '@/lib/discover/resolve-default-mode'
import { getOptionalUserId } from '@/lib/require-auth'
import { hasAnyDiscoverySignalAction } from '@/lib/actions/discover-for-you-books.actions'
```

Make `SparksGrid` async if not already. At the top of the function body add:
```ts
const viewerId = await getOptionalUserId()
const isAuthed = viewerId !== null
const parsedMode = parseMode(pickRaw(sp, 'mode'))
let resolvedMode: ModeId
if (parsedMode) {
  resolvedMode = parsedMode === 'for-you' && !isAuthed ? 'trending' : parsedMode
} else {
  const hasSignal = isAuthed ? await hasAnyDiscoverySignalAction(viewerId!) : false
  resolvedMode = resolveDefaultMode({ isAuthed, hasSignal })
}
```

Mode → action mapping. Replace the single `searchSparksDiscoverAction` call with a switch:
```ts
const resultsRes = await (() => {
  switch (resolvedMode) {
    case 'for-you':
      return searchSparksDiscoverAction({ q, genres, state, wordLimit, timeLeft,
        creator: 'following', sort, page })
    case 'trending':
      return searchSparksDiscoverAction({ q, genres, state, wordLimit, timeLeft,
        creator, sort: 'urgent', page })
    case 'popular':
      return searchSparksDiscoverAction({ q, genres, state, wordLimit, timeLeft,
        creator, sort: 'most-entered', page })
    case 'all':
    default:
      return searchSparksDiscoverAction({ q, genres, state, wordLimit, timeLeft,
        creator, sort, page })
  }
})()
```

Build `toggleBaseParams` (same pattern as books):
```ts
const toggleBaseParams: Record<string, string | string[] | undefined> = {
  q,
  genres: genres.length ? genres : undefined,
  state: state !== 'all' ? state : undefined,
  wordLimit: wordLimit !== 'any' ? wordLimit : undefined,
  timeLeft: timeLeft !== 'any' ? timeLeft : undefined,
  creator: creator !== 'anyone' ? creator : undefined,
  sort: sort !== 'urgent' ? sort : undefined,
}
```

Replace the `<SlimFeaturedStrip>` + existing first-child with a header row + strip:
```tsx
<div className="flex items-center justify-between gap-4">
  <DiscoveryModeToggle
    tab="sparks"
    locale={locale}
    current={resolvedMode}
    isAuthed={isAuthed}
    baseParams={toggleBaseParams}
  />
  <div style={{ width: 192 }}>
    <FilterSearchInput name="q" placeholder="Prompt, creator…" initialValue={q ?? ''} />
  </div>
</div>
<SlimFeaturedStrip kind="spark" featured={featured} />
```

**`sparks-filters.tsx`:**
- Remove `<FilterSection label="Search" ...>` block
- Remove `(q ? 1 : 0) +` from `activeCount`
- Update `clearHref` to preserve `q` and `mode`:
  ```ts
  const modeParam = pickRaw(sp, 'mode')
  const clearHref =
    `/${locale}/discover?tab=sparks` +
    (modeParam ? `&mode=${encodeURIComponent(modeParam)}` : '') +
    (q ? `&q=${encodeURIComponent(q)}` : '')
  ```

**Acceptance criteria:**
- `grep -n "DiscoveryModeToggle" app/[locale]/\(public\)/discover/_components/sparks-grid.tsx` returns a match
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/sparks-filters.tsx` returns no match
- `npx tsc --noEmit` exits 0

---

## T4 — Hives: mode toggle + search header, mode dispatch (needs T1)

**Files:**
- `app/[locale]/(public)/discover/_components/hives-grid.tsx`
- `app/[locale]/(public)/discover/_components/hives-filters.tsx`

**`hives-grid.tsx`:**

Same auth + mode-resolution boilerplate as T3.

Mode → action mapping:
```ts
const resultsRes = await (() => {
  switch (resolvedMode) {
    case 'for-you':
      return searchHivesDiscoverAction({ q, genres, size, openStates, linked,
        sort: 'most-active', source: 'following', viewerId: viewerId ?? undefined, page })
    case 'trending':
      return searchHivesDiscoverAction({ q, genres, size, openStates, linked,
        sort: 'most-active', page })
    case 'popular':
      return searchHivesDiscoverAction({ q, genres, size, openStates, linked,
        sort: 'most-members', page })
    case 'all':
    default:
      return searchHivesDiscoverAction({ q, genres, size, openStates, linked,
        sort, page })
  }
})()
```

Build `toggleBaseParams` (preserve existing filters, no `sort`, no `page`).

Add header row (same structure as T3) with `tab="hives"` and `placeholder="Hive name…"`.

**`hives-filters.tsx`:** Same sidebar cleanup as T3 — remove search section, fix `activeCount`, fix `clearHref`.

**Acceptance criteria:**
- `grep -n "source.*following" app/[locale]/\(public\)/discover/_components/hives-grid.tsx` returns a match
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/hives-filters.tsx` returns no match
- `npx tsc --noEmit` exits 0

---

## T5 — Lists: mode toggle + search header, mode dispatch

**Files:**
- `app/[locale]/(public)/discover/_components/lists-grid.tsx`
- `app/[locale]/(public)/discover/_components/lists-filters.tsx`

**`lists-grid.tsx`:**

Same auth + mode-resolution boilerplate.

Mode → action mapping:
```ts
const resultsRes = await (() => {
  switch (resolvedMode) {
    case 'for-you':
      return searchListsDiscoverAction({ q, genres, size, popularity, updated,
        curator: 'following', sort: 'most-followed', page })
    case 'trending':
      return searchListsDiscoverAction({ q, genres, size, popularity, updated,
        curator, sort: 'recent', page })
    case 'popular':
      return searchListsDiscoverAction({ q, genres, size, popularity, updated,
        curator, sort: 'most-followed', page })
    case 'all':
    default:
      return searchListsDiscoverAction({ q, genres, size, popularity, updated,
        curator, sort, page })
  }
})()
```

Add header row with `tab="lists"` and `placeholder="List title, curator…"`.

**`lists-filters.tsx`:** Same cleanup — remove search section, fix `activeCount`, fix `clearHref`.

**Acceptance criteria:**
- `grep -n "DiscoveryModeToggle" app/[locale]/\(public\)/discover/_components/lists-grid.tsx` returns a match
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/lists-filters.tsx` returns no match
- `npx tsc --noEmit` exits 0

---

## T6 — Clubs: mode toggle + search header, mode dispatch (needs T1)

**Files:**
- `app/[locale]/(public)/discover/_components/clubs-grid.tsx`
- `app/[locale]/(public)/discover/_components/clubs-filters.tsx`

**`clubs-grid.tsx`:**

Same auth + mode-resolution boilerplate.

Mode → action mapping:
```ts
const resultsRes = await (() => {
  switch (resolvedMode) {
    case 'for-you':
      return searchClubsDiscoverAction({ q, genres, size, accessStates, currentBook,
        sort: 'most-active', source: 'following', viewerId: viewerId ?? undefined, page })
    case 'trending':
      return searchClubsDiscoverAction({ q, genres, size, accessStates, currentBook,
        sort: 'most-active', page })
    case 'popular':
      return searchClubsDiscoverAction({ q, genres, size, accessStates, currentBook,
        sort: 'most-members', page })
    case 'all':
    default:
      return searchClubsDiscoverAction({ q, genres, size, accessStates, currentBook,
        sort, page })
  }
})()
```

Add header row with `tab="clubs"` and `placeholder="Club name…"`.

**`clubs-filters.tsx`:** Same cleanup.

**Acceptance criteria:**
- `grep -n "source.*following" app/[locale]/\(public\)/discover/_components/clubs-grid.tsx` returns a match
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/clubs-filters.tsx` returns no match
- `npx tsc --noEmit` exits 0

---

## T7 — Home: mode toggle + search header, remove "From" filter

**Files:**
- `app/[locale]/(public)/discover/_components/home-grid.tsx`
- `app/[locale]/(public)/discover/_components/home-filters.tsx`

**`home-grid.tsx`:**

Same auth + mode-resolution boilerplate. Remove the `from` URL param parse — derive it from `resolvedMode` instead:
```ts
// Remove: const from = parseRadio(pickRaw(sp, 'from'), ['anyone', 'following'], 'anyone')
// Add:
const from = resolvedMode === 'for-you' ? 'following' : 'anyone'
```

Build `toggleBaseParams`:
```ts
const toggleBaseParams: Record<string, string | string[] | undefined> = {
  q,
  genres: genres.length ? genres : undefined,
  show: show.length < 5 ? show : undefined,
}
```

Add header row with `tab="home"` and `placeholder="Anything…"`.

Remove `from` from `buildChips` call and from the chip for "Following" (it's now implicit in the mode).

**`home-filters.tsx`:**

- Remove `<FilterSection label="Search" ...>` block
- Remove `<FilterSection label="From" ...>` block entirely
- Remove `from` parse, `FROM_OPTIONS` const, and `(from !== 'anyone' ? 1 : 0)` from `activeCount`
- Update `clearHref` to preserve `q` and `mode` (same pattern as other tabs)

**Acceptance criteria:**
- `grep -n "DiscoveryModeToggle" app/[locale]/\(public\)/discover/_components/home-grid.tsx` returns a match
- `grep -n "FilterSearchInput" app/[locale]/\(public\)/discover/_components/home-filters.tsx` returns no match
- `grep -n 'label="From"' app/[locale]/\(public\)/discover/_components/home-filters.tsx` returns no match
- `npx tsc --noEmit` exits 0

---

## Execution order

```
Wave 1: T1                      (blocking — hives/clubs For You needs new action params)
Wave 2: T2, T3, T4, T5, T6, T7 (all parallel — each touches distinct files)
```

Wave 2 tasks can be dispatched to subagents simultaneously. T4 and T6 depend on T1 being done first.

## Smoke checklist (post-implementation)

1. `/en/discover?tab=books` — header row shows mode toggle left + search right; sidebar has no search section; switching mode preserves search term; "Clear all" in sidebar preserves mode + search
2. `/en/discover?tab=sparks` — same header row visible; For You shows only sparks from followed creators; Trending sorts by urgency; Popular sorts by most entries
3. `/en/discover?tab=hives` — For You shows hives owned by followed users; Trending = most-active sort; Popular = most-members sort
4. `/en/discover?tab=lists` — For You shows lists from followed curators; Trending = recently updated; Popular = most-followed
5. `/en/discover?tab=clubs` — For You shows clubs owned by followed users; Trending = most-active; Popular = most-members
6. `/en/discover?tab=home` — header row visible; For You passes `from=following` to action; "From" section gone from sidebar; Show + Genre sidebar filters still work
7. Guest on any tab — For You button absent from toggle; default lands on Trending
8. Authed user with no follows on any tab — default lands on Trending (not For You)
9. Authed user with follows on any tab — default lands on For You
10. `npx tsc --noEmit` exits 0 after all changes
