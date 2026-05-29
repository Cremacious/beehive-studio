# H1 — Hive Foundation: Book↔Hive Model & Entry Points

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H1 of 5 (Hives redesign)
**Predecessors:** none
**Successors:** H2 (mirror model), H3 (collaboration core), H4 (motivation layer), H5 (dashboard)

---

## Context

The current Hive feature in beehive-studio exists but is underused: hives have only a nullable `bookId`, no clear entry point in the editor, no first-class place in the studio library, and a 5-role permission model with two indistinguishable roles. The reference implementation at `beehive-books-online` treats hives as book-centric collaboration spaces — every hive is for one book, every section of the hive operates on that book's content (chapters, outline, wiki).

This spec defines the foundation that the rest of the Hives redesign (H2–H5) sits on top of: the relational model between books and hives, the role enum, the creation flows, the entry points on `/studio` and in the editor, and the impact on `/community` and `/discover`. It does **not** redesign any individual hive section's contents — those land in H2–H5.

## Goals

- A book may have at most one hive; standalone (book-less) hives are also allowed.
- Every hive has its own visibility + discoverable axes, independent of any linked book.
- Authors can create a hive in three ways, all from `/studio`: link an existing book, create a new book + hive together, or create a standalone hive.
- The editor binder footer shows **Create Hive** when no hive exists for the book and **Go to Hive** when one does.
- `/studio` displays the user's hives in a dedicated section alongside (below) the books grid, with its own filters (Owned · Member, Linked · Standalone).
- `/community` becomes a feed of activity from hives the viewer is a member of.
- `/discover/hives` filters on `discoverable = true` (mirroring the book pattern).
- Deleting a book deletes its hive (cascade).
- Role enum collapses from 5 values to 4: OWNER / MODERATOR / CONTRIBUTOR / BETA_READER.

## Non-goals

- Wiki, Outline, Annotations, Submissions, Suggestions, Discussions, Word Goals, Buzz Board, and Dashboard internals — these are H2–H5.
- Sprints, polls, and real-time chat from beehive-books-online — not in scope for this redesign cycle.
- Bi-directional mirror between editor binder items and Hive wiki/outline — that's H2.

---

## Data Model

### Schema changes to `hives`

```sql
-- New column
ALTER TABLE hives
  ADD COLUMN discoverable boolean NOT NULL DEFAULT false;

-- Enforce one-hive-per-book (NULL bookId allowed for standalones)
CREATE UNIQUE INDEX hives_book_id_unique
  ON hives(book_id)
  WHERE book_id IS NOT NULL;

-- Tighten FK to cascade
ALTER TABLE hives
  DROP CONSTRAINT hives_book_id_fkey,
  ADD CONSTRAINT hives_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
```

**Columns after migration:**

| Column          | Type      | Notes                                                              |
| --------------- | --------- | ------------------------------------------------------------------ |
| id              | uuid PK   | unchanged                                                          |
| book_id         | uuid?     | nullable; UNIQUE when not null; cascades on book delete            |
| owner_id        | uuid      | unchanged                                                          |
| name            | text      | unchanged                                                          |
| description     | text?     | unchanged                                                          |
| visibility      | enum      | PRIVATE / FRIENDS / PUBLIC (unchanged)                             |
| **discoverable** | **bool** | **NEW**; default false; coerced false when visibility ≠ PUBLIC     |
| status          | enum      | ACTIVE / COMPLETED (unchanged)                                     |
| created_at      | timestamp | unchanged                                                          |
| updated_at      | timestamp | unchanged                                                          |

### Role enum collapse

`hive_member_role` enum reduces from 5 → 4 values:

| Old value     | New value     | Notes                                  |
| ------------- | ------------- | -------------------------------------- |
| OWNER         | OWNER         | unchanged                              |
| EDITOR        | → MODERATOR   | enum value added, old value rewritten  |
| CONTRIBUTOR   | CONTRIBUTOR   | unchanged                              |
| BETA_READER   | BETA_READER   | unchanged                              |
| PROOFREADER   | → CONTRIBUTOR | enum value removed                     |

Final enum: **OWNER · MODERATOR · CONTRIBUTOR · BETA_READER**.

Postgres enum value removal requires the create-new-enum-and-swap pattern; encapsulated in `scripts/db/collapse-hive-roles.ts`.

### New table: `hive_activity` (used by /community feed; written by H3/H4)

```sql
CREATE TABLE hive_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id     uuid NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  actor_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,    -- 'chapter_submitted' | 'chapter_submitted_approved' | 'chapter_submitted_rejected' | 'annotation_added' | 'suggestion_proposed' | 'suggestion_accepted' | 'suggestion_rejected' | 'buzz_posted' | 'discussion_posted' | 'member_joined'
  subject_id  uuid,             -- nullable; e.g. chapter id, post id
  payload     jsonb,            -- denormalized title/excerpt for cheap reads
  created_at  timestamp DEFAULT now() NOT NULL
);

CREATE INDEX hive_activity_hive_id_created_at_idx
  ON hive_activity(hive_id, created_at DESC);
```

H1 ships the table and the read path (`getHiveActivityFeedAction`). The `member_joined` write path is wired up in H1 (since membership is in scope here); all other write paths are wired by the sub-project that owns the corresponding feature (H3 for chapter/discussion/annotation/suggestion, H4 for buzz).

### Permission helpers (new file: `lib/hive/permissions.ts`)

```ts
type HiveRole = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

// Throw-or-return-role helpers
requireHiveMember(hiveId, userId): Promise<HiveRole>
requireHiveMod(hiveId, userId): Promise<HiveRole>      // OWNER or MODERATOR
requireHiveOwner(hiveId, userId): Promise<HiveRole>

// Pure predicates
canEditWiki(role): boolean              // not BETA_READER
canSubmitChapter(role): boolean         // CONTRIBUTOR (BETA_READER cannot)
canReviewSubmissions(role): boolean     // OWNER or MODERATOR
canAnnotate(role): boolean              // all members
canSuggestEdits(role): boolean          // all members
canEditOutline(role): boolean           // OWNER, MODERATOR, CONTRIBUTOR
canManageMembers(role): boolean         // OWNER or MODERATOR
canDeleteHive(role): boolean            // OWNER only
```

H1 ships predicates for **all** roles even though the corresponding UIs ship in H2–H5. Centralizing them here means later sub-projects don't have to re-litigate permission rules.

### Reverse-lookup helper (new file: `lib/hive/get-book-hive.ts`)

```ts
// Single indexed query on hives.bookId; memoized per-request with React cache()
getBookHive(bookId: string): Promise<{ hiveId: string } | null>
```

Used by: editor binder footer, /studio book card "Has hive" indicator (deferred to H2 if needed), createHiveAction (uniqueness pre-check).

---

## Server Actions (H1 surface)

| Action                          | File                                  | Purpose                                                                                            |
| ------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `createHiveAction`              | `lib/actions/hive.actions.ts`         | Now accepts `{ bookId?, name, description, visibility, discoverable }`; validates uniqueness + free-tier limit |
| `updateHiveAction`              | same                                  | Now accepts `discoverable`; coerces false if visibility ≠ PUBLIC                                   |
| `deleteHiveAction`              | same                                  | Owner-only; cascade-deletes via FKs                                                                |
| `getHiveAction`                 | same                                  | Returns hive + membership + role                                                                   |
| `inviteUserToHiveAction`        | same                                  | OWNER or MODERATOR; respects FREE_HIVE_MEMBER_LIMIT                                                |
| `acceptHiveInviteAction`        | same                                  | Token-based; writes `member_joined` activity row                                                   |
| `leaveHiveAction`               | same                                  | Cannot be called by OWNER                                                                          |
| `changeHiveMemberRoleAction`    | same                                  | Owner-only                                                                                         |
| `removeHiveMemberAction`        | same                                  | OWNER or MODERATOR; cannot remove OWNER                                                            |
| `getUserHivesView`              | `lib/actions/hive.actions.ts`         | Replaces `getUserHivesAction` / `getMyHivesAction`; returns the richer projection for /studio       |
| `getBookHive`                   | helper, not server action             | See above                                                                                          |
| `getHiveActivityFeedAction`     | `lib/actions/hive-activity.actions.ts` | New file; cursor-paginated; member-scoped                                                          |
| `getDiscoverableHivesAction`    | `lib/actions/discover.actions.ts`     | Replaces `getPublicHivesAction`; filters `visibility = PUBLIC AND discoverable = true`             |

**Removed:**
- `getCommunityFeedAction` (writers-you-follow feed retires)
- `getPublicHivesAction` (renamed)
- `getMyHivesAction` / `getUserHivesAction` (folded into `getUserHivesView`)

---

## UI Surfaces

### `/studio` — books + hives library

Layout (top to bottom):

```
1. AppNav
2. ContinueWritingHero          (existing)
3. StudioStats row              (existing 4 tiles)
4. BOOKS SECTION                (existing — header, controls, grid)
5. HIVES SECTION                (NEW)
6. Empty-state fallback         (existing pattern, dual CTA)
```

**Hives section:**
- Header: "Your Hives" label + **+ New Hive** button (brand-yellow primary, opens creation modal).
- Control row:
  - Search input (filters by hive name)
  - Sort dropdown: **Most active** (default) · Recently created · A→Z · Member count
  - Filter chips, row 1: **All · Owned · Member** (with counts)
  - Filter chips, row 2: **Linked to book · Standalone** (only renders if user has both)
- Grid: hive cards.

**Hive card:**
- Cover: book's `coverUrl` if linked, else generated honeycomb SVG pattern.
- Header: hive name + role pill (OWNER / MOD / CONTRIB / BETA) using `--status-*` tokens.
- Subline: "for *Book Title* · 4 members" (omits "for *Book*" on standalones).
- Footer: "Last active 2h ago".
- Status-color left-edge stripe (active = brand, completed = muted).
- Click → `/hive/[hiveId]`.

**Empty states:**
- No hives at all → small dotted-border card: *"No hives yet. Start a hive to collaborate on a book."* + **+ New Hive** CTA.
- No hives match filters → *"No hives match these filters."* (no CTA).

### Creation modal

Opens from /studio's **+ New Hive** button. Two-step:

**Step 1 — path picker** (three radio cards):
1. **Link an existing book** — dropdown of user's books without a hive (disabled-with-tooltip for books that already have one; empty state if all books taken).
2. **Create a new book + hive together** — routes to `/studio/new` wizard in `?withHive=1` mode; after book creation, opens directly into the hive details step.
3. **Standalone hive (no book)** — inline form on the same modal.

**Step 2 — hive details** (same for all three paths):
- Name (required, max 80 chars)
- Description (optional, max 280 chars)
- Visibility: Private / Friends / Public (radio cards)
- Discoverable checkbox (disabled unless Public)

Submit → `createHiveAction` → router push to `/hive/[hiveId]`.

### Editor binder footer

Existing `BinderHiveFooter` component. New behavior:

- Page loader at `app/[locale]/(app)/studio/[bookId]/page.tsx` calls `getBookHive(bookId)` and passes `{ hiveId } | null` through the existing provider.
- If `null` → button reads **"Create Hive"** (Plus icon). Click opens `CreateHiveModal` pre-locked to the "Link an existing book" path with this book pre-selected; user fills only name/description/visibility/discoverable.
- If exists → button reads **"Go to Hive"** (Users icon). Renders as a `<Link>` to `/hive/[hiveId]`.

### `/community` — hive activity feed

- Main column: cursor-paginated feed from `getHiveActivityFeedAction(viewerUserId)`. Each row maps to one event type with its own icon + copy.
- Right sidebar: **My Hives** panel (top 5 by activity) · **Suggested Writers** (kept from Phase 7.5) · **Active Sparks** (kept from Phase 7.5).
- Empty state: *"You're not in any hives yet."* + link to /studio.

### `/discover` — Hives tab

- `getDiscoverableHivesAction` swaps in for `getPublicHivesAction`. Card UI unchanged.
- Books and Sparks tabs untouched.

### `/hive/[hiveId]` — placeholder structure

H1 only redesigns the **Settings** and **Members** entries. The other sidebar nav items (Dashboard, Outline, Wiki, Annotations, Discussions, Submit Chapter, Edit Suggestions, Word Goals, Buzz Board) render placeholder pages with a "Coming soon" note so the nav shell is real but the contents wait for H2–H5.

---

## Migration Plan

Single migration file: `db/migrations/0xxx_h1_hive_foundation.sql` + a `scripts/db/apply-h1-migration.ts` runner (drizzle-kit push requires TTY on this project per AGENTS.md).

**Steps the runner performs in order:**

1. Apply schema changes (add `discoverable`, unique index, FK cascade, `hive_activity` table).
2. For any book with >1 hive (shouldn't happen in dev, but defensive): keep the oldest by `createdAt`, delete the rest (cascade handles the children).
3. Coerce `discoverable = false` on any hive with `visibility ≠ PUBLIC` (default already false; this is defense-in-depth).
4. Collapse role enum: `UPDATE hive_members SET role = 'MODERATOR' WHERE role = 'EDITOR'; UPDATE hive_members SET role = 'CONTRIBUTOR' WHERE role = 'PROOFREADER';` then swap the enum type (helper script handles the dance).
5. Log final counts (hives total, hives with bookId, standalone hives, hive_members by role).

---

## Test Plan

**Unit (vitest):**
- Permission helpers: 4 roles × ~8 predicates = ~32 cases (truth-table tests).
- `getBookHive` cache: same bookId in two calls within one request → one DB query.
- Discoverable coercion: visibility flip from PUBLIC → PRIVATE forces discoverable=false.
- `createHiveAction` validation: rejects bookId not owned, rejects bookId with existing hive, rejects over-limit free-tier user.

**Manual smoke (per Chris's preference):**
1. Create a standalone hive from /studio → appears in Hives section with role=OWNER.
2. Create a hive linked to an existing book → editor binder footer flips from "Create Hive" → "Go to Hive".
3. Create new book + hive together via the wizard path → both rows exist, linked.
4. Try to create a second hive for the same book → server error surfaced as toast.
5. Invite another user → they accept → `member_joined` activity row written → appears in viewer's /community feed.
6. Delete the linked book → confirmation dialog includes the hive in the "this will also delete" line → hive row and all child rows gone.
7. Flip hive to PUBLIC + discoverable=true → appears on /discover/hives.
8. Flip back to PRIVATE → discoverable auto-clears → disappears from /discover but URL still works for members.

---

## Risks & Trade-offs

- **Activity-event table is denormalized.** A new event type (e.g. when H4 adds `buzz_posted`) requires both the writer and the feed-renderer to know about it. Acceptable: enumerated `type` field + switch in the renderer. Document new types in this spec as they land.
- **The `getCommunityFeedAction` (follows-feed) is being deleted.** Phase 7.5 work retires. The follow relationship itself remains useful (author profile pages, future features); just the feed view goes.
- **Role enum migration is irreversible.** Once `EDITOR`/`PROOFREADER` are dropped, restoring them requires a real migration. Accepted: those roles were never load-bearing.
- **Standalone hives create a new mental model** users have to absorb ("a hive can exist without a book"). H1 ships this anyway because the user explicitly wants it; UX copy on the creation modal makes the three paths clear.

---

## Out of Scope (Explicit)

- Wiki redesign / new wiki categories / template system → H2
- Outline redesign (Kanban → hierarchical typed items) → H2
- Bi-directional mirror between binder items and Hive wiki/outline → H2
- Inline annotations on chapters → H3
- Chapter submission workflow → H3
- Edit suggestions workflow → H3
- Discussion threading → H3
- Word goals + per-user word logs → H4
- Buzz Board (inspiration / mood posts) → H4
- Sprints, polls, real-time chat → not in scope for the redesign cycle
- Dashboard redesign (aggregates all sections) → H5
