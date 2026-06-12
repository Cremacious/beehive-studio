# D3a — Discover Lists (Design Spec)

**Date:** 2026-06-11
**Sub-project of:** Discover Phase (D1 Books ✅ → D2a Sparks ✅ → D2b Hives ✅ → **D3a Lists** → D3b Clubs → D4 cross-surface home)
**Status:** Design locked autonomously by pattern application, awaiting implementation plan + execution.

---

## 1. Context and intent

D1, D2a, D2b deepened Books, Sparks, and Hives. The Lists tab at `/discover?tab=lists` still uses a basic 2-col grid via `getDiscoverableListsAction`. D3a deepens Lists; D3b deepens Clubs as a separate sibling sub-project after D3a smokes clean. Same algorithm-first + locked iOS design system + load-bearing patterns from D1/D2a/D2b apply.

## 2. Goals

1. Make `/discover?tab=lists` a destination — 5 algorithmic rails + Featured List hero + genre browse + search.
2. Algorithm-first. Reuse D1/D2a/D2b chrome end-to-end.
3. Optional `genre` taxonomy on lists (parallel to D2a Sparks).
4. Search route + filter rail with genre + sort.
5. Transparent backfill.

## 3. Non-goals

- D3b Clubs (separate spec).
- D4 cross-surface home.
- Curator tooling.
- Light mode / mobile responsive.

## 4. Decisions locked

| Q | Decision |
|---|----------|
| Q1 — Scope | D3a Lists only. D3b Clubs separate sub-project. |
| Q2 — Rails (5) | Trending (follower-gain 7d) · Recently updated (last_updated_at 7d) · New (first_publicly_discoverable_at 30d) · Most followed (followerCount DESC all-time) · From writers you follow (authed). `kind='LIKED'` always excluded. |
| Q3 — IA | Hybrid mirror D1/D2a/D2b. Rail-stacked tab home + sub-page per rail + genre chip strip + 14 genre hubs. |
| Q4 — Hero | Featured List = `kind='CUSTOM' AND first_publicly_discoverable_at >= now() - 14d`, sort followerCount DESC, LIMIT 1. "RISING CURATOR" mono badge. Hidden if none. |
| Q5 — Schema | `genre TEXT NULL` + `first_publicly_discoverable_at TIMESTAMP NULL` + `last_updated_at TIMESTAMP NULL` denorm + 3 indexes. |
| Q6 — Card | Book-stack visual hook: first 3 book covers fanned at top of card (60px each, alternating rotation -2°/0°/+2°, -8px overlap). Below: Comfortaa title + curator byline + tags (max 2) + book count + follower count + last-updated meta. |

## 5. Page IA

`/[locale]/discover?tab=lists` top to bottom:

1. PageHead → tab strip (already refreshed) → Featured List hero (hidden if none) → genre chip strip + search row (`tabContext='lists'`, `searchHref='/discover/lists/search'`) → 5 rails stacked (Trending · Recently updated · New · Most followed · Following) → Browse by genre footer grid (`linkBase='/discover/lists/genre/'`, `title='Browse Lists by genre'`).

Sub-routes:
- `/discover/lists/trending`, `/recently-updated`, `/new`, `/most-followed`, `/following`
- `/discover/lists/genre/[slug]` — 14 slugs
- `/discover/lists/search?q=…&genre=…&sort=…`

## 6. Rails — signals and ordering

All rails filter PUBLIC + discoverable + `kind = 'CUSTOM'` (Liked auto-lists never appear) + block-aware via new `getBlockedListOwnerIdsForViewer` helper.

| Rail | Signal | Sort | Slug |
|---|---|---|---|
| Trending | followers gained in 7d > 0 | followersGained7d DESC, id DESC | `trending` |
| Recently updated | `last_updated_at >= now() - 7d` | last_updated_at DESC, id DESC | `recently-updated` |
| New | `first_publicly_discoverable_at >= now() - 30d` | first_publicly_discoverable_at DESC, id DESC | `new` |
| Most followed | (no time window) | followerCount DESC, id DESC | `most-followed` |
| Following | owner IN viewer follows + has followers OR books | last_updated_at DESC, id DESC | `following` (authed-only) |

`followersGained7d` computed via GROUP BY on follow events in window — cheap-path skipped on non-Trending rails.

### Fallback (per-rail)

When strict <4 results, backfill from "any PUBLIC + discoverable + CUSTOM list with `last_updated_at` in last 30d, ordered by last_updated_at DESC", excluding strict set. Caption: `"Filling in with active Lists while [Rail Name] warms up."` Following has no backfill (hidden when empty).

### Genre scoping

When chip set, every rail adds `lists.genre = <slug> AND lists.genre IS NOT NULL`. Hero re-scopes too.

### Featured List hero

`getFeaturedListAction({ genre? })`: `kind='CUSTOM' AND first_publicly_discoverable_at >= now() - 14d`, sort followerCount DESC + id DESC, LIMIT 1.

## 7. Card variants

### `<RailListCard>` (~280px, locked design)

- Outer `<Link>` to `/${locale}/reading-lists/${list.id}`.
- Chrome: tile gradient + `--sh-tile` + `--r-card`. Hover via inline-style mutation.
- **Book stack at top** (~80px tall): 3 book cover thumbs (60px portrait each, 2:3 aspect) fanned with rotation `-2deg / 0deg / +2deg` and `-8px` margin overlap. Z-index stacked so middle is on top. Paper-warm gradient fallback for null coverUrl. Falls back to empty-state illustration when `bookCount === 0`.
- Below stack: padding 18px.
- Comfortaa title 16px semibold 1-line truncate.
- mono `text-[11px]` `curated by @{ownerUsername}` row with 14px owner avatar.
- Tags chips: max 2 from `tags` array, brand-yellow-tint alpha. `text-[9px]` mono uppercase.
- Hairline divider.
- Meta row: `📚 {bookCount}` + `👥 {followerCount}` + relative time of last update right-aligned mono muted.

### `<DiscoverListCard>` (info-dense variant)

- Default `variant: 'rail' | 'grid' | 'row'`.
- Adds `line-clamp-2` description.
- Stat row adds visibility pill (Globe/Lock/Users) + genre pill.
- Optional brand-pill `View list →` CTA on grid variant.

### `<FeaturedListHero>`

- Full-width panel card. `[grid-template-columns:200px_1fr_auto]`.
- LEFT: enlarged book stack (3 covers at 100px each, fanned with rotation, paper-warm fallback).
- CENTER: "RISING CURATOR" mono brand-yellow badge + Comfortaa brand-yellow title 28px + curator byline + line-clamp-3 description.
- RIGHT: vertical column with follower count large (Comfortaa brand-yellow 28px) + tag chips + brand-pill `View the list →` CTA.
- Brand-soft radial accent top-right.
- Hidden cleanly when null.

## 8. Schema changes

One idempotent runner `scripts/migrate-d3a.ts`.

### Additions on `reading_lists`

- `genre TEXT NULL` — Zod-enforced against D1's 14 GenreSlug.
- `first_publicly_discoverable_at TIMESTAMP NULL` — set on first PUBLIC+discoverable transition via in-tx gate. Backfilled from `COALESCE(updated_at, created_at)` for existing PUBLIC+discoverable+CUSTOM rows. Audit pattern: grep `lib/actions/reading-lists.actions.ts` for `discoverable: \w+` writers; apply gate at each.
- `last_updated_at TIMESTAMP NULL` denorm. Backfilled to `updatedAt`. Updated in same tx as `readingListBooks` INSERT (book add) + DELETE (book remove). Audit: `addBookToListAction` + `removeBookFromListAction` and any sibling.

### Indexes

- `reading_lists_first_public_idx` partial on `(first_publicly_discoverable_at DESC) WHERE visibility = 'PUBLIC' AND discoverable = true AND kind = 'CUSTOM'`.
- `reading_lists_last_updated_idx` on `(last_updated_at DESC)`.
- `reading_lists_follower_count_idx` on `(follower_count DESC)`.

## 9. Server actions

New file `lib/actions/discover-lists.actions.ts` (keeps `reading-lists.actions.ts` from growing).

| Action | Args | Returns | Used by |
|---|---|---|---|
| `getFeaturedListAction({ genre? })` | | `ListCard \| null` | Hero |
| `getTrendingListsAction({ genre?, cursor?, limit? })` | | `RailResult<ListCard>` | Trending rail + sub-page |
| `getRecentlyUpdatedListsAction({ genre?, cursor?, limit? })` | | `RailResult<ListCard>` | Recently updated rail + sub-page |
| `getNewListsAction({ genre?, cursor?, limit? })` | | `RailResult<ListCard>` | New rail + sub-page |
| `getMostFollowedListsAction({ genre?, cursor?, limit? })` | | `RailResult<ListCard>` | Most followed rail + sub-page |
| `getFollowingListsAction({ genre?, cursor?, limit? })` | authed (throws on guest) | `RailResult<ListCard>` | Following rail + sub-page |
| `getListBackfillAction({ excludeIds, genre?, limit? = 4 })` | | `ListCard[]` | Universal backfill |
| `searchListsDiscoverAction({ q, genre?, sort?, cursor? })` | sort: relevance / recent / most-followed / most-books | `{ books: ListCard[]; nextCursor: string \| null }` | Search route |
| `getListGenreCountsAction()` | unstable_cache 5min | `Record<GenreSlug, number>` | Footer grid |

### Type — `ListCard`

```ts
export type ListCard = {
  id: string
  title: string
  description: string | null
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  ownerUserId: string
  ownerUsername: string | null
  ownerDisplayName: string | null
  ownerAvatarUrl: string | null
  genre: GenreSlug | null
  tags: string[]
  bookCount: number
  followerCount: number
  followersGained7d: number             // 0 on cheap-path rails
  lastUpdatedAt: Date | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
  bookCoverPreviews: Array<{ bookId: string; coverUrl: string | null; title: string }>  // up to 3 via window function
}

export type RailResult<T = ListCard> = { books: T[]; strictCount: number; nextCursor: string | null }
```

### Cheap-path optimization

`followersGained7d` computed via separate GROUP BY only on Trending. Other rails set to 0. `bookCoverPreviews` always fetched via window function `ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY position) <= 3` joined to `books` for cover + title — bounded query cost.

### Private helpers

- `getBlockedListOwnerIdsForViewer(viewerId)` — bidirectional userBlocks → Set<string>.
- `buildPublicListFilters(genre, blocked)` — PUBLIC + discoverable + kind='CUSTOM' + genre + not-blocked.
- `projectToListCards(rows, opts)` — Map-stitch authors + (optional) followersGained + bookCoverPreviews.

## 10. UI components

New under `app/[locale]/(public)/discover/_components/`:
- `rail-list-card.tsx` (client)
- `discover-list-card.tsx` (client)
- `featured-list-hero.tsx` (client)
- `discover-list-rail.tsx` (server)

Reused from D1/D2a/D2b:
- `<GenreChipStrip>` — extend `tabContext` union with `'lists'`.
- `<DiscoverSearchInput>` with `searchHref`.
- `<GenreFooterGrid>` with `linkBase` + `title`.
- `<DiscoverRailSubPage<ListCard>>` generic shell.

## 11. Visual chrome

Inherits design system end-to-end. Brand-yellow restraint additions for D3a: "RISING CURATOR" hero badge · `View the list →` CTA · book-stack rotation is purely visual chrome (no brand color). Page widths: home + genre hubs `max-w-7xl`; sub-pages + search `max-w-5xl`.

## 12. Test posture

- No new pure helpers in D3a — Lists rails sort by raw signals; D1's `applyBackfill` reused.
- Surface-shape tests for the 9 new actions mirroring D2b shape.
- Manual smoke per AGENTS.md.

## 13. Implementation phasing

Indicative ~9 tasks:

- T1 Schema migration (3 columns + 3 indexes + writer audit + readingListBooks INSERT/DELETE last_updated_at wiring)
- T2 Server-action layer (single combined commit; 9 actions in `discover-lists.actions.ts`)
- T3 Card components (3 client + 1 server rail wrapper combined in single commit)
- T4 Lists tab home rewrite + extend `<GenreChipStrip>` `tabContext` union
- T5 5 rail sub-routes (single combined commit)
- T6 Genre hub route
- T7 Search route + filter rail + results
- T8 AGENTS.md ship + manual smoke

Suggested 6-wave shape: W1=T1, W2=T2, W3=T3, W4=T4, W5=T5+T6+T7 parallel (3 isolated route scopes), W6=T8.

## 14. Carry-forward smoke checklist (post-ship)

20-item checklist mirrors D2b §13 shape with Lists-specific scenarios: home renders + hero hides cleanly + genre chip scopes + backfill caption + sub-routes + book stack visual + Following gating + first-public migration + last_updated_at maintenance + block-aware + 14 genre hubs + search refinement.

---

End of design.
