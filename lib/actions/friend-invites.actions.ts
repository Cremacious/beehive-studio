'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/db'
import { friendInvites, friendships, notifications } from '@/db/schema/social'
import { userProfiles } from '@/db/schema/auth'
import { and, eq, or } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { isBlocked } from '@/lib/social/is-blocked'
import { claimInviteSchema } from '@/lib/validations/social'
import type { ActionResult } from './book.actions'

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

export async function createFriendInviteAction(): Promise<
  ActionResult<{ token: string; expiresAt: Date }>
> {
  const userId = await requireAuth()
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  await db.insert(friendInvites).values({
    token,
    inviterId: userId,
    expiresAt,
  })

  return { success: true, data: { token, expiresAt } }
}

export async function claimFriendInviteAction(
  input: unknown,
): Promise<ActionResult<{ inviterUsername: string | null; alreadyFriends: boolean }>> {
  const userId = await requireAuth()
  const parsed = claimInviteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { token } = parsed.data

  const invite = await db.query.friendInvites.findFirst({
    where: eq(friendInvites.token, token),
    columns: {
      token: true,
      inviterId: true,
      expiresAt: true,
      claimedAt: true,
      claimedBy: true,
    },
  })

  if (!invite) return { success: false, error: 'TOKEN_NOT_FOUND' }
  if (invite.claimedAt !== null) {
    return { success: false, error: 'TOKEN_ALREADY_CLAIMED' }
  }
  if (invite.expiresAt < new Date()) {
    return { success: false, error: 'TOKEN_EXPIRED' }
  }
  if (invite.inviterId === userId) {
    return { success: false, error: 'SELF_INVITE' }
  }

  if (await isBlocked(userId, invite.inviterId)) {
    return { success: false, error: 'BLOCKED' }
  }

  const existing = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        and(
          eq(friendships.requesterId, invite.inviterId),
          eq(friendships.recipientId, userId),
        ),
        and(
          eq(friendships.requesterId, userId),
          eq(friendships.recipientId, invite.inviterId),
        ),
      ),
    ),
    columns: { id: true },
  })

  const inviterProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, invite.inviterId),
    columns: { username: true },
  })
  const inviterUsername = inviterProfile?.username ?? null

  if (existing) {
    await db
      .update(friendInvites)
      .set({ claimedBy: userId, claimedAt: new Date() })
      .where(eq(friendInvites.token, token))
    return { success: true, data: { inviterUsername, alreadyFriends: true } }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(friendInvites)
      .set({ claimedBy: userId, claimedAt: new Date() })
      .where(eq(friendInvites.token, token))

    const [newFriendship] = await tx
      .insert(friendships)
      .values({
        requesterId: invite.inviterId,
        recipientId: userId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      })
      .returning({ id: friendships.id })

    await tx.insert(notifications).values({
      userId: invite.inviterId,
      type: 'FRIEND_ACCEPTED',
      actorId: userId,
      resourceType: 'friendship',
      resourceId: newFriendship.id,
    })
  })

  return { success: true, data: { inviterUsername, alreadyFriends: false } }
}
