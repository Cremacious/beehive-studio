# Community Feed — Design Spec

> **Date:** 2026-05-26
> **Status:** Design approved; pending implementation plan.
> **Goal:** Reposition the Community page from a redundant Hives list into the logged-in user's personal feed of activity from writers they follow, with a sidebar containing their hives, suggested writers, and active Sparks.

---

## 1. Positioning (locked)

- **Discover** (`/(public)/discover` — unauthenticated): browse all published books, Sparks, and Hives on Beehive. The marketing-side front door — open to logged-out visitors, search engines, link shares.
- **Community** (`/(app)/community` — authenticated only): a daily-return surface showing the logged-in user's personal feed of activity from writers they follow, plus a social hub (Hives, Sparks, suggested writers).

The route split already enforces this. Today's Community page just hasn't built into its slot — it currently duplicates Discover's Hives tab. After this work, the line is clear: Discover is for everyone exploring; Community is for you, when you're signed in.

## 2. Non-goals (explicit YAGNI)

- Real-time push updates. Poll/refresh only.
- Filters on the feed (genre, type, etc.) — single chronological stream.
- Quoting / reposting / sharing of feed items.
- Inline comments on feed items — clicks navigate to where comments live (book/chapter/spark pages).
- Algorithmic ranking. Pure reverse-chronological.
- Materialized feed table. Live queries until evidence of pressure.
- Removing or changing `/discover` — Discover stays exactly as it is (public surface for unauthenticated browsing).
- New social actions on the feed itself (likes, reposts).

## 3. Architecture

```
/community page (server component)
├── Fetches in parallel: feed items, my hives, suggested writers, my active sparks
├── Two-column layout (main + sidebar, max-w-6xl, stacks under lg)
│   ├── Main column
│   │   ├── <SuggestedWritersStrip /> — horizontal row of writer cards (always visible)
│   │   └── <FeedList /> — list of <FeedItem /> components + "Load more" button
│   │       └── Variants: NewChapterItem · NewBookItem · NewSparkItem
│   └── Right sidebar (w-72)
│       ├── <MyHivesPanel />
│       ├── <SuggestedWritersPanel /> (vertical, 3 entries)
│       └── <ActiveSparksPanel />
```

## 4. Server actions

### 4.1 `getCommunityFeedAction({ limit, cursor })` — NEW

Lives in `lib/actions/community.actions.ts`. Authenticated.

**Returns:** `ActionResult<{ items: FeedItem[]; nextCursor: string | null }>` where:

```ts
type FeedItem =
  | { type: 'new_chapter'; chapterId: string; bookId: string; bookTitle: string;
      chapterTitle: string; chapterNumber: number;
      author: { id: string; username: string; image: string | null };
      publishedAt: Date }
  | { type: 'new_book'; bookId: string; bookTitle: string; bookCover: string | null;
      synopsis: string | null;
      author: { id: string; username: string; image: string | null };
      publishedAt: Date }
  | { type: 'new_spark'; sparkId: string; sparkPrompt: string; deadline: Date | null;
      author: { id: string; username: string; image: string | null };
      createdAt: Date }
```

**Sourcing logic:**
- Build `followedIds = followers.followingId WHERE followerId = userId`.
- New chapter = `chapters` joined to `books` where `books.userId IN followedIds` AND `books.publishedAt IS NOT NULL` AND `chapters.publishedAt` (if exists; else `chapters.updatedAt`) within last 30 days.
- New book = `books` where `books.userId IN followedIds` AND `books.publishedAt IS NOT NULL` AND `books.publishedAt` within last 30 days.
- New spark = `sparks` where `creatorId IN followedIds` AND `createdAt` within last 30 days.
- UNION the three sources, ORDER BY timestamp DESC, LIMIT 20, with cursor pagination on (timestamp + id tiebreak).
- If `chapters.publishedAt` doesn't exist, fallback: only include the most recent chapter per book (avoids spamming when a writer adds many chapters at once).

**Cursor format:** `${isoTimestamp}_${id}` so it's URL-safe and tie-break-deterministic.

### 4.2 `getSuggestedWritersAction({ excludeFollowing: boolean; limit: number })` — NEW

Lives in same `community.actions.ts`. Authenticated.

**Returns:** `ActionResult<Writer[]>` where:
```ts
type Writer = {
  id: string
  username: string
  image: string | null
  bio: string | null
  bookCount: number  // count of published books
  isFollowing: boolean
}
```

**Logic:** users WHERE has at least 1 published book AND was active in last 30 days (any `updatedAt` field — books, sparks, chapters). Exclude self. If `excludeFollowing` is true, exclude users I already follow. Order by activity (most recent updatedAt) DESC. LIMIT to argument.

No ML, no scoring — simple heuristics. Improves the new-user experience without overengineering.

### 4.3 `getMyHivesAction()` — NEW or reuse

Authenticated. Returns user's hives (id, name, memberCount, isPublic). Likely a thin wrapper around existing hive queries — confirm during implementation whether a suitable action exists; if so, reuse.

### 4.4 `getMyActiveSparksAction()` — NEW

Authenticated. Returns Sparks where the user has submitted an entry AND the spark is not yet finalized.

```ts
type ActiveSparkEntry = {
  sparkId: string
  sparkPrompt: string
  entryId: string
  status: 'submitted' | 'voting' | 'awaiting_winner' | 'won'
  deadline: Date | null
}
```

Status logic:
- `submitted` — entry exists, spark not yet in voting window.
- `voting` — spark in active voting window (creator's choice not finalized).
- `awaiting_winner` — voting closed, no winner finalized yet (lazy finalization queue).
- `won` — `spark.winnerEntryId === entry.id` (recent — show for 7 days then drop).

## 5. UI components

### 5.1 `SuggestedWritersStrip` (top of main column)

- Horizontal scroll on narrow viewports, grid on wide.
- 6-8 writer cards. Each card: avatar (48px), username, follow button, one stat line ("3 books").
- Click avatar/username → `/u/[username]`.
- Click follow → optimistic update, calls existing `toggleFollowAction`.
- Tone: friendly header ("Writers to follow"), not a hard CTA.
- Always shown — even when feed is populated; it's also useful for active users.

### 5.2 `FeedList` + `FeedItem` variants

**FeedList shell:** scrollable list, single column inside main. Initial 20 items SSR-rendered. "Load more" button at bottom calls `getCommunityFeedAction({ cursor })` and appends. When `nextCursor` is null: show "You're caught up — explore [Discover →]" link.

**FeedItem visuals (all variants share a card shell: bg-card, border-border, rounded-lg, p-4, hover bg lifts):**

- **NewChapterItem:**
  - Top row: avatar (24px) + `@username` + small "published a chapter" + relative time.
  - Title row (clickable): `Ch. {number}: {chapterTitle}` (bold) `in` `{bookTitle}` (linked).
  - Optional one-line excerpt (truncated synopsis or first ~140 chars of prose if cheap to fetch).
  - Click anywhere → `/discover/book/[bookId]/read/[chapterId]`.

- **NewBookItem:**
  - Larger card. Cover image left (80x120 if available, else colored placeholder).
  - Right column: title (bold), `by @username`, 2-line synopsis (clamped), relative time.
  - Click → `/discover/book/[bookId]`.

- **NewSparkItem:**
  - Top row: avatar + `@username` + "started a Spark" + Lightning icon (`Zap` from lucide) + relative time.
  - Quoted prompt (italics or styled differently — distinct from prose excerpts).
  - Deadline pill: "Ends in 2 days" or "Voting open" or "Voting closed".
  - Click → `/discover/spark/[sparkId]`.

**FeedItem states:** default · hover (subtle bg + lift) · loading skeleton (during initial SSR fallback or load-more) · disabled/loading (during the click → navigate moment).

### 5.3 Empty / thin states

- **0 follows:** the FeedList shows a single empty card: "Follow writers to fill your feed. Try the suggestions above ↑". SuggestedWritersStrip is the focus.
- **N follows, 0 recent items (rare):** "Nothing new from your follows this week. Try the suggestions above." Strip stays.

### 5.4 Right sidebar (w-72)

Three panels stacked vertically. Each: header row + content + optional CTA. Spacing between panels.

#### `MyHivesPanel`
- Header: "Your Hives" + count badge.
- Body:
  - If 0 hives: a single CTA card — "Join or create a Hive" with a `+ Create Hive` button (links to or opens the existing hive-creation flow).
  - If 1-5 hives: list of rows. Each row: name (link to `/hive/[id]`), member count (small), private/public icon.
  - If >5: list of first 5 + "View all (N)" link.

#### `SuggestedWritersPanel` (different shape from the top strip)
- Header: "Discover writers".
- Body: 3 vertical entries. Each: avatar (32px) + username + small bio truncation + "Follow" button.
- Distinct from the top strip — this is "always there" sidebar, narrower, follow-driven.
- If 0 suggestions returned (rare): hide panel entirely.

#### `ActiveSparksPanel`
- Header: "Your Sparks".
- Body:
  - If 0 active entries: a single CTA card — "Try a Spark" linking to `/discover` Sparks tab.
  - If N: up to 3 rows, each showing spark prompt (truncated), status pill ("Voting · ends 2d", "Awaiting winner", "Won!"), click → spark page.
  - If >3: "View all" link to a future "my sparks" page (or to /discover Sparks tab for now).

### 5.5 Responsive

- Desktop (≥lg): two-column layout. Main `flex-1`, sidebar `w-72`.
- Tablet (md-lg): two-column but tighter — sidebar can drop to `w-64`.
- Mobile (<md): single column. Sidebar panels drop BELOW the feed in this order: My Hives → Active Sparks → Suggested Writers. The SuggestedWritersStrip stays at top of main column.

## 6. Notifications boundary

The Community feed is intentionally separate from notifications:
- **Notifications** (bell in nav, persisted in DB): things addressed to you directly — someone followed you, liked your book, commented on your work, you won a Spark.
- **Feed** (Community page): things published by people you follow.

There is no inbox-style overlap. A new feed item never generates a notification (that would be spam). A notification never appears in the feed.

## 7. Edge cases

- A followed user deletes a published book → the feed item disappears on next page load. No tombstone treatment for v1.
- A followed user is banned/deactivated → server action filters them out.
- Premium gating: Community feed is free-tier accessible. No premium-only feed features in this design.
- Chapter publish state: TBD during implementation whether chapters have an explicit `publishedAt` separate from `books.publishedAt`. If not, treat all chapters in a published book as "available" and use `chapters.updatedAt` as the timestamp. Confirm in code before writing the feed action.
- Pagination cursor invalidation: if a writer publishes a new item between page-1 fetch and load-more, the load-more cursor may skip or duplicate. The cursor is `(timestamp, id)` — stable enough for this scope. If we see complaints, add a "Refresh" button later.
- 30-day window: hard-coded. If we see "I had nothing this week and felt the page was dead" feedback, revisit.

## 8. Testing (manual checklist)

1. Sign in as a user following 3+ active writers → Community shows reverse-chrono feed.
2. Each FeedItem links to the correct destination (chapter reader, book detail, spark page).
3. "Load more" appends 20 more items, exhaustible; then shows "caught up" link.
4. Sign in as a new user (0 follows) → suggested-writers strip prominent; feed area shows "Follow writers to fill your feed."; no error.
5. Follow a writer from the suggested strip → button updates optimistically; refresh page → their items appear in feed.
6. Right sidebar: My Hives shows my hives with member counts; clicking enters /hive/[id]. With 0 hives, shows "Join or create" CTA.
7. Right sidebar: Suggested writers list shows 3 unfollowed writers; clicking follow → updates inline.
8. Right sidebar: Active Sparks shows my open entries with correct status pills.
9. Stacks to single column under lg breakpoint (sidebar drops below feed).
10. Old `/community` content (just public Hives) is gone — fully replaced.
11. `npx tsc --noEmit` clean.
12. `npm test` clean (no new unit tests expected; if any pure helper emerges, add tests).

## 9. Definition of done

- New `/community` page renders the new layout (main feed + right sidebar) for authenticated users.
- `getCommunityFeedAction`, `getSuggestedWritersAction`, `getMyActiveSparksAction` server actions exist and pass manual smoke.
- Old single-page Hives list at `/community` is replaced. Public Hives still browsable via Discover's Hives tab (unchanged).
- All 12 manual checklist items pass.
- `tsc` clean. `npm test` clean.
- Atomic commits per task (Chris's working agreement).

## 10. Risks

- **Feed query performance.** The UNION across chapters/books/sparks with a 30-day window and follow-graph filter should be cheap at current scale, but if any user follows >1000 writers it could slow. Verify with EXPLAIN if there's concern; otherwise leave as live queries until evidence.
- **Chapter publish-state ambiguity.** If `chapters` doesn't have a per-chapter `publishedAt`, treat the whole book's chapters as published when the book is. Could mean a long-published book that gets new chapters shows the new chapter at `chapters.updatedAt`. Acceptable for v1.
- **Empty-state second-day.** A user follows 1 person who posts once a week. On day-2 the feed shows 1 stale item and that's it. We mitigate with the always-visible suggested-writers strip — there's always somewhere to go from Community.
