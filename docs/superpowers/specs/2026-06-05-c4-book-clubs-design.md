# C4 — Book Clubs (Design)

**Status:** Locked 2026-06-05. Awaiting plan-writing.
**Phase:** Fourth of 5 in the Community phase. See [community-phase-overview.md](2026-06-04-community-phase-overview.md) for the C1–C5 roadmap.
**Goal:** Ship persistent book clubs — long-lived groups of readers with member roles, a shared current book + queue + history, scheduled per-chapter milestones, club-wide threaded discussions with likes + pins, dual invite paths (username + link tokens), join-request approvals, and full social-activity integration. Replaces the C1-T9 Coming-Soon stub at `/clubs`.

---

## 1. Locked decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Cross-book continuity | **A — Persistent clubs.** Long-lived groups with current-book pointer + history. Members carry across books. |
| Q2 | Membership approval | **C — Per-club setting.** `open_join: boolean` on each club. Owner picks at creation; togglable in settings. |
| Q3 | Reading schedule | **B — Light schedule.** Per-chapter checkpoints with target dates. New `book_club_schedule_items` table. |
| Q4 | C3 reading-list integration | **A — Club has its OWN books table** (`book_club_books`) mirroring C3 row shape (title/author/bookId/coverUrl/order) + `status` enum (CURRENT/PAST/QUEUE). No rating/commentary (group-level, not curator-level). |
| Q5 | Member roles | **A — Three tiers:** OWNER / MODERATOR / MEMBER. |
| Q6 | Discussion scope | **A — Club-wide only.** Single feed; no per-book partitioning. Per-book scoping is a C5 polish if users ask. |
| Q7 | Discussion mechanics | **i + b + yes + req.** One-level threading (top-level + replies); likes on BOTH posts AND replies; pinned posts (MOD+); titles required (max 120). |
| Q8 | Invite mechanism | **C — Both.** Invite-by-username (consent gate, mirrors C1 friendship pattern) AND invite-by-link tokens (mirrors C1 friend_invites). |
| Q9 | Activity events | **E1 + E3.** `book_club_created` (one-shot) + `book_club_current_book_changed` ("Alice's club is now reading X"). Skip joins (noisy), discussion posts (floods feed), and explicit "finished" (redundant with current-book change). |
| — | Privacy + discoverable | PUBLIC/FRIENDS/PRIVATE + `discoverable` boolean (matches book + hive + spark + list pattern). 3-layer defense on discoverable. |
| — | Owner cannot leave | Returns `OWNER_CANNOT_LEAVE` — must transfer ownership or delete club first. |

---

## 2. Data model

### 2.1 New pgEnums (4)

```
book_club_member_role         ∈ OWNER | MODERATOR | MEMBER
book_club_book_status         ∈ CURRENT | PAST | QUEUE
book_club_invite_status       ∈ PENDING | ACCEPTED | REJECTED | CANCELED
book_club_join_request_status ∈ PENDING | ACCEPTED | REJECTED
```

### 2.2 Tables (11)

**`book_clubs`** — core entity:

```
id              text PRIMARY KEY                              -- createId
owner_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE
name            text NOT NULL                                 -- max 100 (Zod)
description     text                                          -- max 1000 (Zod)
rules           text                                          -- max 2000 (Zod), optional
tags            text[] NOT NULL DEFAULT '{}'                  -- max 5 × 20 chars (Zod)
visibility      book_visibility NOT NULL DEFAULT 'PUBLIC'     -- reuses existing
discoverable    boolean NOT NULL DEFAULT true
open_join       boolean NOT NULL DEFAULT true
member_count    integer NOT NULL DEFAULT 1                    -- denorm; starts at 1 (founder)
current_book_id text                                          -- nullable; FK added in migration step
                                                              -- (forward ref to book_club_books)
created_at      timestamp NOT NULL DEFAULT now()
updated_at      timestamp NOT NULL DEFAULT now()

INDEX (owner_id, created_at DESC)
INDEX (discoverable, visibility)
```

**`book_club_books`** — mirrors C3 row shape with club scope:

```
id              text PRIMARY KEY                              -- createId
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
book_id         text REFERENCES books(id) ON DELETE SET NULL  -- optional Beehive link
title           text NOT NULL                                 -- max 200
author          text NOT NULL                                 -- max 200
cover_url       text                                          -- optional
status          book_club_book_status NOT NULL DEFAULT 'QUEUE'
"order"         integer NOT NULL DEFAULT 0
added_at        timestamp NOT NULL DEFAULT now()
started_at      timestamp                                     -- when flipped to CURRENT
finished_at     timestamp                                     -- when flipped to PAST

INDEX (club_id, status, "order")
PARTIAL UNIQUE INDEX book_club_books_one_current ON (club_id) WHERE status = 'CURRENT'
```

Constraint: **at most one row per club with `status='CURRENT'`** enforced via the partial unique index. `book_clubs.current_book_id` denormalizes the pointer for fast lookup.

After both tables exist, the migration adds the FK: `ALTER TABLE book_clubs ADD CONSTRAINT book_clubs_current_book_id_fkey FOREIGN KEY (current_book_id) REFERENCES book_club_books(id) ON DELETE SET NULL`.

**`book_club_members`** — membership:

```
id              text PRIMARY KEY                              -- createId
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
role            book_club_member_role NOT NULL DEFAULT 'MEMBER'
joined_at       timestamp NOT NULL DEFAULT now()

UNIQUE (club_id, user_id)
INDEX (user_id)                                                -- "what clubs am I in?"
```

**`book_club_invites`** — username invites (consent gate):

```
id              text PRIMARY KEY
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
inviter_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE
recipient_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE
status          book_club_invite_status NOT NULL DEFAULT 'PENDING'
created_at      timestamp NOT NULL DEFAULT now()
responded_at    timestamp

INDEX (recipient_id, status)                                   -- bell-list query
INDEX (club_id)
```

Note: same recipient can have multiple PENDING invites to the same club only if the previous was REJECTED/CANCELED — application-layer guard via `WHERE status='PENDING'` on existence check before insert.

**`book_club_invite_tokens`** — link tokens:

```
token           text PRIMARY KEY                              -- 32-char base64url
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
inviter_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE
expires_at      timestamp NOT NULL                            -- 14 days
claimed_by      text REFERENCES users(id) ON DELETE SET NULL
claimed_at      timestamp
created_at      timestamp NOT NULL DEFAULT now()

INDEX (club_id)
```

One-shot tokens (claimed_at set → cannot be reused). Mirrors C1 `friend_invites` pattern.

**`book_club_join_requests`** — only used when `open_join=false`:

```
id              text PRIMARY KEY
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
status          book_club_join_request_status NOT NULL DEFAULT 'PENDING'
requested_at    timestamp NOT NULL DEFAULT now()
responded_at    timestamp

UNIQUE (club_id, user_id)                                      -- one outstanding request per user
INDEX (club_id, status)
```

If a request is REJECTED and the user wants to retry, application layer first DELETEs the old row then inserts new (or UPDATE status → PENDING with a new requested_at).

**`book_club_schedule_items`** — per-chapter milestones:

```
id              text PRIMARY KEY
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
book_id         text NOT NULL REFERENCES book_club_books(id) ON DELETE CASCADE
chapter_start   integer NOT NULL                              -- 1-indexed
chapter_end     integer NOT NULL                              -- inclusive
target_date     timestamp NOT NULL
label           text                                          -- max 80, optional
"order"         integer NOT NULL DEFAULT 0
created_at      timestamp NOT NULL DEFAULT now()

INDEX (club_id, book_id, "order")
CHECK (chapter_end >= chapter_start)
```

Schedule items survive `book_club_books.status` transitions (PAST books retain their schedule for history viewing).

**`book_club_discussions`** — top-level posts:

```
id              text PRIMARY KEY
club_id         text NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE
author_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE
title           text NOT NULL                                 -- max 120
content         text NOT NULL                                 -- max 10000 plain text
is_pinned       boolean NOT NULL DEFAULT false
like_count      integer NOT NULL DEFAULT 0                    -- denorm
reply_count     integer NOT NULL DEFAULT 0                    -- denorm
created_at      timestamp NOT NULL DEFAULT now()
updated_at      timestamp NOT NULL DEFAULT now()

INDEX (club_id, is_pinned DESC, created_at DESC)               -- pinned-first feed sort
```

**`book_club_discussion_replies`** — one-level replies (NO `parent_id` self-FK; replies cannot have replies):

```
id              text PRIMARY KEY
discussion_id   text NOT NULL REFERENCES book_club_discussions(id) ON DELETE CASCADE
author_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE
content         text NOT NULL                                 -- max 5000
like_count      integer NOT NULL DEFAULT 0                    -- denorm
created_at      timestamp NOT NULL DEFAULT now()

INDEX (discussion_id, created_at)
```

**`book_club_discussion_likes`** — likes on top-level posts:

```
user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
discussion_id   text NOT NULL REFERENCES book_club_discussions(id) ON DELETE CASCADE
created_at      timestamp NOT NULL DEFAULT now()

PRIMARY KEY (user_id, discussion_id)
```

**`book_club_discussion_reply_likes`** — likes on replies:

```
user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
reply_id        text NOT NULL REFERENCES book_club_discussion_replies(id) ON DELETE CASCADE
created_at      timestamp NOT NULL DEFAULT now()

PRIMARY KEY (user_id, reply_id)
```

### 2.3 Existing enum extensions

**`social_activity_type`** adds:
```
+ book_club_created
+ book_club_current_book_changed
```

**`notification_type`** adds:
```
+ CLUB_INVITE                  -- user got invited (CLUB_INVITE notification fires on invite send)
+ CLUB_JOIN_REQUEST            -- owner+MODs notified when a user requests to join
+ CLUB_JOIN_APPROVED           -- requester notified when MOD approves their request
```

Existing notification shape: `{ userId, type, actorId, resourceType, resourceId }` (no payload column). For CLUB_INVITE: `resourceType='book_club_invite'`, `resourceId=invite.id`. For CLUB_JOIN_REQUEST: `resourceType='book_club_join_request'`, `resourceId=request.id`. For CLUB_JOIN_APPROVED: `resourceType='book_club'`, `resourceId=clubId`.

### 2.4 Migration

Idempotent runner at `scripts/migrate-c4.ts` (mirrors `migrate-c3.ts` shape) — 17 logical steps:

1. Create 4 enums via `DO $$ EXCEPTION WHEN duplicate_object`.
2-12. Create 11 tables + their indexes + CHECK constraints.
13. Partial unique index `book_club_books_one_current`.
14. ADD `book_clubs.current_book_id` FK (deferred until both tables exist).
15. `ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS` for each of the 2 new values.
16. `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS` for each of the 3 new values.
17. Verification row counts.

The migration runner prints `✓ N/17 ...` per step.

---

## 3. Helpers

### 3.1 `lib/book-clubs/predicates.ts`

Mirrors `lib/hive/permissions.ts` shape (3-tier role) + composes C1's `areFriends` + `isBlocked`.

**Role-derived predicates** (synchronous, take viewerRole + targetUser):
- `canEditClubMetadata(role) → boolean` — OWNER | MOD
- `canManageBookQueue(role) → boolean` — OWNER | MOD
- `canManageSchedule(role) → boolean` — OWNER | MOD
- `canPinDiscussion(role) → boolean` — OWNER | MOD
- `canApproveJoinRequest(role) → boolean` — OWNER | MOD
- `canInviteUser(role) → boolean` — OWNER | MOD
- `canManageMembers(role) → boolean` — OWNER | MOD (can remove MEMBERs; cannot remove OWNER)
- `canChangeRole(role) → boolean` — OWNER only
- `canDeleteClub(role) → boolean` — OWNER only
- `canPostDiscussion(role) → boolean` — any role (MEMBER+)

**Visibility predicates** (async, compose with `isBlocked` + `areFriends`):
- `canViewClub(viewerId | null, club: { ownerId, visibility }): Promise<boolean>` — PUBLIC unconditional; FRIENDS via areFriends; PRIVATE = members only. Block masquerade.
- `canJoinClub(viewerId | null, club: { ownerId, visibility, open_join }, viewerIsMember: boolean): Promise<boolean>` — canViewClub AND not already member AND (open_join OR has pending invite/accepted request).

### 3.2 `lib/book-clubs/get-membership.ts`

`getClubMembership(viewerId, clubId): Promise<{ role: BookClubMemberRole | null }>` — single-row lookup, React `cache()`-wrapped for per-request memoization (used by multiple actions/UI per request).

### 3.3 `lib/book-clubs/derive-current-book.ts`

Helper for the in-tx current-book transition logic — used by `addClubBookAction` (status='CURRENT' path) and `setCurrentBookAction`:

```ts
// Inside the action's tx:
// 1. Find existing CURRENT row for the club; if exists, flip to PAST + set finished_at.
// 2. Set target row to CURRENT + set started_at.
// 3. Update book_clubs.current_book_id pointer.
// 4. Fire book_club_current_book_changed activity event (PUBLIC+discoverable gated).
```

Pure helper that takes a tx + clubId + newCurrentBookId + actor; consolidates the 4-step logic.

---

## 4. Server actions

All actions return `ActionResult<T>`. All authed via `requireAuth()` unless noted. All Zod-validated. All respect block masquerade (`NOT_FOUND` instead of `FORBIDDEN`).

### 4.1 Club CRUD (5)

| Action | Notes |
|---|---|
| `createClubAction({ name, description?, rules?, tags?, visibility, discoverable, openJoin })` | Tx: insert club + insert founding `book_club_members` row (role='OWNER', userId=creator) + fire `book_club_created` activity if PUBLIC+discoverable. |
| `getClubsAction({ filter, cursor?, limit? })` | 'mine' = JOIN `book_club_members` on viewer's userId. 'discover' = discoverable+PUBLIC + post-filter `isBlocked` on owner. Cursor `(createdAt DESC, id DESC)`. Returns rows + owner profile + currentBook (LEFT JOIN `book_club_books`). |
| `getClubAction(clubId)` | `canViewClub` gate → NOT_FOUND masquerade. Returns `{ club, owner, viewerRole, viewerMembership, currentBook, memberCount }`. Used by detail page header. |
| `updateClubAction({ clubId, ...partialFields })` | `canEditClubMetadata` (OWNER+MOD). 3-layer discoverable defense (mirrors C2/C3 createList). Visibility change auto-clears discoverable when ≠PUBLIC. |
| `deleteClubAction({ clubId })` | OWNER only (`canDeleteClub`). CASCADE drops all 10 sub-tables. |

### 4.2 Member + invite + join-request actions (12)

| Action | Notes |
|---|---|
| `joinClubAction({ clubId })` | If `open_join=true` AND canViewClub → tx: insert member + bump member_count. If `open_join=false` → check no PENDING request exists → insert `book_club_join_requests` row → notify owner+MODs (CLUB_JOIN_REQUEST). Errors: `NOT_FOUND` (block), `ALREADY_MEMBER`, `REQUEST_ALREADY_PENDING`. |
| `leaveClubAction({ clubId })` | Self-leave. OWNER → return `OWNER_CANNOT_LEAVE`. Else tx: delete member row + decrement member_count via `GREATEST(...-1, 0)`. |
| `removeClubMemberAction({ clubId, targetUserId })` | `canManageMembers` (MOD+). Cannot remove OWNER (returns `CANNOT_REMOVE_OWNER`). MODs cannot remove other MODs (only OWNER can demote/remove MODs). Tx: delete member + decrement count + notify removed user (optional). |
| `changeClubMemberRoleAction({ clubId, targetUserId, newRole })` | **OWNER only.** Cannot self-demote in this action (use transferOwnership instead). Updates role. |
| `transferClubOwnershipAction({ clubId, targetUserId })` | OWNER only. Target must be existing member. Atomic tx: target.role → OWNER + self.role → MEMBER + update `book_clubs.owner_id`. |
| `inviteUserToClubAction({ clubId, recipientUsername })` | `canInviteUser` (MOD+). Resolve username → userId. Block check both directions. Verify not already member. Verify no PENDING invite to same recipient. Tx: insert PENDING invite + insert CLUB_INVITE notification. |
| `respondToClubInviteAction({ inviteId, accept })` | Recipient-only. Accept → tx: update invite ACCEPTED + insert member (role='MEMBER') + bump count + delete any matching PENDING join_request. Reject → status → REJECTED. |
| `cancelClubInviteAction({ inviteId })` | Inviter-only. Status → CANCELED. |
| `createClubInviteTokenAction({ clubId })` | `canInviteUser` (MOD+). Generate 24-byte base64url token. 14-day TTL. Insert row. Returns `{ token, expiresAt }`. |
| `claimClubInviteTokenAction({ token })` | Authed-only. Error ladder: TOKEN_NOT_FOUND → TOKEN_ALREADY_CLAIMED → TOKEN_EXPIRED → SELF_INVITE (inviter cannot claim own token) → BLOCKED → ALREADY_MEMBER. Tx: mark claimed + insert member + bump count. |
| `respondToJoinRequestAction({ requestId, accept })` | `canApproveJoinRequest` (MOD+). Accept → tx: update request ACCEPTED + insert member + bump count + insert CLUB_JOIN_APPROVED notification to requester. Reject → status → REJECTED (silent). |
| `cancelJoinRequestAction({ requestId })` | Requester-only. Withdraws their pending request. |

### 4.3 Books + schedule actions (9)

| Action | Notes |
|---|---|
| `addClubBookAction({ clubId, bookId?, title, author, coverUrl?, status: 'QUEUE' \| 'CURRENT' })` | `canManageBookQueue` (MOD+). Validate bookId via `canReadBook(bookId, userId)` when set → BOOK_NOT_FOUND on masquerade. If `status='CURRENT'`: delegate to `deriveCurrentBookTx` helper (flips existing CURRENT → PAST, inserts new CURRENT, updates pointer, fires activity event). If `status='QUEUE'`: compute next order + insert. |
| `updateClubBookAction({ rowId, title?, author?, coverUrl?, order? })` | `canManageBookQueue`. Cannot change `status` here (use `setCurrentBookAction`). |
| `setCurrentBookAction({ rowId })` | `canManageBookQueue`. Tx delegates to `deriveCurrentBookTx`. Source row must be `status='QUEUE'` or `status='PAST'` (can re-read). |
| `removeClubBookAction({ rowId })` | `canManageBookQueue`. Cannot remove CURRENT (returns `CANNOT_REMOVE_CURRENT` — must first promote a QUEUE row). Tx: delete + null out `book_clubs.current_book_id` if it was pointing here (shouldn't be reachable due to guard, but defensive). |
| `reorderClubQueueAction({ clubId, orderedIds })` | `canManageBookQueue`. Bulk update orders within `status='QUEUE'` via tx. Verifies all rows belong to club. |
| `getClubBooksAction({ clubId, status? })` | `canViewClub`. Returns rows with LEFT JOIN `books` for non-null bookId enrichment. If no status filter, returns all 3 groups. |
| `addScheduleItemAction({ clubId, bookId, chapterStart, chapterEnd, targetDate, label? })` | `canManageSchedule` (MOD+). Verify bookId belongs to clubId. Auto-compute order = max+1 within (club_id, book_id). |
| `updateScheduleItemAction({ itemId, chapterStart?, chapterEnd?, targetDate?, label?, order? })` | `canManageSchedule`. |
| `removeScheduleItemAction({ itemId })` | `canManageSchedule`. |
| `getClubScheduleAction(clubId, bookId?)` | `canViewClub`. Returns items ordered by `targetDate ASC`. Defaults to current book if no bookId. |

### 4.4 Discussion + reply + like actions (9)

| Action | Notes |
|---|---|
| `createClubDiscussionAction({ clubId, title, content })` | Any member (`canPostDiscussion`). Insert row. |
| `updateClubDiscussionAction({ discussionId, title?, content? })` | Author OR MOD+. |
| `deleteClubDiscussionAction({ discussionId })` | Author OR MOD+. CASCADE drops replies + likes. |
| `pinClubDiscussionAction({ discussionId, pin })` | `canPinDiscussion` (MOD+). Flip `is_pinned`. |
| `replyToClubDiscussionAction({ discussionId, content })` | Member. Tx: insert reply + `book_club_discussions.reply_count += 1`. Verify discussion's club allows viewer (canViewClub on parent's club). |
| `deleteClubDiscussionReplyAction({ replyId })` | Author OR MOD+. Tx: delete + `reply_count = GREATEST(... - 1, 0)`. |
| `toggleClubDiscussionLikeAction({ discussionId })` | Member. Tx: insert/delete `book_club_discussion_likes` row + `like_count ± 1` via `sql\`${col} ± 1\``. Mirrors C2 spark vote atomic pattern. Use `.returning()` to detect ON CONFLICT short-circuit. |
| `toggleClubReplyLikeAction({ replyId })` | Same atomic shape on replies. |
| `listClubDiscussionsAction({ clubId, cursor?, limit? })` | `canViewClub`. Order: `is_pinned DESC, created_at DESC, id DESC`. Returns rows + author profile + `viewerLiked` flag (two-query stitch-in-JS mirroring H4 buzz). Cursor `(is_pinned, created_at, id)` tuple — pinned rows always at top regardless of cursor. |
| `getClubDiscussionAction(discussionId)` | `canViewClub` on parent's club. Returns discussion + reply list (paginated separately if list grows; v1 returns all replies) + viewer's like state on post AND each reply. |

### 4.5 Activity hooks

Two hook sites, both PUBLIC+discoverable gated:

- **`createClubAction`** (in tx) → `recordSocialActivityTx({ type: 'book_club_created', subjectType: 'book_club', subjectId: clubId, payload: { name } })` if `visibility==='PUBLIC' AND discoverable===true`.

- **`addClubBookAction` (status='CURRENT' path)** AND **`setCurrentBookAction`** — both delegate to `deriveCurrentBookTx` which fires `recordSocialActivityTx({ type: 'book_club_current_book_changed', subjectType: 'book_club', subjectId: clubId, payload: { clubName, fromBookTitle: <previous CURRENT title or null>, toBookTitle } })` if PUBLIC+discoverable.

**No notifications** for these activity events — feed-only.

### 4.6 Notification writes

Three places:

1. **`inviteUserToClubAction`** (in tx) → `notifications` row with `type='CLUB_INVITE'`, `userId=recipientId`, `actorId=inviterId`, `resourceType='book_club_invite'`, `resourceId=inviteId`. Skipped if either party blocks the other.

2. **`joinClubAction`** (open_join=false branch, in tx) → notifications row PER existing OWNER + MOD with `type='CLUB_JOIN_REQUEST'`, `userId=ownerOrModId`, `actorId=requesterId`, `resourceType='book_club_join_request'`, `resourceId=requestId`. (Multi-row notification fan-out — single tx insert with a SELECT for the recipient list.)

3. **`respondToJoinRequestAction`** (accept path, in tx) → notifications row with `type='CLUB_JOIN_APPROVED'`, `userId=requesterId`, `actorId=approverId`, `resourceType='book_club'`, `resourceId=clubId`.

---

## 5. Privacy + block enforcement summary

| Surface | Gate |
|---|---|
| `/clubs` (mine) | Authed only; viewer's own memberships. |
| `/clubs/[id]` detail | `canViewClub` → NOT_FOUND masquerade. |
| `/discover?tab=clubs` | `discoverable=true AND visibility='PUBLIC'` + `isBlocked` filter on owner. |
| `joinClubAction` | `canJoinClub`. Block-aware. |
| `inviteUserToClubAction` | Block check both directions on recipient. |
| Discussions / replies / likes | `canPostDiscussion` (member). Reads gated by `canViewClub`. |
| Schedule + books | `canViewClub` for reads; `canManageBookQueue` / `canManageSchedule` for writes. |
| Settings actions | `canEditClubMetadata` + role-specific predicates. |
| Activity events | Gated at write time `if visibility === 'PUBLIC' && discoverable === true`. |
| Notifications | Skipped when either party blocks the other. |
| Profile clubs section | Per-row `canViewClub`. |

---

## 6. Routes + UI

### 6.1 New routes at `app/[locale]/(app)/clubs/`

- **`page.tsx`** — `/clubs` index. Server component. Header (Comfortaa title + `<CreateClubButton>` modal trigger). Section: **My clubs** (calls `getClubsAction({ filter: 'mine' })`). Grid of `<ClubCard>`. Empty state: "Create or join a club to get started." "Discover more clubs →" link to `/discover?tab=clubs`. Replaces C1 T9 Coming-Soon stub.

- **`[clubId]/page.tsx`** — detail hub. Server component. Reads `?tab=` query (defaults to `'discussions'` if member, `'about'` otherwise). Renders `<ClubHeader>` + `<ClubTabStrip>` + tab content (one of `<ClubAboutPanel>`, `<ClubDiscussionsPanel>`, `<ClubBooksPanel>`, `<ClubMembersPanel>`, `<ClubSchedulePanel>`, `<ClubSettingsPanel>`). NOT_FOUND → `notFound()`.

- **`[clubId]/discussions/[discussionId]/page.tsx`** — single discussion thread. Renders post + replies + composers. Like buttons on post + each reply. MOD pin/unpin toggle.

- **`[clubId]/invite/[token]/page.tsx`** — public route. If not authed → `redirect('/${locale}/sign-up?next=...')`. If authed → call `claimClubInviteTokenAction({ token })` → success: redirect to `/clubs/${clubId}` with sonner toast. Errors → `<InviteResult>` screen with 6 error cases.

### 6.2 New components at `_components/`

- `<CreateClubModal>` — shadcn Dialog. Fields: name, description, rules (optional textarea), tags (chip input max 5), `<VisibilityPicker>` (reused from C2), discoverable checkbox (3-layer defense), Open-join toggle. Submit → `createClubAction` → router.push to detail.
- `<ClubCard>` — title (Comfortaa) + owner avatar/handle + description excerpt + tag chips (first 3 + "+N more") + meta row (`N members · Reading "Title"` when current book set). Visibility pill if not PUBLIC.
- `<ClubHeader>` — full detail-page chrome. Name + visibility pill + owner card + member count + dynamic primary CTA:
  - Not member, `open_join=true` → "Join club" button
  - Not member, `open_join=false`, no pending request → "Request to join" button
  - Not member, has pending request → "Request pending" muted pill
  - Member (MEMBER role) → "Leave club" button + `<InviteUserButton>` (since `canInviteUser` is MOD+, MEMBER doesn't see this)
  - Member (MOD/OWNER) → `<InviteUserButton>` + ⋯ kebab (Settings / Delete-if-OWNER)
- `<ClubTabStrip>` — 6 tabs (About · Discussions · Books · Members · Schedule · Settings). Tab=`Settings` hidden for non-MOD+. Counts on Discussions / Books / Members tabs from header data.
- `<ClubAboutPanel>` — rules + tags + currentBook summary card + recent activity excerpt.
- `<ClubDiscussionsPanel>` — feed of `<DiscussionCard>` (title + author + likeCount + replyCount + pinned indicator). Pinned-first sort. "+ New Discussion" CTA for members. Cursor pagination.
- `<DiscussionComposer>` — shadcn Dialog. Title input + content textarea.
- `<DiscussionDetail>` — single thread page renders this. Post body + likeButton + reply list + `<ReplyComposer>` (inline) + MOD pin/unpin toggle.
- `<ReplyComposer>` — inline textarea + submit. Like button per reply.
- `<LikeButton>` — reused shape on posts AND replies. Optimistic flip + rollback + sonner.
- `<ClubBooksPanel>` — three sections:
  - **Currently reading** — single `<ClubBookRow>` showing CURRENT book or empty state.
  - **Up next** — list of QUEUE books in order. Drag-reorder via dnd-kit (MOD+ only). Each row has ⋯ kebab (Set as current / Edit / Remove).
  - **Past reads** — collapsed accordion list of PAST books with `finished_at` date.
  - "+ Add book" CTA opens `<AddBookToClubModal>` (mirrors C3 `<AddBookModal>` 2-tab Beehive search + external).
- `<AddBookToClubModal>` — 2-tab: Beehive search (uses C3's `searchBooksAction`) + manual external. Bottom controls: "Add to queue" vs "Set as current" toggle.
- `<ClubBookRow>` — thumb + title + author + status pill (CURRENT / PAST / QUEUE) + ⋯ kebab (MOD+ only).
- `<ClubSchedulePanel>` — timeline view per CURRENT book. Lists schedule items grouped by book in `target_date ASC` order. Shows visual indicator for past/today/future. "+ Add milestone" for MOD+. Each item has ⋯ kebab.
- `<AddScheduleItemModal>` — Dialog. Fields: book picker (currentBook selected by default), chapter start, chapter end, target date, label.
- `<ClubMembersPanel>` — member list with role pills (color-coded: OWNER=brand, MOD=blue, MEMBER=muted). ⋯ kebab on each row for MOD+ to remove/change-role. Owner's row gets a transfer-ownership option.
- `<RoleChangeDialog>` — confirms role change. OWNER-only.
- `<ClubSettingsPanel>` — sub-sections:
  - **Metadata** — Edit name/description/rules/tags/visibility/discoverable/open_join.
  - **Pending invites** — list of outgoing invites + Cancel button.
  - **Join requests** — list of incoming requests with Approve/Reject buttons (MOD+).
  - **Invite by link** — `<InviteLinkDialog>` trigger to generate + copy.
  - **Transfer ownership** — `<TransferOwnershipDialog>`.
  - **Danger zone** — Delete club (OWNER only, ConfirmDialog).
- `<InviteByUsernameInput>` — debounced username search → `searchUsersAction` (C1) → Pick → send invite.
- `<InviteLinkDialog>` — generates token via `createClubInviteTokenAction` → displays URL + Copy button + 14-day expiry note (mirrors C1 `<InviteLinkDialog>` for friends).
- `<JoinClubButton>` / `<RequestToJoinButton>` / `<LeaveClubButton>` — small dedicated buttons for the primary CTA states.

### 6.3 Discover integration

`app/[locale]/(public)/discover/page.tsx` gains a **fifth tab**: Clubs (alongside Books / Sparks / Hives / Lists from C3). `?tab=clubs`. Calls `getClubsAction({ filter: 'discover', limit: 24 })`. Renders `<ClubCard>` grid.

### 6.4 Community section rail

`<SectionRail>`'s Clubs tile is already at `/clubs` from C1 T9 — Coming-Soon stub at `/clubs/page.tsx` gets replaced. Count badge wires through existing parallel fetch on `/community` (extend with `getMyClubsCountAction()` returning a single int).

### 6.5 Profile page integration (`/u/[username]`)

New "Clubs" section showing the user's PUBLIC clubs they OWN (FRIENDS visible to friends). Excludes clubs they're just a member of (only owner-of). Horizontal `<ClubCard>` row + filter via `getUserPublicClubsAction(userId, viewerId, limit)` with per-row `canViewClub`.

### 6.6 Activity feed integration

`<ActivityEventRow>` gains 2 verb-map entries:
- `book_club_created` → "@x started a book club **{name}**"
- `book_club_current_book_changed` → count-aware copy from payload: "@x's club **{clubName}** is now reading **{toBookTitle}**"

Subject hydration in `getCommunityFeedAction` extends with `subjectType='book_club'` (IN-list query on `book_clubs` for name + visibility).

### 6.7 Bell notification copy

`notifications-bell.tsx` LABELS map + click-handler branches for:
- `CLUB_INVITE` → "@x invited you to club **{clubName}**" → routes to `/clubs/${clubId}` (or inbox/invites tab)
- `CLUB_JOIN_REQUEST` → "@x requested to join **{clubName}**" → routes to `/clubs/${clubId}/settings?section=requests`
- `CLUB_JOIN_APPROVED` → "@x approved your request to join **{clubName}**" → routes to `/clubs/${clubId}`

Bell-list's `NotificationRow.actor` shape (`{name, image}` only — no username; pre-existing limitation flagged in C1) means routing uses `clubId` from `resourceId` rather than actor's profile.

---

## 7. Test posture

Following AGENTS.md convention: unit tests for pure helpers + surface-shape tests for server actions + manual smoke for UI.

- **Unit tests** (`lib/book-clubs/__tests__/`):
  - `predicates.test.ts` — full role × visibility × block matrix for `canViewClub`, `canEditClubMetadata`, `canManageBookQueue`, `canPostDiscussion`, etc.
  - `get-membership.test.ts` — caching behavior.
  - `derive-current-book.test.ts` — flip-PAST + insert-CURRENT + pointer-update + activity-fire sequence.

- **Surface-shape tests** (`lib/actions/__tests__/book-clubs-actions.test.ts`) — typeof + arity for all ~25 actions. Mirrors existing pattern.

- **Manual smoke** per §11 carry-forward checklist.

---

## 8. Implementation phasing (preview)

Suggested ~22-task decomposition for the implementation plan:

| Task | Title |
|---|---|
| T1 | Schema migration (4 enums + 11 tables + indexes + CHECK constraints + partial unique + FK back-fill + 2 social_activity + 3 notification_type enum additions) |
| T2 | Helpers — `predicates.ts` + `get-membership.ts` + `derive-current-book.ts` + unit tests |
| T3 | Validations (`lib/validations/book-club.ts`) + `createClubAction` + `getClubsAction` + `getClubAction` + `updateClubAction` + `deleteClubAction` |
| T4 | Member actions: join/leave/remove/changeRole/transferOwnership |
| T5 | Invite actions: invite-by-username + respond + cancel + token-create + token-claim |
| T6 | Join-request actions: join (open_join=false path) + respond + cancel |
| T7 | Books + schedule actions: add/update/setCurrent/remove/reorder + schedule CRUD + getClubBooks + getClubSchedule |
| T8 | Discussions + replies + likes actions: 9 actions covering full CRUD + toggle likes + pin |
| T9 | Notification + activity event wiring audit + `searchClubsAction` if needed for discover |
| T10 | `/clubs` index page (replaces stub) + `<ClubCard>` + `<CreateClubButton>` |
| T11 | `/clubs/[clubId]/page.tsx` detail hub + `<ClubHeader>` + `<ClubTabStrip>` |
| T12 | `<CreateClubModal>` + `<EditClubMetadataDialog>` |
| T13 | `<ClubAboutPanel>` + `<ClubMembersPanel>` + `<RoleChangeDialog>` + `<TransferOwnershipDialog>` |
| T14 | `<ClubDiscussionsPanel>` + `<DiscussionCard>` + `<DiscussionComposer>` |
| T15 | `<DiscussionDetail>` + `<ReplyComposer>` + `<LikeButton>` (post + reply) + pin toggle |
| T16 | `<ClubBooksPanel>` + `<AddBookToClubModal>` + `<ClubBookRow>` + dnd-kit reorder for queue |
| T17 | `<ClubSchedulePanel>` + `<AddScheduleItemModal>` + `<ScheduleItemRow>` |
| T18 | `<ClubSettingsPanel>` + invite/request panels + `<InviteByUsernameInput>` + `<InviteLinkDialog>` + danger zone |
| T19 | Discover integration (`/discover?tab=clubs` 5th tab + `<ClubsTabContent>`) |
| T20 | Activity feed verb-map entries + feed subject hydration + bell notification copy for 3 new types |
| T21 | Profile page Clubs section + `getUserPublicClubsAction` |
| T22 | `/clubs/[clubId]/invite/[token]/page.tsx` route + `<InviteResult>` |
| T23 | Smoke + AGENTS.md ship-summary + ship |

Suggested wave shape (mirrors C3 pattern):
- **W1**: T1 alone
- **W2**: T2 alone
- **W3**: T3-T9 server-action wave as ONE combined commit (single subagent per C2/C3 Wave 3 precedent — same shared file)
- **W4**: T10 + T11 routes (sequential per C3 Wave 4 precedent — stubs)
- **W5**: T12-T18 UI parallel (component scopes isolated)
- **W6**: T19 + T20 + T21 + T22 parallel (integration tasks)
- **W7**: T23 smoke + ship

---

## 9. Out of scope (deferred to C5 or later)

| Item | Defer to |
|---|---|
| Per-book discussion scoping (each post tied to a `book_club_books` row) | C5 polish if users ask |
| Polls (vote next book / vote schedule date) | C5+ |
| Real-time presence / "X is typing" | Never (out of v1 scope) |
| Email digests | Future growth |
| Cross-club search | C5 polish |
| Direct-add by username (skip consent) | Never (Q8 explicitly chose consent gate) |
| Per-comment likes within discussions | Already in scope (Q7-b) — covered |
| Edit history on discussions | C5 polish |
| Emoji reactions beyond Like | Never unless requested |
| Notification preferences per-club (mute) | C5 polish (general notification prefs work) |
| Cross-book continuity beyond persistent member list | Already core — persistent clubs (Q1-A) |
| Public reading-progress aggregation (members' readingProgress visible) | C5 — adds to schedule panel |

---

## 10. Implementation notes

**Patterns reused from C1-C3:**
- `areFriends` + `isBlocked` as canonical privacy helpers (C1).
- `recordSocialActivityTx` for feed events with PUBLIC+discoverable gate (C1).
- `actorId + resourceType + resourceId` notification shape — NO payload column (C1 lesson).
- `<VisibilityPicker>` 3-card radio from C2 sparks/lists.
- `<StatusPill>` / `<VisibilityPill>` / `<Countdown>` token-based alpha-tinted pills (C2).
- Block masquerade as NOT_FOUND (C1/C2/C3).
- Cursor pagination `(createdAt DESC, id DESC)` tuple base64url JSON (C1+).
- INSERT/DELETE `.returning()` + only-bump-on-truthy counter denorm (C3).
- C3 `<AddBookModal>` 2-tab pattern → adapted as `<AddBookToClubModal>`.
- C3 dnd-kit reorder pattern for queue books.
- Partial unique index pattern for "at most one row with kind=X per parent" (C3 Liked, here CURRENT book).

**Net-new patterns introduced:**
- **`deriveCurrentBookTx` helper** consolidating 4-step current-book transition (PAST flip + new CURRENT insert + pointer update + activity fire). Reusable shape for any future "current X" pattern with denorm pointer.
- **Multi-row notification fan-out** (CLUB_JOIN_REQUEST notifies all owner+MODs in one tx). New pattern; mirror in any future "notify all admins" need.
- **Two like tables** (post likes + reply likes) — separate tables instead of polymorphic to keep FK + CASCADE semantics clean.

---

## 11. Carry-forward smoke checklist for ship (after T23)

(Mirrors C1/C2/C3 patterns.)

1. **Club create + join (open).** As A → `+ New Club` → name + description + Public + open_join=ON → Create. Confirm: on /clubs My + /discover?tab=clubs + community rail count. As B → /discover?tab=clubs → Join club → instant member.
2. **Approval-required join.** As A → create club with open_join=OFF. As B → /clubs/[id] → Request to join → "Request pending" pill. As A → settings → Approve → B becomes member + CLUB_JOIN_APPROVED notification fires.
3. **Invite by username.** As A → settings → Invite by username → @C → C gets CLUB_INVITE notification. As C → bell → Accept → joins club.
4. **Invite by link.** As A → settings → Invite link → generate + copy. Open in incognito → sign up as D → claim → joins club.
5. **Invite link errors.** Expired token / self-invite / already-claimed / blocked / already-member → all show distinct error screens.
6. **FRIENDS club visibility.** As A → create FRIENDS club. B (friend) sees it. C (not friend) cannot — direct URL returns 404 (masquerade).
7. **PRIVATE club.** Only invited members can see. C cannot via /discover or direct URL.
8. **Discoverable auto-clear.** Toggle visibility from PUBLIC → FRIENDS → discoverable auto-unchecks + disabled.
9. **Add book to queue.** As MOD+ → /clubs/[id]/books → + Add book → Beehive tab → search + Pick → Add to queue. Appears in Up next.
10. **Set as current.** + Add book → external tab → title/author/cover → Set as current. Confirm: appears in Currently reading + previous CURRENT moves to Past reads with `finished_at` set + `book_club_current_book_changed` activity event fires for friends/followers.
11. **Drag-reorder queue.** As MOD+ → drag queue books → drop → order persists.
12. **Schedule milestones.** As MOD+ → /clubs/[id]/schedule → + Add milestone → chapter 1-3 by Friday → save. Confirm: appears in timeline with target date. Members can see schedule.
13. **Discussion CRUD.** Member → + New Discussion → title + content → post. Confirm: appears in /clubs/[id]/discussions. Like → likeCount increments. Reply → reply_count bumps. Like reply → reply's likeCount bumps. MOD pin → bubbles to top.
14. **MOD permissions.** As OWNER → promote B to MOD. As B → can edit club metadata + manage queue + pin discussions + invite/approve. Cannot: change roles or delete club (errors).
15. **MEMBER permissions.** As MEMBER C → cannot pin / manage queue / change roles / delete. UI affordances hidden.
16. **Owner cannot leave.** As A (OWNER) → Leave club → confirms `OWNER_CANNOT_LEAVE` error.
17. **Transfer ownership.** As A → settings → Transfer ownership → pick B → confirm. B becomes OWNER + A becomes MEMBER. A can now leave.
18. **Delete club.** As OWNER → settings → Delete (ConfirmDialog) → all sub-tables CASCADE → club + all data gone.
19. **Block flow.** A blocks B → B's /discover?tab=clubs hides A's clubs + direct URL → 404. Existing membership of B in A's club: not auto-removed (out of scope; flag for follow-up if needed).
20. **Activity feed events.** A (friend of B) creates a PUBLIC+discoverable club → B's /community → "@A started a book club **Name**". A changes current book → B sees "@A's club **Name** is now reading **Title**".
21. **FRIENDS club events do NOT leak to feed.** A creates FRIENDS club + adds book → C (follower, not friend) sees no events.
22. **Profile page Clubs section.** /u/[A-username] shows A's PUBLIC clubs they OWN. FRIENDS visible to friends only. Member-of-only excluded.
23. **Bell notifications.** CLUB_INVITE + CLUB_JOIN_REQUEST + CLUB_JOIN_APPROVED render with correct copy + route correctly.

If any scenario fails → file `fix(c4): ...`.

---

*End of C4 spec. Next step: writing-plans skill to produce the ~22-task plan.*
