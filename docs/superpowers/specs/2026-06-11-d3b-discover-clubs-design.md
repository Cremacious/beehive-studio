# D3b — Discover Clubs (Design Spec)

**Date:** 2026-06-11
**Sub-project of:** Discover Phase (D1 ✅ → D2a ✅ → D2b ✅ → D3a ✅ → **D3b Clubs** → D4)
**Status:** Locked autonomously, awaiting plan + execution.

---

## 1. Intent

D1/D2a/D2b/D3a shipped. Clubs tab at `/discover?tab=clubs` is a basic 2-col grid. D3b deepens it with the same pattern.

## 2. Decisions

| Q | Decision |
|---|----------|
| Q1 — Scope | Clubs only. D4 cross-surface home is the final D-phase remainder. |
| Q2 — Rails (5) | Trending (`activity_score_7d` weighted: discussions 1x · book changes 3x · new members 2x) · Active (`last_activity_at >= 7d`) · New (`first_publicly_discoverable_at >= 30d`) · Open to join (`openJoin=true AND last_activity_at >= 30d`, sort `memberCount DESC`) · From writers you follow (authed). |
| Q3 — IA | Hybrid mirror. Chip strip + genre hubs + sub-routes + search. |
| Q4 — Hero | Featured Club = "Open + active" — `openJoin=true AND activity_score_7d > 0 AND last_activity_at >= 14d`, sort score DESC, LIMIT 1. "OPEN + ACTIVE" mono badge. Hidden when null. |
| Q5 — Schema | `genre TEXT NULL` + `first_publicly_discoverable_at TIMESTAMP NULL` + `last_activity_at TIMESTAMP NULL` denorm + 3 indexes. |
| Q6 — Card | Current-book cover left (48px portrait, paper-warm fallback when no current book) + Comfortaa club name + `led by @owner` + `currently reading {Book Title}` eyebrow (or italic muted "no current book") + member avatar stack + activity-pulse + genre/open-join pills. Mirrors D2b Hive card shape. |

## 3. Schema

`book_clubs`:
- `genre TEXT NULL` — Zod-enforced against 14 GenreSlug.
- `first_publicly_discoverable_at TIMESTAMP NULL` — backfilled COALESCE(updated_at, created_at) for PUBLIC+discoverable.
- `last_activity_at TIMESTAMP NULL` denorm. Backfilled from `MAX(bookClubDiscussions.createdAt)` per club. Updated in-tx at writer sites: `createDiscussionAction`, `joinClubAction`, `setCurrentBookAction` (and any callers that set current book — `deriveCurrentBookTx` should bump it too). No `recordClubActivityTx` helper exists; inline at sites.
- Indexes: `book_clubs_last_activity_idx` on `(last_activity_at DESC)` · `book_clubs_first_public_idx` partial on `(first_publicly_discoverable_at DESC) WHERE PUBLIC AND discoverable` · `book_clubs_open_join_idx` on `(open_join, member_count DESC)`.

## 4. Server actions

New file `lib/actions/discover-clubs.actions.ts`. 9 actions:

`getFeaturedClubAction`, `getTrendingClubsAction`, `getActiveClubsAction`, `getNewClubsAction`, `getOpenToJoinClubsAction`, `getFollowingClubsAction`, `getClubBackfillAction`, `searchClubsDiscoverAction`, `getClubGenreCountsAction`.

### Type

```ts
export type ClubCard = {
  id: string
  name: string
  description: string | null
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  ownerUserId: string
  ownerUsername: string | null
  ownerDisplayName: string | null
  ownerAvatarUrl: string | null
  genre: GenreSlug | null
  tags: string[]
  memberCount: number
  openJoin: boolean
  currentBookId: string | null
  currentBookTitle: string | null
  currentBookCoverUrl: string | null
  activityScore7d: number          // 0 on cheap-path rails
  lastActivityAt: Date | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>  // up to 4 via window function
}
export type RailResult<T = ClubCard> = { books: T[]; strictCount: number; nextCursor: string | null }
```

### Pure helper

`lib/discover/club-activity-score.ts` exports `computeClubActivityScore7d({ discussions7d, bookChanges7d, newMembers7d })` per spec §2 Q2 weights. 4 unit tests.

### Cheap-path

`activityScore7d` GROUP BY only on Trending + Featured. Other rails set to 0. `memberPreviews` always via window function on bookClubMembers (mirror D2b Hives pattern).

## 5. Pages

Sub-routes (mirror D3a):
- `/discover/clubs/trending`, `/active`, `/new`, `/open-to-join`, `/following`
- `/discover/clubs/genre/[slug]`
- `/discover/clubs/search?q=…&genre=…&sort=…`

## 6. Cards

`<RailClubCard>` ~280px — mirrors D2b RailHiveCard structure:
- Header: 48px portrait current_book cover + meta cluster (club name + `currently reading {Book Title}` mono eyebrow OR italic muted "no current book" + `led by @owner`).
- Members section: recessed pill bar + 4-avatar overlap stack + count.
- Hairline.
- Activity row: green pulse "Active Xh ago" + genre + open-join pill ("OPEN" small brand-yellow badge when `openJoin`).

`<DiscoverClubCard>` info-dense variant + description line-clamp-2 + visibility pill + brand-pill CTA.

`<FeaturedClubHero>` full-width:
- LEFT 160px current_book cover.
- CENTER: "OPEN + ACTIVE" mono badge + Comfortaa brand-yellow name + currently reading eyebrow + description + owner.
- RIGHT: member count + open-join pill + activity score line + brand-pill `Visit the Club →` CTA.

## 7. Phasing

~8 tasks:
1. Schema migration + writer audit + inline last_activity_at updates at 3 sites.
2. Pure helper `computeClubActivityScore7d` + 4 tests.
3. Server-action layer (9 actions single commit).
4. Cards + rail wrapper (4 components single commit).
5. Home page rewrite + extend GenreChipStrip `tabContext` union with `'clubs'`.
6. 5 rail sub-routes single commit.
7. Genre hub + search (combined).
8. AGENTS.md ship + smoke.

Suggested 6-wave shape: W1=T1, W2=T2, W3=T3, W4=T4, W5=T5+T6+T7 parallel-safe (separate route scopes; T5 home depends on T4 but is committed first), W6=T8.

End of design.
