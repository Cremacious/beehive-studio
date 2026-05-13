# Phase 7 — Community Design

**Date:** 2026-05-13
**Status:** Approved

## Overview

Phase 7 completes the social layer of Beehive Studio: author profile pages, notification wiring for discover-feed events, a Hives tab on /discover, and a full Sparks feature — writing prompt contests with community voting and creator's choice.

---

## Scope

**In scope:**
- `/discover` tab bar: Books | Sparks | Hives (URL param `?tab=`)
- Sparks: prompt creation, entry submission, 48-hour voting window, creator's choice, results
- Spark entry full-read page with comments
- Hives tab on /discover: public Hives grid with request-to-join
- Author profile pages: `/u/[username]` — bio, stats, books, Sparks, activity feed
- Notification wiring: NEW_FOLLOWER, NEW_LIKE, NEW_COMMENT, SPARK_WIN fired from social/spark actions

**Out of scope:**
- Search / full-text search
- Spark reply threading (comments on entries are top-level only)
- DMs or private messaging
- Spark categories/tags
- Stripe monetization (Phase 8)

---

## Route Structure

All routes are in the `(public)` group — no auth required to browse.

```
app/[locale]/(public)/discover/page.tsx                              — modified: adds tab bar
app/[locale]/(public)/discover/spark/[sparkId]/page.tsx             — new: Spark detail
app/[locale]/(public)/discover/spark/[sparkId]/entry/[entryId]/page.tsx — new: full entry + comments
app/[locale]/(public)/u/[username]/page.tsx                         — new: author profile
```

**URL parameters (discover page):**

| Param | Values | Default |
|---|---|---|
| `tab` | `books` \| `sparks` \| `hives` | `books` |
| `sort` | `trending` \| `popular` \| `new` (books only) | `trending` |
| `genre` | any genre string (books only) | (none) |

---

## Discover Tab Bar

A `DiscoverTabs` client component sits above the existing `FeedFilters`. It reads `?tab` from the URL and updates it on click. The Books tab renders the existing feed (FeedFilters + LoadMoreFeed). Sparks and Hives render their own independent content below the tab bar — the sort/genre filters are hidden when tab ≠ `books`.

---

## Sparks

### Spark Lifecycle

Status is **computed from dates at query time** — not stored in the DB:

| Status | Condition |
|---|---|
| `OPEN` | `now < deadline` — entries accepted, voting disabled |
| `VOTING` | `deadline ≤ now < deadline + 48h` — no new entries, voting open |
| `CLOSED` | `now ≥ deadline + 48h` — results final |

### Creation

- Free users: 1 active Spark at a time (`status = OPEN or VOTING`). Premium: unlimited.
- Creator sets: prompt text, deadline (date picker), optional word limit (integer, enforced on submit).
- Creation via a modal on the Sparks tab — no separate route.

### Sparks Tab Layout (`?tab=sparks`)

- **Active Sparks grid:** 2-column grid of Spark cards. Card shows: status badge (color-coded: yellow = OPEN, purple = VOTING), prompt text, creator username, entry count, word limit (if set), time remaining.
- **Past Sparks list:** Compact rows below the grid — prompt text, winner username, entry/vote counts.
- **"+ Create Spark" button** in the top-right of the tab bar (auth-gated; shows sign-in prompt for guests).

### Spark Detail Page (`/discover/spark/[sparkId]`)

**Hero:** Status badge, prompt text (large, max-width 640px), creator info, deadline, entry count.

**Submit panel** (shown only when `status = OPEN` and user is authenticated and has not yet submitted):
- Textarea with live word count
- Word limit enforced client-side and server-side
- One entry per user per Spark

**Entries list:**
- Sort toggle: Top (by votes) / New (by `createdAt`)
- Entry cards: author, timestamp, word count, first ~3 lines of prose preview, "View full entry →" button
- Vote button on each card: disabled with "voting opens after deadline" during OPEN; active during VOTING; hidden/final during CLOSED
- During VOTING/CLOSED, creator sees "★ Pick as my choice" on each entry (hidden on their own if they entered)
- Users cannot vote on their own entry

**CLOSED state:** Winner banner at top showing 🏆 most-voted winner + ⭐ creator's choice (if different people).

### Full Entry Page (`/discover/spark/[sparkId]/entry/[entryId]`)

- Back link to Spark detail
- Thin context bar showing the prompt text
- Vote button / status in the top nav (mirrors Spark detail state)
- Full prose rendered at 640px reading width (`font-size: 16px`, `line-height: 1.9`)
- Comments section below (same pattern as book comments: auth-gated input, top-level only, max 1000 chars)

---

## Hives Tab (`?tab=hives`)

2-column grid of public Hives cards. Each card: Hive name, description snippet, member count, book count, "Request to Join" button (auth-gated). Uses the existing `getPublicHivesAction`. No new DB work — purely a new tab layout and card component.

---

## Author Profile (`/u/[username]`)

Public page — no auth required.

**Header:** Avatar (72px), display name / username, bio, inline stats row, Follow button.

**Stats row:** `X followers · X following · Xk words written · X books published · X Sparks created`

**Follow button:** Auth-gated. Unauthenticated visitors see "Sign in to follow." Authenticated users see the optimistic toggle (same `toggleFollowAction` from Phase 6).

**Published Books:** 4-column grid of book cards (cover, title, word count, like count) linking to `/discover/book/[bookId]`.

**Open Sparks:** Compact rows for `OPEN` and `VOTING` Sparks the author created. Closed Sparks are not shown here.

**Recent Activity feed:** Chronological list with icons:
- 📖 Published a chapter in [book]
- ⚡ Created a Spark: "[prompt]"
- 💬 Commented on [username]'s entry in a Spark
- ⭐ Picked [username] as creator's choice

Excludes likes and bookmarks (too noisy). Limited to ~20 most recent events.

`getProfileActivityAction` uses a UNION query across four tables: `binderItems` (chapter publishes), `sparks` (Spark creations), `sparkEntryComments` (entry comments), and `sparks.creatorChoiceEntryId` (creator's choice picks). Each row is tagged with a type so the UI can render the correct icon and label.

---

## DB Schema Changes

### Modify `sparks`

Add columns:
```sql
word_limit              integer                -- null = no limit
creator_choice_entry_id uuid references spark_entries(id)  -- null until creator picks
winner_entry_id         uuid references spark_entries(id)  -- null until finalized
```

No `status` column — computed from `deadline`.

`winner_entry_id` enables lazy finalization: the first call to `getSparkAction` that finds `status = CLOSED` and `winner_entry_id IS NULL` computes the most-voted entry, writes it to `winner_entry_id`, and fires the `SPARK_WIN` notification — exactly once.

### Modify `sparkEntries`

Remove `chapter_id` and `votes` (vote counts are computed from `sparkVotes` joins, not stored). Add:
```sql
content    text not null
word_count integer not null default 0
```

### New `sparkVotes` table

```sql
user_id    text not null references users(id)
entry_id   uuid not null references spark_entries(id)
created_at timestamp not null default now()
primary key (user_id, entry_id)
```

One row = one vote. Prevents double-voting. Used to compute vote counts and check whether the current user has voted on a given entry.

---

## New Server Actions

### `lib/actions/sparks.actions.ts`

```ts
getSparksAction(filter?: 'active' | 'closed', page?: number)
  → ActionResult<{ sparks: SparkSummary[]; hasMore: boolean }>

getSparkAction(sparkId: string)
  → ActionResult<SparkDetail>           // includes computed status, creator profile

createSparkAction(input: { prompt: string; deadline: Date; wordLimit?: number })
  → ActionResult<{ sparkId: string }>   // auth required; free-tier gated

getSparkEntriesAction(sparkId: string, sort?: 'top' | 'new', page?: number)
  → ActionResult<{ entries: SparkEntrySummary[]; hasMore: boolean }>

getSparkEntryAction(sparkId: string, entryId: string)
  → ActionResult<SparkEntryDetail>      // full content + author + vote count + userHasVoted

submitSparkEntryAction(sparkId: string, content: string)
  → ActionResult<{ entryId: string }>   // auth; only during OPEN; one per user; word limit enforced

updateSparkEntryAction(entryId: string, content: string)
  → ActionResult<void>                  // auth; own entry; only during OPEN

voteSparkEntryAction(entryId: string)
  → ActionResult<{ voted: boolean }>    // auth; only during VOTING; not own entry; toggles

setCreatorChoiceAction(sparkId: string, entryId: string)
  → ActionResult<void>                  // auth; must be Spark creator; only after deadline

getSparkEntryCommentsAction(entryId: string, page?: number)
  → ActionResult<{ comments: EntryComment[]; hasMore: boolean }>

addSparkEntryCommentAction(entryId: string, content: string)
  → ActionResult<EntryComment>          // auth; max 1000 chars
```

### `lib/actions/user-profile.actions.ts`

```ts
getPublicProfileAction(username: string)
  → ActionResult<PublicProfile>         // bio, stats, 404 if not found

getProfileBooksAction(userId: string)
  → ActionResult<DiscoverBook[]>        // published books, ordered by likeCount desc

getProfileSparksAction(userId: string)
  → ActionResult<SparkSummary[]>        // OPEN + VOTING only

getProfileActivityAction(userId: string)
  → ActionResult<ActivityEvent[]>       // last 20 events
```

### Modify `lib/actions/social.actions.ts`

Add `db.insert(notifications)` after the DB write in:
- `toggleFollowAction` → `NEW_FOLLOWER` to the followed user (only on follow, not unfollow)
- `toggleBookLikeAction` → `NEW_LIKE` to the book author (only on like, skip if author === liker)
- `addCommentAction` → `NEW_COMMENT` to the book author (skip if commenter === author)

Add to `addSparkEntryCommentAction`:
- `NEW_COMMENT` to the entry author (skip if commenter === entry author)

Add to `setCreatorChoiceAction` and on voting close (computed when `getSparkAction` detects CLOSED transition):
- `SPARK_WIN` to the most-voted entry author
- `SPARK_WIN` to the creator's choice entry author (separate notification if different person)

---

## Files to Create / Modify

### New
- `app/[locale]/(public)/discover/_components/tabs.tsx`
- `app/[locale]/(public)/discover/_components/spark-card.tsx`
- `app/[locale]/(public)/discover/_components/spark-entry-card.tsx`
- `app/[locale]/(public)/discover/_components/spark-vote-button.tsx`
- `app/[locale]/(public)/discover/_components/create-spark-modal.tsx`
- `app/[locale]/(public)/discover/_components/hive-card.tsx`
- `app/[locale]/(public)/discover/spark/[sparkId]/page.tsx`
- `app/[locale]/(public)/discover/spark/[sparkId]/entry/[entryId]/page.tsx`
- `app/[locale]/(public)/u/[username]/page.tsx`
- `app/[locale]/(public)/u/[username]/_components/follow-button.tsx`
- `lib/actions/sparks.actions.ts`
- `lib/actions/user-profile.actions.ts`

### Modified
- `app/[locale]/(public)/discover/page.tsx` — add tab bar, conditional rendering by tab
- `lib/actions/social.actions.ts` — add notification inserts
- `db/schema/social.ts` — add `sparkVotes` table, modify `sparks` and `sparkEntries`

---

## Error States

| Condition | Behavior |
|---|---|
| `/u/[username]` not found | 404 page |
| Spark not found | 404 page |
| Entry not found or belongs to different Spark | 404 page |
| Submit entry while not OPEN | `{ success: false, error: 'SPARK_NOT_OPEN' }` |
| Submit entry when already submitted | `{ success: false, error: 'ALREADY_SUBMITTED' }` |
| Submit entry over word limit | `{ success: false, error: 'WORD_LIMIT_EXCEEDED' }` |
| Vote while not VOTING | `{ success: false, error: 'VOTING_NOT_OPEN' }` |
| Vote on own entry | `{ success: false, error: 'CANNOT_VOTE_OWN_ENTRY' }` |
| Create Spark over free limit | `{ success: false, error: 'FREE_LIMIT_REACHED' }` |
| Creator's choice by non-creator | `{ success: false, error: 'NOT_SPARK_CREATOR' }` |
| Social action while unauthenticated | `{ success: false, error: 'AUTH_REQUIRED' }` — UI shows sign-in prompt |
