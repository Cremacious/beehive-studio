'use server'

import { db } from '@/db'
import { friendships, notifications, userBlocks, userProfiles } from '@/db/schema'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { isBlocked } from '@/lib/social/is-blocked'
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'
import { runAction } from './safe-action'
import type { ActionResult } from './book.actions'
import {
  sendFriendRequestSchema,
  friendshipIdSchema,
  unfriendSchema,
  searchUsersSchema,
} from '@/lib/validations/friendship'

export type FriendshipStatus =
  | 'NONE'
  | 'PENDING_OUTGOING'
  | 'PENDING_INCOMING'
  | 'ACCEPTED'

export type FriendSummary = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  friendsSince: Date
}

export type PendingRequest = {
  friendshipId: string
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  requestedAt: Date
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function findPairRow(a: string, b: string) {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, a), eq(friendships.recipientId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.recipientId, a)),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function sendFriendRequestAction(
  input: { recipientId: string },
): Promise<ActionResult<{ autoAccepted: boolean }>> {
  return runAction<{ autoAccepted: boolean }>(async () => {
  const userId = await requireAuth()
  const parsed = sendFriendRequestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { recipientId } = parsed.data
  if (recipientId === userId) return { success: false, error: 'CANNOT_FRIEND_SELF' }

  if (await isBlocked(userId, recipientId)) {
    return { success: false, error: 'BLOCKED' }
  }

  const existing = await findPairRow(userId, recipientId)
  if (existing) {
    if (existing.status === 'ACCEPTED') return { success: false, error: 'ALREADY_FRIENDS' }
    // PENDING
    if (existing.requesterId === userId) {
      return { success: false, error: 'ALREADY_REQUESTED' }
    }
    // PENDING_INCOMING → auto-accept (fires FRIEND_ACCEPTED to the original requester)
    const skipAutoAccept = await shouldSkipNotification(existing.requesterId, 'FRIEND_ACCEPTED')
    await db.transaction(async (tx) => {
      await tx
        .update(friendships)
        .set({ status: 'ACCEPTED', acceptedAt: new Date() })
        .where(eq(friendships.id, existing.id))
      if (!skipAutoAccept) {
        await tx.insert(notifications).values({
          userId: existing.requesterId,
          type: 'FRIEND_ACCEPTED',
          actorId: userId,
          resourceType: 'friendship',
          resourceId: existing.id,
        })
      }
    })
    return { success: true, data: { autoAccepted: true } }
  }

  const skipRequest = await shouldSkipNotification(recipientId, 'FRIEND_REQUEST')
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(friendships)
      .values({
        requesterId: userId,
        recipientId,
        status: 'PENDING',
      })
      .returning({ id: friendships.id })
    if (!inserted) throw new Error('FRIENDSHIP_INSERT_FAILED')
    if (!skipRequest) {
      await tx.insert(notifications).values({
        userId: recipientId,
        type: 'FRIEND_REQUEST',
        actorId: userId,
        resourceType: 'friendship',
        resourceId: inserted.id,
      })
    }
  })
  return { success: true, data: { autoAccepted: false } }
  })
}

export async function acceptFriendRequestAction(
  input: { friendshipId: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = friendshipIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, parsed.data.friendshipId))
    .limit(1)
  if (!row) return { success: false, error: 'NOT_FOUND' }
  if (row.recipientId !== userId) return { success: false, error: 'NOT_AUTHORIZED' }
  if (row.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  const skipAccepted = await shouldSkipNotification(row.requesterId, 'FRIEND_ACCEPTED')
  await db.transaction(async (tx) => {
    await tx
      .update(friendships)
      .set({ status: 'ACCEPTED', acceptedAt: new Date() })
      .where(eq(friendships.id, row.id))
    if (!skipAccepted) {
      await tx.insert(notifications).values({
        userId: row.requesterId,
        type: 'FRIEND_ACCEPTED',
        actorId: userId,
        resourceType: 'friendship',
        resourceId: row.id,
      })
    }
  })
  return { success: true, data: null }
  })
}

export async function rejectFriendRequestAction(
  input: { friendshipId: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = friendshipIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, parsed.data.friendshipId))
    .limit(1)
  if (!row) return { success: false, error: 'NOT_FOUND' }
  if (row.recipientId !== userId) return { success: false, error: 'NOT_AUTHORIZED' }
  if (row.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  await db.delete(friendships).where(eq(friendships.id, row.id))
  return { success: true, data: null }
  })
}

export async function cancelFriendRequestAction(
  input: { friendshipId: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = friendshipIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, parsed.data.friendshipId))
    .limit(1)
  if (!row) return { success: false, error: 'NOT_FOUND' }
  if (row.requesterId !== userId) return { success: false, error: 'NOT_AUTHORIZED' }
  if (row.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' }

  await db.delete(friendships).where(eq(friendships.id, row.id))
  return { success: true, data: null }
  })
}

/**
 * Cancel a pending outgoing friend request by the target user's id, without
 * needing the friendship row's PK. Used by surfaces that render the Cancel
 * Request button but don't have the row id handy (e.g. profile page when the
 * server projection failed to thread the id, or any future caller).
 */
export async function cancelFriendRequestByTargetAction(
  input: { targetUserId: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const targetUserId = input.targetUserId
  if (!targetUserId || typeof targetUserId !== 'string') {
    return { success: false, error: 'INVALID_INPUT' }
  }
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.requesterId, userId),
        eq(friendships.recipientId, targetUserId),
        eq(friendships.status, 'PENDING'),
      ),
    )
    .limit(1)
  if (!row) return { success: false, error: 'NOT_FOUND' }
  await db.delete(friendships).where(eq(friendships.id, row.id))
  return { success: true, data: null }
  })
}

export async function unfriendAction(
  input: { otherUserId: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = unfriendSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { otherUserId } = parsed.data
  if (otherUserId === userId) return { success: false, error: 'INVALID_INPUT' }

  const [row] = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'ACCEPTED'),
        or(
          and(eq(friendships.requesterId, userId), eq(friendships.recipientId, otherUserId)),
          and(eq(friendships.requesterId, otherUserId), eq(friendships.recipientId, userId)),
        ),
      ),
    )
    .limit(1)
  if (!row) return { success: false, error: 'NOT_FRIENDS' }

  await db.delete(friendships).where(eq(friendships.id, row.id))
  return { success: true, data: null }
  })
}

export async function getFriendshipStatusAction(
  otherUserId: string,
): Promise<ActionResult<FriendshipStatus>> {
  const userId = await requireAuth()
  if (otherUserId === userId) return { success: true, data: 'NONE' }
  const row = await findPairRow(userId, otherUserId)
  if (!row) return { success: true, data: 'NONE' }
  if (row.status === 'ACCEPTED') return { success: true, data: 'ACCEPTED' }
  // PENDING
  if (row.requesterId === userId) return { success: true, data: 'PENDING_OUTGOING' }
  return { success: true, data: 'PENDING_INCOMING' }
}

export async function listFriendsAction(): Promise<ActionResult<FriendSummary[]>> {
  const userId = await requireAuth()

  const rows = await db
    .select({
      id: friendships.id,
      requesterId: friendships.requesterId,
      recipientId: friendships.recipientId,
      acceptedAt: friendships.acceptedAt,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'ACCEPTED'),
        or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
      ),
    )
    .orderBy(desc(friendships.acceptedAt))

  if (rows.length === 0) return { success: true, data: [] }

  const otherIds = rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId))
  const profiles = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(or(...otherIds.map((id) => eq(userProfiles.userId, id))))
  const byId = new Map(profiles.map((p) => [p.userId, p]))

  const data: FriendSummary[] = rows.map((r) => {
    const otherId = r.requesterId === userId ? r.recipientId : r.requesterId
    const p = byId.get(otherId)
    return {
      userId: otherId,
      username: p?.username ?? null,
      displayName: p?.displayName ?? null,
      avatarUrl: p?.avatarUrl ?? null,
      friendsSince: r.acceptedAt ?? r.createdAt,
    }
  })
  return { success: true, data }
}

export async function listPendingFriendRequestsAction(): Promise<
  ActionResult<{ incoming: PendingRequest[]; outgoing: PendingRequest[] }>
> {
  const userId = await requireAuth()

  const rows = await db
    .select({
      id: friendships.id,
      requesterId: friendships.requesterId,
      recipientId: friendships.recipientId,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'PENDING'),
        or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
      ),
    )
    .orderBy(desc(friendships.createdAt))

  if (rows.length === 0) return { success: true, data: { incoming: [], outgoing: [] } }

  const otherIds = Array.from(
    new Set(rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId))),
  )
  const profiles = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(or(...otherIds.map((id) => eq(userProfiles.userId, id))))
  const byId = new Map(profiles.map((p) => [p.userId, p]))

  const incoming: PendingRequest[] = []
  const outgoing: PendingRequest[] = []
  for (const r of rows) {
    const isIncoming = r.recipientId === userId
    const otherId = isIncoming ? r.requesterId : r.recipientId
    const p = byId.get(otherId)
    const summary: PendingRequest = {
      friendshipId: r.id,
      userId: otherId,
      username: p?.username ?? null,
      displayName: p?.displayName ?? null,
      avatarUrl: p?.avatarUrl ?? null,
      requestedAt: r.createdAt,
    }
    if (isIncoming) incoming.push(summary)
    else outgoing.push(summary)
  }
  return { success: true, data: { incoming, outgoing } }
}

export type UserSearchResult = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export async function getFriendCountAction(
  targetUserId: string,
): Promise<ActionResult<number>> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'ACCEPTED'),
        or(
          eq(friendships.requesterId, targetUserId),
          eq(friendships.recipientId, targetUserId),
        ),
      ),
    )
  return { success: true, data: row?.count ?? 0 }
}

export async function searchUsersAction(
  input: { query: string; limit?: number },
): Promise<ActionResult<UserSearchResult[]>> {
  const userId = await requireAuth()
  const parsed = searchUsersSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { query, limit = 10 } = parsed.data

  const needle = `%${query}%`
  // Overscan so we can filter out self + blocked pairs and still return up to `limit`.
  const overscan = Math.max(limit * 3, limit + 5)

  const candidates = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(or(ilike(userProfiles.username, needle), ilike(userProfiles.displayName, needle)))
    .limit(overscan)

  const otherIds = candidates.map((c) => c.userId).filter((id) => id !== userId)
  if (otherIds.length === 0) return { success: true, data: [] }

  // Find any block row involving the viewer + a candidate (either direction).
  const blockRows = await db
    .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, userId), inArray(userBlocks.blockedId, otherIds)),
        and(eq(userBlocks.blockedId, userId), inArray(userBlocks.blockerId, otherIds)),
      ),
    )
  const blockedIds = new Set<string>()
  for (const r of blockRows) {
    blockedIds.add(r.blockerId === userId ? r.blockedId : r.blockerId)
  }

  const filtered: UserSearchResult[] = []
  for (const c of candidates) {
    if (c.userId === userId) continue
    if (blockedIds.has(c.userId)) continue
    filtered.push({
      userId: c.userId,
      username: c.username,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl,
    })
    if (filtered.length >= limit) break
  }
  return { success: true, data: filtered }
}
