# H4 — Motivation: Word Goals · Buzz Board

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H4 of 5 (Hives redesign)
**Predecessors:** H1 (foundation), H2 (mirror), H3 (collab core)
**Successors:** H5 (dashboard)

---

## Context

H1–H3 give us a working collaboration space: a hive lives on a book, members can edit the shared wiki/outline, leave annotations, suggest edits, submit chapters, and talk in discussions. H4 adds the team-momentum layer — shared word goals that progress as anyone in the hive writes on the linked book, and a lightweight Buzz Board for sharing inspiration, links, and vibes.

Milestones were originally planned for this sub-project but have been dropped from the redesign entirely (decided mid-brainstorm). H1, H2, H3 specs amended to remove references.

## Goals

- A hive can have up to four simultaneous active word goals: DAILY, WEEKLY, MONTHLY, TOTAL. One active per type at any time.
- Word logs flow in automatically as members save chapters, throttled at 60s per (user, chapter) to match the existing snapshot throttle.
- Goal progress is recomputed on view from `hive_word_logs` aggregated over the goal's date window; can move backward when content is deleted.
- A `/hive/[hiveId]/word-goals` page shows active goal progress bars, per-member contribution breakdown, recent activity, and a history of archived goals.
- The hive sidebar shows a small progress badge under the Word Goals nav entry.
- A `/hive/[hiveId]/buzz` Buzz Board page lets all members post short TEXT or LINK items; no images (reserved for profiles + book covers), no comments (use Discussions).
- Likes on buzz posts; like count denormalized for cheap feed reads.
- `buzz_posted` event written to H1's `hive_activity` table from the same transaction.

## Non-goals

- Per-member personal goals inside a hive context — confirmed out (Q1). Personal pace tracking belongs on a future user-level dashboard, not in hive chrome.
- Milestones / achievements of any kind — removed from the redesign.
- Image uploads on Buzz Board — confirmed out. Image hosting is reserved for user profile avatars and book covers.
- Comments on Buzz Board posts — confirmed out. Conversational threads belong in Discussions.
- @mention notifications on buzz posts — cross-cutting notification work, deferred.
- Goal-completion celebrations / notifications — completion is visual (bar pulses); not a tracked event.
- Real-time feed updates (live new-post indicator) — standard refresh on navigation.
- Dashboard aggregation across word goals + buzz feed + activity feed → H5.

---

## Data Model

### `hive_word_goals` (new)

```sql
CREATE TYPE word_goal_type AS ENUM ('DAILY','WEEKLY','MONTHLY','TOTAL');

CREATE TABLE hive_word_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id         uuid NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  type            word_goal_type NOT NULL,
  target_words    integer NOT NULL CHECK (target_words > 0),
  start_date      timestamp NOT NULL DEFAULT now(),
  end_date        timestamp,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hive_word_goals_active_unique
  ON hive_word_goals(hive_id, type) WHERE is_active = true;
```

**Lifecycle:** when OWNER/MOD creates a goal of an existing active type, the existing active goal auto-archives (`is_active=false`, `end_date=now()`). The partial-unique index allows full history with one active per `(hive_id, type)`.

### `hive_word_logs` (new)

```sql
CREATE TABLE hive_word_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id         uuid NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id      uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  words_added     integer NOT NULL,
  logged_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX hive_word_logs_hive_id_logged_at_idx
  ON hive_word_logs(hive_id, logged_at DESC);
CREATE INDEX hive_word_logs_user_chapter_idx
  ON hive_word_logs(user_id, chapter_id, logged_at DESC);
```

`words_added` is a delta from the previous log row for the same (`user_id`, `chapter_id`); first row per pair = the full word count at first log. Negative values allowed (deletion). Goal progress = `SUM(words_added)` filtered by `logged_at >= goal.start_date AND (goal.end_date IS NULL OR logged_at < goal.end_date)`.

### `hive_buzz_posts` (new)

```sql
CREATE TYPE buzz_post_type AS ENUM ('TEXT','LINK');

CREATE TABLE hive_buzz_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id         uuid NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            buzz_post_type NOT NULL,
  body            text NOT NULL,
  link_url        text,
  like_count      integer NOT NULL DEFAULT 0,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now(),
  CHECK ((type = 'LINK' AND link_url IS NOT NULL)
      OR (type = 'TEXT' AND link_url IS NULL))
);

CREATE INDEX hive_buzz_posts_hive_created_idx
  ON hive_buzz_posts(hive_id, created_at DESC);
```

### `hive_buzz_likes` (new)

```sql
CREATE TABLE hive_buzz_likes (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buzz_id    uuid NOT NULL REFERENCES hive_buzz_posts(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, buzz_id)
);
```

`hive_buzz_posts.like_count` is denormalized for cheap feed reads. Always updated in the same transaction as the like-row insert/delete.

### Permission predicates (extend `lib/hive/permissions.ts`)

```ts
canSetWordGoal(role): boolean              // OWNER or MODERATOR
canPostBuzz(role): boolean                 // all members
canLikeBuzz(role): boolean                 // all members
canEditBuzz(post, viewerRole, viewerId): boolean
                                            // viewerId === post.authorId OR role IN ('OWNER','MODERATOR')
```

---

## Word Goals: UI + Logging Integration

### Logging hook — `lib/hive/log-word-delta.ts`

```ts
logHiveWordDelta({
  bookId,
  userId,
  chapterId,
  currentWordCount,
}): Promise<void>
```

Behavior:
1. `getBookHive(bookId)` (H1 helper). If null → no-op.
2. Fetch most recent `hive_word_logs` for (`hive_id`, `user_id`, `chapter_id`). If `loggedAt > now - 60s` → no-op (throttle).
3. `wordsAdded = currentWordCount - sumPriorLogs(user, chapter)`. Negative values valid.
4. Insert `hive_word_logs` row.

**Wiring:** appended to the end of `saveChapterAction` after the chapter doc commits, inside the same try block as the snapshot throttle but as a non-blocking `.catch(logErr)` — a logging failure must not break the user's save.

Standalone hives (shadow book) flow through the same path; logs land in the real hive.

**Activity-event policy:** word logs deliberately don't fire `hive_activity` rows (would flood the feed). Per-write momentum surfaces on the Word Goals page directly.

### `/hive/[hiveId]/word-goals` page

**Page chrome:**
- Header: "Word Goals" title · **+ New Goal** button (visible to `canSetWordGoal(role)`)

**Active goals strip (top):**
- Up to 4 cards, one per goal type (DAILY / WEEKLY / MONTHLY / TOTAL); renders only types with an active goal
- Card content:
  - Goal type badge (color per type)
  - Progress bar (brand-yellow fill on chrome track; pulses past 100%)
  - "1,243 / 5,000 words" · "82%" · time remaining · target absolute timestamp
  - Edit/archive icons (visible to `canSetWordGoal(role)`)
- Empty state when no active goals: dotted-border card "No active goals — set a goal to track team writing momentum" + + New Goal CTA (permission-gated)

**Contributors panel:**
- Per-member breakdown within the highest-priority active goal's window (priority: DAILY > WEEKLY > MONTHLY > TOTAL)
- Row: avatar · name · words contributed in window · % of team total · last-write relative time
- Sortable by words contributed (default desc)
- Derived from `hive_word_logs` aggregated by `user_id`

**Recent activity panel:**
- Last 20 word-log entries: avatar · "+847 words in *Chapter Title*" · timestamp
- Cursor-paginated; "Load older" button

**Goal history (collapsible at bottom):**
- All `is_active = false` goals
- Read-only rows: type · target · final progress · date range
- No "Re-enable" affordance — creating a new goal of the same type is cleaner

### + New Goal modal

- Type radio cards: DAILY / WEEKLY / MONTHLY / TOTAL
- Target words input (integer, min 1, max 10,000,000)
- Start date (defaults today; locked to today for DAILY)
- End date (auto-derived for DAILY/WEEKLY/MONTHLY based on start date; freeform for TOTAL or left null for open-ended)
- Submit → `createWordGoalAction({ hiveId, type, targetWords, startDate, endDate })`:
  1. Permission check `canSetWordGoal(role)`
  2. Archive any existing active goal for `(hiveId, type)`: `is_active=false`, `end_date=now()`
  3. Insert new goal row

### Edit / archive flow

- Edit modal pre-fills; submit calls `updateWordGoalAction({ id, ...changes })`. Limited to `target_words`, `end_date`. Type and start date locked.
- Archive button → confirmation dialog → `archiveWordGoalAction(id)`. Goal moves to history.

### Hive sidebar progress badge

Hive shell's left sidebar entry for "Word Goals" shows a thin horizontal bar segment under the nav label when an active goal exists:
- Aggregate progress against the highest-priority active goal (DAILY > WEEKLY > MONTHLY > TOTAL)
- Brand-yellow fill on chrome track; no number
- Hidden when no active goal

---

## Buzz Board

### `/hive/[hiveId]/buzz` page

**Page chrome:**
- Header: "Buzz Board" title · **+ New Post** button (visible to all members)
- Subtitle: *"Share what's getting you fired up. Inspiration, links, vibes."*

**Feed:**
- Reverse-chron cursor-paginated, single column, masonry-style spacing (pure CSS, no JS layout)
- Mounted via `<BuzzPostCard>` (one component, two type branches)

**TEXT post card:**
- Author avatar · name · timestamp
- Body: paragraph(s); preserves line breaks; supports basic markdown (bold, italic, `code spans`) — NO headings, NO lists
- Footer: heart icon + like count · author menu (edit/delete for `canEditBuzz`)

**LINK post card:**
- Same author/timestamp header
- Optional caption above the link
- Link rendered as card-in-card:
  - Domain favicon (fetched client-side from `https://www.google.com/s2/favicons?domain=...`)
  - URL hostname (e.g. `spotify.com`)
  - Truncated full URL underneath
  - Click anywhere → opens URL in new tab (`rel="noopener noreferrer"`)
- Footer: heart icon + like count · author menu

**Compose modal:**
- Two pill tabs: **Text** / **Link** (default Text)
- TEXT form: body textarea (4-row auto-grow, max 1000 chars), live char counter
- LINK form: URL input (validated via `URL()` constructor; must parse as `https://*`; rejects non-http(s)) · optional caption (max 280 chars)
- Submit → `createBuzzPostAction({ hiveId, type, body, linkUrl? })`:
  1. Permission check `canPostBuzz(role)`
  2. Insert `hive_buzz_posts` row
  3. Write `hive_activity` event `buzz_posted` (same transaction)

**Edit modal:**
- Same shape as compose, pre-filled
- Body / linkUrl / caption editable; type locked (TEXT → LINK = delete + recreate, not in scope)

**Delete:**
- Confirm dialog (reuses shared `ConfirmDialog`)
- `deleteBuzzPostAction(id)` → row + cascading likes gone via FK
- No activity event for deletion

**Like flow:**
- Heart icon click → `toggleBuzzLikeAction({ buzzId })`:
  1. Permission check `canLikeBuzz(role)`
  2. Row exists → DELETE + decrement `like_count`
  3. Row missing → INSERT + increment `like_count`
  4. Both branches wrapped in DB transaction
- Optimistic UI: heart fills immediately, count adjusts; reverts on failure

**Empty state:**
- Dotted-border card: *"No posts yet. Drop your first vibe."* + + New Post CTA

---

## Activity Event Wiring

H4 writes the following event into H1's `hive_activity` table:

| Event type      | Written by action               |
| --------------- | ------------------------------- |
| `buzz_posted`   | `createBuzzPostAction` (top-level posts only) |

`payload` jsonb: `{ type, bodyExcerpt: first 100 chars, linkUrl? }`.

Word logs don't emit events (flood prevention). Likes don't emit events (not feed-worthy).

---

## Server Actions Summary

**New files:**

| Action                          | File                                       |
| ------------------------------- | ------------------------------------------ |
| `createWordGoalAction`          | `lib/actions/hive-word-goals.actions.ts`   |
| `updateWordGoalAction`          | same                                       |
| `archiveWordGoalAction`         | same                                       |
| `listHiveWordGoalsAction`       | same                                       |
| `getWordGoalProgressAction`     | same (returns `{ goal, progress, contributors[], recentLogs[] }`) |
| `getRecentWordLogsAction`       | `lib/actions/hive-word-logs.actions.ts`    |
| `createBuzzPostAction`          | `lib/actions/hive-buzz.actions.ts`         |
| `updateBuzzPostAction`          | same                                       |
| `deleteBuzzPostAction`          | same                                       |
| `listBuzzPostsAction`           | same (cursor-paginated; viewer's like status per post via subquery) |
| `toggleBuzzLikeAction`          | same                                       |

**Helper:** `logHiveWordDelta` in `lib/hive/log-word-delta.ts` (called from `saveChapterAction`).

---

## Migration Plan

Single file: `db/migrations/0xxx_h4_motivation.sql` + runner `scripts/db/apply-h4-migration.ts`.

**Steps in order:**

1. Create enums `word_goal_type`, `buzz_post_type`
2. Create tables `hive_word_goals`, `hive_word_logs`, `hive_buzz_posts`, `hive_buzz_likes`
3. Partial-unique index on `hive_word_goals(hive_id, type) WHERE is_active = true`
4. Indexes on `hive_word_logs` (hive+logged_at, user+chapter+logged_at)
5. Index on `hive_buzz_posts(hive_id, created_at DESC)`
6. CHECK constraint on `hive_buzz_posts` (TEXT/LINK shape)

No data backfill — all tables are new.

---

## Test Plan

**Unit:**
- `logHiveWordDelta` throttle: two calls within 60s → second no-op
- `logHiveWordDelta` no-op when book has no hive
- Negative `wordsAdded` (deletion) computes correctly from delta
- Goal progress aggregation respects `start_date` / `end_date` window
- Goal partial-unique: creating a second active DAILY archives the first
- Buzz CHECK constraint: TEXT with linkUrl → reject; LINK without linkUrl → reject
- `toggleBuzzLikeAction` is idempotent under double-click
- Permission predicates: `canSetWordGoal`, `canEditBuzz`

**Action:**
- `createWordGoalAction` archives the prior goal of the same type
- `getWordGoalProgressAction` returns correct contributor breakdown for 3-member logs
- `createBuzzPostAction` writes `hive_activity` row in same transaction (rollback path tested)
- `toggleBuzzLikeAction` increments/decrements `like_count` correctly under interleaved clicks

**Manual smoke (per Chris's preference):**
1. OWNER sets a WEEKLY goal of 5,000 words → progress bar at 0% on day 1
2. CONTRIBUTOR writes ~800 words → 60s pass → refresh → progress at ~16%, contributor in panel
3. Author deletes ~200 words → next save → progress moves backward ~4%
4. OWNER creates a new WEEKLY goal → prior WEEKLY auto-archives, appears in history
5. BETA_READER tries to set a goal → PERMISSION_DENIED
6. CONTRIBUTOR posts TEXT buzz "Just hit 50k words" → appears in feed → another member likes → heart fills, count = 1; same member clicks again → unlike, count = 0
7. LINK buzz with Spotify URL → renders as link card with spotify.com favicon
8. Author edits own TEXT buzz → updated body shows; non-MOD member can't edit it (no menu option)
9. /community feed shows `buzz_posted` event from a hive the viewer is a member of
10. Standalone hive: post a buzz, set a goal, write in the shadow book → everything works

---

## Risks & Trade-offs

- **Word logs grow unbounded.** Heavy session = one row per minute per active writer. ~50KB/hour/writer max. Acceptable; collapse-to-dailies is a future perf optimization if a hive hits 10M+ rows.
- **`like_count` denorm can drift** if a transaction half-completes. Mitigated by wrapping insert/delete + count update in a DB transaction. Reconciliation script: `UPDATE hive_buzz_posts SET like_count = (SELECT COUNT(*) FROM hive_buzz_likes WHERE buzz_id = ...)`.
- **Goal progress recomputed on every page render.** Cheap for thousands of rows; revisit if a hive accumulates millions of logs.
- **No goal-completion celebration / notification.** Bar pulses past 100%, no event fired. Acceptable — completion is aspirational, not an event.
- **Buzz Board has no comments.** By design. Discussions is one click away.

---

## Out of Scope (Explicit)

- Per-member personal word goals → confirmed out (Q1)
- Milestones / achievements → removed from redesign entirely
- Image uploads on buzz posts → confirmed out (images reserved for profiles + book covers)
- Comments on buzz posts → confirmed out (use Discussions)
- @mention notifications → cross-cutting; deferred
- Goal-completion celebrations / notifications → deferred
- Real-time feed updates → not in scope
- Dashboard aggregation → H5
