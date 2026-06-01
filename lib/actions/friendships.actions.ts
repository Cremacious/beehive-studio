'use server'

import { db } from '@/db'
import { friendships, userProfiles } from '@/db/schema'
import { and, desc, eq, or } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'
import {
  sendFriendRequestSchema,
  friendshipIdSchema,
  unfriendSchema,
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
  const userId = await requireAuth()
  const parsed = sendFriendRequestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { recipientId } = parsed.data
  if (recipientId === userId) return { success: false, error: 'CANNOT_FRIEND_SELF' }

  const existing = await findPairRow(userId, recipientId)
  if (existing) {
    if (existing.status === 'ACCEPTED') return { success: false, error: 'ALREADY_FRIENDS' }
    // PENDING
    if (existing.requesterId === userId) {
      return { success: false, error: 'ALREADY_REQUESTED' }
    }
    // PENDING_INCOMING → auto-accept
    await db
      .update(friendships)
      .set({ status: 'ACCEPTED', acceptedAt: new Date() })
      .where(eq(friendships.id, existing.id))
    return { success: true, data: { autoAccepted: true } }
  }

  await db.insert(friendships).values({
    requesterId: userId,
    recipientId,
    status: 'PENDING',
  })
  return { success: true, data: { autoAccepted: false } }
}

export async function acceptFriendRequestAction(
  input: { friendshipId: string },
): Promise<ActionResult<null>> {
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

  await db
    .update(friendships)
    .set({ status: 'ACCEPTED', acceptedAt: new Date() })
    .where(eq(friendships.id, row.id))
  return { success: true, data: null }
}

export async function rejectFriendRequestAction(
  input: { friendshipId: string },
): Promise<ActionResult<null>> {
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
}

export async function cancelFriendRequestAction(
  input: { friendshipId: string },
): Promise<ActionResult<null>> {
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
}

export async function unfriendAction(
  input: { otherUserId: string },
): Promise<ActionResult<null>> {
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
