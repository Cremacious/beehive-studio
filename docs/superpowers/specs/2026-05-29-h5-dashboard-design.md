# H5 — Dashboard

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H5 of 5 (Hives redesign — final sub-project)
**Predecessors:** H1 (foundation), H2 (mirror), H3 (collab core), H4 (motivation)
**Successors:** none

---

## Context

H1–H4 build out the entire hive functional surface: foundation, shared wiki/outline, peer-to-peer collab (annotations / suggestions / submissions / discussions), and motivation (word goals + buzz). H5 is the landing surface at `/hive/[hiveId]` — the page a user sees when they click a hive card from /studio or /community. The job is to roll up everything H1–H4 produce into one coherent first impression.

Decision shape from brainstorm: **activity-first** dashboard (a chronicle of recent hive events) with a secondary **"Needs your attention"** queue that surfaces role-relevant action items. Orientation info (cover, members) is collapsed into a hero strip at the top. Word goals, linked book, and recent buzz appear as compact secondary panels.

## Goals

- Single landing surface at `/hive/[hiveId]` that gives every viewer (any role) a useful first impression.
- Activity feed scoped to this hive (reuses H1's `getHiveActivityFeedAction` with a single-hive filter param).
- Role-conditional "Needs your attention" queue, hidden when empty.
- Compact panels for active word goal · linked book stats · recent buzz.
- Member chip strip in the hero (avatars + role pills, capped + "+N more").
- "Unread since last visit" semantics for the queue's reply-tracking, via a small `hive_member_last_seen` table.
- One composite server action (`getHiveDashboardAction`) so the page is one round-trip.
- Standalone hives render the same surface, with the linked-book panel hidden and a honeycomb SVG instead of a book cover.

## Non-goals

- Personalized customization (drag-to-reorder, hide panels) — not in scope.
- Cross-hive dashboard or global hive metrics — /studio's Hives section + /community feed already cover those needs.
- Real-time event push (websockets) — dashboard reflects last server render; nav-away-and-back re-fetches. Acceptable for v1.
- Per-event "mark as unread" — last-seen is a single watermark.
- Dashboard widgets for features not yet built (sprints, polls, etc.) — H5 only surfaces H1–H4 functionality.

---

## Route & Layout

### Route

`/hive/[hiveId]` — replaces the H1 placeholder. Sidebar entry **Dashboard** lands here. Default landing surface.

### Layout

Single column on narrow viewports; two-column on wide (≥1024px).

```
HIVE HERO (full-width)
  Cover (book.coverUrl or honeycomb SVG for standalone)
  Hive name · status pill · visibility pill
  "for *Book Title* by @author"  (omitted on standalone)
  Member chip strip (avatars + role pills, up to 8 + "+N more")
  Right-side: Invite button (visible when canManageMembers)

ACTIVITY FEED (left col on wide, full-width on narrow)
  Cursor-paginated from getHiveActivityFeedAction(hiveId, viewerId)
  Same event renderer as /community
  Last 30 days; "Load older" button
  Empty state: "No activity yet. Be the first to do something."

NEEDS YOUR ATTENTION (right col on wide, hidden when empty)
  Role-conditional queue — see "Queue contents" below

ACTIVE WORD GOAL (right col)
  Highest-priority active goal (DAILY > WEEKLY > MONTHLY > TOTAL)
  Mini progress bar + label
  "View all goals →" link

LINKED BOOK QUICK-STATS (right col)
  Cover + title
  Chapter count + total words
  "Open in editor →" (author only) or "Read book →"
  Hidden for standalone hive

RECENT BUZZ (right col)
  3 most recent buzz posts
  "View Buzz Board →"
```

### "Needs your attention" queue contents

One component, content branched by role + viewer-specific state. Hidden entirely when all branches yield zero items.

| Item type                                          | Visible to            | Source                                                                |
| -------------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Pending submission to review                       | OWNER, MODERATOR      | `hive_submissions WHERE draft_status='PENDING'`                       |
| Pending suggestion to accept/reject                | OWNER, MODERATOR      | `hive_suggestions WHERE resolved=false AND parent_id IS NULL`         |
| Replies to your annotation / suggestion / post     | All members           | `parent_id` chain → ancestor authored by viewer, since `last_seen_at` |
| Unresolved annotations on chapters you authored    | Chapter author        | `hive_annotations WHERE chapter.author_user_id = viewerId OR (chapter.author_user_id IS NULL AND book.user_id = viewerId)` |
| Your draft submission (DRAFT, not yet submitted)   | Submission author     | `hive_submissions WHERE userId=viewer AND draft_status='DRAFT'`       |

Each item renders as a one-line row: icon · short label · click-through link. Panel header shows count: "**Needs your attention (4)**".

### Permissions

- Dashboard requires hive membership (`requireHiveMember` from H1). Non-members visiting → 404 (same as other /hive routes).
- All panel content respects underlying feature role gates. The dashboard never exposes data a role wouldn't see elsewhere — it's purely a roll-up.

---

## Data Model

### `hive_member_last_seen` (new — only table H5 introduces)

```sql
CREATE TABLE hive_member_last_seen (
  hive_id      uuid NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (hive_id, user_id)
);
```

Upserted on every dashboard render via `markHiveDashboardSeenAction`. Used by the "unread replies" subquery to scope to events since the previous visit.

### No other schema changes

H5 is read-only over H1–H4 schema; it doesn't introduce new domain concepts.

---

## Server Actions

| Action                                | File                                       |
| ------------------------------------- | ------------------------------------------ |
| `getHiveDashboardAction(hiveId)`      | `lib/actions/hive-dashboard.actions.ts`    |
| `markHiveDashboardSeenAction(hiveId)` | same                                       |

### `getHiveDashboardAction` return shape

```ts
type HiveDashboardData = {
  hive: {
    id, name, description, visibility, discoverable, status, coverUrl
  }
  book: {                          // null for standalone hives
    id, title, coverUrl, authorName, chapterCount, totalWordCount
  } | null
  viewerRole: HiveRole
  members: Array<{ userId, username, avatarUrl, role }>   // capped at 8 + "+N more"
  activity: {
    items: ActivityEvent[]         // last 30 days, cursor-paginated; page 1
    nextCursor: string | null
  }
  needsAttention: {
    pendingSubmissions:
      Array<{ id, title, submitterName, createdAt }> | null   // null when viewer can't review
    pendingSuggestions:
      Array<{ id, chapterTitle, suggesterName, excerpt, createdAt }> | null
    unreadReplies:
      Array<{ id, kind: 'annotation' | 'suggestion' | 'discussion',
              threadTitle, replyExcerpt, createdAt }>
    unresolvedAnnotationsOnYourChapters:
      Array<{ id, chapterTitle, layer, body, createdAt }> | null
      // null when viewer authored no chapters in this book
    yourDrafts:
      Array<{ id, title, updatedAt }>
  }
  activeGoal: {                    // highest-priority active goal; null if none
    id, type, targetWords, currentWords, endDate
  } | null
  recentBuzz: Array<{ id, type, body, linkUrl, authorName, createdAt }>  // 3 most recent
}
```

Single composite read so the page is one round-trip; React `cache()` dedups internal sub-queries (membership lookup, role check).

### `markHiveDashboardSeenAction`

Fire-and-forget upsert from page render — `(hive_id, user_id) → last_seen_at = now()`. Used by the next visit's "unread replies" subquery.

### Underlying read patterns

- **Activity feed:** reuses H1's `getHiveActivityFeedAction` with an optional `hiveId` scoping param (added in H5).
- **Pending submissions/suggestions:** reuses H3's `listHiveSubmissionsAction` (filtered to PENDING) and `getPendingSuggestionsForHiveAction`; dashboard takes the top 5 of each.
- **Unread replies:** new query — recursive CTE over `hive_annotations` + `hive_suggestions` + `hive_discussion_posts` joining `hive_member_last_seen.last_seen_at`. Returns top-level rows whose ancestor was authored by the viewer AND whose reply timestamp > last_seen_at.
- **Unresolved annotations on your chapters:** join `hive_annotations` → `chapters` → match `chapters.author_user_id = viewerId` OR (`author_user_id IS NULL` AND `books.user_id = viewerId`).
- **Your drafts:** straight read from `hive_submissions WHERE draft_status='DRAFT' AND user_id=viewer`.
- **Active goal + currentWords:** reuses H4's `listHiveWordGoalsAction` filtered to active, ordered by priority; `currentWords` reuses `getWordGoalProgressAction`.
- **Recent buzz:** straight read from `hive_buzz_posts ORDER BY created_at DESC LIMIT 3`.

---

## Migration Plan

Single file: `db/migrations/0xxx_h5_dashboard.sql` + runner `scripts/db/apply-h5-migration.ts`.

**Steps:**

1. Create `hive_member_last_seen` table.
2. Backfill: for every existing `hive_members` row, insert `(hive_id, user_id, joined_at)` so the first dashboard visit doesn't surface every-event-ever as "unread."

No other schema changes; no other data migration.

---

## Test Plan

**Unit:**
- `getHiveDashboardAction` composes the right shape for each role × each panel-population state matrix (4 roles × {has active goal / no goal} × {standalone hive / linked book} × {viewer is chapter author / not}).
- "Replies since last seen" recursive CTE: fixture with 3 levels of nesting + `last_seen_at` midway → returns only post-timestamp rows in the viewer's threads.
- `markHiveDashboardSeenAction` upsert: first call inserts; second call updates `last_seen_at` only.

**Action:**
- Permission denied: non-member → throws NOT_AUTHORIZED.
- `needsAttention.pendingSubmissions` is null for CONTRIBUTOR/BETA_READER (can't review).
- `needsAttention.unresolvedAnnotationsOnYourChapters` is null for a viewer with no `author_user_id` chapters in the hive's book.
- Standalone hive: `book` field is null; linked-book panel hidden in renderer.

**Manual smoke (per Chris's preference):**
1. OWNER opens dashboard → activity feed populated, "Needs your attention" shows pending submissions/suggestions count, active goal bar visible.
2. BETA_READER opens same hive → activity feed unchanged, "Needs your attention" empty/hidden (no review power), active goal still visible.
3. CONTRIBUTOR submits a chapter → OWNER's dashboard gains the pending submission row; CONTRIBUTOR's dashboard "Your drafts" stays empty (no longer DRAFT); activity event appears.
4. Author writes a chapter, BETA annotates → author's dashboard shows "Unresolved annotations on your chapters" row.
5. Member visits dashboard twice within 5 min → second visit's unread-replies subquery returns only post-first-visit rows.
6. Standalone hive → cover = honeycomb SVG, linked-book panel hidden, everything else renders.
7. Fresh hive (no activity, no goals, no buzz, no pending anything) → hero + members + empty-state activity, right column collapsed/hidden.

---

## Risks & Trade-offs

- **`hive_member_last_seen` updates on every dashboard render.** Cheap upsert, but "unread" collapses to zero on every visit. Acceptable — that IS the definition of "unread since last visit." A future feature could expose a "mark as unread" affordance.
- **Composite `getHiveDashboardAction` is a fat query.** ~7 sub-queries + 1 recursive CTE. All indexed; runs server-side; no client round-trips. If perf becomes an issue, panels can be lazy-loaded via separate actions.
- **Activity-feed denormalization carries through.** New event types added later need to be taught to the renderer in two places (/community + dashboard). A centralized event renderer component avoids the duplication.
- **No real-time updates.** Acceptable for v1.

---

## Out of Scope (Explicit)

- Personalized dashboard customization (drag-to-reorder panels, hide panels)
- Cross-hive dashboard / global hive metrics (already covered by /studio + /community)
- Real-time event push (websockets)
- Per-event "mark as unread" — single watermark only
- Dashboard widgets for features not yet built (sprints, polls)

---

## Wrap-up — End of the Hives Redesign Spec Cycle

H5 closes the spec stack. With H1–H5 specified, recommended implementation order:

1. **H1** — foundation (schema, roles, creation flows, /studio surface, /community feed, /discover changes, book delete cascade)
2. **H2** — mirror (wiki/outline/notes single-source-of-truth, 14 categories, shadow books, permissions)
3. **H3** — collab core (annotations, suggestions, submissions, discussions, TipTap marks, activity events)
4. **H4** — motivation (word goals + logs, buzz board, hooks into saveChapterAction)
5. **H5** — dashboard (composite read action + layout, last-seen tracking)

Each sub-project ships independently with its own writing-plans cycle.
