# Hive Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Hive collaboration workspace — co-authoring, shared outline/wiki, inline comments, discussion, tasks, notifications, and community discovery.

**Architecture:** Async collaboration (no WebSockets). Chapter soft-locks advisory only. All content stored in Postgres via Drizzle. Hive workspace at `/[locale]/hive/[hiveId]` with sidebar nav mirroring the Studio.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Drizzle ORM, TipTap v3, Zod, cuid2

---

## Task 1: DB Schema Additions

**Files:**
- Modify: `db/schema/hive.ts`
- Modify: `db/schema/social.ts`

- [ ] **Step 1: Extend notification enum in `db/schema/social.ts`**

Replace the `notificationTypeEnum` line:
```ts
export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_FOLLOWER', 'NEW_LIKE', 'NEW_COMMENT', 'NEW_CHAPTER',
  'HIVE_INVITE', 'HIVE_SUBMISSION', 'HIVE_SUGGESTION', 'SPARK_WIN',
  'HIVE_JOIN_REQUEST', 'HIVE_JOIN_APPROVED', 'HIVE_MEMBER_JOINED',
  'CHAPTER_EDITED', 'HIVE_COMMENT', 'TASK_ASSIGNED', 'TASK_COMPLETED',
])
```

- [ ] **Step 2: Update `hiveInvites` and add new tables to `db/schema/hive.ts`**

Add `integer` to the import. Then replace the `hiveInvites` table definition and append new tables:

```ts
import { pgTable, text, timestamp, pgEnum, index, boolean, integer } from 'drizzle-orm/pg-core'
```

Replace `hiveInvites`:
```ts
export const hiveInvites = pgTable('hive_invites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  inviteeId: text('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').unique(),
  role: hiveMemberRoleEnum('role').default('CONTRIBUTOR').notNull(),
  status: hiveInviteStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

Append after the existing tables (before relations):
```ts
export const hiveOutlines = pgTable('hive_outlines', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().unique().references(() => hives.id, { onDelete: 'cascade' }),
  content: text('content'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const hiveWikiPages = pgTable('hive_wiki_pages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('hive_wiki_pages_hive_id_idx').on(t.hiveId)])

export const hiveTasks = pgTable('hive_tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('OPEN'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('hive_tasks_hive_id_idx').on(t.hiveId)])

export const hiveDiscussionPosts = pgTable('hive_discussion_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  hiveId: text('hive_id').notNull().references(() => hives.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: text('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('hive_discussion_posts_hive_id_idx').on(t.hiveId)])

export const hiveChapterLocks = pgTable('hive_chapter_locks', {
  chapterId: text('chapter_id').notNull().primaryKey().references(() => chapters.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lockedAt: timestamp('locked_at').defaultNow().notNull(),
})
```

- [ ] **Step 3: Push schema to DB**

```bash
npx drizzle-kit push
```

Expected: all new tables created, enum values added, `hive_invites.invitee_id` made nullable.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add db/schema/hive.ts db/schema/social.ts
git commit -m "feat: add hive collaboration tables and extend notification enum"
```

---

## Task 2: Shared Helpers + Zod Schemas

**Files:**
- Modify: `lib/actions/_helpers.ts`
- Create: `lib/validations/hive.ts`

- [ ] **Step 1: Add `assertHiveMember` to `lib/actions/_helpers.ts`**

```ts
import { hives, hiveMembers } from '@/db/schema'

/** Verifies caller is a member of the hive. Returns the member row. */
export async function assertHiveMember(hiveId: string, userId: string) {
  const member = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, userId)),
  })
  if (!member) throw new Error('Not a member of this hive')
  return member
}

/** Verifies caller is the hive owner. */
export async function assertHiveOwner(hiveId: string, userId: string) {
  const hive = await db.query.hives.findFirst({
    where: and(eq(hives.id, hiveId), eq(hives.ownerId, userId)),
    columns: { id: true },
  })
  if (!hive) throw new Error('Hive not found or access denied')
}

/** Verifies caller is owner or has EDITOR role. */
export async function assertHiveAdmin(hiveId: string, userId: string) {
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { ownerId: true },
  })
  if (!hive) throw new Error('Hive not found')
  if (hive.ownerId === userId) return
  const member = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, userId), eq(hiveMembers.role, 'EDITOR')),
  })
  if (!member) throw new Error('Admin access required')
}
```

- [ ] **Step 2: Create `lib/validations/hive.ts`**

```ts
import { z } from 'zod'

export const createHiveSchema = z.object({
  bookId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']).default('PRIVATE'),
})

export const updateHiveSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
})

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  assigneeId: z.string().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
})
```

- [ ] **Step 3: Write unit tests in `lib/validations/__tests__/hive.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createHiveSchema, createTaskSchema, updateTaskSchema } from '../hive'

describe('createHiveSchema', () => {
  it('accepts valid input', () => {
    const result = createHiveSchema.safeParse({ bookId: 'abc', name: 'My Hive' })
    expect(result.success).toBe(true)
  })
  it('rejects empty name', () => {
    const result = createHiveSchema.safeParse({ bookId: 'abc', name: '' })
    expect(result.success).toBe(false)
  })
  it('rejects missing bookId', () => {
    const result = createHiveSchema.safeParse({ name: 'My Hive' })
    expect(result.success).toBe(false)
  })
})

describe('updateTaskSchema', () => {
  it('accepts valid status', () => {
    const result = updateTaskSchema.safeParse({ status: 'IN_PROGRESS' })
    expect(result.success).toBe(true)
  })
  it('rejects invalid status', () => {
    const result = updateTaskSchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/_helpers.ts lib/validations/hive.ts lib/validations/__tests__/hive.test.ts
git commit -m "feat: hive helpers and Zod schemas"
```

---

## Task 3: Hive Management + Membership Actions

**Files:**
- Create: `lib/actions/hive.actions.ts`

- [ ] **Step 1: Create `lib/actions/hive.actions.ts` with management actions**

```ts
'use server'

import { db } from '@/db'
import { hives, hiveMembers, hiveInvites, notifications } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveOwner, assertHiveAdmin } from './_helpers'
import { getUserPremiumStatus, FREE_HIVE_LIMIT, FREE_HIVE_MEMBER_LIMIT } from '@/lib/premium'
import { createHiveSchema, updateHiveSchema } from '@/lib/validations/hive'
import { createId } from '@paralleldrive/cuid2'
import type { ActionResult } from './book.actions'

export type HiveSummary = {
  id: string
  bookId: string | null
  name: string
  description: string | null
  visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  status: 'ACTIVE' | 'COMPLETED'
  ownerId: string
  memberCount: number
  createdAt: Date
}

export type HiveMemberRow = {
  id: string
  hiveId: string
  userId: string
  role: 'OWNER' | 'CONTRIBUTOR' | 'EDITOR' | 'BETA_READER' | 'PROOFREADER'
  joinedAt: Date
  user: { name: string | null; email: string; image: string | null }
}

async function getHiveCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(hives)
    .where(eq(hives.ownerId, userId))
  return Number(rows[0]?.count ?? 0)
}

async function getHiveMemberCount(hiveId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(hiveMembers)
    .where(eq(hiveMembers.hiveId, hiveId))
  return Number(rows[0]?.count ?? 0)
}

export async function createHiveAction(input: {
  bookId: string
  name: string
  description?: string
  visibility?: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
}): Promise<ActionResult<{ hiveId: string }>> {
  const userId = await requireAuth()
  const parsed = createHiveSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium && (await getHiveCount(userId)) >= FREE_HIVE_LIMIT) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const hiveId = createId()
  await db.transaction(async (tx) => {
    await tx.insert(hives).values({
      id: hiveId,
      bookId: parsed.data.bookId,
      ownerId: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      visibility: parsed.data.visibility ?? 'PRIVATE',
    })
    await tx.insert(hiveMembers).values({
      hiveId,
      userId,
      role: 'OWNER',
    })
  })

  return { success: true, data: { hiveId } }
}

export async function getHiveAction(hiveId: string): Promise<ActionResult<{
  hive: typeof hives.$inferSelect
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
}>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)

  const hive = await db.query.hives.findFirst({ where: eq(hives.id, hiveId) })
  if (!hive) return { success: false, error: 'Hive not found' }

  const members = await db.query.hiveMembers.findMany({
    where: eq(hiveMembers.hiveId, hiveId),
    with: { user: { columns: { name: true, email: true, image: true } } },
  })

  const myMember = members.find(m => m.userId === userId)
  const isOwner = hive.ownerId === userId
  const isEditor = isOwner || myMember?.role === 'EDITOR'

  return { success: true, data: { hive, members: members as HiveMemberRow[], isOwner, isEditor } }
}

export async function getUserHivesAction(): Promise<ActionResult<HiveSummary[]>> {
  const userId = await requireAuth()

  const memberships = await db.query.hiveMembers.findMany({
    where: eq(hiveMembers.userId, userId),
    with: { hive: true },
  })

  const summaries: HiveSummary[] = memberships.map(m => ({
    id: m.hive.id,
    bookId: m.hive.bookId,
    name: m.hive.name,
    description: m.hive.description,
    visibility: m.hive.visibility,
    status: m.hive.status,
    ownerId: m.hive.ownerId,
    memberCount: 0,
    createdAt: m.hive.createdAt,
  }))

  return { success: true, data: summaries }
}

export async function updateHiveAction(hiveId: string, input: {
  name?: string
  description?: string | null
  visibility?: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  status?: 'ACTIVE' | 'COMPLETED'
}): Promise<ActionResult> {
  const userId = await requireAuth()
  const parsed = updateHiveSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  await assertHiveAdmin(hiveId, userId)

  const updates: Partial<typeof hives.$inferInsert> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (Object.keys(updates).length === 0) return { success: true, data: undefined }

  await db.update(hives).set({ ...updates, updatedAt: new Date() }).where(eq(hives.id, hiveId))
  return { success: true, data: undefined }
}

export async function deleteHiveAction(hiveId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveOwner(hiveId, userId)
  await db.delete(hives).where(eq(hives.id, hiveId))
  return { success: true, data: undefined }
}
```

- [ ] **Step 2: Add membership actions to the same file**

```ts
export async function inviteMemberByUsernameAction(hiveId: string, username: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveAdmin(hiveId, userId)

  const { users: usersTable, userProfiles } = await import('@/db/schema')
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.username, username),
    columns: { userId: true },
  })
  if (!profile) return { success: false, error: 'User not found' }

  const hive = await db.query.hives.findFirst({ where: eq(hives.id, hiveId), columns: { ownerId: true } })
  if (!hive) return { success: false, error: 'Hive not found' }

  const isPremium = await getUserPremiumStatus(hive.ownerId)
  const memberCount = await getHiveMemberCount(hiveId)
  if (!isPremium && memberCount >= FREE_HIVE_MEMBER_LIMIT) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const existing = await db.query.hiveInvites.findFirst({
    where: and(eq(hiveInvites.hiveId, hiveId), eq(hiveInvites.inviteeId, profile.userId), eq(hiveInvites.status, 'PENDING')),
  })
  if (existing) return { success: false, error: 'Already invited' }

  await db.insert(hiveInvites).values({ hiveId, inviteeId: profile.userId })
  await db.insert(notifications).values({
    userId: profile.userId,
    type: 'HIVE_INVITE',
    actorId: userId,
    resourceType: 'hive',
    resourceId: hiveId,
  })
  return { success: true, data: undefined }
}

export async function generateInviteLinkAction(hiveId: string): Promise<ActionResult<{ token: string }>> {
  const userId = await requireAuth()
  await assertHiveAdmin(hiveId, userId)

  const token = createId()
  await db.insert(hiveInvites).values({ hiveId, token, inviteeId: null })
  return { success: true, data: { token } }
}

export async function joinHiveByLinkAction(token: string): Promise<ActionResult<{ hiveId: string }>> {
  const userId = await requireAuth()

  const invite = await db.query.hiveInvites.findFirst({
    where: and(eq(hiveInvites.token, token), eq(hiveInvites.status, 'PENDING')),
  })
  if (!invite) return { success: false, error: 'Invite link invalid or expired' }

  const hive = await db.query.hives.findFirst({ where: eq(hives.id, invite.hiveId), columns: { ownerId: true } })
  if (!hive) return { success: false, error: 'Hive not found' }

  const isPremium = await getUserPremiumStatus(hive.ownerId)
  const memberCount = await getHiveMemberCount(invite.hiveId)
  if (!isPremium && memberCount >= FREE_HIVE_MEMBER_LIMIT) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const alreadyMember = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, invite.hiveId), eq(hiveMembers.userId, userId)),
  })
  if (alreadyMember) return { success: true, data: { hiveId: invite.hiveId } }

  await db.insert(hiveMembers).values({ hiveId: invite.hiveId, userId, role: invite.role })
  return { success: true, data: { hiveId: invite.hiveId } }
}

export async function acceptHiveInviteAction(inviteId: string): Promise<ActionResult<{ hiveId: string }>> {
  const userId = await requireAuth()

  const invite = await db.query.hiveInvites.findFirst({
    where: and(eq(hiveInvites.id, inviteId), eq(hiveInvites.inviteeId, userId), eq(hiveInvites.status, 'PENDING')),
  })
  if (!invite) return { success: false, error: 'Invite not found' }

  await db.transaction(async (tx) => {
    await tx.update(hiveInvites).set({ status: 'ACCEPTED' }).where(eq(hiveInvites.id, inviteId))
    await tx.insert(hiveMembers).values({ hiveId: invite.hiveId, userId, role: invite.role })
  })
  return { success: true, data: { hiveId: invite.hiveId } }
}

export async function declineHiveInviteAction(inviteId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(hiveInvites)
    .set({ status: 'DECLINED' })
    .where(and(eq(hiveInvites.id, inviteId), eq(hiveInvites.inviteeId, userId)))
  return { success: true, data: undefined }
}

export async function removeMemberAction(hiveId: string, targetUserId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveAdmin(hiveId, userId)
  await db.delete(hiveMembers).where(and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, targetUserId)))
  return { success: true, data: undefined }
}

export async function updateMemberRoleAction(hiveId: string, targetUserId: string, role: 'CONTRIBUTOR' | 'EDITOR' | 'BETA_READER' | 'PROOFREADER' | 'OWNER'): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveOwner(hiveId, userId)
  await db.update(hiveMembers).set({ role }).where(and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, targetUserId)))
  return { success: true, data: undefined }
}

export async function leaveHiveAction(hiveId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const hive = await db.query.hives.findFirst({ where: eq(hives.id, hiveId), columns: { ownerId: true } })
  if (!hive) return { success: false, error: 'Hive not found' }
  if (hive.ownerId === userId) return { success: false, error: 'OWNER_MUST_TRANSFER_OR_DELETE' }
  await db.delete(hiveMembers).where(and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, userId)))
  return { success: true, data: undefined }
}

export async function getPublicHivesAction(): Promise<ActionResult<HiveSummary[]>> {
  await requireAuth()
  const rows = await db.query.hives.findMany({
    where: eq(hives.visibility, 'PUBLIC'),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 50,
  })
  const summaries: HiveSummary[] = rows.map(h => ({
    id: h.id, bookId: h.bookId, name: h.name, description: h.description,
    visibility: h.visibility, status: h.status, ownerId: h.ownerId,
    memberCount: 0, createdAt: h.createdAt,
  }))
  return { success: true, data: summaries }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/hive.actions.ts lib/actions/_helpers.ts
git commit -m "feat: hive management and membership server actions"
```

---

## Task 4: Notifications Actions

**Files:**
- Create: `lib/actions/notifications.actions.ts`

- [ ] **Step 1: Create `lib/actions/notifications.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { notifications } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'

export type NotificationRow = {
  id: string
  type: string
  actorId: string | null
  resourceType: string | null
  resourceId: string | null
  read: boolean
  createdAt: Date
  actor: { name: string | null; image: string | null } | null
}

export async function getNotificationsAction(): Promise<ActionResult<{ notifications: NotificationRow[]; unreadCount: number }>> {
  const userId = await requireAuth()

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit: 30,
    with: {
      actor: { columns: { name: true, image: true } },
    },
  })

  const unreadCount = rows.filter(n => !n.read).length
  return { success: true, data: { notifications: rows as NotificationRow[], unreadCount } }
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notificationId))
  return { success: true, data: undefined }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId))
  return { success: true, data: undefined }
}
```

- [ ] **Step 2: Add notifications relation to `db/schema/social.ts`**

In the relations section at the bottom of `social.ts`, add:
```ts
import { users } from './auth'

export const notificationsRelations = relations(notifications, ({ one }) => ({
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
}))
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add lib/actions/notifications.actions.ts db/schema/social.ts
git commit -m "feat: notifications server actions"
```

---

## Task 5: Chapter Locks + Comments Actions

**Files:**
- Create: `lib/actions/hive-collab.actions.ts`

- [ ] **Step 1: Create `lib/actions/hive-collab.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { hiveChapterLocks, hiveComments, notifications, chapters } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember } from './_helpers'
import type { ActionResult } from './book.actions'

export type CommentRow = {
  id: string
  chapterId: string
  authorId: string
  anchorStart: string | null
  anchorEnd: string | null
  content: string
  resolved: Date | null
  createdAt: Date
  author: { name: string | null; image: string | null }
}

export async function lockChapterAction(hiveId: string, chapterId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  await db.insert(hiveChapterLocks)
    .values({ chapterId, userId })
    .onConflictDoUpdate({ target: hiveChapterLocks.chapterId, set: { userId, lockedAt: new Date() } })
  return { success: true, data: undefined }
}

export async function unlockChapterAction(chapterId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.delete(hiveChapterLocks)
    .where(and(eq(hiveChapterLocks.chapterId, chapterId), eq(hiveChapterLocks.userId, userId)))
  return { success: true, data: undefined }
}

export async function getHiveChapterLocksAction(hiveId: string): Promise<ActionResult<Record<string, { userId: string; lockedAt: Date }>>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)

  const locks = await db.query.hiveChapterLocks.findMany({
    with: { chapter: { columns: { binderItemId: true } } },
  })

  const map: Record<string, { userId: string; lockedAt: Date }> = {}
  for (const lock of locks) {
    if (lock.chapter?.binderItemId) {
      map[lock.chapter.binderItemId] = { userId: lock.userId, lockedAt: lock.lockedAt }
    }
  }
  return { success: true, data: map }
}

export async function createHiveCommentAction(
  hiveId: string,
  chapterId: string,
  content: string,
  anchorStart?: string,
  anchorEnd?: string,
): Promise<ActionResult<{ commentId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)

  const [comment] = await db.insert(hiveComments)
    .values({ hiveId, chapterId, authorId: userId, content, anchorStart: anchorStart ?? null, anchorEnd: anchorEnd ?? null })
    .returning({ id: hiveComments.id })

  // Notify chapter's last editor (simplified: notify hive owner)
  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    with: { book: { columns: { userId: true } } },
  })
  if (chapter?.book?.userId && chapter.book.userId !== userId) {
    await db.insert(notifications).values({
      userId: chapter.book.userId,
      type: 'HIVE_COMMENT',
      actorId: userId,
      resourceType: 'chapter',
      resourceId: chapterId,
    })
  }

  return { success: true, data: { commentId: comment.id } }
}

export async function resolveHiveCommentAction(commentId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(hiveComments)
    .set({ resolved: new Date() })
    .where(eq(hiveComments.id, commentId))
  return { success: true, data: undefined }
}

export async function getChapterCommentsAction(chapterId: string): Promise<ActionResult<CommentRow[]>> {
  const userId = await requireAuth()
  const rows = await db.query.hiveComments.findMany({
    where: eq(hiveComments.chapterId, chapterId),
    with: { author: { columns: { name: true, image: true } } },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })
  return { success: true, data: rows as CommentRow[] }
}
```

- [ ] **Step 2: Add relations for new tables to `db/schema/hive.ts`**

```ts
export const hiveChapterLocksRelations = relations(hiveChapterLocks, ({ one }) => ({
  chapter: one(chapters, { fields: [hiveChapterLocks.chapterId], references: [chapters.id] }),
  user: one(users, { fields: [hiveChapterLocks.userId], references: [users.id] }),
}))

export const hiveWikiPagesRelations = relations(hiveWikiPages, ({ one }) => ({
  hive: one(hives, { fields: [hiveWikiPages.hiveId], references: [hives.id] }),
  creator: one(users, { fields: [hiveWikiPages.createdBy], references: [users.id] }),
}))

export const hiveTasksRelations = relations(hiveTasks, ({ one }) => ({
  hive: one(hives, { fields: [hiveTasks.hiveId], references: [hives.id] }),
  assignee: one(users, { fields: [hiveTasks.assigneeId], references: [users.id] }),
  creator: one(users, { fields: [hiveTasks.creatorId], references: [users.id], relationName: 'task_creator' }),
}))

export const hiveDiscussionPostsRelations = relations(hiveDiscussionPosts, ({ one, many }) => ({
  hive: one(hives, { fields: [hiveDiscussionPosts.hiveId], references: [hives.id] }),
  author: one(users, { fields: [hiveDiscussionPosts.authorId], references: [users.id] }),
}))

export const hiveOutlinesRelations = relations(hiveOutlines, ({ one }) => ({
  hive: one(hives, { fields: [hiveOutlines.hiveId], references: [hives.id] }),
}))
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add lib/actions/hive-collab.actions.ts db/schema/hive.ts
git commit -m "feat: chapter locks and inline comments actions"
```

---

## Task 6: Outline, Wiki, Discussion, Tasks Actions

**Files:**
- Create: `lib/actions/hive-content.actions.ts`

- [ ] **Step 1: Create `lib/actions/hive-content.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { hiveOutlines, hiveWikiPages, hiveDiscussionPosts, hiveTasks, notifications } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveAdmin } from './_helpers'
import { createTaskSchema, updateTaskSchema } from '@/lib/validations/hive'
import type { ActionResult } from './book.actions'

// ── Outline ───────────────────────────────────────────────────────────────────

export async function getHiveOutlineAction(hiveId: string): Promise<ActionResult<{ content: string | null }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const outline = await db.query.hiveOutlines.findFirst({ where: eq(hiveOutlines.hiveId, hiveId) })
  return { success: true, data: { content: outline?.content ?? null } }
}

export async function saveHiveOutlineAction(hiveId: string, content: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  await db.insert(hiveOutlines)
    .values({ hiveId, content })
    .onConflictDoUpdate({ target: hiveOutlines.hiveId, set: { content, updatedAt: new Date() } })
  return { success: true, data: undefined }
}

// ── Wiki ──────────────────────────────────────────────────────────────────────

export type WikiPageSummary = { id: string; title: string; updatedAt: Date }
export type WikiPageFull = WikiPageSummary & { content: string | null; hiveId: string }

export async function getWikiPagesAction(hiveId: string): Promise<ActionResult<WikiPageSummary[]>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const pages = await db.query.hiveWikiPages.findMany({
    where: eq(hiveWikiPages.hiveId, hiveId),
    columns: { id: true, title: true, updatedAt: true },
    orderBy: (t, { asc }) => [asc(t.title)],
  })
  return { success: true, data: pages }
}

export async function createWikiPageAction(hiveId: string, title: string): Promise<ActionResult<{ pageId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const [page] = await db.insert(hiveWikiPages)
    .values({ hiveId, title, createdBy: userId })
    .returning({ id: hiveWikiPages.id })
  return { success: true, data: { pageId: page.id } }
}

export async function getWikiPageAction(pageId: string): Promise<ActionResult<WikiPageFull>> {
  const userId = await requireAuth()
  const page = await db.query.hiveWikiPages.findFirst({ where: eq(hiveWikiPages.id, pageId) })
  if (!page) return { success: false, error: 'Page not found' }
  await assertHiveMember(page.hiveId, userId)
  return { success: true, data: page }
}

export async function saveWikiPageAction(pageId: string, content: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const page = await db.query.hiveWikiPages.findFirst({ where: eq(hiveWikiPages.id, pageId), columns: { hiveId: true } })
  if (!page) return { success: false, error: 'Page not found' }
  await assertHiveMember(page.hiveId, userId)
  await db.update(hiveWikiPages).set({ content, updatedBy: userId, updatedAt: new Date() }).where(eq(hiveWikiPages.id, pageId))
  return { success: true, data: undefined }
}

export async function deleteWikiPageAction(pageId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const page = await db.query.hiveWikiPages.findFirst({ where: eq(hiveWikiPages.id, pageId), columns: { hiveId: true } })
  if (!page) return { success: false, error: 'Page not found' }
  await assertHiveMember(page.hiveId, userId)
  await db.delete(hiveWikiPages).where(eq(hiveWikiPages.id, pageId))
  return { success: true, data: undefined }
}

// ── Discussion ────────────────────────────────────────────────────────────────

export type DiscussionPost = {
  id: string
  hiveId: string
  authorId: string
  content: string
  parentId: string | null
  createdAt: Date
  author: { name: string | null; image: string | null }
}

export async function getDiscussionPostsAction(hiveId: string): Promise<ActionResult<DiscussionPost[]>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const posts = await db.query.hiveDiscussionPosts.findMany({
    where: eq(hiveDiscussionPosts.hiveId, hiveId),
    with: { author: { columns: { name: true, image: true } } },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })
  return { success: true, data: posts as DiscussionPost[] }
}

export async function createDiscussionPostAction(hiveId: string, content: string, parentId?: string): Promise<ActionResult<{ postId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  if (!content.trim()) return { success: false, error: 'Content required' }
  const [post] = await db.insert(hiveDiscussionPosts)
    .values({ hiveId, authorId: userId, content: content.trim(), parentId: parentId ?? null })
    .returning({ id: hiveDiscussionPosts.id })
  return { success: true, data: { postId: post.id } }
}

export async function deleteDiscussionPostAction(postId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const post = await db.query.hiveDiscussionPosts.findFirst({ where: eq(hiveDiscussionPosts.id, postId) })
  if (!post) return { success: false, error: 'Post not found' }
  await assertHiveMember(post.hiveId, userId)
  if (post.authorId !== userId) await assertHiveAdmin(post.hiveId, userId)
  await db.delete(hiveDiscussionPosts).where(eq(hiveDiscussionPosts.id, postId))
  return { success: true, data: undefined }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskRow = {
  id: string
  hiveId: string
  title: string
  description: string | null
  assigneeId: string | null
  creatorId: string
  status: string
  createdAt: Date
  assignee: { name: string | null; image: string | null } | null
}

export async function getTasksAction(hiveId: string): Promise<ActionResult<TaskRow[]>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const tasks = await db.query.hiveTasks.findMany({
    where: eq(hiveTasks.hiveId, hiveId),
    with: { assignee: { columns: { name: true, image: true } } },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })
  return { success: true, data: tasks as TaskRow[] }
}

export async function createTaskAction(hiveId: string, input: {
  title: string
  description?: string
  assigneeId?: string
}): Promise<ActionResult<{ taskId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const [task] = await db.insert(hiveTasks)
    .values({ hiveId, creatorId: userId, ...parsed.data })
    .returning({ id: hiveTasks.id })

  if (parsed.data.assigneeId && parsed.data.assigneeId !== userId) {
    await db.insert(notifications).values({
      userId: parsed.data.assigneeId,
      type: 'TASK_ASSIGNED',
      actorId: userId,
      resourceType: 'hive_task',
      resourceId: task.id,
    })
  }

  return { success: true, data: { taskId: task.id } }
}

export async function updateTaskAction(taskId: string, input: {
  title?: string
  description?: string | null
  assigneeId?: string | null
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE'
}): Promise<ActionResult> {
  const userId = await requireAuth()
  const task = await db.query.hiveTasks.findFirst({ where: eq(hiveTasks.id, taskId) })
  if (!task) return { success: false, error: 'Task not found' }
  await assertHiveMember(task.hiveId, userId)

  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  await db.update(hiveTasks).set({ ...parsed.data, updatedAt: new Date() }).where(eq(hiveTasks.id, taskId))

  if (parsed.data.status === 'DONE' && task.creatorId !== userId) {
    await db.insert(notifications).values({
      userId: task.creatorId,
      type: 'TASK_COMPLETED',
      actorId: userId,
      resourceType: 'hive_task',
      resourceId: taskId,
    })
  }

  return { success: true, data: undefined }
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const task = await db.query.hiveTasks.findFirst({ where: eq(hiveTasks.id, taskId) })
  if (!task) return { success: false, error: 'Task not found' }
  if (task.creatorId !== userId) await assertHiveAdmin(task.hiveId, userId)
  await db.delete(hiveTasks).where(eq(hiveTasks.id, taskId))
  return { success: true, data: undefined }
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit
git add lib/actions/hive-content.actions.ts
git commit -m "feat: outline, wiki, discussion, and tasks server actions"
```

---

## Task 7: Hive Route Layout + Sidebar

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/layout.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  locale: string
  hiveName: string
  isOwner: boolean
  isEditor: boolean
}

const NAV_ITEMS = [
  { label: 'Overview', icon: '📋', segment: '' },
  { label: 'Binder', icon: '📄', segment: '/binder' },
  { label: 'Outline', icon: '📝', segment: '/outline' },
  { label: 'Wiki', icon: '🌍', segment: '/wiki' },
  { label: 'Discussion', icon: '💬', segment: '/discussion' },
  { label: 'Tasks', icon: '✅', segment: '/tasks' },
  { label: 'Members', icon: '👥', segment: '/members' },
]

export function HiveSidebar({ hiveId, locale, hiveName, isOwner, isEditor }: Props) {
  const pathname = usePathname()
  const base = `/${locale}/hive/${hiveId}`

  function isActive(segment: string) {
    if (segment === '') return pathname === base
    return pathname.startsWith(base + segment)
  }

  return (
    <aside className="w-44 flex-shrink-0 flex flex-col bg-card border-r border-border">
      <div className="px-3 py-4 border-b border-border">
        <span className="text-xs font-bold text-brand truncate block">🐝 {hiveName}</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(({ label, icon, segment }) => (
          <Link
            key={segment}
            href={base + segment}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
              isActive(segment)
                ? 'bg-brand/10 text-brand'
                : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
            )}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {(isOwner || isEditor) && (
        <div className="p-2 border-t border-border">
          <Link
            href={`${base}/settings`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground/40 hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <span>⚙</span>
            <span>Settings</span>
          </Link>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/layout.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveSidebar } from './_components/hive-sidebar'

export default async function HiveLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; hiveId: string }>
}) {
  const { locale, hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, isOwner, isEditor } = result.data

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
      <HiveSidebar
        hiveId={hiveId}
        locale={locale}
        hiveName={hive.name}
        isOwner={isOwner}
        isEditor={isEditor}
      />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/
git commit -m "feat: hive route layout and sidebar"
```

---

## Task 8: Hive Overview Page

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-overview.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-overview.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import type { TaskRow } from '@/lib/actions/hive-content.actions'

type Props = {
  hive: { id: string; name: string; description: string | null; visibility: string; bookId: string | null }
  members: HiveMemberRow[]
  tasks: TaskRow[]
  isOwner: boolean
  locale: string
}

export function HiveOverview({ hive, members, tasks, isOwner, locale }: Props) {
  const openTasks = tasks.filter(t => t.status !== 'DONE')

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Book info bar */}
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">{hive.name}</h1>
          {hive.description && <p className="text-xs text-muted-foreground mt-0.5">{hive.description}</p>}
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-surface-elevated text-muted-foreground border border-border">
          {hive.visibility}
        </span>
        <span className="text-xs text-muted-foreground">{members.length} members</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Members */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Members</h2>
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
                  {m.user.image ? <img src={m.user.image} alt="" className="w-full h-full object-cover" /> : (m.user.name?.[0] ?? '?')}
                </div>
                <span className="text-xs text-foreground flex-1">{m.user.name ?? m.user.email}</span>
                <span className="text-[10px] text-muted-foreground">{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Open tasks */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Open Tasks</h2>
          {openTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open tasks.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {openTasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-border rounded-sm flex-shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{t.title}</span>
                  {t.assignee && (
                    <span className="text-[10px] text-muted-foreground">{t.assignee.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getTasksAction } from '@/lib/actions/hive-content.actions'
import { HiveOverview } from './_components/hive-overview'

export default async function HivePage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params

  const [hiveResult, tasksResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getTasksAction(hiveId).catch(() => ({ success: true, data: [] as any[] })),
  ])

  if (!hiveResult?.success) notFound()

  return (
    <HiveOverview
      hive={hiveResult.data.hive}
      members={hiveResult.data.members}
      tasks={tasksResult?.success ? tasksResult.data : []}
      isOwner={hiveResult.data.isOwner}
      locale={locale}
    />
  )
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/page.tsx app/[locale]/\(app\)/hive/[hiveId]/_components/hive-overview.tsx
git commit -m "feat: hive overview page"
```

---

## Task 9: Shared Binder + Chapter Comments

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/binder/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-chapter-comments.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-chapter-comments.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { CommentRow } from '@/lib/actions/hive-collab.actions'
import { createHiveCommentAction, resolveHiveCommentAction } from '@/lib/actions/hive-collab.actions'

type Props = {
  hiveId: string
  chapterId: string
  comments: CommentRow[]
  onCommentAdded: () => void
}

export function HiveChapterComments({ hiveId, chapterId, comments, onCommentAdded }: Props) {
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    await createHiveCommentAction(hiveId, chapterId, newComment.trim())
    setNewComment('')
    setSubmitting(false)
    onCommentAdded()
  }

  async function handleResolve(commentId: string) {
    await resolveHiveCommentAction(commentId)
    onCommentAdded()
  }

  return (
    <div className="w-52 border-l border-border bg-card flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Comments
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {comments.map(c => (
          <div key={c.id} className={cn('rounded-md p-2 text-xs border-l-2', c.resolved ? 'opacity-50 border-border' : 'border-brand bg-surface-elevated')}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-foreground font-medium">{c.author.name ?? 'Unknown'}</span>
              <span className="text-muted-foreground ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            {c.anchorStart && (
              <p className="text-muted-foreground italic mb-1 truncate">"{c.anchorStart}"</p>
            )}
            <p className="text-foreground/80 leading-relaxed">{c.content}</p>
            {!c.resolved && (
              <button onClick={() => handleResolve(c.id)} className="mt-1 text-muted-foreground hover:text-foreground transition-colors">
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-border flex flex-col gap-1.5">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          className="resize-none bg-surface-inset border border-border rounded p-1.5 text-xs outline-none focus:border-brand/40 min-h-14"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="text-xs px-2 py-1 rounded bg-brand text-black font-medium disabled:opacity-40"
        >
          Comment
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/binder/page.tsx`**

This page reuses the Studio's binder architecture but adds the Hive context (locks + comments):

```tsx
import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { getHiveChapterLocksAction } from '@/lib/actions/hive-collab.actions'
import { HiveBinder } from '../_components/hive-binder'

export default async function HiveBinderPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params

  const [hiveResult, locksResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getHiveChapterLocksAction(hiveId).catch(() => ({ success: true, data: {} })),
  ])

  if (!hiveResult?.success) notFound()
  const { hive } = hiveResult.data
  if (!hive.bookId) return <div className="p-8 text-sm text-muted-foreground">No book linked to this Hive.</div>

  const binderResult = await getBinderTreeAction(hive.bookId).catch(() => null)
  if (!binderResult?.success) notFound()

  return (
    <HiveBinder
      hiveId={hiveId}
      bookId={hive.bookId}
      initialBinderItems={binderResult.data}
      initialLocks={locksResult?.success ? locksResult.data : {}}
      members={hiveResult.data.members}
    />
  )
}
```

- [ ] **Step 3: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-binder.tsx`**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import { lockChapterAction, unlockChapterAction, getChapterCommentsAction } from '@/lib/actions/hive-collab.actions'
import { HiveChapterComments } from './hive-chapter-comments'
import { BookEditorProvider } from '@/app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider'
import { ChapterEditor } from '@/app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor'

type Props = {
  hiveId: string
  bookId: string
  initialBinderItems: BinderItemRow[]
  initialLocks: Record<string, { userId: string; lockedAt: Date }>
  members: HiveMemberRow[]
}

export function HiveBinder({ hiveId, bookId, initialBinderItems, initialLocks, members }: Props) {
  const [locks, setLocks] = useState(initialLocks)
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])

  const memberMap = Object.fromEntries(members.map(m => [m.userId, m.user.name ?? m.user.email]))

  async function handleChapterSelect(binderItemId: string, chapterId: string) {
    if (activeChapterId) await unlockChapterAction(activeChapterId)
    setActiveChapterId(chapterId)
    await lockChapterAction(hiveId, chapterId)
    const result = await getChapterCommentsAction(chapterId)
    if (result.success) setComments(result.data)
  }

  async function refreshComments() {
    if (!activeChapterId) return
    const result = await getChapterCommentsAction(activeChapterId)
    if (result.success) setComments(result.data)
  }

  return (
    <BookEditorProvider bookId={bookId} bookTitle="" initialBinderItems={initialBinderItems}>
      <div className="flex h-full">
        {/* Binder list with lock badges */}
        <div className="w-52 border-r border-border bg-card overflow-y-auto p-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 py-1 mb-1">Chapters</div>
          {initialBinderItems.filter(i => ['chapter','front_matter','back_matter'].includes(i.type)).map(item => {
            const lock = locks[item.id]
            return (
              <button
                key={item.id}
                onClick={() => item.chapterId && handleChapterSelect(item.id, item.chapterId)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors',
                  'hover:bg-surface-elevated text-foreground/70',
                )}
              >
                <span className="flex-1 truncate">{item.title}</span>
                {lock && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-surface-elevated border border-border text-muted-foreground truncate max-w-16">
                    {memberMap[lock.userId] ?? 'editing'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Editor + comments */}
        <div className="flex flex-1 overflow-hidden">
          <ChapterEditor />
          {activeChapterId && (
            <HiveChapterComments
              hiveId={hiveId}
              chapterId={activeChapterId}
              comments={comments}
              onCommentAdded={refreshComments}
            />
          )}
        </div>
      </div>
    </BookEditorProvider>
  )
}
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/binder/ app/[locale]/\(app\)/hive/[hiveId]/_components/hive-chapter-comments.tsx app/[locale]/\(app\)/hive/[hiveId]/_components/hive-binder.tsx
git commit -m "feat: hive shared binder with chapter locks and inline comments"
```

---

## Task 10: Outline Page

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getHiveOutlineAction } from '@/lib/actions/hive-content.actions'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveOutlineEditor } from '../_components/hive-outline-editor'

export default async function HiveOutlinePage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId } = await params
  const [hiveResult, outlineResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getHiveOutlineAction(hiveId).catch(() => ({ success: true, data: { content: null } })),
  ])
  if (!hiveResult?.success) notFound()
  return (
    <HiveOutlineEditor
      hiveId={hiveId}
      initialContent={outlineResult?.success ? outlineResult.data.content : null}
    />
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-outline-editor.tsx`**

```tsx
'use client'

import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { saveHiveOutlineAction } from '@/lib/actions/hive-content.actions'

type Props = { hiveId: string; initialContent: string | null }

export function HiveOutlineEditor({ hiveId, initialContent }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useRef<'saved' | 'saving' | 'unsaved'>('saved') as any

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your story outline here — acts, beats, chapter summaries…' }),
    ],
    content: initialContent ?? null,
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        await saveHiveOutlineAction(hiveId, JSON.stringify(editor.getJSON()))
      }, 2000)
    },
    editorProps: { attributes: { class: 'outline-none min-h-full' } },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border bg-surface text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-medium">Story Outline</span>
        <span className="text-foreground/40">Shared — edits auto-save</span>
      </div>
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto prose prose-invert prose-sm w-full"
      />
    </div>
  )
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/outline/
git commit -m "feat: hive shared outline editor"
```

---

## Task 11: Wiki Pages

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/wiki/[pageId]/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-wiki.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-wiki.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { WikiPageSummary, WikiPageFull } from '@/lib/actions/hive-content.actions'
import { createWikiPageAction, saveWikiPageAction, deleteWikiPageAction } from '@/lib/actions/hive-content.actions'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  pages: WikiPageSummary[]
  activePage: WikiPageFull | null
}

export function HiveWiki({ hiveId, pages: initialPages, activePage }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [newPageTitle, setNewPageTitle] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing this wiki page…' }),
    ],
    content: activePage?.content ? JSON.parse(activePage.content) : null,
    onUpdate: ({ editor }) => {
      if (!activePage) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        await saveWikiPageAction(activePage.id, JSON.stringify(editor.getJSON()))
      }, 2000)
    },
    editorProps: { attributes: { class: 'outline-none min-h-full' } },
  }, [activePage?.id])

  async function handleCreatePage() {
    if (!newPageTitle.trim()) return
    const result = await createWikiPageAction(hiveId, newPageTitle.trim())
    if (result.success) {
      setPages(prev => [...prev, { id: result.data.pageId, title: newPageTitle.trim(), updatedAt: new Date() }])
      setNewPageTitle('')
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-52 border-r border-border bg-card flex flex-col">
        <div className="p-2 border-b border-border">
          <div className="flex gap-1">
            <input
              value={newPageTitle}
              onChange={e => setNewPageTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreatePage()}
              placeholder="New page title…"
              className="flex-1 bg-surface-inset border border-border rounded px-2 py-1 text-xs outline-none focus:border-brand/40"
            />
            <button onClick={handleCreatePage} className="text-xs px-2 py-1 rounded bg-brand text-black font-medium">+</button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {pages.map(p => (
            <a
              key={p.id}
              href={`./wiki/${p.id}`}
              className={cn(
                'px-2 py-1.5 rounded-md text-xs truncate transition-colors',
                activePage?.id === p.id
                  ? 'bg-brand/10 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              {p.title}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {activePage ? (
          <>
            <div className="px-4 py-2 border-b border-border bg-surface text-xs text-muted-foreground flex items-center justify-between">
              <span className="font-medium text-foreground">{activePage.title}</span>
              <span className="text-foreground/40">Auto-saves</span>
            </div>
            <EditorContent
              editor={editor}
              className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto prose prose-invert prose-sm w-full"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a page or create one.
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/wiki/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getWikiPagesAction } from '@/lib/actions/hive-content.actions'
import { HiveWiki } from '../_components/hive-wiki'

export default async function HiveWikiPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const [hiveResult, pagesResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getWikiPagesAction(hiveId).catch(() => null),
  ])
  if (!hiveResult?.success) notFound()
  return <HiveWiki hiveId={hiveId} pages={pagesResult?.success ? pagesResult.data : []} activePage={null} />
}
```

- [ ] **Step 3: Create `app/[locale]/(app)/hive/[hiveId]/wiki/[pageId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getWikiPagesAction, getWikiPageAction } from '@/lib/actions/hive-content.actions'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveWiki } from '../../_components/hive-wiki'

export default async function WikiPageDetail({ params }: { params: Promise<{ hiveId: string; pageId: string }> }) {
  const { hiveId, pageId } = await params
  const [hiveResult, pagesResult, pageResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getWikiPagesAction(hiveId).catch(() => null),
    getWikiPageAction(pageId).catch(() => null),
  ])
  if (!hiveResult?.success || !pageResult?.success) notFound()
  return <HiveWiki hiveId={hiveId} pages={pagesResult?.success ? pagesResult.data : []} activePage={pageResult.data} />
}
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/wiki/
git commit -m "feat: hive world wiki with TipTap editor"
```

---

## Task 12: Discussion Board

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/discussion/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-discussion.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-discussion.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { DiscussionPost } from '@/lib/actions/hive-content.actions'
import { createDiscussionPostAction, deleteDiscussionPostAction } from '@/lib/actions/hive-content.actions'

type Props = { hiveId: string; initialPosts: DiscussionPost[]; currentUserId: string }

export function HiveDiscussion({ hiveId, initialPosts, currentUserId }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [newPost, setNewPost] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const topLevel = posts.filter(p => !p.parentId)
  const replies = (parentId: string) => posts.filter(p => p.parentId === parentId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newPost.trim()) return
    const result = await createDiscussionPostAction(hiveId, newPost.trim(), replyTo ?? undefined)
    if (result.success) {
      const newItem: DiscussionPost = {
        id: result.data.postId,
        hiveId,
        authorId: currentUserId,
        content: newPost.trim(),
        parentId: replyTo,
        createdAt: new Date(),
        author: { name: 'You', image: null },
      }
      setPosts(prev => [newItem, ...prev])
      setNewPost('')
      setReplyTo(null)
    }
  }

  async function handleDelete(postId: string) {
    await deleteDiscussionPostAction(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
      <h2 className="text-sm font-medium text-foreground">Discussion</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {replyTo && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            Replying to post <button type="button" onClick={() => setReplyTo(null)} className="text-brand">✕ Cancel</button>
          </div>
        )}
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder={replyTo ? 'Write a reply…' : 'Start a discussion…'}
          className="resize-none bg-surface-inset border border-border rounded-md p-3 text-sm text-foreground/80 outline-none focus:border-brand/40 min-h-20"
        />
        <button type="submit" disabled={!newPost.trim()} className="self-end text-xs px-3 py-1.5 rounded bg-brand text-black font-medium disabled:opacity-40">
          Post
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {topLevel.map(post => (
          <div key={post.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-foreground">{post.author.name ?? 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setReplyTo(post.id)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Reply</button>
                {post.authorId === currentUserId && (
                  <button onClick={() => handleDelete(post.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{post.content}</p>
            {replies(post.id).map(reply => (
              <div key={reply.id} className="mt-3 ml-4 pl-3 border-l border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">{reply.author.name ?? 'Unknown'}</span>
                  <span className="text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleDateString()}</span>
                  {reply.authorId === currentUserId && (
                    <button onClick={() => handleDelete(reply.id)} className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
                  )}
                </div>
                <p className="text-sm text-foreground/80">{reply.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/discussion/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getDiscussionPostsAction } from '@/lib/actions/hive-content.actions'
import { HiveDiscussion } from '../_components/hive-discussion'

export default async function HiveDiscussionPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const [hiveResult, postsResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getDiscussionPostsAction(hiveId).catch(() => null),
  ])
  if (!hiveResult?.success) notFound()
  return (
    <HiveDiscussion
      hiveId={hiveId}
      initialPosts={postsResult?.success ? postsResult.data : []}
      currentUserId={session!.user.id}
    />
  )
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/discussion/
git commit -m "feat: hive discussion board"
```

---

## Task 13: Task Kanban Board

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/tasks/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-tasks.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-tasks.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TaskRow } from '@/lib/actions/hive-content.actions'
import { createTaskAction, updateTaskAction, deleteTaskAction } from '@/lib/actions/hive-content.actions'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'

const COLUMNS = [
  { status: 'OPEN', label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
] as const

type Props = { hiveId: string; initialTasks: TaskRow[]; members: HiveMemberRow[]; currentUserId: string }

export function HiveTasks({ hiveId, initialTasks, members, currentUserId }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const result = await createTaskAction(hiveId, { title: newTitle.trim(), assigneeId: newAssignee || undefined })
    if (result.success) {
      const assigneeMember = members.find(m => m.userId === newAssignee)
      setTasks(prev => [...prev, {
        id: result.data.taskId, hiveId, title: newTitle.trim(), description: null,
        assigneeId: newAssignee || null, creatorId: currentUserId,
        status: 'OPEN', createdAt: new Date(),
        assignee: assigneeMember ? { name: assigneeMember.user.name, image: assigneeMember.user.image } : null,
      }])
      setNewTitle('')
      setNewAssignee('')
    }
  }

  async function handleStatusChange(taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') {
    await updateTaskAction(taskId, { status })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  async function handleDelete(taskId: string) {
    await deleteTaskAction(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <form onSubmit={handleCreate} className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="New task title…"
          className="flex-1 bg-surface-inset border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-brand/40"
        />
        <select
          value={newAssignee}
          onChange={e => setNewAssignee(e.target.value)}
          className="bg-surface-inset border border-border rounded px-2 py-1.5 text-sm text-muted-foreground outline-none"
        >
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>)}
        </select>
        <button type="submit" disabled={!newTitle.trim()} className="px-3 py-1.5 rounded bg-brand text-black text-sm font-medium disabled:opacity-40">
          Add Task
        </button>
      </form>

      <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
        {COLUMNS.map(col => (
          <div key={col.status} className="flex flex-col gap-2 overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{col.label}</div>
            {tasks.filter(t => t.status === col.status).map(task => (
              <div key={task.id} className={cn('bg-card border border-border rounded-lg p-3', task.status === 'DONE' && 'opacity-50')}>
                <p className={cn('text-sm text-foreground mb-2', task.status === 'DONE' && 'line-through text-muted-foreground')}>{task.title}</p>
                <div className="flex items-center gap-2">
                  {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee.name}</span>}
                  <div className="ml-auto flex gap-1">
                    {col.status !== 'OPEN' && (
                      <button onClick={() => handleStatusChange(task.id, 'OPEN')} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground">←</button>
                    )}
                    {col.status !== 'DONE' && (
                      <button onClick={() => handleStatusChange(task.id, col.status === 'OPEN' ? 'IN_PROGRESS' : 'DONE')} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground">→</button>
                    )}
                    {(task.creatorId === currentUserId) && (
                      <button onClick={() => handleDelete(task.id)} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-destructive">✕</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/tasks/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getTasksAction } from '@/lib/actions/hive-content.actions'
import { HiveTasks } from '../_components/hive-tasks'

export default async function HiveTasksPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const [hiveResult, tasksResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getTasksAction(hiveId).catch(() => null),
  ])
  if (!hiveResult?.success) notFound()
  return (
    <HiveTasks
      hiveId={hiveId}
      initialTasks={tasksResult?.success ? tasksResult.data : []}
      members={hiveResult.data.members}
      currentUserId={session!.user.id}
    />
  )
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/tasks/
git commit -m "feat: hive task kanban board"
```

---

## Task 14: Members Page + Invite Landing

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/members/page.tsx`
- Create: `app/[locale]/(app)/hive/[hiveId]/_components/hive-members.tsx`
- Create: `app/[locale]/(app)/hive/invite/[token]/page.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/hive/[hiveId]/_components/hive-members.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import {
  inviteMemberByUsernameAction, generateInviteLinkAction,
  removeMemberAction, updateMemberRoleAction,
} from '@/lib/actions/hive.actions'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
  currentUserId: string
}

export function HiveMembers({ hiveId, members: initialMembers, isOwner, isEditor, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteUsername.trim()) return
    const result = await inviteMemberByUsernameAction(hiveId, inviteUsername.trim())
    if (result.success) {
      setInviteUsername('')
      setError(null)
    } else {
      setError(result.error)
    }
  }

  async function handleGenerateLink() {
    const result = await generateInviteLinkAction(hiveId)
    if (result.success) {
      setInviteLink(`${window.location.origin}/en/hive/invite/${result.data.token}`)
    }
  }

  async function handleRemove(userId: string) {
    await removeMemberAction(hiveId, userId)
    setMembers(prev => prev.filter(m => m.userId !== userId))
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <h2 className="text-sm font-medium text-foreground">Members</h2>

      {(isOwner || isEditor) && (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invite</h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              value={inviteUsername}
              onChange={e => setInviteUsername(e.target.value)}
              placeholder="Username…"
              className="flex-1 bg-surface-inset border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-brand/40"
            />
            <button type="submit" className="px-3 py-1.5 rounded bg-brand text-black text-sm font-medium">Invite</button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={handleGenerateLink} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
              Generate invite link
            </button>
            {inviteLink && (
              <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="text-xs text-brand">Copy link</button>
            )}
          </div>
          {inviteLink && <p className="text-xs text-muted-foreground break-all">{inviteLink}</p>}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-xs overflow-hidden">
              {m.user.image ? <img src={m.user.image} alt="" className="w-full h-full object-cover" /> : (m.user.name?.[0] ?? '?')}
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{m.user.name ?? m.user.email}</p>
            </div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', m.role === 'OWNER' ? 'border-brand/40 text-brand bg-brand/10' : 'border-border text-muted-foreground')}>
              {m.role}
            </span>
            {isOwner && m.userId !== currentUserId && m.role !== 'OWNER' && (
              <button onClick={() => handleRemove(m.userId)} className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2">Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/hive/[hiveId]/members/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveMembers } from '../_components/hive-members'

export default async function HiveMembersPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()
  return (
    <HiveMembers
      hiveId={hiveId}
      members={result.data.members}
      isOwner={result.data.isOwner}
      isEditor={result.data.isEditor}
      currentUserId={session!.user.id}
    />
  )
}
```

- [ ] **Step 3: Create `app/[locale]/(app)/hive/invite/[token]/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { hiveInvites, hives } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { joinHiveByLinkAction } from '@/lib/actions/hive.actions'

export default async function HiveInvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/${locale}/sign-in`)

  const invite = await db.query.hiveInvites.findFirst({
    where: and(eq(hiveInvites.token, token), eq(hiveInvites.status, 'PENDING')),
    with: { hive: { columns: { id: true, name: true, description: true } } },
  })

  if (!invite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground mb-2">Invite expired or invalid</h1>
          <p className="text-sm text-muted-foreground">This invite link is no longer valid.</p>
        </div>
      </div>
    )
  }

  async function handleJoin() {
    'use server'
    const result = await joinHiveByLinkAction(token)
    if (result.success) redirect(`/${locale}/hive/${result.data.hiveId}`)
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full text-center flex flex-col gap-4">
        <div className="text-3xl">🐝</div>
        <h1 className="text-lg font-semibold text-foreground">You're invited to a Hive</h1>
        <p className="text-sm font-medium text-brand">{invite.hive?.name}</p>
        {invite.hive?.description && <p className="text-sm text-muted-foreground">{invite.hive.description}</p>}
        <form action={handleJoin}>
          <button type="submit" className="w-full px-4 py-2 rounded-lg bg-brand text-black font-medium text-sm">
            Join Hive
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hive/[hiveId]/members/ app/[locale]/\(app\)/hive/invite/
git commit -m "feat: members management page and invite landing"
```

---

## Task 15: Community / Discover Page + Notifications Bell

**Files:**
- Modify: `app/[locale]/(app)/community/page.tsx`
- Modify: `app/[locale]/(app)/_components/app-nav.tsx`
- Create: `app/[locale]/(app)/_components/notifications-bell.tsx`

- [ ] **Step 1: Replace `app/[locale]/(app)/community/page.tsx`**

```tsx
import { getPublicHivesAction } from '@/lib/actions/hive.actions'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const result = await getPublicHivesAction().catch(() => null)
  const hives = result?.success ? result.data : []

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-foreground mb-6">Community Hives</h1>
      {hives.length === 0 ? (
        <p className="text-sm text-muted-foreground">No public Hives yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hives.map(hive => (
            <div key={hive.id} className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{hive.name}</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground shrink-0">Public</span>
              </div>
              {hive.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{hive.description}</p>}
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{hive.memberCount} members</span>
                <a
                  href={`/${locale}/hive/${hive.id}`}
                  className="text-xs px-3 py-1 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
                >
                  View Hive
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/[locale]/(app)/_components/notifications-bell.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import type { NotificationRow } from '@/lib/actions/notifications.actions'
import {
  getNotificationsAction, markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/lib/actions/notifications.actions'
import { acceptHiveInviteAction, declineHiveInviteAction } from '@/lib/actions/hive.actions'
import { cn } from '@/lib/utils'

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function load() {
    const result = await getNotificationsAction()
    if (result.success) {
      setNotifications(result.data.notifications)
      setUnreadCount(result.data.unreadCount)
    }
  }

  useEffect(() => { load() }, [])

  async function handleOpen() {
    setOpen(o => !o)
    if (!open) load()
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleAcceptInvite(n: NotificationRow) {
    if (!n.resourceId) return
    // Find the invite via resourceId (hiveId) — simplified: navigate to hive
    await markNotificationReadAction(n.id)
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    setUnreadCount(prev => Math.max(0, prev - 1))
    window.location.href = `/en/hive/${n.resourceId}`
  }

  const LABELS: Record<string, string> = {
    HIVE_INVITE: '🐝 invited you to a Hive',
    TASK_ASSIGNED: '✅ assigned you a task',
    HIVE_COMMENT: '💬 commented on a chapter',
    TASK_COMPLETED: '✅ completed a task',
    HIVE_MEMBER_JOINED: '👥 joined your Hive',
    CHAPTER_EDITED: '📄 edited a chapter',
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors relative"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand border-2 border-[#141414] flex items-center justify-center text-[9px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">Notifications</span>
              <button onClick={handleMarkAllRead} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Mark all read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">No notifications.</p>
              ) : notifications.map(n => (
                <div key={n.id} className={cn('flex gap-3 px-4 py-3 border-b border-border last:border-0', !n.read && 'bg-brand/5')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">
                      <strong>{n.actor?.name ?? 'Someone'}</strong>{' '}
                      {LABELS[n.type] ?? n.type.toLowerCase().replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </div>
                  {n.type === 'HIVE_INVITE' && !n.read && (
                    <button onClick={() => handleAcceptInvite(n)} className="text-[10px] px-2 py-1 rounded bg-brand text-black font-medium shrink-0">View</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire `NotificationsBell` into `app-nav.tsx`**

Replace the static bell button in `app-nav.tsx`:
```tsx
import { NotificationsBell } from './notifications-bell'

// Replace the existing <button aria-label="Notifications"> block with:
<NotificationsBell />
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/community/page.tsx app/[locale]/\(app\)/_components/notifications-bell.tsx app/[locale]/\(app\)/_components/app-nav.tsx
git commit -m "feat: community page, notifications bell, and hive invite flow"
```

---

## Task 16: Studio Integration — Create Hive from Book

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/page.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/create-hive-modal.tsx`

- [ ] **Step 1: Create `app/[locale]/(app)/studio/[bookId]/_components/create-hive-modal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createHiveAction } from '@/lib/actions/hive.actions'

type Props = { bookId: string; locale: string; onClose: () => void }

export function CreateHiveModal({ bookId, locale, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    const result = await createHiveAction({ bookId, name: name.trim(), description: description.trim() || undefined, visibility })
    setSubmitting(false)
    if (result.success) {
      router.push(`/${locale}/hive/${result.data.hiveId}`)
    } else {
      setError(result.error === 'FREE_LIMIT_REACHED' ? 'You have reached the free limit of 3 Hives. Upgrade to Premium for unlimited Hives.' : result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Create a Hive for this book</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Hive name…"
            className="bg-surface-inset border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand/40 text-foreground"
            required
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)…"
            className="resize-none bg-surface-inset border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand/40 text-foreground min-h-16"
          />
          <div className="flex gap-2">
            {(['PRIVATE', 'PUBLIC'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex-1 text-xs py-1.5 rounded-full border transition-colors ${visibility === v ? 'bg-brand/20 border-brand/40 text-brand' : 'border-border text-muted-foreground'}`}
              >
                {v === 'PRIVATE' ? '🔒 Private' : '🌍 Public'}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose} className="flex-1 text-sm py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={submitting || !name.trim()} className="flex-1 text-sm py-2 rounded-lg bg-brand text-black font-medium disabled:opacity-40">
              {submitting ? 'Creating…' : 'Create Hive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add "Create Hive" button to the Studio book page**

In `app/[locale]/(app)/studio/[bookId]/page.tsx`, this is a server component. Add a client wrapper that shows the button and modal. The easiest approach: add a `CreateHiveButton` client component that renders the modal on click, then import it in the server page.

Create `app/[locale]/(app)/studio/[bookId]/_components/create-hive-button.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { CreateHiveModal } from './create-hive-modal'

type Props = { bookId: string; locale: string }

export function CreateHiveButton({ bookId, locale }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
      >
        🐝 Create Hive
      </button>
      {open && <CreateHiveModal bookId={bookId} locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
```

Then in the `BookEditorProvider` wrapper in `app/[locale]/(app)/studio/[bookId]/page.tsx`, import and add `<CreateHiveButton>` somewhere visible (e.g., in the header area of the studio). Locate the return statement and add the button near the top-level layout alongside existing content.

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/studio/[bookId]/_components/create-hive-modal.tsx app/[locale]/\(app\)/studio/[bookId]/_components/create-hive-button.tsx
git commit -m "feat: create hive from studio book page"
```

---

## Final Verification

- [ ] **Run type-check across full codebase**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Run unit tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Manual smoke test checklist**
  - [ ] Create a Hive from a book in the Studio
  - [ ] Open the Hive — overview shows, sidebar navigates correctly
  - [ ] Open Binder — chapters list, lock indicator appears, chapter editor works
  - [ ] Add an inline comment, resolve it
  - [ ] Edit the Outline — saves after 2 seconds
  - [ ] Create a Wiki page, write content, navigate between pages
  - [ ] Post in Discussion, reply to a post
  - [ ] Create a task, assign it, move it across columns
  - [ ] Open Members page, generate invite link
  - [ ] Visit `/community` — public Hives appear
  - [ ] Visit an invite link — join button works
  - [ ] Notifications bell shows unread badge, dropdown opens

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: Phase 4 Hive Collaboration complete"
git push
```
