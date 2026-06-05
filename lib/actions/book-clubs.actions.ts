'use server'

import { createId } from '@paralleldrive/cuid2'
import { and, asc, desc, eq, gt, inArray, lt, lte, ne, or, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '@/db'
import {
  bookClubs,
  bookClubBooks,
  bookClubMembers,
  bookClubInvites,
  bookClubInviteTokens,
  bookClubJoinRequests,
  bookClubScheduleItems,
  bookClubDiscussions,
  bookClubDiscussionReplies,
  bookClubDiscussionLikes,
  bookClubDiscussionReplyLikes,
  notifications,
  userBlocks,
  type BookClubMemberRole,
  type BookClubBookStatus,
} from '@/db/schema/social'
import { books, bookVisibilityEnum } from '@/db/schema/books'
import { userProfiles } from '@/db/schema/auth'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { isBlocked } from '@/lib/social/is-blocked'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { canReadBook } from '@/lib/books/can-read'
import {
  canViewClub,
  canJoinClub,
  canEditClubMetadata,
  canManageBookQueue,
  canManageSchedule,
  canPinDiscussion,
  canApproveJoinRequest,
  canInviteUser,
  canManageMembers,
  canChangeRole,
  canDeleteClub,
  canPostDiscussion,
} from '@/lib/book-clubs/predicates'
import { getClubMembership } from '@/lib/book-clubs/get-membership'
import { deriveCurrentBookTx } from '@/lib/book-clubs/derive-current-book'
import * as v from '@/lib/validations/book-club'
import type { ActionResult } from './book.actions'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const INVITE_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────────────

type BookVisibility = (typeof bookVisibilityEnum.enumValues)[number]

export type ClubOwner = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type ClubCurrentBook = {
  id: string
  title: string
  author: string
  coverUrl: string | null
}

export type ClubSummary = {
  id: string
  name: string
  description: string | null
  rules: string | null
  visibility: BookVisibility
  discoverable: boolean
  openJoin: boolean
  tags: string[]
  memberCount: number
  currentBook: ClubCurrentBook | null
  owner: ClubOwner
  viewerMembership: { role: BookClubMemberRole | null }
  createdAt: Date
  updatedAt: Date
}

export type ClubDetail = {
  club: ClubSummary
  owner: ClubOwner
  viewerRole: BookClubMemberRole | null
  viewerMembership: { role: BookClubMemberRole | null }
  currentBook: ClubCurrentBook | null
  memberCount: number
}

export type ClubBookRow = {
  id: string
  clubId: string
  bookId: string | null
  title: string
  author: string
  coverUrl: string | null
  status: BookClubBookStatus
  order: number
  addedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export type ClubMemberRow = {
  id: string
  userId: string
  role: BookClubMemberRole
  joinedAt: Date
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type ClubDiscussionRow = {
  id: string
  clubId: string
  authorId: string
  title: string
  content: string
  isPinned: boolean
  likeCount: number
  replyCount: number
  createdAt: Date
  updatedAt: Date
  author: ClubOwner
  viewerLiked: boolean
}

export type ClubDiscussionReply = {
  id: string
  discussionId: string
  authorId: string
  content: string
  likeCount: number
  createdAt: Date
  author: ClubOwner
  viewerLiked: boolean
}

export type ClubScheduleItem = {
  id: string
  clubId: string
  bookId: string
  chapterStart: number
  chapterEnd: number
  targetDate: Date
  label: string | null
  order: number
  createdAt: Date
}

// ─── Cursor helpers ──────────────────────────────────────────────────────────

type CursorTuple = { createdAt: string; id: string }

function encodeCursor(c: CursorTuple): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url')
}

function decodeCursor(s: string | undefined): CursorTuple | null {
  if (!s) return null
  try {
    const raw = Buffer.from(s, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as CursorTuple
    if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// T3 — Club CRUD
// ═════════════════════════════════════════════════════════════════════════════

export async function createClubAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = v.createClubSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const id = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubs).values({
      id,
      ownerId: userId,
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
      id: createId(),
      clubId: id,
      userId,
      role: 'OWNER',
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

export async function getClubsAction(input: {
  filter: 'mine' | 'discover'
  cursor?: string
  limit?: number
}): Promise<ActionResult<{ rows: ClubSummary[]; nextCursor: string | null }>> {
  const viewerId = await getOptionalUserId()
  const parsed = v.getClubsInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const limit = Math.min(parsed.data.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const cursor = decodeCursor(parsed.data.cursor)
  const overFetch = limit + 1

  if (parsed.data.filter === 'mine' && !viewerId) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const cursorCondition = cursor
    ? or(
        lt(bookClubs.createdAt, new Date(cursor.createdAt)),
        and(
          eq(bookClubs.createdAt, new Date(cursor.createdAt)),
          lt(bookClubs.id, cursor.id),
        ),
      )
    : undefined

  type RawRow = {
    id: string
    ownerId: string
    name: string
    description: string | null
    rules: string | null
    visibility: BookVisibility
    discoverable: boolean
    openJoin: boolean
    tags: string[]
    memberCount: number
    currentBookId: string | null
    createdAt: Date
    updatedAt: Date
    ownerUsername: string | null
    ownerDisplayName: string | null
    ownerAvatarUrl: string | null
  }

  let rawRows: RawRow[] = []

  if (parsed.data.filter === 'mine') {
    const rows = await db
      .select({
        id: bookClubs.id,
        ownerId: bookClubs.ownerId,
        name: bookClubs.name,
        description: bookClubs.description,
        rules: bookClubs.rules,
        visibility: bookClubs.visibility,
        discoverable: bookClubs.discoverable,
        openJoin: bookClubs.openJoin,
        tags: bookClubs.tags,
        memberCount: bookClubs.memberCount,
        currentBookId: bookClubs.currentBookId,
        createdAt: bookClubs.createdAt,
        updatedAt: bookClubs.updatedAt,
        ownerUsername: userProfiles.username,
        ownerDisplayName: userProfiles.displayName,
        ownerAvatarUrl: userProfiles.avatarUrl,
      })
      .from(bookClubs)
      .innerJoin(
        bookClubMembers,
        and(
          eq(bookClubMembers.clubId, bookClubs.id),
          eq(bookClubMembers.userId, viewerId!),
        ),
      )
      .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
      .where(cursorCondition ? cursorCondition : undefined)
      .orderBy(desc(bookClubs.createdAt), desc(bookClubs.id))
      .limit(overFetch)
    rawRows = rows
  } else {
    // discover: PUBLIC + discoverable + block-filtered post-hoc
    const baseWhere = and(
      eq(bookClubs.visibility, 'PUBLIC'),
      eq(bookClubs.discoverable, true),
    )
    const rows = await db
      .select({
        id: bookClubs.id,
        ownerId: bookClubs.ownerId,
        name: bookClubs.name,
        description: bookClubs.description,
        rules: bookClubs.rules,
        visibility: bookClubs.visibility,
        discoverable: bookClubs.discoverable,
        openJoin: bookClubs.openJoin,
        tags: bookClubs.tags,
        memberCount: bookClubs.memberCount,
        currentBookId: bookClubs.currentBookId,
        createdAt: bookClubs.createdAt,
        updatedAt: bookClubs.updatedAt,
        ownerUsername: userProfiles.username,
        ownerDisplayName: userProfiles.displayName,
        ownerAvatarUrl: userProfiles.avatarUrl,
      })
      .from(bookClubs)
      .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
      .where(cursorCondition ? and(baseWhere, cursorCondition) : baseWhere)
      .orderBy(desc(bookClubs.createdAt), desc(bookClubs.id))
      .limit(overFetch * 2) // overscan for block filter

    if (viewerId) {
      const filtered: RawRow[] = []
      const results = await Promise.all(
        rows.map(async (r) => ((await isBlocked(viewerId, r.ownerId)) ? null : r)),
      )
      for (const r of results) {
        if (r) filtered.push(r)
        if (filtered.length >= overFetch) break
      }
      rawRows = filtered
    } else {
      rawRows = rows.slice(0, overFetch)
    }
  }

  const hasMore = rawRows.length > limit
  const page = rawRows.slice(0, limit)
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null

  // Hydrate currentBook for rows that have a currentBookId
  const currentBookIds = page
    .map((r) => r.currentBookId)
    .filter((id): id is string => id !== null)
  let currentBookMap = new Map<string, ClubCurrentBook>()
  if (currentBookIds.length > 0) {
    const bookRows = await db
      .select({
        id: bookClubBooks.id,
        title: bookClubBooks.title,
        author: bookClubBooks.author,
        coverUrl: bookClubBooks.coverUrl,
      })
      .from(bookClubBooks)
      .where(inArray(bookClubBooks.id, currentBookIds))
    currentBookMap = new Map(bookRows.map((b) => [b.id, b]))
  }

  // Hydrate viewerMembership for each row
  const memberships = await Promise.all(
    page.map((r) => getClubMembership(viewerId, r.id)),
  )

  const result: ClubSummary[] = page.map((r, i) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    rules: r.rules,
    visibility: r.visibility,
    discoverable: r.discoverable,
    openJoin: r.openJoin,
    tags: r.tags ?? [],
    memberCount: r.memberCount,
    currentBook: r.currentBookId ? currentBookMap.get(r.currentBookId) ?? null : null,
    owner: {
      userId: r.ownerId,
      username: r.ownerUsername,
      displayName: r.ownerDisplayName,
      avatarUrl: r.ownerAvatarUrl,
    },
    viewerMembership: memberships[i],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))

  return { success: true, data: { rows: result, nextCursor } }
}

export async function getClubAction(
  clubId: string,
): Promise<ActionResult<ClubDetail>> {
  const viewerId = await getOptionalUserId()

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, clubId),
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(viewerId, clubId)
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' } // masquerade
  }

  const [owner] = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, club.ownerId))
    .limit(1)

  const resolvedOwner: ClubOwner = {
    userId: club.ownerId,
    username: owner?.username ?? null,
    displayName: owner?.displayName ?? null,
    avatarUrl: owner?.avatarUrl ?? null,
  }

  let currentBook: ClubCurrentBook | null = null
  if (club.currentBookId) {
    const [row] = await db
      .select({
        id: bookClubBooks.id,
        title: bookClubBooks.title,
        author: bookClubBooks.author,
        coverUrl: bookClubBooks.coverUrl,
      })
      .from(bookClubBooks)
      .where(eq(bookClubBooks.id, club.currentBookId))
      .limit(1)
    currentBook = row ?? null
  }

  const summary: ClubSummary = {
    id: club.id,
    name: club.name,
    description: club.description,
    rules: club.rules,
    visibility: club.visibility,
    discoverable: club.discoverable,
    openJoin: club.openJoin,
    tags: club.tags ?? [],
    memberCount: club.memberCount,
    currentBook,
    owner: resolvedOwner,
    viewerMembership: membership,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
  }

  return {
    success: true,
    data: {
      club: summary,
      owner: resolvedOwner,
      viewerRole: membership.role,
      viewerMembership: membership,
      currentBook,
      memberCount: club.memberCount,
    },
  }
}

export async function updateClubAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.updateClubSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: { id: true, visibility: true, discoverable: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canEditClubMetadata(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  const updates: Partial<typeof bookClubs.$inferInsert> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.rules !== undefined) updates.rules = parsed.data.rules
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility
  if (parsed.data.openJoin !== undefined) updates.openJoin = parsed.data.openJoin

  // 3-layer discoverable defense
  const effectiveVisibility = parsed.data.visibility ?? club.visibility
  if (parsed.data.discoverable !== undefined) {
    updates.discoverable =
      effectiveVisibility === 'PUBLIC' ? parsed.data.discoverable : false
  } else if (parsed.data.visibility !== undefined && effectiveVisibility !== 'PUBLIC') {
    updates.discoverable = false
  }

  updates.updatedAt = new Date()

  await db.update(bookClubs).set(updates).where(eq(bookClubs.id, parsed.data.clubId))
  return { success: true, data: { updated: true } }
}

export async function deleteClubAction(
  input: unknown,
): Promise<ActionResult<{ deleted: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.clubIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canDeleteClub(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db.delete(bookClubs).where(eq(bookClubs.id, parsed.data.clubId))
  return { success: true, data: { deleted: true } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T4 — Members
// ═════════════════════════════════════════════════════════════════════════════

export async function joinClubAction(
  input: unknown,
): Promise<ActionResult<{ joined: boolean; requested: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.clubIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: {
      id: true,
      ownerId: true,
      visibility: true,
      openJoin: true,
      name: true,
    },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, club.id)
  if (membership.role !== null) {
    return { success: false, error: 'ALREADY_MEMBER' }
  }
  if (!(await canJoinClub(userId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' } // masquerade
  }

  if (club.openJoin) {
    await db.transaction(async (tx) => {
      await tx
        .insert(bookClubMembers)
        .values({ id: createId(), clubId: club.id, userId, role: 'MEMBER' })
      await tx
        .update(bookClubs)
        .set({ memberCount: sql`${bookClubs.memberCount} + 1` })
        .where(eq(bookClubs.id, club.id))
    })
    return { success: true, data: { joined: true, requested: false } }
  }

  // Closed-join — request flow
  const existing = await db.query.bookClubJoinRequests.findFirst({
    where: and(
      eq(bookClubJoinRequests.clubId, club.id),
      eq(bookClubJoinRequests.userId, userId),
      eq(bookClubJoinRequests.status, 'PENDING'),
    ),
  })
  if (existing) return { success: false, error: 'REQUEST_ALREADY_PENDING' }

  const requestId = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubJoinRequests).values({
      id: requestId,
      clubId: club.id,
      userId,
      status: 'PENDING',
    })
    // Fan-out notification to all OWNER + MOD members
    const recipients = await tx.query.bookClubMembers.findMany({
      where: and(
        eq(bookClubMembers.clubId, club.id),
        inArray(bookClubMembers.role, ['OWNER', 'MODERATOR']),
      ),
      columns: { userId: true },
    })
    if (recipients.length > 0) {
      await tx.insert(notifications).values(
        recipients.map((r) => ({
          id: createId(),
          userId: r.userId,
          type: 'CLUB_JOIN_REQUEST' as const,
          actorId: userId,
          resourceType: 'book_club_join_request',
          resourceId: requestId,
        })),
      )
    }
  })
  return { success: true, data: { joined: false, requested: true } }
}

export async function leaveClubAction(
  input: unknown,
): Promise<ActionResult<{ left: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.clubIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (membership.role === null) return { success: false, error: 'NOT_MEMBER' }
  if (membership.role === 'OWNER') {
    return { success: false, error: 'OWNER_CANNOT_LEAVE' }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(bookClubMembers)
      .where(
        and(
          eq(bookClubMembers.clubId, parsed.data.clubId),
          eq(bookClubMembers.userId, userId),
        ),
      )
    await tx
      .update(bookClubs)
      .set({ memberCount: sql`greatest(${bookClubs.memberCount} - 1, 0)` })
      .where(eq(bookClubs.id, parsed.data.clubId))
  })
  return { success: true, data: { left: true } }
}

export async function removeClubMemberAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.targetUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canManageMembers(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  const target = await db.query.bookClubMembers.findFirst({
    where: and(
      eq(bookClubMembers.clubId, parsed.data.clubId),
      eq(bookClubMembers.userId, parsed.data.targetUserId),
    ),
    columns: { role: true },
  })
  if (!target) return { success: false, error: 'NOT_FOUND' }
  if (target.role === 'OWNER') {
    return { success: false, error: 'CANNOT_REMOVE_OWNER' }
  }
  // MODs cannot remove other MODs — only OWNER can.
  if (target.role === 'MODERATOR' && membership.role !== 'OWNER') {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(bookClubMembers)
      .where(
        and(
          eq(bookClubMembers.clubId, parsed.data.clubId),
          eq(bookClubMembers.userId, parsed.data.targetUserId),
        ),
      )
    await tx
      .update(bookClubs)
      .set({ memberCount: sql`greatest(${bookClubs.memberCount} - 1, 0)` })
      .where(eq(bookClubs.id, parsed.data.clubId))
  })
  return { success: true, data: { removed: true } }
}

export async function changeClubMemberRoleAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.changeRoleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canChangeRole(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }
  if (parsed.data.targetUserId === userId) {
    return { success: false, error: 'CANNOT_SELF_DEMOTE' }
  }

  const target = await db.query.bookClubMembers.findFirst({
    where: and(
      eq(bookClubMembers.clubId, parsed.data.clubId),
      eq(bookClubMembers.userId, parsed.data.targetUserId),
    ),
    columns: { role: true },
  })
  if (!target) return { success: false, error: 'NOT_FOUND' }
  if (target.role === 'OWNER') {
    return { success: false, error: 'CANNOT_CHANGE_OWNER' }
  }

  await db
    .update(bookClubMembers)
    .set({ role: parsed.data.newRole })
    .where(
      and(
        eq(bookClubMembers.clubId, parsed.data.clubId),
        eq(bookClubMembers.userId, parsed.data.targetUserId),
      ),
    )
  return { success: true, data: { updated: true } }
}

export async function transferClubOwnershipAction(
  input: unknown,
): Promise<ActionResult<{ transferred: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.targetUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (membership.role !== 'OWNER') {
    return { success: false, error: 'NOT_ALLOWED' }
  }
  if (parsed.data.targetUserId === userId) {
    return { success: false, error: 'INVALID_TARGET' }
  }

  const target = await db.query.bookClubMembers.findFirst({
    where: and(
      eq(bookClubMembers.clubId, parsed.data.clubId),
      eq(bookClubMembers.userId, parsed.data.targetUserId),
    ),
    columns: { role: true },
  })
  if (!target) return { success: false, error: 'NOT_FOUND' }

  await db.transaction(async (tx) => {
    await tx
      .update(bookClubMembers)
      .set({ role: 'OWNER' })
      .where(
        and(
          eq(bookClubMembers.clubId, parsed.data.clubId),
          eq(bookClubMembers.userId, parsed.data.targetUserId),
        ),
      )
    await tx
      .update(bookClubMembers)
      .set({ role: 'MEMBER' })
      .where(
        and(
          eq(bookClubMembers.clubId, parsed.data.clubId),
          eq(bookClubMembers.userId, userId),
        ),
      )
    await tx
      .update(bookClubs)
      .set({ ownerId: parsed.data.targetUserId, updatedAt: new Date() })
      .where(eq(bookClubs.id, parsed.data.clubId))
  })
  return { success: true, data: { transferred: true } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T5 — Invites (username + token)
// ═════════════════════════════════════════════════════════════════════════════

export async function inviteUserToClubAction(
  input: unknown,
): Promise<ActionResult<{ inviteId: string }>> {
  const userId = await requireAuth()
  const parsed = v.inviteByUsernameSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canInviteUser(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  // Resolve username → userId
  const recipientProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.username, parsed.data.recipientUsername),
    columns: { userId: true },
  })
  if (!recipientProfile) return { success: false, error: 'USER_NOT_FOUND' }
  const recipientId = recipientProfile.userId

  if (recipientId === userId) {
    return { success: false, error: 'SELF_INVITE' }
  }

  // Block check (bidirectional)
  if ((await isBlocked(userId, recipientId)) || (await isBlocked(recipientId, userId))) {
    return { success: false, error: 'USER_NOT_FOUND' } // masquerade
  }

  // Already a member?
  const recipientMembership = await getClubMembership(recipientId, parsed.data.clubId)
  if (recipientMembership.role !== null) {
    return { success: false, error: 'ALREADY_MEMBER' }
  }

  // Existing PENDING invite?
  const existingInvite = await db.query.bookClubInvites.findFirst({
    where: and(
      eq(bookClubInvites.clubId, parsed.data.clubId),
      eq(bookClubInvites.recipientId, recipientId),
      eq(bookClubInvites.status, 'PENDING'),
    ),
    columns: { id: true },
  })
  if (existingInvite) return { success: false, error: 'INVITE_ALREADY_PENDING' }

  const inviteId = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubInvites).values({
      id: inviteId,
      clubId: parsed.data.clubId,
      inviterId: userId,
      recipientId,
      status: 'PENDING',
    })
    await tx.insert(notifications).values({
      id: createId(),
      userId: recipientId,
      type: 'CLUB_INVITE',
      actorId: userId,
      resourceType: 'book_club_invite',
      resourceId: inviteId,
    })
  })
  return { success: true, data: { inviteId } }
}

export async function respondToClubInviteAction(
  input: unknown,
): Promise<ActionResult<{ accepted: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.respondInviteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const invite = await db.query.bookClubInvites.findFirst({
    where: eq(bookClubInvites.id, parsed.data.inviteId),
  })
  if (!invite) return { success: false, error: 'NOT_FOUND' }
  if (invite.recipientId !== userId) return { success: false, error: 'NOT_ALLOWED' }
  if (invite.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  if (!parsed.data.accept) {
    await db
      .update(bookClubInvites)
      .set({ status: 'REJECTED', respondedAt: new Date() })
      .where(eq(bookClubInvites.id, parsed.data.inviteId))
    return { success: true, data: { accepted: false } }
  }

  // Accept path — tx
  await db.transaction(async (tx) => {
    await tx
      .update(bookClubInvites)
      .set({ status: 'ACCEPTED', respondedAt: new Date() })
      .where(eq(bookClubInvites.id, parsed.data.inviteId))
    await tx
      .insert(bookClubMembers)
      .values({ id: createId(), clubId: invite.clubId, userId, role: 'MEMBER' })
    await tx
      .update(bookClubs)
      .set({ memberCount: sql`${bookClubs.memberCount} + 1` })
      .where(eq(bookClubs.id, invite.clubId))
    // Cancel any matching PENDING join request from same user
    await tx
      .delete(bookClubJoinRequests)
      .where(
        and(
          eq(bookClubJoinRequests.clubId, invite.clubId),
          eq(bookClubJoinRequests.userId, userId),
          eq(bookClubJoinRequests.status, 'PENDING'),
        ),
      )
  })
  return { success: true, data: { accepted: true } }
}

export async function cancelClubInviteAction(
  input: unknown,
): Promise<ActionResult<{ canceled: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.inviteIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const invite = await db.query.bookClubInvites.findFirst({
    where: eq(bookClubInvites.id, parsed.data.inviteId),
    columns: { inviterId: true, status: true },
  })
  if (!invite) return { success: false, error: 'NOT_FOUND' }
  if (invite.inviterId !== userId) return { success: false, error: 'NOT_ALLOWED' }
  if (invite.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  await db
    .update(bookClubInvites)
    .set({ status: 'CANCELED', respondedAt: new Date() })
    .where(eq(bookClubInvites.id, parsed.data.inviteId))
  return { success: true, data: { canceled: true } }
}

export async function createClubInviteTokenAction(
  input: unknown,
): Promise<ActionResult<{ token: string; expiresAt: Date }>> {
  const userId = await requireAuth()
  const parsed = v.clubIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canInviteUser(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS)
  await db.insert(bookClubInviteTokens).values({
    token,
    clubId: parsed.data.clubId,
    inviterId: userId,
    expiresAt,
  })
  return { success: true, data: { token, expiresAt } }
}

export async function claimClubInviteTokenAction(
  input: unknown,
): Promise<ActionResult<{ clubId: string }>> {
  const userId = await requireAuth()
  const parsed = v.claimTokenSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const row = await db.query.bookClubInviteTokens.findFirst({
    where: eq(bookClubInviteTokens.token, parsed.data.token),
  })
  if (!row) return { success: false, error: 'TOKEN_NOT_FOUND' }
  if (row.claimedAt !== null) return { success: false, error: 'TOKEN_ALREADY_CLAIMED' }
  if (row.expiresAt < new Date()) return { success: false, error: 'TOKEN_EXPIRED' }
  if (row.inviterId === userId) return { success: false, error: 'SELF_INVITE' }

  // Block check (bidirectional)
  if (
    (await isBlocked(userId, row.inviterId)) ||
    (await isBlocked(row.inviterId, userId))
  ) {
    return { success: false, error: 'BLOCKED' }
  }

  // Already a member?
  const membership = await getClubMembership(userId, row.clubId)
  if (membership.role !== null) {
    return { success: false, error: 'ALREADY_MEMBER' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(bookClubInviteTokens)
      .set({ claimedBy: userId, claimedAt: new Date() })
      .where(eq(bookClubInviteTokens.token, parsed.data.token))
    await tx
      .insert(bookClubMembers)
      .values({ id: createId(), clubId: row.clubId, userId, role: 'MEMBER' })
    await tx
      .update(bookClubs)
      .set({ memberCount: sql`${bookClubs.memberCount} + 1` })
      .where(eq(bookClubs.id, row.clubId))
  })
  return { success: true, data: { clubId: row.clubId } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T6 — Join requests
// ═════════════════════════════════════════════════════════════════════════════

export async function respondToJoinRequestAction(
  input: unknown,
): Promise<ActionResult<{ accepted: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.respondRequestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const request = await db.query.bookClubJoinRequests.findFirst({
    where: eq(bookClubJoinRequests.id, parsed.data.requestId),
  })
  if (!request) return { success: false, error: 'NOT_FOUND' }
  if (request.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  const membership = await getClubMembership(userId, request.clubId)
  if (!canApproveJoinRequest(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  if (!parsed.data.accept) {
    await db
      .update(bookClubJoinRequests)
      .set({ status: 'REJECTED', respondedAt: new Date() })
      .where(eq(bookClubJoinRequests.id, parsed.data.requestId))
    return { success: true, data: { accepted: false } }
  }

  // Accept path
  await db.transaction(async (tx) => {
    await tx
      .update(bookClubJoinRequests)
      .set({ status: 'ACCEPTED', respondedAt: new Date() })
      .where(eq(bookClubJoinRequests.id, parsed.data.requestId))
    await tx.insert(bookClubMembers).values({
      id: createId(),
      clubId: request.clubId,
      userId: request.userId,
      role: 'MEMBER',
    })
    await tx
      .update(bookClubs)
      .set({ memberCount: sql`${bookClubs.memberCount} + 1` })
      .where(eq(bookClubs.id, request.clubId))
    await tx.insert(notifications).values({
      id: createId(),
      userId: request.userId,
      type: 'CLUB_JOIN_APPROVED',
      actorId: userId,
      resourceType: 'book_club',
      resourceId: request.clubId,
    })
  })
  return { success: true, data: { accepted: true } }
}

export async function cancelJoinRequestAction(
  input: unknown,
): Promise<ActionResult<{ canceled: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.requestIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const request = await db.query.bookClubJoinRequests.findFirst({
    where: eq(bookClubJoinRequests.id, parsed.data.requestId),
    columns: { userId: true, status: true },
  })
  if (!request) return { success: false, error: 'NOT_FOUND' }
  if (request.userId !== userId) return { success: false, error: 'NOT_ALLOWED' }
  if (request.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  await db
    .delete(bookClubJoinRequests)
    .where(eq(bookClubJoinRequests.id, parsed.data.requestId))
  return { success: true, data: { canceled: true } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T7 — Books + schedule
// ═════════════════════════════════════════════════════════════════════════════

export async function addClubBookAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = v.addClubBookSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: {
      id: true,
      name: true,
      visibility: true,
      discoverable: true,
    },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canManageBookQueue(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  // Validate optional bookId via canReadBook (positional signature)
  if (parsed.data.bookId) {
    const access = await canReadBook(parsed.data.bookId, userId)
    if (!access.ok) return { success: false, error: 'BOOK_NOT_FOUND' }
  }

  if (parsed.data.status === 'CURRENT') {
    const newRowId = createId()
    await db.transaction(async (tx) => {
      // Insert as QUEUE first (partial unique allows multiple QUEUE rows).
      await tx.insert(bookClubBooks).values({
        id: newRowId,
        clubId: parsed.data.clubId,
        bookId: parsed.data.bookId ?? null,
        title: parsed.data.title,
        author: parsed.data.author,
        coverUrl: parsed.data.coverUrl ?? null,
        status: 'QUEUE',
      })
      // Then delegate the transition.
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
  }

  // QUEUE: simple insert with next order
  const id = createId()
  await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select({
        maxOrder: sql<number>`coalesce(max(${bookClubBooks.order}), -1)::int`,
      })
      .from(bookClubBooks)
      .where(
        and(
          eq(bookClubBooks.clubId, parsed.data.clubId),
          eq(bookClubBooks.status, 'QUEUE'),
        ),
      )
    const maxOrder = orderRow?.maxOrder ?? -1
    await tx.insert(bookClubBooks).values({
      id,
      clubId: parsed.data.clubId,
      bookId: parsed.data.bookId ?? null,
      title: parsed.data.title,
      author: parsed.data.author,
      coverUrl: parsed.data.coverUrl ?? null,
      status: 'QUEUE',
      order: maxOrder + 1,
    })
  })
  return { success: true, data: { id } }
}

export async function updateClubBookAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.updateClubBookSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const row = await db.query.bookClubBooks.findFirst({
    where: eq(bookClubBooks.id, parsed.data.rowId),
    columns: { clubId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, row.clubId)
  if (!canManageBookQueue(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  const updates: Partial<typeof bookClubBooks.$inferInsert> = {}
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.author !== undefined) updates.author = parsed.data.author
  if (parsed.data.coverUrl !== undefined) updates.coverUrl = parsed.data.coverUrl
  if (parsed.data.order !== undefined) updates.order = parsed.data.order

  await db.update(bookClubBooks).set(updates).where(eq(bookClubBooks.id, parsed.data.rowId))
  return { success: true, data: { updated: true } }
}

export async function setCurrentBookAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.rowIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const row = await db.query.bookClubBooks.findFirst({
    where: eq(bookClubBooks.id, parsed.data.rowId),
    columns: { clubId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, row.clubId),
    columns: { id: true, name: true, visibility: true, discoverable: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, row.clubId)
  if (!canManageBookQueue(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db.transaction(async (tx) => {
    await deriveCurrentBookTx(tx, {
      clubId: row.clubId,
      newCurrentBookId: parsed.data.rowId,
      actorId: userId,
      clubName: club.name,
      clubVisibility: club.visibility,
      clubDiscoverable: club.discoverable,
    })
  })
  return { success: true, data: { updated: true } }
}

export async function removeClubBookAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.rowIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const row = await db.query.bookClubBooks.findFirst({
    where: eq(bookClubBooks.id, parsed.data.rowId),
    columns: { clubId: true, status: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  if (row.status === 'CURRENT') {
    return { success: false, error: 'CANNOT_REMOVE_CURRENT' }
  }

  const membership = await getClubMembership(userId, row.clubId)
  if (!canManageBookQueue(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db.delete(bookClubBooks).where(eq(bookClubBooks.id, parsed.data.rowId))
  return { success: true, data: { removed: true } }
}

export async function reorderClubQueueAction(
  input: unknown,
): Promise<ActionResult<{ reordered: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.reorderQueueSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canManageBookQueue(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.orderedIds.length; i++) {
      await tx
        .update(bookClubBooks)
        .set({ order: i })
        .where(
          and(
            eq(bookClubBooks.id, parsed.data.orderedIds[i]),
            eq(bookClubBooks.clubId, parsed.data.clubId),
            eq(bookClubBooks.status, 'QUEUE'),
          ),
        )
    }
  })
  return { success: true, data: { reordered: true } }
}

export async function getClubBooksAction(input: {
  clubId: string
  status?: BookClubBookStatus
}): Promise<ActionResult<{ rows: ClubBookRow[] }>> {
  const viewerId = await getOptionalUserId()
  const parsed = v.getClubBooksInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(viewerId, parsed.data.clubId)
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const conditions = [eq(bookClubBooks.clubId, parsed.data.clubId)]
  if (parsed.data.status) {
    conditions.push(eq(bookClubBooks.status, parsed.data.status))
  }

  const rows = await db
    .select({
      id: bookClubBooks.id,
      clubId: bookClubBooks.clubId,
      bookId: bookClubBooks.bookId,
      storedTitle: bookClubBooks.title,
      storedAuthor: bookClubBooks.author,
      storedCoverUrl: bookClubBooks.coverUrl,
      status: bookClubBooks.status,
      order: bookClubBooks.order,
      addedAt: bookClubBooks.addedAt,
      startedAt: bookClubBooks.startedAt,
      finishedAt: bookClubBooks.finishedAt,
      bookTitle: books.title,
      bookCoverUrl: books.coverUrl,
    })
    .from(bookClubBooks)
    .leftJoin(books, eq(books.id, bookClubBooks.bookId))
    .where(and(...conditions))
    .orderBy(asc(bookClubBooks.order), asc(bookClubBooks.addedAt))

  const result: ClubBookRow[] = rows.map((r) => ({
    id: r.id,
    clubId: r.clubId,
    bookId: r.bookId,
    title: r.bookId && r.bookTitle ? r.bookTitle : r.storedTitle,
    author: r.storedAuthor,
    coverUrl: r.bookId && r.bookCoverUrl ? r.bookCoverUrl : r.storedCoverUrl,
    status: r.status,
    order: r.order,
    addedAt: r.addedAt,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  }))

  return { success: true, data: { rows: result } }
}

export async function addScheduleItemAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = v.addScheduleItemSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canManageSchedule(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  // Verify bookId belongs to clubId
  const book = await db.query.bookClubBooks.findFirst({
    where: and(
      eq(bookClubBooks.id, parsed.data.bookId),
      eq(bookClubBooks.clubId, parsed.data.clubId),
    ),
    columns: { id: true },
  })
  if (!book) return { success: false, error: 'BOOK_NOT_IN_CLUB' }

  const id = createId()
  await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select({
        maxOrder: sql<number>`coalesce(max(${bookClubScheduleItems.order}), -1)::int`,
      })
      .from(bookClubScheduleItems)
      .where(
        and(
          eq(bookClubScheduleItems.clubId, parsed.data.clubId),
          eq(bookClubScheduleItems.bookId, parsed.data.bookId),
        ),
      )
    const maxOrder = orderRow?.maxOrder ?? -1
    await tx.insert(bookClubScheduleItems).values({
      id,
      clubId: parsed.data.clubId,
      bookId: parsed.data.bookId,
      chapterStart: parsed.data.chapterStart,
      chapterEnd: parsed.data.chapterEnd,
      targetDate: parsed.data.targetDate,
      label: parsed.data.label ?? null,
      order: maxOrder + 1,
    })
  })
  return { success: true, data: { id } }
}

export async function updateScheduleItemAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.updateScheduleItemSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const item = await db.query.bookClubScheduleItems.findFirst({
    where: eq(bookClubScheduleItems.id, parsed.data.itemId),
    columns: { clubId: true },
  })
  if (!item) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, item.clubId)
  if (!canManageSchedule(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  const updates: Partial<typeof bookClubScheduleItems.$inferInsert> = {}
  if (parsed.data.chapterStart !== undefined) updates.chapterStart = parsed.data.chapterStart
  if (parsed.data.chapterEnd !== undefined) updates.chapterEnd = parsed.data.chapterEnd
  if (parsed.data.targetDate !== undefined) updates.targetDate = parsed.data.targetDate
  if (parsed.data.label !== undefined) updates.label = parsed.data.label
  if (parsed.data.order !== undefined) updates.order = parsed.data.order

  await db
    .update(bookClubScheduleItems)
    .set(updates)
    .where(eq(bookClubScheduleItems.id, parsed.data.itemId))
  return { success: true, data: { updated: true } }
}

export async function removeScheduleItemAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.itemIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const item = await db.query.bookClubScheduleItems.findFirst({
    where: eq(bookClubScheduleItems.id, parsed.data.itemId),
    columns: { clubId: true },
  })
  if (!item) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, item.clubId)
  if (!canManageSchedule(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db
    .delete(bookClubScheduleItems)
    .where(eq(bookClubScheduleItems.id, parsed.data.itemId))
  return { success: true, data: { removed: true } }
}

export async function getClubScheduleAction(
  clubId: string,
  bookId?: string,
): Promise<ActionResult<{ items: ClubScheduleItem[] }>> {
  const viewerId = await getOptionalUserId()

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(viewerId, clubId)
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const conditions = [eq(bookClubScheduleItems.clubId, clubId)]
  if (bookId) conditions.push(eq(bookClubScheduleItems.bookId, bookId))

  const items = await db
    .select()
    .from(bookClubScheduleItems)
    .where(and(...conditions))
    .orderBy(asc(bookClubScheduleItems.targetDate), asc(bookClubScheduleItems.order))

  return { success: true, data: { items } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T8 — Discussions + replies + likes
// ═════════════════════════════════════════════════════════════════════════════

export async function createClubDiscussionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = v.createDiscussionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, parsed.data.clubId)
  if (!canPostDiscussion(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }
  if (!(await canViewClub(userId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const id = createId()
  await db.insert(bookClubDiscussions).values({
    id,
    clubId: parsed.data.clubId,
    authorId: userId,
    title: parsed.data.title,
    content: parsed.data.content,
  })
  return { success: true, data: { id } }
}

export async function updateClubDiscussionAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.updateDiscussionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, parsed.data.discussionId),
    columns: { authorId: true, clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  const isAuthor = discussion.authorId === userId
  const isModPlus = membership.role === 'OWNER' || membership.role === 'MODERATOR'
  if (!isAuthor && !isModPlus) return { success: false, error: 'NOT_ALLOWED' }

  const updates: Partial<typeof bookClubDiscussions.$inferInsert> = {}
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.content !== undefined) updates.content = parsed.data.content
  updates.updatedAt = new Date()

  await db
    .update(bookClubDiscussions)
    .set(updates)
    .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
  return { success: true, data: { updated: true } }
}

export async function deleteClubDiscussionAction(
  input: unknown,
): Promise<ActionResult<{ deleted: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.discussionIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, parsed.data.discussionId),
    columns: { authorId: true, clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  const isAuthor = discussion.authorId === userId
  const isModPlus = membership.role === 'OWNER' || membership.role === 'MODERATOR'
  if (!isAuthor && !isModPlus) return { success: false, error: 'NOT_ALLOWED' }

  await db
    .delete(bookClubDiscussions)
    .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
  return { success: true, data: { deleted: true } }
}

export async function pinClubDiscussionAction(
  input: unknown,
): Promise<ActionResult<{ pinned: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.pinDiscussionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, parsed.data.discussionId),
    columns: { clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  if (!canPinDiscussion(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  await db
    .update(bookClubDiscussions)
    .set({ isPinned: parsed.data.pin, updatedAt: new Date() })
    .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
  return { success: true, data: { pinned: parsed.data.pin } }
}

export async function replyToClubDiscussionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = v.replyToDiscussionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, parsed.data.discussionId),
    columns: { clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, discussion.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  if (!canPostDiscussion(membership.role)) {
    return { success: false, error: 'NOT_ALLOWED' }
  }
  if (!(await canViewClub(userId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const id = createId()
  await db.transaction(async (tx) => {
    await tx.insert(bookClubDiscussionReplies).values({
      id,
      discussionId: parsed.data.discussionId,
      authorId: userId,
      content: parsed.data.content,
    })
    await tx
      .update(bookClubDiscussions)
      .set({ replyCount: sql`${bookClubDiscussions.replyCount} + 1` })
      .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
  })
  return { success: true, data: { id } }
}

export async function deleteClubDiscussionReplyAction(
  input: unknown,
): Promise<ActionResult<{ deleted: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.replyIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const reply = await db.query.bookClubDiscussionReplies.findFirst({
    where: eq(bookClubDiscussionReplies.id, parsed.data.replyId),
    columns: { authorId: true, discussionId: true },
  })
  if (!reply) return { success: false, error: 'NOT_FOUND' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, reply.discussionId),
    columns: { clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  const isAuthor = reply.authorId === userId
  const isModPlus = membership.role === 'OWNER' || membership.role === 'MODERATOR'
  if (!isAuthor && !isModPlus) return { success: false, error: 'NOT_ALLOWED' }

  await db.transaction(async (tx) => {
    await tx
      .delete(bookClubDiscussionReplies)
      .where(eq(bookClubDiscussionReplies.id, parsed.data.replyId))
    await tx
      .update(bookClubDiscussions)
      .set({ replyCount: sql`greatest(${bookClubDiscussions.replyCount} - 1, 0)` })
      .where(eq(bookClubDiscussions.id, reply.discussionId))
  })
  return { success: true, data: { deleted: true } }
}

export async function toggleClubDiscussionLikeAction(
  input: unknown,
): Promise<ActionResult<{ liked: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.discussionIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, parsed.data.discussionId),
    columns: { clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, discussion.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  if (!(await canViewClub(userId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  let liked = false
  await db.transaction(async (tx) => {
    const existing = await tx.query.bookClubDiscussionLikes.findFirst({
      where: and(
        eq(bookClubDiscussionLikes.userId, userId),
        eq(bookClubDiscussionLikes.discussionId, parsed.data.discussionId),
      ),
    })
    if (existing) {
      await tx
        .delete(bookClubDiscussionLikes)
        .where(
          and(
            eq(bookClubDiscussionLikes.userId, userId),
            eq(bookClubDiscussionLikes.discussionId, parsed.data.discussionId),
          ),
        )
      await tx
        .update(bookClubDiscussions)
        .set({
          likeCount: sql`greatest(${bookClubDiscussions.likeCount} - 1, 0)`,
        })
        .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
      liked = false
    } else {
      await tx.insert(bookClubDiscussionLikes).values({
        userId,
        discussionId: parsed.data.discussionId,
      })
      await tx
        .update(bookClubDiscussions)
        .set({ likeCount: sql`${bookClubDiscussions.likeCount} + 1` })
        .where(eq(bookClubDiscussions.id, parsed.data.discussionId))
      liked = true
    }
  })
  return { success: true, data: { liked } }
}

export async function toggleClubReplyLikeAction(
  input: unknown,
): Promise<ActionResult<{ liked: boolean }>> {
  const userId = await requireAuth()
  const parsed = v.replyIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const reply = await db.query.bookClubDiscussionReplies.findFirst({
    where: eq(bookClubDiscussionReplies.id, parsed.data.replyId),
    columns: { discussionId: true },
  })
  if (!reply) return { success: false, error: 'NOT_FOUND' }

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, reply.discussionId),
    columns: { clubId: true },
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, discussion.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(userId, discussion.clubId)
  if (!(await canViewClub(userId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  let liked = false
  await db.transaction(async (tx) => {
    const existing = await tx.query.bookClubDiscussionReplyLikes.findFirst({
      where: and(
        eq(bookClubDiscussionReplyLikes.userId, userId),
        eq(bookClubDiscussionReplyLikes.replyId, parsed.data.replyId),
      ),
    })
    if (existing) {
      await tx
        .delete(bookClubDiscussionReplyLikes)
        .where(
          and(
            eq(bookClubDiscussionReplyLikes.userId, userId),
            eq(bookClubDiscussionReplyLikes.replyId, parsed.data.replyId),
          ),
        )
      await tx
        .update(bookClubDiscussionReplies)
        .set({
          likeCount: sql`greatest(${bookClubDiscussionReplies.likeCount} - 1, 0)`,
        })
        .where(eq(bookClubDiscussionReplies.id, parsed.data.replyId))
      liked = false
    } else {
      await tx.insert(bookClubDiscussionReplyLikes).values({
        userId,
        replyId: parsed.data.replyId,
      })
      await tx
        .update(bookClubDiscussionReplies)
        .set({ likeCount: sql`${bookClubDiscussionReplies.likeCount} + 1` })
        .where(eq(bookClubDiscussionReplies.id, parsed.data.replyId))
      liked = true
    }
  })
  return { success: true, data: { liked } }
}

export async function listClubDiscussionsAction(input: {
  clubId: string
  cursor?: string
  limit?: number
}): Promise<ActionResult<{ rows: ClubDiscussionRow[]; nextCursor: string | null }>> {
  const viewerId = await getOptionalUserId()
  const parsed = v.listDiscussionsInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(viewerId, parsed.data.clubId)
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const limit = Math.min(parsed.data.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const cursor = decodeCursor(parsed.data.cursor)
  const overFetch = limit + 1

  const cursorCondition = cursor
    ? or(
        lt(bookClubDiscussions.createdAt, new Date(cursor.createdAt)),
        and(
          eq(bookClubDiscussions.createdAt, new Date(cursor.createdAt)),
          lt(bookClubDiscussions.id, cursor.id),
        ),
      )
    : undefined

  const baseWhere = eq(bookClubDiscussions.clubId, parsed.data.clubId)

  const rows = await db
    .select({
      id: bookClubDiscussions.id,
      clubId: bookClubDiscussions.clubId,
      authorId: bookClubDiscussions.authorId,
      title: bookClubDiscussions.title,
      content: bookClubDiscussions.content,
      isPinned: bookClubDiscussions.isPinned,
      likeCount: bookClubDiscussions.likeCount,
      replyCount: bookClubDiscussions.replyCount,
      createdAt: bookClubDiscussions.createdAt,
      updatedAt: bookClubDiscussions.updatedAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(bookClubDiscussions)
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubDiscussions.authorId))
    .where(cursorCondition ? and(baseWhere, cursorCondition) : baseWhere)
    .orderBy(
      desc(bookClubDiscussions.isPinned),
      desc(bookClubDiscussions.createdAt),
      desc(bookClubDiscussions.id),
    )
    .limit(overFetch)

  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null

  // Viewer-liked set via two-query stitch
  let likedSet = new Set<string>()
  if (viewerId && page.length > 0) {
    const likedRows = await db
      .select({ discussionId: bookClubDiscussionLikes.discussionId })
      .from(bookClubDiscussionLikes)
      .where(
        and(
          eq(bookClubDiscussionLikes.userId, viewerId),
          inArray(
            bookClubDiscussionLikes.discussionId,
            page.map((r) => r.id),
          ),
        ),
      )
    likedSet = new Set(likedRows.map((r) => r.discussionId))
  }

  const result: ClubDiscussionRow[] = page.map((r) => ({
    id: r.id,
    clubId: r.clubId,
    authorId: r.authorId,
    title: r.title,
    content: r.content,
    isPinned: r.isPinned,
    likeCount: r.likeCount,
    replyCount: r.replyCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: {
      userId: r.authorId,
      username: r.authorUsername,
      displayName: r.authorDisplayName,
      avatarUrl: r.authorAvatarUrl,
    },
    viewerLiked: likedSet.has(r.id),
  }))

  return { success: true, data: { rows: result, nextCursor } }
}

export async function getClubDiscussionAction(
  discussionId: string,
): Promise<
  ActionResult<{
    discussion: ClubDiscussionRow
    replies: ClubDiscussionReply[]
  }>
> {
  const viewerId = await getOptionalUserId()

  const discussion = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, discussionId),
  })
  if (!discussion) return { success: false, error: 'NOT_FOUND' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, discussion.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(viewerId, discussion.clubId)
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  // Author profile
  const [authorProfile] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, discussion.authorId))
    .limit(1)

  // Viewer's like on the post
  let viewerLikedPost = false
  if (viewerId) {
    const row = await db.query.bookClubDiscussionLikes.findFirst({
      where: and(
        eq(bookClubDiscussionLikes.userId, viewerId),
        eq(bookClubDiscussionLikes.discussionId, discussionId),
      ),
    })
    viewerLikedPost = !!row
  }

  // Replies
  const replyRows = await db
    .select({
      id: bookClubDiscussionReplies.id,
      discussionId: bookClubDiscussionReplies.discussionId,
      authorId: bookClubDiscussionReplies.authorId,
      content: bookClubDiscussionReplies.content,
      likeCount: bookClubDiscussionReplies.likeCount,
      createdAt: bookClubDiscussionReplies.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(bookClubDiscussionReplies)
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubDiscussionReplies.authorId))
    .where(eq(bookClubDiscussionReplies.discussionId, discussionId))
    .orderBy(asc(bookClubDiscussionReplies.createdAt))

  // Viewer-liked replies
  let likedReplySet = new Set<string>()
  if (viewerId && replyRows.length > 0) {
    const likes = await db
      .select({ replyId: bookClubDiscussionReplyLikes.replyId })
      .from(bookClubDiscussionReplyLikes)
      .where(
        and(
          eq(bookClubDiscussionReplyLikes.userId, viewerId),
          inArray(
            bookClubDiscussionReplyLikes.replyId,
            replyRows.map((r) => r.id),
          ),
        ),
      )
    likedReplySet = new Set(likes.map((r) => r.replyId))
  }

  const replies: ClubDiscussionReply[] = replyRows.map((r) => ({
    id: r.id,
    discussionId: r.discussionId,
    authorId: r.authorId,
    content: r.content,
    likeCount: r.likeCount,
    createdAt: r.createdAt,
    author: {
      userId: r.authorId,
      username: r.authorUsername,
      displayName: r.authorDisplayName,
      avatarUrl: r.authorAvatarUrl,
    },
    viewerLiked: likedReplySet.has(r.id),
  }))

  const discussionRow: ClubDiscussionRow = {
    id: discussion.id,
    clubId: discussion.clubId,
    authorId: discussion.authorId,
    title: discussion.title,
    content: discussion.content,
    isPinned: discussion.isPinned,
    likeCount: discussion.likeCount,
    replyCount: discussion.replyCount,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    author: {
      userId: discussion.authorId,
      username: authorProfile?.username ?? null,
      displayName: authorProfile?.displayName ?? null,
      avatarUrl: authorProfile?.avatarUrl ?? null,
    },
    viewerLiked: viewerLikedPost,
  }

  return { success: true, data: { discussion: discussionRow, replies } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T9 — Extras (count for section rail)
// ═════════════════════════════════════════════════════════════════════════════

export async function getMyClubsCountAction(): Promise<ActionResult<{ count: number }>> {
  const userId = await requireAuth()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookClubMembers)
    .where(eq(bookClubMembers.userId, userId))
  return { success: true, data: { count: row?.count ?? 0 } }
}

// ═════════════════════════════════════════════════════════════════════════════
// T13 — Member roster
// ═════════════════════════════════════════════════════════════════════════════

export type ClubMemberListItem = {
  id: string
  userId: string
  role: BookClubMemberRole
  joinedAt: Date
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export async function listClubMembersAction(input: {
  clubId: string
}): Promise<ActionResult<{ members: ClubMemberListItem[] }>> {
  const viewerId = await getOptionalUserId()
  const parsed = v.clubIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, parsed.data.clubId),
    columns: { id: true, ownerId: true, visibility: true },
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = viewerId
    ? await getClubMembership(viewerId, club.id)
    : { role: null }
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' } // masquerade
  }

  const rows = await db
    .select({
      id: bookClubMembers.id,
      userId: bookClubMembers.userId,
      role: bookClubMembers.role,
      joinedAt: bookClubMembers.joinedAt,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(bookClubMembers)
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubMembers.userId))
    .where(eq(bookClubMembers.clubId, club.id))
    .orderBy(
      // OWNER first, then MOD, then MEMBER; within role, oldest first.
      sql`case ${bookClubMembers.role} when 'OWNER' then 0 when 'MODERATOR' then 1 else 2 end`,
      asc(bookClubMembers.joinedAt),
    )

  return { success: true, data: { members: rows } }
}
