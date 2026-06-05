# C4 — Book Clubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship persistent book clubs — long-lived groups with current/queue/past book lists, 3-tier OWNER/MOD/MEMBER roles, club-wide threaded discussions with likes on posts AND replies + pins + required titles, both invite-by-username + invite-by-link paths, light per-chapter schedule, 2 social_activity events + 3 new notification types.

**Architecture:** 11 new tables sharing C1's `areFriends`/`isBlocked` privacy helpers + `recordSocialActivityTx` event store. Atomic current-book transitions via `deriveCurrentBookTx` helper (PAST flip + new CURRENT insert + denorm pointer update + activity fire). Two like tables (posts + replies) for clean CASCADE. Multi-row notification fan-out for CLUB_JOIN_REQUEST (notifies all owner+MODs in one tx). Partial unique index for "at most one CURRENT book per club" mirrors C3 Liked-list pattern.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM on Neon Postgres, shadcn Dialog + DropdownMenu, dnd-kit for queue reorder, sonner toasts, vitest + tsc for verification.

**Spec:** [docs/superpowers/specs/2026-06-05-c4-book-clubs-design.md](../specs/2026-06-05-c4-book-clubs-design.md)
**Phase overview:** [docs/superpowers/specs/2026-06-04-community-phase-overview.md](../specs/2026-06-04-community-phase-overview.md)

---

## Task Dependencies

```
T1 (schema) → T2 (helpers) → T3-T9 (server actions, single shared file)
                                    ↓
                                  T10, T11 (routes — sequential per C3 W4 precedent)
                                    ↓
                                  T12-T18 (UI parallel — isolated component scopes)
                                    ↓
                                  T19-T22 (integration parallel — discover + activity + profile + invite route)
                                    ↓
                                  T23 (smoke + ship)
```

Suggested 7-wave shape (mirrors C3 cadence at larger scale):
- **W1**: T1 alone (schema migration)
- **W2**: T2 alone (helpers)
- **W3**: T3-T9 as ONE combined commit (single subagent — same-file race avoidance per C2/C3 Wave 3 precedent)
- **W4**: T10 + T11 sequential (page + detail hub — stub components)
- **W5**: T12-T18 parallel (7-way UI dispatch — separate component scopes)
- **W6**: T19-T22 parallel (4-way integration dispatch — separate files)
- **W7**: T23 smoke + ship

---

## Task 1: Schema migration

**Files:**
- Create: `scripts/migrate-c4.ts`
- Modify: `db/schema/social.ts`

- [ ] **Step 1: Extend `db/schema/social.ts`** — append 4 new pgEnums + 11 new tables. Add `'book_club_created'` + `'book_club_current_book_changed'` to existing `socialActivityTypeEnum` array literal. Add `'CLUB_INVITE'` + `'CLUB_JOIN_REQUEST'` + `'CLUB_JOIN_APPROVED'` to existing `notificationTypeEnum` array literal. Import existing `bookVisibilityEnum` from `./books`.

```ts
export const bookClubMemberRoleEnum = pgEnum('book_club_member_role', ['OWNER', 'MODERATOR', 'MEMBER'])
export const bookClubBookStatusEnum = pgEnum('book_club_book_status', ['CURRENT', 'PAST', 'QUEUE'])
export const bookClubInviteStatusEnum = pgEnum('book_club_invite_status', ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED'])
export const bookClubJoinRequestStatusEnum = pgEnum('book_club_join_request_status', ['PENDING', 'ACCEPTED', 'REJECTED'])

export type BookClubMemberRole = (typeof bookClubMemberRoleEnum.enumValues)[number]
export type BookClubBookStatus = (typeof bookClubBookStatusEnum.enumValues)[number]
export type BookClubInviteStatus = (typeof bookClubInviteStatusEnum.enumValues)[number]
export type BookClubJoinRequestStatus = (typeof bookClubJoinRequestStatusEnum.enumValues)[number]
```

Then add 11 tables (`bookClubs`, `bookClubBooks`, `bookClubMembers`, `bookClubInvites`, `bookClubInviteTokens`, `bookClubJoinRequests`, `bookClubScheduleItems`, `bookClubDiscussions`, `bookClubDiscussionReplies`, `bookClubDiscussionLikes`, `bookClubDiscussionReplyLikes`) following spec §2.2 column-by-column.

**Important:** `bookClubs.currentBookId` cannot use `references()` directly because `bookClubBooks` is defined AFTER `bookClubs`. Use `text('current_book_id')` without the references() (the FK is added via raw ALTER in the migration runner step 14). Type-system reference still works through `AnyPgColumn` cast if needed in relations later.

- [ ] **Step 2: Create `scripts/migrate-c4.ts`** — 17-step idempotent runner mirroring `scripts/migrate-c3.ts` shape. Top JSDoc comment describes purpose + run command (`npx dotenv -e .env.local -- tsx scripts/migrate-c4.ts`). Uses `neon` from `@neondatabase/serverless`. Each step prints `✓ N/17 ...`.

Step list:
1. Create 4 enums via `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`.
2. `CREATE TABLE IF NOT EXISTS book_clubs` + 2 indexes.
3. `CREATE TABLE IF NOT EXISTS book_club_books` + 1 index (the partial unique index is step 13).
4. `CREATE TABLE IF NOT EXISTS book_club_members` + UNIQUE constraint + 1 index.
5. `CREATE TABLE IF NOT EXISTS book_club_invites` + 2 indexes.
6. `CREATE TABLE IF NOT EXISTS book_club_invite_tokens` + 1 index.
7. `CREATE TABLE IF NOT EXISTS book_club_join_requests` + UNIQUE + 1 index.
8. `CREATE TABLE IF NOT EXISTS book_club_schedule_items` + 1 index + CHECK.
9. `CREATE TABLE IF NOT EXISTS book_club_discussions` + 1 index.
10. `CREATE TABLE IF NOT EXISTS book_club_discussion_replies` + 1 index.
11. `CREATE TABLE IF NOT EXISTS book_club_discussion_likes` (composite PK).
12. `CREATE TABLE IF NOT EXISTS book_club_discussion_reply_likes` (composite PK).
13. `CREATE UNIQUE INDEX IF NOT EXISTS book_club_books_one_current ON book_club_books (club_id) WHERE status = 'CURRENT'` — partial unique enforcing one CURRENT row per club.
14. Add `book_clubs.current_book_id` FK after both tables exist:
   ```sql
   ALTER TABLE book_clubs DROP CONSTRAINT IF EXISTS book_clubs_current_book_id_fkey;
   ALTER TABLE book_clubs ADD CONSTRAINT book_clubs_current_book_id_fkey
     FOREIGN KEY (current_book_id) REFERENCES book_club_books(id) ON DELETE SET NULL;
   ```
   (Drop-and-readd makes the step idempotent.)
15. `ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'book_club_created'` + same for `'book_club_current_book_changed'`.
16. `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CLUB_INVITE'` + `'CLUB_JOIN_REQUEST'` + `'CLUB_JOIN_APPROVED'`.
17. Verification row counts (clubs + members + books + discussions).

**Critical SQL details:**
- Wrap `"order"` in double-quotes everywhere (Postgres reserved word) — same as C3 T1.
- `tags text[] NOT NULL DEFAULT '{}'` — Postgres coerces bare `'{}'` to empty text array.
- `book_club_books.book_id` references `books(id)` ON DELETE SET NULL (optional Beehive link).
- All `recipient_id`/`requester_id`/`user_id`/`author_id` columns reference `users(id)` lowercase (NOT `"user"(id)` — same lesson as C1).
- CHECK on schedule items: `CHECK (chapter_end >= chapter_start)`.

- [ ] **Step 3: Run migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-c4.ts`
Expected: 17 ✓ steps. Re-run for idempotency.

- [ ] **Step 4: Tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + 540/540 green.

Note: enum widening on `social_activity_type` + `notification_type` may cascade into exhaustive `Record<EnumType, _>` consumers (per C3 T1 lesson). Locate via `grep -rn "Record<FeedRow\['type'\]\|Record<NotificationType" app/`. If found, add provisional copy entries to keep tsc clean — T20 owns final phrasing.

- [ ] **Step 5: Commit**

```bash
git add db/schema/social.ts scripts/migrate-c4.ts
git commit -m "feat(c4/schema): 11 book-club tables + 4 enums + social_activity + notification additions"
```

(HEREDOC + Co-Authored-By trailer.)

---

## Task 2: Helpers — predicates + get-membership + derive-current-book

**Files:**
- Create: `lib/book-clubs/predicates.ts`
- Create: `lib/book-clubs/get-membership.ts`
- Create: `lib/book-clubs/derive-current-book.ts`
- Test: `lib/book-clubs/__tests__/{predicates,get-membership,derive-current-book}.test.ts`

- [ ] **Step 1: `predicates.ts`** — mirror `lib/sparks/predicates.ts` (visibility) + `lib/hive/permissions.ts` (role-derived).

```ts
import { areFriends } from '@/lib/social/are-friends'
import { isBlocked } from '@/lib/social/is-blocked'
import type { BookVisibility } from '@/db/schema/books'
import type { BookClubMemberRole } from '@/db/schema/social'

type ClubLike = { ownerId: string; visibility: BookVisibility }
type RoleableClub = { ownerId: string; visibility: BookVisibility; openJoin: boolean }

// Visibility-based (async)
export async function canViewClub(viewerId: string | null, club: ClubLike, viewerMembership: { role: BookClubMemberRole | null }): Promise<boolean> {
  if (viewerId && (await isBlocked(viewerId, club.ownerId))) return false
  if (viewerMembership.role !== null) return true   // members always see their own clubs
  if (club.visibility === 'PUBLIC') return true
  if (club.visibility === 'PRIVATE') return false
  // FRIENDS
  if (!viewerId) return false
  if (viewerId === club.ownerId) return true
  return await areFriends(viewerId, club.ownerId)
}

export async function canJoinClub(viewerId: string | null, club: RoleableClub, viewerMembership: { role: BookClubMemberRole | null }): Promise<boolean> {
  if (!viewerId) return false
  if (viewerMembership.role !== null) return false  // already a member
  return await canViewClub(viewerId, club, viewerMembership)
}

// Role-based (synchronous)
export function canEditClubMetadata(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canManageBookQueue(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canManageSchedule(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canPinDiscussion(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canApproveJoinRequest(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canInviteUser(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canManageMembers(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'MODERATOR'
}

export function canChangeRole(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER'
}

export function canDeleteClub(role: BookClubMemberRole | null): boolean {
  return role === 'OWNER'
}

export function canPostDiscussion(role: BookClubMemberRole | null): boolean {
  return role !== null  // any member
}
```

Note: `canViewClub` takes a `viewerMembership` parameter to account for members-of-PRIVATE-clubs. This requires the caller to pre-fetch membership (via `getClubMembership` helper from step 2).

- [ ] **Step 2: `get-membership.ts`** — cached single-row lookup:

```ts
import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bookClubMembers } from '@/db/schema/social'
import type { BookClubMemberRole } from '@/db/schema/social'

export const getClubMembership = cache(async (viewerId: string | null, clubId: string): Promise<{ role: BookClubMemberRole | null }> => {
  if (!viewerId) return { role: null }
  const row = await db.query.bookClubMembers.findFirst({
    where: and(eq(bookClubMembers.userId, viewerId), eq(bookClubMembers.clubId, clubId)),
    columns: { role: true },
  })
  return { role: row?.role ?? null }
})
```

- [ ] **Step 3: `derive-current-book.ts`** — consolidates 4-step current-book transition. Pure function operating on a tx:

```ts
import { and, eq, sql } from 'drizzle-orm'
import { bookClubs, bookClubBooks, socialActivity } from '@/db/schema/social'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { createId } from '@paralleldrive/cuid2'
import type { db as Db } from '@/db'

type DrizzleTx = Parameters<Parameters<typeof Db.transaction>[0]>[0]

type DeriveOpts = {
  clubId: string
  newCurrentBookId: string
  actorId: string
  clubName: string
  clubVisibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  clubDiscoverable: boolean
}

/** Atomic current-book transition: PAST flip + new CURRENT + pointer update + activity fire. */
export async function deriveCurrentBookTx(tx: DrizzleTx, opts: DeriveOpts): Promise<void> {
  // 1. Find existing CURRENT row (if any) for this club; capture title.
  const existing = await tx.query.bookClubBooks.findFirst({
    where: and(eq(bookClubBooks.clubId, opts.clubId), eq(bookClubBooks.status, 'CURRENT')),
    columns: { id: true, title: true },
  })

  // 2. Flip existing CURRENT → PAST + set finished_at.
  if (existing && existing.id !== opts.newCurrentBookId) {
    await tx.update(bookClubBooks)
      .set({ status: 'PAST', finishedAt: new Date() })
      .where(eq(bookClubBooks.id, existing.id))
  }

  // 3. Set target row to CURRENT + set started_at + update pointer.
  await tx.update(bookClubBooks)
    .set({ status: 'CURRENT', startedAt: new Date() })
    .where(eq(bookClubBooks.id, opts.newCurrentBookId))

  await tx.update(bookClubs)
    .set({ currentBookId: opts.newCurrentBookId, updatedAt: new Date() })
    .where(eq(bookClubs.id, opts.clubId))

  // 4. Fire activity event if PUBLIC+discoverable.
  if (opts.clubVisibility === 'PUBLIC' && opts.clubDiscoverable) {
    const newRow = await tx.query.bookClubBooks.findFirst({
      where: eq(bookClubBooks.id, opts.newCurrentBookId),
      columns: { title: true },
    })
    await recordSocialActivityTx(tx, {
      actorId: opts.actorId,
      type: 'book_club_current_book_changed',
      subjectType: 'book_club',
      subjectId: opts.clubId,
      payload: {
        clubName: opts.clubName,
        fromBookTitle: existing?.title ?? null,
        toBookTitle: newRow?.title ?? 'Untitled',
      },
    })
  }
}
```

- [ ] **Step 4: Tests** — mirror C2/C3 patterns:
  - `predicates.test.ts` — ~25 tests covering role × visibility × block matrix. Use `vi.mock('@/lib/social/{are-friends,is-blocked}', () => ({ ... }))` at top level + static imports per [ca51b28] lesson.
  - `get-membership.test.ts` — 2 tests (null viewer → role:null; viewer with membership → role from row). `vi.mock('@/db', ...)`.
  - `derive-current-book.test.ts` — 3 tests (no existing CURRENT + new insert; existing CURRENT flipped to PAST + new becomes CURRENT; activity event PUBLIC-gated). Use `vi.hoisted()` per C3 T2 lesson for chained mock state.

- [ ] **Step 5: Tsc + tests + commit**

```bash
npx tsc --noEmit && npm test
git add lib/book-clubs/
git commit -m "feat(c4/helpers): predicates + getClubMembership + deriveCurrentBookTx + ~30 unit tests"
```

---

## Task 3-9: Server actions (one combined commit per C2/C3 Wave 3 precedent)

**Files:**
- Create: `lib/actions/book-clubs.actions.ts`
- Create: `lib/validations/book-club.ts`
- Test: `lib/actions/__tests__/book-clubs-actions.test.ts`

**ALL 7 TASKS BELOW SHIP IN ONE COMMIT** to avoid 7-way race on `book-clubs.actions.ts`. Dispatch as ONE combined-implementer subagent.

### T3 — Validations + club CRUD

- [ ] **Step 1: `lib/validations/book-club.ts`** — ~12 Zod schemas:

```ts
import { z } from 'zod'

export const createClubSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  rules: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).default([]),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
  discoverable: z.boolean().optional().default(true),
  openJoin: z.boolean().optional().default(true),
}).transform((d) => ({ ...d, discoverable: d.visibility === 'PUBLIC' ? d.discoverable : false }))

export const updateClubSchema = z.object({
  clubId: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  rules: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
  discoverable: z.boolean().optional(),
  openJoin: z.boolean().optional(),
})

export const clubIdSchema = z.object({ clubId: z.string().min(1) })
export const targetUserSchema = z.object({ clubId: z.string().min(1), targetUserId: z.string().min(1) })
export const changeRoleSchema = z.object({
  clubId: z.string().min(1),
  targetUserId: z.string().min(1),
  newRole: z.enum(['MODERATOR', 'MEMBER']),  // OWNER role swap is via transferOwnership, not this
})

export const inviteByUsernameSchema = z.object({
  clubId: z.string().min(1),
  recipientUsername: z.string().trim().min(1).max(32),
})
export const inviteIdSchema = z.object({ inviteId: z.string().min(1) })
export const respondInviteSchema = z.object({ inviteId: z.string().min(1), accept: z.boolean() })
export const claimTokenSchema = z.object({ token: z.string().min(16).max(64) })

export const requestIdSchema = z.object({ requestId: z.string().min(1) })
export const respondRequestSchema = z.object({ requestId: z.string().min(1), accept: z.boolean() })

export const addClubBookSchema = z.object({
  clubId: z.string().min(1),
  bookId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().max(500).optional(),
  status: z.enum(['QUEUE', 'CURRENT']).default('QUEUE'),
})

export const updateClubBookSchema = z.object({
  rowId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  author: z.string().trim().min(1).max(200).optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
})

export const rowIdSchema = z.object({ rowId: z.string().min(1) })
export const reorderQueueSchema = z.object({
  clubId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
})

export const addScheduleItemSchema = z.object({
  clubId: z.string().min(1),
  bookId: z.string().min(1),
  chapterStart: z.number().int().min(1),
  chapterEnd: z.number().int().min(1),
  targetDate: z.coerce.date(),
  label: z.string().trim().max(80).optional(),
}).refine((d) => d.chapterEnd >= d.chapterStart, { message: 'chapter_end must be >= chapter_start' })

export const updateScheduleItemSchema = z.object({
  itemId: z.string().min(1),
  chapterStart: z.number().int().min(1).optional(),
  chapterEnd: z.number().int().min(1).optional(),
  targetDate: z.coerce.date().optional(),
  label: z.string().trim().max(80).nullable().optional(),
  order: z.number().int().min(0).optional(),
})
export const itemIdSchema = z.object({ itemId: z.string().min(1) })

export const createDiscussionSchema = z.object({
  clubId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(10000),
})
export const updateDiscussionSchema = z.object({
  discussionId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(10000).optional(),
})
export const discussionIdSchema = z.object({ discussionId: z.string().min(1) })
export const pinDiscussionSchema = z.object({ discussionId: z.string().min(1), pin: z.boolean() })
export const replyToDiscussionSchema = z.object({
  discussionId: z.string().min(1),
  content: z.string().trim().min(1).max(5000),
})
export const replyIdSchema = z.object({ replyId: z.string().min(1) })
```

- [ ] **Step 2: `lib/actions/book-clubs.actions.ts`** — start with `'use server'` + imports + 5 CRUD actions. Follow C3 `reading-lists.actions.ts` shape for createClubAction's tx (insert + activity hook + insert founding member).

```ts
'use server'

import { createId } from '@paralleldrive/cuid2'
import { and, asc, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '@/db'
import {
  bookClubs, bookClubBooks, bookClubMembers, bookClubInvites, bookClubInviteTokens,
  bookClubJoinRequests, bookClubScheduleItems, bookClubDiscussions,
  bookClubDiscussionReplies, bookClubDiscussionLikes, bookClubDiscussionReplyLikes,
  notifications, socialActivity, userProfiles, userBlocks,
} from '@/db/schema/social'
import { books } from '@/db/schema/books'
import { users } from '@/db/schema/auth'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { isBlocked } from '@/lib/social/is-blocked'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { canReadBook } from '@/lib/books/can-read'
import {
  canViewClub, canJoinClub, canEditClubMetadata, canManageBookQueue, canManageSchedule,
  canPinDiscussion, canApproveJoinRequest, canInviteUser, canManageMembers,
  canChangeRole, canDeleteClub, canPostDiscussion,
} from '@/lib/book-clubs/predicates'
import { getClubMembership } from '@/lib/book-clubs/get-membership'
import { deriveCurrentBookTx } from '@/lib/book-clubs/derive-current-book'
import * as v from '@/lib/validations/book-club'
import type { ActionResult } from './book.actions'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const INVITE_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClubSummary = {
  id: string
  name: string
  description: string | null
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  discoverable: boolean
  openJoin: boolean
  tags: string[]
  memberCount: number
  currentBook: { id: string; title: string; author: string; coverUrl: string | null } | null
  owner: { userId: string; username: string | null; displayName: string | null; avatarUrl: string | null }
  viewerMembership: { role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null }
  createdAt: Date
}

// ─── Club CRUD ────────────────────────────────────────────────────────────────

export async function createClubAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = v.createClubSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const id = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubs).values({
      id, ownerId: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      rules: parsed.data.rules ?? null,
      tags: parsed.data.tags,
      visibility: parsed.data.visibility,
      discoverable: parsed.data.discoverable,
      openJoin: parsed.data.openJoin,
      memberCount: 1,
    })
    await tx.insert(bookClubMembers).values({
      id: createId(), clubId: id, userId, role: 'OWNER',
    })
    if (parsed.data.visibility === 'PUBLIC' && parsed.data.discoverable) {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'book_club_created',
        subjectType: 'book_club',
        subjectId: id,
        payload: { name: parsed.data.name },
      })
    }
  })
  return { success: true, data: { id } }
}

// getClubsAction, getClubAction, updateClubAction, deleteClubAction follow C3 patterns
// (cursor pagination, canViewClub gate, 3-layer discoverable defense, CASCADE on delete).
// Full implementations follow spec §4.1 + plan T4-T5 patterns.
```

(Full implementations of T3-T9 actions follow the spec §4 + the patterns from C3 `reading-lists.actions.ts`. Plan keeps detailed code for load-bearing actions; routine CRUD follows established patterns.)

### T4 — Member actions (join/leave/remove/changeRole/transferOwnership)

- [ ] **Step 1: `joinClubAction`** — branches on `open_join`:

```ts
export async function joinClubAction(input: unknown): Promise<ActionResult<{ joined: boolean; requested: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.clubIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: { id: true, ownerId: true, visibility: true, openJoin: true, name: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, club.id)
  if (membership.role !== null) return { success: false, error: 'ALREADY_MEMBER' }

  if (!(await canJoinClub(userId, club, membership))) return { success: false, error: 'NOT_FOUND' }  // masquerade

  if (club.openJoin) {
    await db.transaction(async (tx) => {
      await tx.insert(bookClubMembers).values({ id: createId(), clubId: club.id, userId, role: 'MEMBER' })
      await tx.update(bookClubs).set({ memberCount: sql`${bookClubs.memberCount} + 1` }).where(eq(bookClubs.id, club.id))
    })
    return { success: true, data: { joined: true, requested: false } }
  }

  // open_join=false → insert join request + notify owner+MODs
  const existingRequest = await db.query.bookClubJoinRequests.findFirst({
    where: and(eq(bookClubJoinRequests.clubId, club.id), eq(bookClubJoinRequests.userId, userId), eq(bookClubJoinRequests.status, 'PENDING')),
  })
  if (existingRequest) return { success: false, error: 'REQUEST_ALREADY_PENDING' }

  const requestId = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubJoinRequests).values({ id: requestId, clubId: club.id, userId, status: 'PENDING' })

    // Fan-out notifications to all OWNER + MOD members
    const recipients = await tx.query.bookClubMembers.findMany({
      where: and(eq(bookClubMembers.clubId, club.id), inArray(bookClubMembers.role, ['OWNER', 'MODERATOR'])),
      columns: { userId: true },
    })
    if (recipients.length > 0) {
      await tx.insert(notifications).values(recipients.map((r) => ({
        id: createId(),
        userId: r.userId,
        type: 'CLUB_JOIN_REQUEST' as const,
        actorId: userId,
        resourceType: 'book_club_join_request',
        resourceId: requestId,
      })))
    }
  })
  return { success: true, data: { joined: false, requested: true } }
}
```

- [ ] **Step 2: `leaveClubAction`** + `removeClubMemberAction` + `changeClubMemberRoleAction` + `transferClubOwnershipAction`. Follow spec §4.2 — all canManageMembers / canChangeRole gates; tx for atomic role swaps. **`transferClubOwnershipAction` is atomic**: target.role→OWNER + self.role→MEMBER + `book_clubs.owner_id` update in one tx.

### T5 — Invite actions (username + token)

- [ ] **`inviteUserToClubAction`**: lookup username → check no PENDING invite + not member + not blocked → tx insert invite + CLUB_INVITE notification (using `actorId + resourceType: 'book_club_invite' + resourceId`).

- [ ] **`respondToClubInviteAction`** — accept path: tx update invite ACCEPTED + insert member + bump count + delete any PENDING join_request from same user.

- [ ] **`cancelClubInviteAction`** — inviter-only status flip to CANCELED.

- [ ] **`createClubInviteTokenAction`**: `randomBytes(24).toString('base64url')` + 14d TTL.

- [ ] **`claimClubInviteTokenAction`**: full error ladder per spec §4.2. Tx wraps: mark claimed + insert member + bump count.

### T6 — Join-request actions (already partially in T4's joinClubAction)

- [ ] **`respondToJoinRequestAction`** — canApproveJoinRequest gate. Accept: tx update PENDING→ACCEPTED + insert member + bump count + CLUB_JOIN_APPROVED notification. Reject: status flip only.

- [ ] **`cancelJoinRequestAction`** — requester-only withdraw.

### T7 — Books + schedule actions

- [ ] **`addClubBookAction`** — load-bearing. canManageBookQueue gate + bookId validation via `canReadBook(bookId, userId)` (positional per C3 T5 lesson; → BOOK_NOT_FOUND on masquerade) + status branch:

```ts
if (parsed.data.status === 'CURRENT') {
  // Delegate to deriveCurrentBookTx
  const newRowId = createId()
  await db.transaction(async (tx) => {
    // First, INSERT the row at QUEUE status (the partial unique index allows multiple QUEUE rows)
    await tx.insert(bookClubBooks).values({
      id: newRowId, clubId: parsed.data.clubId,
      bookId: parsed.data.bookId ?? null,
      title: parsed.data.title,
      author: parsed.data.author,
      coverUrl: parsed.data.coverUrl ?? null,
      status: 'QUEUE',  // start as queue; deriveCurrentBookTx flips it
    })
    // Then delegate the transition
    await deriveCurrentBookTx(tx, {
      clubId: parsed.data.clubId,
      newCurrentBookId: newRowId,
      actorId: userId,
      clubName: club.name,
      clubVisibility: club.visibility,
      clubDiscoverable: club.discoverable,
    })
  })
  return { success: true, data: { id: newRowId } }
} else {
  // QUEUE: simple insert with next order
  const [{ maxOrder }] = await db.select({ maxOrder: sql<number>`coalesce(max("order"), -1)::int` })
    .from(bookClubBooks)
    .where(and(eq(bookClubBooks.clubId, parsed.data.clubId), eq(bookClubBooks.status, 'QUEUE'))) as any

  const id = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubBooks).values({
      id, clubId: parsed.data.clubId,
      bookId: parsed.data.bookId ?? null,
      title: parsed.data.title,
      author: parsed.data.author,
      coverUrl: parsed.data.coverUrl ?? null,
      status: 'QUEUE',
      order: (maxOrder ?? -1) + 1,
    })
  })
  return { success: true, data: { id } }
}
```

- [ ] **`setCurrentBookAction`** — wrap `deriveCurrentBookTx` directly.

- [ ] **`removeClubBookAction`** — guard against removing CURRENT.

- [ ] **`reorderClubQueueAction`** — bulk update via tx; verifies all rows belong to club.

- [ ] **`getClubBooksAction`** — canViewClub gate. LEFT JOIN books for non-null bookId enrichment. Default groups all 3 statuses.

- [ ] **`addScheduleItemAction`** / `updateScheduleItemAction` / `removeScheduleItemAction` / `getClubScheduleAction` — canManageSchedule gate (writes); canViewClub gate (reads).

### T8 — Discussion + reply + like actions

- [ ] **`createClubDiscussionAction`** — canPostDiscussion (member).

- [ ] **`updateClubDiscussionAction`** / `deleteClubDiscussionAction` — author OR MOD+.

- [ ] **`pinClubDiscussionAction`** — canPinDiscussion (MOD+).

- [ ] **`replyToClubDiscussionAction`** — tx: insert reply + `book_club_discussions.reply_count + 1`. Verify discussion's club allows viewer.

- [ ] **`deleteClubDiscussionReplyAction`** — author OR MOD+. Tx: delete + decrement via `GREATEST(...-1, 0)`.

- [ ] **`toggleClubDiscussionLikeAction`** + **`toggleClubReplyLikeAction`** — atomic tx pattern:

```ts
let liked = false
await db.transaction(async (tx) => {
  const existing = await tx.query.bookClubDiscussionLikes.findFirst({
    where: and(eq(bookClubDiscussionLikes.userId, userId), eq(bookClubDiscussionLikes.discussionId, parsed.data.discussionId)),
  })
  if (existing) {
    await tx.delete(bookClubDiscussionLikes)
      .where(and(eq(bookClubDiscussionLikes.userId, userId), eq(bookClubDiscussionLikes.discussionId, parsed.data.discussionId)))
    await tx.update(bookClubDiscussions)
      .set({ likeCount: sql`greatest(${bookClubDiscussions.likeCount} - 1, 0)` })
      .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
    liked = false
  } else {
    await tx.insert(bookClubDiscussionLikes).values({ userId, discussionId: parsed.data.discussionId })
    await tx.update(bookClubDiscussions)
      .set({ likeCount: sql`${bookClubDiscussions.likeCount} + 1` })
      .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
    liked = true
  }
})
return { success: true, data: { liked } }
```

Same shape for `toggleClubReplyLikeAction` with `bookClubDiscussionReplyLikes` + `bookClubDiscussionReplies`.

- [ ] **`listClubDiscussionsAction`** — canViewClub. Order: `is_pinned DESC, created_at DESC, id DESC`. Returns rows + author profile + `viewerLiked` (two-query stitch).

- [ ] **`getClubDiscussionAction`** — canViewClub on parent's club. Returns post + reply list + viewer's like state on post + each reply.

### T9 — Notification + activity wiring audit + extras

- [ ] **Step 1:** Audit all 3 activity hook sites (createClubAction → book_club_created; addClubBookAction status=CURRENT path → book_club_current_book_changed via deriveCurrentBookTx; setCurrentBookAction → same via deriveCurrentBookTx). Confirm all gated on `visibility==='PUBLIC' && discoverable===true`.

- [ ] **Step 2:** Audit all 3 notification write sites (inviteUserToClubAction → CLUB_INVITE; joinClubAction open_join=false path → CLUB_JOIN_REQUEST multi-row fan-out; respondToJoinRequestAction accept path → CLUB_JOIN_APPROVED). Confirm `actorId + resourceType + resourceId` shape (NO payload column).

- [ ] **Step 3:** Add `getMyClubsCountAction()` returning a single int from `bookClubMembers` JOIN `bookClubs` for the community section rail count badge.

- [ ] **Step 4: Surface-shape tests** at `lib/actions/__tests__/book-clubs-actions.test.ts` — mirror `lib/actions/__tests__/reading-lists-actions.test.ts` shape. Top-level `vi.mock('@/lib/require-auth')` + `vi.mock('@/db', () => ({ db: {} }))` + mocks for predicates/derive helpers. Assert `typeof actions.X === 'function'` for all ~25 actions.

- [ ] **Step 5: Run + commit (single commit for all of T3-T9):**

```bash
npx tsc --noEmit && npm test
git add lib/actions/book-clubs.actions.ts lib/validations/book-club.ts lib/actions/__tests__/book-clubs-actions.test.ts
git commit -m "feat(c4/actions): T3-T9 ~25 book-club actions + notifications fan-out + activity hooks"
```

---

## Task 10: `/clubs` index page (replaces stub)

**Files:**
- Modify: `app/[locale]/(app)/clubs/page.tsx` (was Coming-Soon stub)
- Create: `_components/{club-card,create-club-button}.tsx` (stubs)

- [ ] **Step 1: Server component:**

```tsx
import Link from 'next/link'
import { getClubsAction } from '@/lib/actions/book-clubs.actions'
import { ClubCard } from './_components/club-card'
import { CreateClubButton } from './_components/create-club-button'
import { requireAuth } from '@/lib/require-auth'

export default async function ClubsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await requireAuth()
  const result = await getClubsAction({ filter: 'mine', limit: 20 })
  if (!result.success) {
    return <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6"><p className="text-red-400">Failed to load.</p></main>
  }
  const mine = result.data.rows

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]" style={{ fontFamily: 'var(--font-comfortaa)' }}>
            Book clubs
          </h1>
          <p className="text-sm text-[var(--canvas-dark-ink-muted)] mt-1">
            Read together. Discuss what you love.
          </p>
        </div>
        <CreateClubButton locale={locale} />
      </header>
      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          My clubs
        </h2>
        {mine.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">Create or join a club to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mine.map((club) => <ClubCard key={club.id} club={club} locale={locale} />)}
          </div>
        )}
      </section>
      <div className="text-center">
        <Link href={`/${locale}/discover?tab=clubs`} className="text-sm text-[var(--brand)] hover:underline">
          Discover more clubs →
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create stub `<ClubCard>` and `<CreateClubButton>`** — minimal stable-prop versions T12/T13 enrich later. Follow C3 T9 stub-component pattern.

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/\(app\)/clubs/page.tsx app/[locale]/\(app\)/clubs/_components/
git commit -m "feat(c4/clubs-page): index page with My clubs section + stub components"
```

---

## Task 11: `/clubs/[clubId]` detail hub

**Files:**
- Create: `app/[locale]/(app)/clubs/[clubId]/page.tsx`
- Create: `_components/{club-header,club-tab-strip}.tsx` + tab-content stubs

- [ ] **Step 1: Server component** reads `?tab=` query (default per membership), calls `getClubAction(clubId)` → `notFound()` on NOT_FOUND. Renders `<ClubHeader>` + `<ClubTabStrip>` + tab-content stub. Add tab content stubs for `<ClubAboutPanel>`, `<ClubDiscussionsPanel>`, `<ClubBooksPanel>`, `<ClubMembersPanel>`, `<ClubSchedulePanel>`, `<ClubSettingsPanel>` — all minimal placeholders T13-T18 enrich.

- [ ] **Step 2: Commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/\(app\)/clubs/\[clubId\]/
git commit -m "feat(c4/club-detail): /clubs/[clubId] hub + ClubHeader + ClubTabStrip + 6 stub panels"
```

---

## Task 12: `<CreateClubModal>` + `<EditClubMetadataDialog>`

**Files:**
- Create: `_components/{create-club-modal,edit-club-metadata-dialog}.tsx`
- Modify: `_components/create-club-button.tsx` (stub → real trigger)

- [ ] **Implementation:** Mirror C3 `<CreateListModal>` shape. Reuse C2 `<VisibilityPicker>`. Fields: name + description + rules + tags (`<TagInput>` from C3) + visibility + discoverable (3-layer defense) + Open-join toggle. Submit → `createClubAction` → router.push to `/clubs/[id]`. EditDialog pre-fills + calls `updateClubAction`.

- [ ] **Commit:**
```bash
git add app/[locale]/\(app\)/clubs/_components/{create-club-modal,edit-club-metadata-dialog,create-club-button}.tsx
git commit -m "feat(c4/ui-create): CreateClubModal + EditClubMetadataDialog + CreateClubButton trigger"
```

---

## Task 13: `<ClubAboutPanel>` + `<ClubMembersPanel>` + role-change + transfer-ownership dialogs

**Files:**
- Create: `_components/{club-about-panel,club-members-panel,role-change-dialog,transfer-ownership-dialog}.tsx`

- [ ] **`<ClubAboutPanel>`** — description + rules + tag chips + currentBook summary card + recent-activity excerpt (optional v1; can be deferred).

- [ ] **`<ClubMembersPanel>`** — member list with role pills color-coded (OWNER=brand, MOD=blue, MEMBER=muted). ⋯ kebab on each row for MOD+: Remove + Change role. Owner's row → Transfer ownership option. Leave button for self (hidden if owner).

- [ ] **`<RoleChangeDialog>`** — OWNER-only. Picks MOD or MEMBER for target.

- [ ] **`<TransferOwnershipDialog>`** — confirms + calls `transferClubOwnershipAction`.

- [ ] **Commit:**
```bash
git commit -m "feat(c4/ui-about-members): ClubAboutPanel + ClubMembersPanel + RoleChangeDialog + TransferOwnershipDialog"
```

---

## Task 14: `<ClubDiscussionsPanel>` + `<DiscussionCard>` + `<DiscussionComposer>`

**Files:**
- Create: `_components/{club-discussions-panel,discussion-card,discussion-composer}.tsx`

- [ ] **`<ClubDiscussionsPanel>`** — calls `listClubDiscussionsAction` cursor-paginated. Pinned-first sort. + New Discussion CTA for members. Empty state.

- [ ] **`<DiscussionCard>`** — title (Comfortaa) + author avatar/handle + relTime + likeCount + replyCount + pinned indicator (small "📌 Pinned" pill). Click → `/clubs/[id]/discussions/[discussionId]`.

- [ ] **`<DiscussionComposer>`** — shadcn Dialog. Title input (required, max 120) + content textarea (required, max 10000).

- [ ] **Commit:**
```bash
git commit -m "feat(c4/ui-discussions): ClubDiscussionsPanel + DiscussionCard + DiscussionComposer"
```

---

## Task 15: Single-thread page + `<DiscussionDetail>` + `<ReplyComposer>` + `<LikeButton>` + pin toggle

**Files:**
- Create: `app/[locale]/(app)/clubs/[clubId]/discussions/[discussionId]/page.tsx`
- Create: `_components/{discussion-detail,reply-composer,like-button,pin-toggle}.tsx`

- [ ] **Server page** reads `discussionId` + viewerRole, calls `getClubDiscussionAction`. Renders `<DiscussionDetail>`.

- [ ] **`<DiscussionDetail>`** — post body + author header + `<LikeButton variant="post">` + reply list (each with `<LikeButton variant="reply">`) + `<ReplyComposer>` inline below. MOD+ sees `<PinToggle>` next to post header.

- [ ] **`<LikeButton>`** — props: `{ variant: 'post' | 'reply', targetId, initialLiked, initialCount }`. Optimistic flip + rollback. Calls `toggleClubDiscussionLikeAction` or `toggleClubReplyLikeAction` per variant.

- [ ] **`<PinToggle>`** — MOD+ only. Calls `pinClubDiscussionAction({ discussionId, pin })` + router.refresh.

- [ ] **Commit:**
```bash
git commit -m "feat(c4/ui-thread): single-thread page + DiscussionDetail + ReplyComposer + LikeButton + PinToggle"
```

---

## Task 16: `<ClubBooksPanel>` + `<AddBookToClubModal>` + `<ClubBookRow>` + dnd-kit reorder

**Files:**
- Create: `_components/{club-books-panel,add-book-to-club-modal,club-book-row}.tsx`

- [ ] **`<ClubBooksPanel>`** — three sections: Currently reading (single CURRENT row or empty) + Up next (QUEUE list with dnd-kit reorder for MOD+) + Past reads (collapsed accordion of PAST). + Add book CTA opens `<AddBookToClubModal>` for MOD+.

- [ ] **`<AddBookToClubModal>`** — mirror C3 `<AddBookModal>` 2-tab pattern (Beehive search via C3's `searchBooksAction` + manual external). Plus bottom segmented control: "Add to queue" vs "Set as current."

- [ ] **`<ClubBookRow>`** — thumb (96×144 2:3) + title + author + status pill + ⋯ kebab (MOD+ only: Set as current / Edit / Remove). dnd-kit grip handle for queue rows when MOD+.

- [ ] **Commit:**
```bash
git commit -m "feat(c4/ui-books): ClubBooksPanel (3 sections) + AddBookToClubModal + ClubBookRow + dnd-kit queue reorder"
```

---

## Task 17: `<ClubSchedulePanel>` + `<AddScheduleItemModal>` + `<ScheduleItemRow>`

**Files:**
- Create: `_components/{club-schedule-panel,add-schedule-item-modal,schedule-item-row}.tsx`

- [ ] **`<ClubSchedulePanel>`** — calls `getClubScheduleAction(clubId, currentBookId)`. Timeline view ordered by `target_date ASC`. Visual indicator for past/today/future. + Add milestone CTA for MOD+. Empty state.

- [ ] **`<AddScheduleItemModal>`** — Book picker (defaults to current) + chapter start + chapter end (refine validation: end >= start) + target date picker + optional label.

- [ ] **`<ScheduleItemRow>`** — chapter range + date + label + ⋯ kebab for MOD+ (Edit / Remove).

- [ ] **Commit:**
```bash
git commit -m "feat(c4/ui-schedule): ClubSchedulePanel + AddScheduleItemModal + ScheduleItemRow"
```

---

## Task 18: `<ClubSettingsPanel>` + invite/request panels + invite-by-username/link + danger zone

**Files:**
- Create: `_components/{club-settings-panel,invite-by-username-input,invite-link-dialog,pending-invites-panel,join-requests-panel}.tsx`

- [ ] **`<ClubSettingsPanel>`** — OWNER+MOD only. Sub-sections: Metadata (mounts `<EditClubMetadataDialog>`) + Pending invites + Join requests + Invite by link + Transfer ownership + Danger zone (Delete OWNER-only).

- [ ] **`<InviteByUsernameInput>`** — debounced username search via C1 `searchUsersAction` → Pick → `inviteUserToClubAction` → sonner toast.

- [ ] **`<InviteLinkDialog>`** — `createClubInviteTokenAction` on open. Display URL + Copy button (mirror C1 friend invite-link pattern). 14-day expiry note.

- [ ] **`<PendingInvitesPanel>`** — lists outgoing invites with Cancel button (calls `cancelClubInviteAction`).

- [ ] **`<JoinRequestsPanel>`** — lists incoming pending requests with Approve/Reject buttons (MOD+, calls `respondToJoinRequestAction`).

- [ ] **Commit:**
```bash
git commit -m "feat(c4/ui-settings): ClubSettingsPanel + invite/request panels + danger zone"
```

---

## Task 19: `/discover?tab=clubs` 5th tab

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`
- Create: `app/[locale]/(public)/discover/_components/clubs-tab-content.tsx`

- [ ] **Add 5th tab** to existing tab strip (alongside Books / Sparks / Hives / Lists). Update `tab` parser to accept `'clubs'`. Conditionally render `<ClubsTabContent locale={locale} />` when active.

- [ ] **`<ClubsTabContent>`** — calls `getClubsAction({ filter: 'discover', limit: 24 })`. Renders `<ClubCard>` grid. Empty + error states. Pagination "Load more" optional (omit for first cut per C3 T14 precedent).

- [ ] **Commit:**
```bash
git commit -m "feat(c4/discover): /discover?tab=clubs 5th tab with ClubsTabContent"
```

---

## Task 20: Activity verb-map + feed subject hydration + bell notification copy

**Files:**
- Modify: `app/[locale]/(app)/community/_components/activity-event-row.tsx`
- Modify: `lib/actions/community.actions.ts`
- Modify: `app/[locale]/(app)/_components/notifications-bell.tsx`

- [ ] **Step 1: Verb-map** in `activity-event-row.tsx`:
  - `book_club_created` → "@x started a book club **{subject.title}**" (subject.title resolved via hydration)
  - `book_club_current_book_changed` → "@x's club **{payload.clubName}** is now reading **{payload.toBookTitle}**"

- [ ] **Step 2: Feed subject hydration** in `getCommunityFeedAction`:

```ts
const bookClubIds = events.filter((e) => e.subjectType === 'book_club').map((e) => e.subjectId)
let bookClubsMap = new Map<string, { id: string; name: string }>()
if (bookClubIds.length > 0) {
  const rows = await db.select({ id: bookClubs.id, name: bookClubs.name })
    .from(bookClubs)
    .where(inArray(bookClubs.id, bookClubIds))
  bookClubsMap = new Map(rows.map((c) => [c.id, c]))
}
// In row composition:
if (event.subjectType === 'book_club') {
  const club = bookClubsMap.get(event.subjectId)
  subject = { type: 'book_club', id: event.subjectId, title: club?.name ?? null }
}
```

Widen `SubjectType` union in `lib/social/types.ts` to include `'book_club'` (per C3 T3-T8 lesson — required cascade for new subjects).

- [ ] **Step 3: Bell-list copy map** in `notifications-bell.tsx`:
  - `CLUB_INVITE` → "@x invited you to club" + route to `/clubs/${clubId}` (use `resourceId`)
  - `CLUB_JOIN_REQUEST` → "@x requested to join your club" + route to `/clubs/${clubId}/settings` (need to fetch club from request to get clubId; OR change `resourceId` to clubId on insert + denorm `book_club_join_request.id` to a payload field — simpler: fetch club from request as bell-list query)
  - `CLUB_JOIN_APPROVED` → "@x approved your request" + route to `/clubs/${resourceId}`

- [ ] **Commit:**
```bash
git commit -m "feat(c4/integrations): activity verb-map + feed subject hydration + bell copy for 3 CLUB_* types"
```

---

## Task 21: Profile page Clubs section

**Files:**
- Modify: `app/[locale]/(public)/u/[username]/page.tsx`
- Add to `lib/actions/book-clubs.actions.ts`: `getUserPublicClubsAction(targetUserId, limit?)` — returns clubs the user OWNS that the viewer can see (canViewClub per row). Excludes clubs they're just a member of.

- [ ] **Step 1: New action**:

```ts
export async function getUserPublicClubsAction(targetUserId: string, limit = 5): Promise<ActionResult<ClubSummary[]>> {
  const viewerId = await getOptionalUserId()
  // Fetch clubs where ownerId = targetUserId
  // Over-fetch 2x then per-row canViewClub filter
  // Liked-like exclusion: N/A (no system clubs)
}
```

- [ ] **Step 2: Profile page section** — between existing sections. Render only when result has rows.

```tsx
{publicClubs.length > 0 && (
  <section className="mt-8">
    <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
      Clubs
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {publicClubs.map((club) => <ClubCard key={club.id} club={club} locale={locale} />)}
    </div>
  </section>
)}
```

Import `<ClubCard>` from `@/app/[locale]/(app)/clubs/_components/club-card`.

- [ ] **Commit:**
```bash
git commit -m "feat(c4/profile): Clubs section on /u/[username] + getUserPublicClubsAction"
```

---

## Task 22: `/clubs/[clubId]/invite/[token]` route + `<InviteResult>`

**Files:**
- Create: `app/[locale]/(app)/clubs/[clubId]/invite/[token]/page.tsx`
- Create: `_components/invite-result.tsx`

- [ ] **Server page** — pattern mirrors C1 `/friend-invite/[token]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { claimClubInviteTokenAction } from '@/lib/actions/book-clubs.actions'
import { InviteResult } from './_components/invite-result'

export default async function Page({ params }: { params: Promise<{ locale: string; clubId: string; token: string }> }) {
  const { locale, clubId, token } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(`/${locale}/sign-up?next=${encodeURIComponent(`/${locale}/clubs/${clubId}/invite/${token}`)}`)
  }
  const result = await claimClubInviteTokenAction({ token })
  if (!result.success) {
    return <InviteResult kind="error" code={result.error} locale={locale} />
  }
  redirect(`/${locale}/clubs/${clubId}`)
}
```

- [ ] **`<InviteResult>`** — error copy map: TOKEN_NOT_FOUND / TOKEN_EXPIRED / TOKEN_ALREADY_CLAIMED / SELF_INVITE / BLOCKED / ALREADY_MEMBER. Each with tailored copy + Back to Discover CTA. Mirrors C1 `/friend-invite/[token]/_components/invite-result.tsx`.

- [ ] **Commit:**
```bash
git commit -m "feat(c4/invite-route): /clubs/[clubId]/invite/[token] claim route + InviteResult"
```

---

## Task 23: Manual smoke + AGENTS.md + ship

- [ ] **Step 1: Full test suite + tsc**

```bash
npm test && npx tsc --noEmit
```
Expected: 540+ green, clean.

- [ ] **Step 2: Run 23-scenario smoke** from spec §11.

- [ ] **Step 3: Update AGENTS.md Resume Here** with ship summary mirroring C1/C2/C3 pattern:
- Wave SHA list (each task)
- Patterns now load-bearing (deriveCurrentBookTx; multi-row notification fan-out; two-like-tables pattern; club open-join toggle; transfer-ownership atomic tx)
- Known follow-ups
- Carry-forward smoke targets (the 23 above)

Set "Next concrete step" to: Chris picks C5 polish (mentions / notification prefs / friend-feed prioritization / final UI pass via Claude Design — closes the Community phase).

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): record C4 Book Clubs ship"
```

- [ ] **Step 5: Hand off to Chris**

"C4 Book Clubs is code-complete and ready for smoke. Walk the 23-scenario checklist; file `fix(c4): ...` commits for any bugs. After smoke passes, decide C5 polish (closes Community phase) or other priorities."

---

## Self-Review

**Spec coverage:**
- §2.1 enums → T1 ✓
- §2.2 tables → T1 ✓
- §2.3 enum extensions → T1 ✓
- §2.4 migration → T1 ✓
- §3.1 predicates → T2 ✓
- §3.2 get-membership → T2 ✓
- §3.3 derive-current-book → T2 ✓
- §4.1 club CRUD → T3 ✓
- §4.2 members + invites + requests → T4 + T5 + T6 ✓
- §4.3 books + schedule → T7 ✓
- §4.4 discussions + replies + likes → T8 ✓
- §4.5 activity hooks → T3 + T7 (via deriveCurrentBookTx) + T9 audit ✓
- §4.6 notification writes → T5 + T6 + T9 audit ✓
- §6.1 routes → T10 + T11 + T15 + T22 ✓
- §6.2 components → T12-T18 ✓
- §6.3 discover → T19 ✓
- §6.4 section rail → T9 (`getMyClubsCountAction`) + T10 (page replacement) ✓
- §6.5 profile → T21 ✓
- §6.6 activity feed → T20 ✓
- §6.7 bell copy → T20 ✓
- §7 test posture → distributed ✓

**Placeholder scan:** No "TBD" / "implement later". The "deriveCurrentBookTx" code in T2 is complete; downstream task implementations reference it. `getClubsAction`/`updateClubAction`/`deleteClubAction` bodies are described prose-style with reference to spec + C3 patterns — implementer fills following established convention. Acceptable since spec has full action contracts.

**Type consistency:**
- `BookClubMemberRole` from schema → predicates → action guards → UI affordances. Names match.
- `BookClubBookStatus` (CURRENT | PAST | QUEUE) flows from schema → action input → UI status pill.
- `ClubSummary` shape declared in T3 → used in `<ClubCard>` props (T10+T12+T13+T19+T21).
- `deriveCurrentBookTx` signature stable across consumers (T7 addClubBookAction + setCurrentBookAction).

No drift detected. Plan locked.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-c4-book-clubs.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh implementer per task + per-task review + per-task commits. Matches C1-C3 cadence.

2. **Inline Execution** — execute in current session via executing-plans, batched with checkpoints.

For C4: subagent-driven is strongly recommended given 23 tasks. Wave shape from spec §8:
- W1 = T1 alone (schema — sequential prereq)
- W2 = T2 alone (helpers — sequential prereq)
- W3 = T3-T9 combined-single (server actions — same-file race avoidance per C2/C3 Wave 3 precedent)
- W4 = T10 + T11 sequential (page + detail hub — stubs ensure tsc clean)
- W5 = T12-T18 parallel (7-way UI dispatch — separate component scopes)
- W6 = T19-T22 parallel (4-way integration dispatch — separate files)
- W7 = T23 smoke + ship

Chris picks execution mode when ready.
