'use server'

import { db } from '@/db'
import { hives, hiveMembers, hiveInvites, notifications, books } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveOwner, assertHiveAdmin } from './_helpers'
import { getUserPremiumStatus, FREE_HIVE_LIMIT, FREE_HIVE_MEMBER_LIMIT } from '@/lib/premium'
import { createHiveSchema, updateHiveSchema } from '@/lib/validations/hive'
import { getBookHive } from '@/lib/hive/get-book-hive'
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

export async function createHiveAction(input: unknown): Promise<ActionResult<{ hiveId: string }>> {
  try {
    const userId = await requireAuth()
    const parsed = createHiveSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const data = parsed.data

    // Free-tier limit (owned hives only)
    const isPremium = await getUserPremiumStatus(userId)
    if (!isPremium && (await getHiveCount(userId)) >= FREE_HIVE_LIMIT) {
      return { success: false, error: 'FREE_LIMIT_REACHED' }
    }

    // If bookId provided, verify ownership + uniqueness
    if (data.bookId) {
      const book = await db.query.books.findFirst({
        where: and(eq(books.id, data.bookId), eq(books.userId, userId)),
        columns: { id: true },
      })
      if (!book) return { success: false, error: 'BOOK_NOT_FOUND' }
      const existing = await getBookHive(data.bookId)
      if (existing) return { success: false, error: 'BOOK_ALREADY_HAS_HIVE' }
    }

    const hiveId = createId()
    await db.transaction(async (tx) => {
      await tx.insert(hives).values({
        id: hiveId,
        bookId: data.bookId ?? null,
        ownerId: userId,
        name: data.name,
        description: data.description ?? null,
        visibility: data.visibility,
        discoverable: data.discoverable,
      })
      await tx.insert(hiveMembers).values({
        hiveId,
        userId,
        role: 'OWNER',
      })
    })

    return { success: true, data: { hiveId } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
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
  const isEditor = isOwner || myMember?.role === 'MODERATOR'

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

export type MyHiveSummary = {
  id: string
  name: string
  memberCount: number
  isPublic: boolean
}

export async function getMyHivesAction(): Promise<ActionResult<MyHiveSummary[]>> {
  const userId = await requireAuth()

  const memberships = await db.query.hiveMembers.findMany({
    where: eq(hiveMembers.userId, userId),
    with: { hive: true },
  })

  const summaries = await Promise.all(
    memberships.map(async m => ({
      id: m.hive.id,
      name: m.hive.name,
      memberCount: await getHiveMemberCount(m.hive.id),
      isPublic: m.hive.visibility === 'PUBLIC',
    })),
  )

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

export async function inviteMemberByUsernameAction(hiveId: string, username: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveAdmin(hiveId, userId)

  const { userProfiles } = await import('@/db/schema')
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

export async function updateMemberRoleAction(hiveId: string, targetUserId: string, role: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'): Promise<ActionResult> {
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
