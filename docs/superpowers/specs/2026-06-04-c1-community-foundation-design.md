# C1 — Community Foundation: Friends + /community Shell + Feed (Design)

**Status:** Locked 2026-06-04. Awaiting plan-writing.
**Phase:** First of 5 in the Community phase. See [community-phase-overview.md](2026-06-04-community-phase-overview.md) for the C1–C5 roadmap.
**Goal:** Make `/community` feel like the social hub of Beehive Studio — friends, follows, mutual-friend discovery, an activity feed of your circle's writing life, blocks/mutes, invite-by-link onboarding, and full enforcement of the FRIENDS visibility tier that's been shipping unenforced.

---

## 1. Locked decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Friend model topology | **Friends + Follows (both).** Mutual ACCEPTED friendships gate FRIENDS content; one-way follows drive discovery. |
| Q2 | Friend groups (Close Friends / subsets) | **No.** Flat list. Hives + Book Clubs cover named subgroups. |
| Q3 | Discovery — finding people to add | **A+B+C+D.** Username search + Suggested writers + Profile-driven Add buttons + Invite-by-link (token URL). |
| Q4 | Management actions | **Send / Accept / Reject / Cancel pending / Unfriend / Mute / Block.** No Restrict, no Report in C1. |
| Q5 | /community IA | **Hybrid hub.** Feed center + horizontal section rail (Friends · Hives · Sparks · Lists · Clubs) + lean attention sidebar. |
| Q6a | Feed scope | **Friends + Followed merged.** No hive activity in personal feed (hive activity stays on `/hive/[id]`). |
| Q6b | Feed event types (C1 launch set) | F1 book_published, F2 chapter_posted, F3 book_liked, F4 book_commented, F5 spark_entry_submitted, F6 spark_won_community + spark_won_creator_choice, F7 hive_created + hive_joined. **F8 (followed someone) dropped as noisy.** |
| Q7 | Profile page friendship UI | **P1+P2+P3+P4+P6.** Status pill, smart CTA, mutual-friends count + avatars, friends-count + followers-count split, block/mute in ⋯ kebab. P5 (friends list visible) deferred to C5. |
| Q8 | FRIENDS visibility gate | **A — mutual friendship only.** Followers do NOT get FRIENDS access. Same gate applies to hives + (future) reading lists + book clubs. |
| Q9 | Notifications | New types: `FRIEND_REQUEST`, `FRIEND_ACCEPTED`. Reuse existing `NEW_FOLLOWER`. Rejected-request notifications NOT sent (silent rejection). |
| — | Nav user-avatar dropdown | New: **View profile** (→ `/u/[me]`) + **Friends** (→ `/friends`) + existing items. |
| — | Architecture | **Approach 2 — `social_activity` event table.** Mirrors `hive_activity` pattern. Single SELECT cursor-paginated feed. |

---

## 2. Data model

### 2.1 New tables (4)

**`social_activity`** — append-only event store driving the feed.

```
id              text PK (createId)
actor_id        text NOT NULL  → users.id ON DELETE CASCADE
type            social_activity_type NOT NULL
subject_type    text NOT NULL                  -- 'book' | 'chapter' | 'spark_entry' | 'hive' | 'comment'
subject_id      text NOT NULL                  -- polymorphic; no FK constraint (cleanup via subject_type+id sweep)
payload         jsonb                          -- event-specific extras (titles, excerpts, hive names)
created_at      timestamp NOT NULL DEFAULT now()

INDEX social_activity_actor_created_idx  (actor_id, created_at DESC)
INDEX social_activity_subject_idx        (subject_type, subject_id)
```

**`user_blocks`** — global hard cut between two users. Asymmetric on storage (a block is one-way at the row level) but enforced bidirectionally at read time (either party's block hides both ways).

```
blocker_id      text NOT NULL  → users.id ON DELETE CASCADE
blocked_id      text NOT NULL  → users.id ON DELETE CASCADE
created_at      timestamp NOT NULL DEFAULT now()

PRIMARY KEY (blocker_id, blocked_id)
INDEX user_blocks_blocked_idx (blocked_id)
```

**`user_mutes`** — viewer-side feed hide. Muter still sees content if they navigate directly to it; muted activity just doesn't surface in their feed.

```
muter_id        text NOT NULL  → users.id ON DELETE CASCADE
muted_id        text NOT NULL  → users.id ON DELETE CASCADE
created_at      timestamp NOT NULL DEFAULT now()

PRIMARY KEY (muter_id, muted_id)
```

**`friend_invites`** — one-shot link-based friend tokens.

```
token           text PK                        -- 32-char url-safe random
inviter_id      text NOT NULL  → users.id ON DELETE CASCADE
expires_at      timestamp NOT NULL             -- inviter_id + 14 days
claimed_by      text          → users.id ON DELETE SET NULL
claimed_at      timestamp
created_at      timestamp NOT NULL DEFAULT now()

INDEX friend_invites_inviter_idx (inviter_id)
```

TTL is 14 days from creation. Tokens are one-shot — once `claimed_at` is set the row stays for audit but cannot be reused. Cleanup of expired-unclaimed tokens is a future cron concern; not needed for C1.

### 2.2 New enums (1)

**`social_activity_type`** (Postgres enum):

```
book_published
chapter_posted
book_liked
book_commented
spark_entry_submitted
spark_won_community
spark_won_creator_choice
hive_created
hive_joined
```

C2–C5 extend this enum additively in their own migrations.

### 2.3 Existing tables — extensions only

**`friendships`** — no structural change. Status stays `PENDING | ACCEPTED`. **Blocks are NOT a friendship status** — they live in `user_blocks` because blocking applies regardless of whether the parties were ever friends.

**`follows`** — no change. Already drives Discover suggested writers.

**`notifications`** — add two values to the existing `notification_type` enum:

```
FRIEND_REQUEST
FRIEND_ACCEPTED
```

(`NEW_FOLLOWER` already exists from Phase 7. No change there.)

### 2.4 Migration

Idempotent runner at `scripts/migrate-c1.ts` (matches H1/H2/H3/H4/migrate-reader-redesign pattern):

1. Create `social_activity_type` enum.
2. Create `social_activity` table + 2 indexes.
3. Create `user_blocks` table + 1 index.
4. Create `user_mutes` table.
5. Create `friend_invites` table + 1 index.
6. `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FRIEND_REQUEST'`.
7. `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED'`.

All steps wrapped in `IF NOT EXISTS` / `DO $$ EXCEPTION WHEN duplicate_object` patterns so re-running is safe.

---

## 3. Helpers

### 3.1 `lib/social/are-friends.ts`

```ts
export const areFriends = cache(async (userIdA: string, userIdB: string): Promise<boolean> => {
  if (userIdA === userIdB) return false;
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        and(eq(friendships.requesterId, userIdA), eq(friendships.recipientId, userIdB)),
        and(eq(friendships.requesterId, userIdB), eq(friendships.recipientId, userIdA)),
      ),
    ),
    columns: { id: true },
  });
  return !!row;
});
```

Used by:
- `canReadBook()` for FRIENDS-tier book access (closes the SP-B placeholder gap).
- `getDiscoverableHivesAction` for FRIENDS-tier hive filtering.
- Profile-page status-pill derivation.
- C3 reading lists + C4 book clubs FRIENDS visibility (forward-compat).

### 3.2 `lib/social/is-blocked.ts`

```ts
export const isBlocked = cache(async (viewerId: string, targetId: string): Promise<boolean> => {
  if (viewerId === targetId) return false;
  const row = await db.query.userBlocks.findFirst({
    where: or(
      and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, targetId)),
      and(eq(userBlocks.blockerId, targetId), eq(userBlocks.blockedId, viewerId)),
    ),
    columns: { blockerId: true },
  });
  return !!row;
});
```

Used by:
- `getPublicAuthorProfileAction` (returns "profile unavailable" if blocked).
- `getCommunityFeedAction` (excludes blocked actors).
- `canReadBook()` (block also prevents reading).
- Every comment/like/follow/friend-request action gate.

### 3.3 `lib/social/get-mutual-friends.ts`

`getMutualFriends(viewerId, otherUserId, limit?): Promise<{ userId, username, displayName, avatarUrl }[]>` — IN-list intersect of `viewerId`'s ACCEPTED friends with `otherUserId`'s ACCEPTED friends, joined to `userProfiles` for display fields, limited to `limit` for the avatar cluster + total count returned separately.

### 3.4 `lib/social/record-activity.ts`

Tx-aware writer mirroring `lib/hive/record-activity.ts`:

```ts
export async function recordSocialActivityTx(
  tx: DrizzleTx,
  opts: {
    actorId: string;
    type: SocialActivityType;
    subjectType: 'book' | 'chapter' | 'spark_entry' | 'hive' | 'comment';
    subjectId: string;
    payload?: Record<string, unknown>;
  }
): Promise<void>
```

Inserts a `social_activity` row. Callers MUST invoke this inside the source action's transaction so the activity row commits atomically with the source change. Sibling `recordSocialActivity(opts)` (without tx) for non-tx contexts; same write, picks its own connection.

**Privacy gate at write time:** callers only invoke `recordSocialActivityTx` when the source row is publicly observable. Concrete rules:

| Event | Write only if |
|---|---|
| `book_published` | `book.visibility = PUBLIC AND book.discoverable = true` |
| `chapter_posted` | chapter is reader-visible per `isChapterReaderVisible()` AND parent book is PUBLIC+discoverable |
| `book_liked` | the liked book is PUBLIC+discoverable |
| `book_commented` | the commented book is PUBLIC+discoverable |
| `spark_entry_submitted` | the parent Spark is PUBLIC (existing `privacy` field) |
| `spark_won_*` | always (spark wins are inherently public outcomes) |
| `hive_created` | `hive.visibility = PUBLIC AND hive.discoverable = true` |
| `hive_joined` | `hive.visibility = PUBLIC AND hive.discoverable = true` |

FRIENDS-tier content does NOT flow into the feed. Rationale: feed events get redistributed to follows, and follows aren't friends — emitting a FRIENDS-tier event would leak its existence to non-friends even if the click-through is gated.

### 3.5 Per-actor-per-event dedupe (write-side)

`book_liked` and similar high-cardinality events get a **per-actor-per-target dedupe** at write time: if a `social_activity` row exists for `(actor_id, type='book_liked', subject_id=bookId)` in the last 6 hours, skip the write. Prevents feed spam from a single user binge-liking. Implemented as a check inside `recordSocialActivityTx` for events flagged dedupe-eligible in a const map.

---

## 4. Server actions

All actions return `ActionResult<T>`. All authed via `requireAuth()`. All Zod-validated where input is non-trivial. Every action that touches another user respects `isBlocked` first (returns `BLOCKED` error to abort the operation silently for the actor).

### 4.1 `lib/actions/friendships.actions.ts` (expand existing)

| Action | Purpose | Notes |
|---|---|---|
| `sendFriendRequestAction({ recipientUsername })` | Create PENDING friendship row | Recipient lookup by username. Errors: `SELF_FRIEND`, `BLOCKED`, `ALREADY_FRIENDS`, `REQUEST_ALREADY_PENDING`, `RECIPIENT_NOT_FOUND`. Tx: insert friendship + insert notification (FRIEND_REQUEST). |
| `acceptFriendRequestAction({ requestId })` | Flip PENDING → ACCEPTED | Only recipient can accept. Tx: update friendship + insert notification (FRIEND_ACCEPTED) to original sender. |
| `rejectFriendRequestAction({ requestId })` | Delete PENDING row | Only recipient. Silent — no notification to sender. |
| `cancelFriendRequestAction({ requestId })` | Delete PENDING row | Only requester (the sender). Silent. |
| `unfriendAction({ otherUserId })` | Delete ACCEPTED row | Either party. Silent. Does NOT touch follows (user must unfollow separately if desired). |
| `getFriendsAction(userId)` | List accepted friends | Public-readable for any userId, but `isBlocked` filter applied per-row. Returns avatar + username + display + mutual count (against viewer). |
| `getPendingRequestsAction()` | Return `{ received: [...], sent: [...] }` for current user | Used by /friends Requests + Sent tabs. |
| `getFriendCountAction(userId)` | Public-readable count | Used by profile stats row. |
| `searchUsersAction({ query, limit? })` | Username/display-name fuzzy search | ILIKE on `userProfiles.username` + `userProfiles.displayName`. Excludes self + users who have blocked the searcher OR are blocked by searcher. Returns up to 10 hits with avatar + username + displayName + mutual-friends count. Used by `/friends` Find-a-friend popover. |

### 4.2 `lib/actions/blocks.actions.ts` (new)

| Action | Purpose | Notes |
|---|---|---|
| `blockUserAction({ targetUserId })` | Create user_blocks row | Tx: insert user_blocks + DELETE any friendship row in either direction + DELETE any follows row in either direction + DELETE any pending notifications between the two. Idempotent (no-op if already blocked). |
| `unblockUserAction({ targetUserId })` | Delete user_blocks row | Does NOT restore friendships/follows. Users must re-friend / re-follow manually. |
| `getBlockedUsersAction()` | List of users current viewer has blocked | For /settings/blocked-users (future) — for C1, just the action; no UI surface yet. |

### 4.3 `lib/actions/mutes.actions.ts` (new)

| Action | Purpose | Notes |
|---|---|---|
| `muteUserAction({ targetUserId })` | Create user_mutes row | Silent. No effect on muted user's experience. |
| `unmuteUserAction({ targetUserId })` | Delete user_mutes row | |
| `getMutedUsersAction()` | List of users current viewer has muted | Used by profile ⋯ menu to show "Unmute" vs "Mute" toggle. |

### 4.4 `lib/actions/friend-invites.actions.ts` (new)

| Action | Purpose | Notes |
|---|---|---|
| `createFriendInviteAction()` | Generate token, return URL | URL = `${baseUrl}/${locale}/friend-invite/${token}`. Expires `now() + 14 days`. Same inviter can have multiple unclaimed tokens. |
| `claimFriendInviteAction({ token })` | Claim token, create ACCEPTED friendship | Called from the `/friend-invite/[token]` route after auth. Errors: `TOKEN_NOT_FOUND`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_CLAIMED`, `SELF_INVITE` (inviter cannot claim own token), `BLOCKED`, `ALREADY_FRIENDS` (idempotent: still mark token claimed). Tx: insert friendship + update token claimed_by + claimed_at + insert notification (FRIEND_ACCEPTED) to inviter. |

### 4.5 `lib/actions/community.actions.ts` (replace existing)

The old `getCommunityFeedAction` (built around `hive_activity`) is REPLACED. New shape:

| Action | Purpose | Notes |
|---|---|---|
| `getCommunityFeedAction({ cursor?, limit? })` | Cursor-paginated feed | Filters: `actor_id IN (friends + follows)` MINUS blocked MINUS muted. Cursor = `(created_at, id)` tuple. Default limit 20, max 50. Returns rows + nextCursor + author profile join. |
| `getSuggestedWritersAction({ limit? })` | Friends-of-friends + shared-hive members | Excludes existing friends + follows + blocked. Existing function but extended to surface friends-of-friends with mutual count as the primary sort. |

Drop: `getMyHivesAction` (already folded into `getUserHivesView` in H1). Drop: any consumers of the old hive-activity feed shape from /community.

### 4.6 Activity event hooks (where `recordSocialActivityTx` is called)

Each hook lives inside its source action's transaction:

| Source action | Event type | When fired |
|---|---|---|
| `publishBookAction` | `book_published` | At publish tx, if PUBLIC+discoverable |
| `saveChapterAction` | `chapter_posted` | Only when chapter status transitions INTO REVISED or FINAL (not on routine drafts), and parent book is PUBLIC+discoverable. Tx-internal status diff. |
| `toggleBookLikeAction` | `book_liked` | On like (not unlike). Dedupe-eligible (6h). |
| `addCommentAction` | `book_commented` | On insert. |
| `submitSparkEntryAction` | `spark_entry_submitted` | On insert, if parent spark is PUBLIC. |
| Spark winner-resolution path (community vote) | `spark_won_community` | When `winnerEntryId` is set. |
| Spark creator's-choice path | `spark_won_creator_choice` | When `creatorChoiceEntryId` is set. |
| `createHiveAction` | `hive_created` | If created hive is PUBLIC+discoverable. |
| `acceptHiveInviteAction` / `joinHiveAction` | `hive_joined` | If the joined hive is PUBLIC+discoverable. |

---

## 5. Privacy gates wired

### 5.1 `canReadBook` extension

Currently `canReadBook` returns `FRIENDS_ONLY` placeholder for FRIENDS-tier books to any non-author. After C1:

```ts
// in canReadBook, for FRIENDS-tier books:
if (await isBlocked(viewerUserId, book.userId)) return 'NOT_FOUND';  // hide existence
if (await areFriends(viewerUserId, book.userId)) return 'OK';
return 'FRIENDS_ONLY';
```

Block masquerades as `NOT_FOUND` — never reveal a block exists to the blocked party. Same pattern applies to public profile lookup.

### 5.2 Hive FRIENDS visibility

`getDiscoverableHivesAction` already filters `discoverable=true AND visibility='PUBLIC'`. After C1, hives can be discoverable+FRIENDS — when a hive is FRIENDS visibility, surface it in the viewer's Discover Hives feed only if `areFriends(viewer, hive.owner)`.

### 5.3 Block-aware profile fetch

`getPublicAuthorProfileAction` first checks `isBlocked(viewer, targetUser)`. If blocked in either direction: returns `{ blocked: true }` and the page renders a generic "This profile is unavailable" screen (matches the [SP-A](../specs) AccessDenied pattern visually).

### 5.4 Block-aware feed

`getCommunityFeedAction`'s SELECT joins `user_blocks` and `user_mutes` and excludes any `actor_id` that's either side of a block with the viewer OR muted by the viewer.

---

## 6. Page-level UI changes

Visual design is deferred to a Claude Design pass after C1 ships. The structure below locks IA, behavior, and component composition — not pixel-level styling.

### 6.1 `/[locale]/(app)/community/page.tsx` — full rewrite

Layout:

```
┌─────────────────────────────────────────────────────────┐
│  Community  (h1, Comfortaa, brand-yellow)                │
├─────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   ← Section rail   │
│  │👥  │ │🐝  │ │⚡  │ │📚  │ │📖  │     horizontal     │
│  │Frs │ │Hivs│ │Spk │ │Lst │ │Clb │     5 tiles        │
│  └────┘ └────┘ └────┘ └────┘ └────┘                    │
├─────────────────────────────────────────┬───────────────┤
│  Activity feed                          │ Requests      │
│  ┌─────────────────────────────────┐    │ ┌────────┐    │
│  │ event row 1                     │    │ │ 2 new  │    │
│  └─────────────────────────────────┘    │ └────────┘    │
│  ┌─────────────────────────────────┐    │               │
│  │ event row 2                     │    │ Hive invites  │
│  └─────────────────────────────────┘    │ ┌────────┐    │
│  ...                                    │ │ 1 new  │    │
│  [ Load older ]                         │ └────────┘    │
│                                          │              │
│                                          │ Your sparks  │
│                                          │ ┌────────┐    │
│                                          │ │ Mid Aug│    │
│                                          │ └────────┘    │
└─────────────────────────────────────────┴───────────────┘
```

Components:
- **`<CommunityHeader>`** — Comfortaa h1 + tagline.
- **`<SectionRail>`** — 5 horizontal tiles. Each: lucide icon + label + optional count badge ("3 hives", "1 club"). Clicking routes to dedicated index. Lists + Clubs tiles route to `/reading-lists` (stub) and `/clubs` (stub) returning a "Coming soon" page until C3/C4. The rail is a presentational fixture — its presence telegraphs the breadth of Community.
- **`<ActivityFeed>`** — client component owning cursor pagination via `useTransition`. Renders `<ActivityEventRow>` per row.
- **`<ActivityEventRow>`** — per-event-type rendering. Each event has: actor avatar + actor handle (linked) + verb sentence + subject card. Verb map by type (e.g. `book_published` → "@alice published *Book Title*" with cover-thumb card).
- **`<RequestsCard>`** — count badge of received pending friend requests + sample 3 avatars + "Manage →" link to `/friends?tab=requests`. Renders nothing when empty.
- **`<HiveInvitesCard>`** — existing component, kept.
- **`<ActiveSparksCard>`** — existing pattern, kept.
- **Empty state:** when feed is empty (no friends, no follows), show centered card: *"Add friends or follow writers to fill your feed"* + two brand-pill CTAs (Find friends / Discover writers).

Server-side: `page.tsx` parallel-fetches `getCommunityFeedAction({ limit: 20 })` + `getPendingRequestsAction()` (received only) + `getMyHiveInvitesAction()` + `getMyActiveSparksAction()` + section-rail counts (friends count, hives count, sparks count). The 4-fetch shape is the same one used by today's community page; we swap the feed source + add the section rail.

### 6.2 `/[locale]/(app)/friends/page.tsx` — full rewrite

Tab strip: **Friends · Requests · Sent · Suggested**. Tab state via `?tab=` query so deep-links work. Top-right of each tab: **Find a friend** input (username search) + **Invite by link** button.

**Friends tab:** grid of `<FriendCard>`s sorted by `friendship.acceptedAt DESC`. Each card: avatar + display name + @username + mutual-friends count + ⋯ kebab (View profile / Mute / Block / Unfriend, each Block / Unfriend goes through `<ConfirmDialog>`). Empty state: "You haven't added any friends yet" + suggested-writers CTA.

**Requests tab:** received-pending list. Each row: avatar + sender + Accept (brand pill) + Reject (tile-gradient). Count badge in tab.

**Sent tab:** sent-pending list with Cancel button per row.

**Suggested tab:** `getSuggestedWritersAction` results. Each card: avatar + handle + mutual count + Add Friend / Follow buttons.

**Username search:** debounced 300ms, hits a new `searchUsersAction(query)` (returns up to 10 results joined on `userProfiles`, excludes self + blocked). Hits open in a popover under the input with click-to-view-profile.

**Invite by link:** opens shadcn Dialog with copy-link UI matching the existing `<ShareBookDialog>` pattern. Token created on dialog open via `createFriendInviteAction()`.

### 6.3 `/[locale]/(public)/u/[username]/page.tsx` — extensions

Existing profile is preserved. C1 adds:

- **Pre-fetch block check:** if `isBlocked(viewer, profile.userId)` in either direction, render `<ProfileUnavailable>` (generic "This profile is unavailable" — never confirms block existence).
- **Status pill** at top of profile header: `Friends` (green-ish), `Request sent` (mono muted), `Request received` (brand-yellow), or no pill if no relationship.
- **Primary CTA button** reflecting status:
  - Not friends → **Add Friend** (calls `sendFriendRequestAction`)
  - Request sent → **Cancel Request** (calls `cancelFriendRequestAction`)
  - Request received → **Accept Request** (calls `acceptFriendRequestAction`) + secondary Reject
  - Friends → ⋯ menu (Mute toggle / Block / Unfriend)
  - Self → no CTA (or "Edit profile" link to settings)
- **Mutual friends row:** `"12 mutual · @alice @bob @carol +9 more"` with avatar cluster. Renders nothing when zero. Clickable → `/friends?mutuals-with=<userId>` (deferred filter; for C1 the link goes to `/u/<username>` for now — link present, behavior trivial).
- **Stats row gain:** add `friendsCount` next to existing followers/following.
- **⋯ kebab** (next to primary CTA): Mute / Block / Report (Report stub for C5).

### 6.4 Nav user-avatar dropdown

`AppNav` user-avatar already exists; today it has Sign out (and maybe Settings). Add a dropdown menu (shadcn `DropdownMenu` primitive — already in repo) with:

1. **View profile** → `/${locale}/u/${session.user.username}`
2. **Friends** → `/${locale}/friends`
3. **Settings** → `/${locale}/settings` *(if not already present)*
4. divider
5. **Sign out** → existing action

The dropdown is a small but load-bearing piece — it gives users the only path to their own profile and to /friends.

### 6.5 `/[locale]/(public)/friend-invite/[token]/page.tsx` — new route

Server component. Flow:

1. Read `token` from params.
2. Fetch session.
3. If no session → `redirect('/${locale}/sign-up?next=/${locale}/friend-invite/${token}')`. Sign-up page (already supports `?next=` per SP-A) returns user here post-onboarding.
4. If session → call `claimFriendInviteAction({ token })`.
5. On success: redirect to `/${locale}/u/${inviterUsername}` with sonner toast "You and @inviter are now friends."
6. On error: render a centered explanation card (token expired / invalid / already claimed / blocked) with a "Back to Discover" CTA.

Mirrors the hive invite-accept route already shipped.

---

## 7. Notifications

`notifications` table extended via enum-add. Two new types:

| Type | Fired when | Recipient | Payload |
|---|---|---|---|
| `FRIEND_REQUEST` | Inside `sendFriendRequestAction` tx | Request recipient | `{ requesterId, requesterUsername }` |
| `FRIEND_ACCEPTED` | Inside `acceptFriendRequestAction` AND `claimFriendInviteAction` tx | Original sender | `{ accepterId, accepterUsername }` |

`NEW_FOLLOWER` (Phase 7) — unchanged.

Block-aware: notification writes are skipped when either party blocks the other.

UI: the existing notifications bell + dropdown picks them up automatically once the types are added to the enum + the message map. No new routes.

---

## 8. Activity feed UX details

- **Pagination:** cursor-based. Cursor format: base64-encoded `(created_at ISO, id)` tuple. Stable across same-millisecond rows.
- **Sort:** strictly `created_at DESC, id DESC`. No interleaving / scoring (defer ranking to C5).
- **Refresh:** "Load older" button below the list (matches existing /community pattern). Pull-to-refresh / auto-poll deferred to C5. Current-session "X new posts" indicator deferred.
- **Empty:** the empty state CTAs (Find friends, Discover writers) link to `/friends` and `/discover`.
- **Friend pinning:** events from FRIENDS get a subtle visual marker (e.g. a brand-yellow left edge) vs followed-only writers. Mechanical: include `isFriend: boolean` in the row projection.
- **Dedupe at write:** see §3.5. `book_liked` is the main offender; capped to one event per (actor, book) per 6 hours.
- **Subject hydration:** rows store `subject_id` only. Display rendering joins to the source table at read time (book title + cover, hive name + cover, etc.) via a few `inArray` queries grouped by `subject_type`. Stitched in JS, matches the H4 `listBuzzPostsAction` precedent.

---

## 9. Out of scope (deferred to later phases — named so they don't get forgotten)

| Item | Defer to |
|---|---|
| @-mentions parsing + `MENTION` notification type | C5 |
| Friends-list visible on others' profiles (P5) — opt-in toggle | C5 |
| Per-friend feed prioritization / Close Friends subset | C5 (if user research surfaces a need) |
| Activity feed ranking beyond chronological | C5 |
| "X new posts" live indicator / pull-to-refresh / auto-poll | C5 |
| Restrict (Instagram-style stealth limit) | Probably never |
| Report + moderation queue | Phase 10+ |
| Reading List + Book Club event types in feed (forward-compat enum addition) | C3 / C4 |
| Settings → Blocked Users / Muted Users pages | C5 polish (action layer ships in C1; UI is one small page) |
| `mutuals-with=<userId>` filter on /friends | C5 |
| Friend-feed prioritization algorithm | C5 |
| Mass invite (email list) | Out — invite-link is the supported path |

---

## 10. Visual design

Sent to Claude Design AFTER C1 ships. Spec locks IA, data, behavior. Visual polish is a separate handoff per the editor refresh / hive refresh precedent. Chrome inherits existing iOS-inspired tokens (`--canvas-dark-*` scale, `--r-card`, `--sh-card`, `--br-card`, Comfortaa/Geist/Newsreader stack). Brand-yellow stays restrained per the design-system map in AGENTS.md.

---

## 11. Test posture

Following AGENTS.md: unit tests for pure helpers + server-action surface-shape tests + manual smoke for UI.

**Unit tests (with Vitest):**
- `lib/social/__tests__/are-friends.test.ts` — mutual ACCEPTED truth table; self-id returns false; non-ACCEPTED rows return false.
- `lib/social/__tests__/is-blocked.test.ts` — both directions return true; self-id false.
- `lib/social/__tests__/get-mutual-friends.test.ts` — intersection correctness; respects ACCEPTED filter.
- `lib/social/__tests__/record-activity-dedupe.test.ts` — within-window skip; outside-window write; non-dedupe types always write.

**Surface-shape tests (mirrors `lib/actions/__tests__/reading-actions.test.ts` and `create-hive-action.test.ts`):**
- `lib/actions/__tests__/friendships-actions.test.ts` — exports + arity for the 8 actions.
- `lib/actions/__tests__/blocks-actions.test.ts` — exports + block tx behavior (mock db, assert tx sequence).
- `lib/actions/__tests__/friend-invites-actions.test.ts` — token shape, claim flow paths (valid / expired / claimed / self).
- `lib/actions/__tests__/community-actions.test.ts` — `getCommunityFeedAction` cursor behavior + block/mute exclusion.

**Manual smoke checklist** lives in §13 below (carry-forward target list for whoever ships C1).

---

## 12. Implementation phasing

Suggested task decomposition for the implementation plan (writing-plans skill will own the final breakdown):

| Task | Title | Notes |
|---|---|---|
| T1 | Schema migration + enum additions | `scripts/migrate-c1.ts`, idempotent. |
| T2 | `are-friends` + `is-blocked` + `get-mutual-friends` helpers + tests | Pure functions, no chrome dependency. |
| T3 | `recordSocialActivityTx` + dedupe map + tests | Mirrors `recordHiveActivityTx`. |
| T4 | Block-aware `canReadBook` extension | Wire FRIENDS gate + block masquerade. |
| T5 | `friendships.actions.ts` expansion | All 8 actions + tx-internal notification writes. |
| T6 | `blocks.actions.ts` + `mutes.actions.ts` + `friend-invites.actions.ts` | All new files. |
| T7 | `getCommunityFeedAction` rewrite + subject hydration | Replaces hive-activity feed. |
| T8 | Activity event hooks wired into 7 source actions | publishBook, saveChapter, toggleBookLike, addComment, submitSparkEntry, createHive, acceptHiveInvite + spark winner paths. |
| T9 | `/community` page rewrite | Section rail + feed + sidebar cards. Empty state. |
| T10 | `/friends` page rewrite | 4-tab strip + search + invite-by-link dialog. |
| T11 | Profile-page friendship UI | Status pill + smart CTA + mutual cluster + stats row + kebab. Block-masquerade fetch path. |
| T12 | Nav user-avatar dropdown | View profile / Friends / Settings / Sign out. |
| T13 | `/friend-invite/[token]` route | Sign-up redirect + claim flow + toast. |
| T14 | Notifications enum extension + bell-list rendering for new types | Trivial — extends existing surface. |
| T15 | Hive FRIENDS visibility filter on Discover | Quick. |
| T16 | Manual smoke + AGENTS.md update + ship | |

Each task is independently shippable. Tests gate per-task; full suite stays green throughout.

---

## 13. Carry-forward smoke checklist for ship

(For Chris after T16. Mirrors C-phase smoke conventions.)

1. **Send friend request:** as user A → `/u/[B's username]` → Add Friend. Confirm: request lands in B's inbox + status pill on A's view flips to "Request sent" + `FRIEND_REQUEST` notification badge appears on B.
2. **Accept request:** as B → bell or `/friends?tab=requests` → Accept. Confirm: friendship row ACCEPTED + A sees status pill "Friends" + A receives `FRIEND_ACCEPTED` notification.
3. **Mutual friends:** A and B both add C as friend → A views B's profile → confirm mutual-friends row reads "1 mutual · @C".
4. **Reject silently:** as B → reject A's request. Confirm: row deleted, A receives NO notification, A's status pill on B's profile flips back to "Not friends".
5. **Cancel sent:** as A → /friends?tab=sent → Cancel. Confirm: row deleted, B's inbox empty.
6. **Unfriend:** existing friends → A unfriends B. Confirm: row deleted, neither receives a notification, both lose FRIENDS-tier access to each other's books.
7. **Block flow:** A blocks B. Confirm: existing friendship deleted, existing follows in both directions deleted, B navigating to A's profile sees "This profile is unavailable", A's content disappears from B's feed.
8. **Unblock:** A unblocks B. Confirm: A's profile becomes visible to B again, but friendship/follows are NOT restored (must re-request).
9. **Mute:** A mutes B. Confirm: B's activity disappears from A's feed, B navigating sees A unchanged, A can still navigate to B's profile normally.
10. **Invite by link:** A on /friends clicks Invite by link → copies URL → opens in incognito → signs up as new user D → claim runs → D and A are friends + A gets `FRIEND_ACCEPTED` notification.
11. **Invite expired:** create a token, manually edit DB to set expires_at in past → claim → confirm `TOKEN_EXPIRED` error screen.
12. **Self-invite:** A creates token + tries to claim on own session → confirm `SELF_INVITE` error screen.
13. **FRIENDS book access:** A creates a FRIENDS-visibility book → publishes a chapter at REVISED → B (not friend) visits `/books/[id]` → confirm FRIENDS_ONLY screen → A and B become friends → B reloads → confirm full read access.
14. **FRIENDS hive on Discover:** A creates a hive at FRIENDS+discoverable visibility → B (not friend) visits /discover/hives → confirm hive absent → friends → confirm hive visible.
15. **Feed events flow:** A publishes a book, posts a REVISED chapter, likes another book, comments on a book, joins a public hive → confirm B (friend or follower) sees 5 events in their /community feed with correct verbs + subject cards.
16. **Feed dedupe:** A likes the SAME book twice within 6 hours → B confirms only 1 `book_liked` event in feed (per-book dedupe per §3.5). A likes 5 DIFFERENT books in 10 minutes → B confirms 5 distinct events.
17. **Feed scope:** A is friend of B and following C. B publishes a book, C publishes a book. A's feed shows both. A also follows D who's not a friend. D publishes a book. A's feed shows it. Followed-only entries should be subtly distinguishable from friend entries.
18. **Privacy of FRIENDS books in feed:** A has a FRIENDS book, publishes it. B (follower, not friend) does NOT see `book_published` event for it.
19. **Feed empty state:** new user E with no friends, no follows → /community shows empty-state card with both CTAs.
20. **Nav dropdown:** click avatar → View profile routes to /u/[me]; Friends routes to /friends.
21. **Profile self-view:** /u/[me] renders without status pill / CTA.
22. **Section rail:** /community top rail tiles route correctly (Lists + Clubs route to Coming Soon stubs).
23. **Notifications:** FRIEND_REQUEST + FRIEND_ACCEPTED render in bell list with correct copy.

---

*End of C1 spec. Next step: writing-plans skill to produce the task plan.*
