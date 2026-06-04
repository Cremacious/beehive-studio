'use server'

import { db } from '@/db'
import { hives, hiveMembers, hiveInvites, notifications, books } from '@/db/schema'
import { eq, and, count, sql, ne, or, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveOwner, assertHiveAdmin } from './_helpers'
import { getUserPremiumStatus, FREE_HIVE_LIMIT, FREE_HIVE_MEMBER_LIMIT } from '@/lib/premium'
import { createHiveSchema, updateHiveSchema } from '@/lib/validations/hive'
import { getBookHive } from '@/lib/hive/get-book-hive'
import { requireHiveMod } from '@/lib/hive/permissions'
import { recordHiveActivity } from '@/lib/hive/record-activity'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { friendships } from '@/db/schema/social'
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
  role: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'
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

    let bookId: string

    if (data.bookId) {
      // Linked-book path: verify ownership + uniqueness, refuse shadows.
      // Defensive ne(...) ensures the standalone-hive shadow can't be linked.
      const book = await db.query.books.findFirst({
        where: and(
          eq(books.id, data.bookId),
          eq(books.userId, userId),
          ne(books.status, 'STANDALONE_HIVE_SHADOW'),
        ),
        columns: { id: true },
      })
      if (!book) return { success: false, error: 'BOOK_NOT_FOUND' }
      const existing = await getBookHive(data.bookId)
      if (existing) return { success: false, error: 'BOOK_ALREADY_HAS_HIVE' }
      bookId = data.bookId
    } else {
      // Standalone path: create an invisible shadow book so hives.bookId is
      // always non-null. Title mirrors the hive name for admin debuggability.
      bookId = createId()
      await db.insert(books).values({
        id: bookId,
        userId,
        title: data.name,
        visibility: 'PRIVATE',
        discoverable: false,
        status: 'STANDALONE_HIVE_SHADOW',
      })
    }

    const hiveId = createId()
    await db.transaction(async (tx) => {
      await tx.insert(hives).values({
        id: hiveId,
        bookId,
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

      // C1 T8 hook: hive_created. Gate on PUBLIC+discoverable. Spec §3.4.
      if (data.visibility === 'PUBLIC' && data.discoverable === true) {
        await recordSocialActivityTx(tx, {
          actorId: userId,
          type: 'hive_created',
          subjectType: 'hive',
          subjectId: hiveId,
          payload: { name: data.name },
        })
      }
    })

    return { success: true, data: { hiveId } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export type HiveBookSummary = {
  id: string
  title: string
  coverUrl: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'STANDALONE_HIVE_SHADOW'
  userId: string
  authorUsername: string | null
}

export async function getHiveAction(hiveId: string): Promise<ActionResult<{
  hive: typeof hives.$inferSelect
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
  book: HiveBookSummary | null
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

  let book: HiveBookSummary | null = null
  if (hive.bookId) {
    const bookRow = await db.query.books.findFirst({
      where: eq(books.id, hive.bookId),
      columns: { id: true, title: true, coverUrl: true, status: true, userId: true },
    })
    if (bookRow) {
      const { userProfiles } = await import('@/db/schema')
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, bookRow.userId),
        columns: { username: true },
      })
      book = {
        id: bookRow.id,
        title: bookRow.title,
        coverUrl: bookRow.coverUrl,
        status: bookRow.status,
        userId: bookRow.userId,
        authorUsername: profile?.username ?? null,
      }
    }
  }

  return { success: true, data: { hive, members: members as HiveMemberRow[], isOwner, isEditor, book } }
}

// `getUserHivesAction` and `getMyHivesAction` deleted in H1 Task 6.
// Both fold into `getUserHivesView` shipping in H1 Task 7. Callers (e.g.
// `app/[locale]/(app)/community/page.tsx`) are stubbed until then.

export async function updateHiveAction(input: unknown): Promise<ActionResult<void>> {
  try {
    const userId = await requireAuth()
    const parsed = updateHiveSchema.parse(input)
    await requireHiveMod(parsed.hiveId, userId)

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.name !== undefined) patch.name = parsed.name
    if (parsed.description !== undefined) patch.description = parsed.description
    if (parsed.visibility !== undefined) patch.visibility = parsed.visibility
    if (parsed.discoverable !== undefined) patch.discoverable = parsed.discoverable

    await db.update(hives).set(patch).where(eq(hives.id, parsed.hiveId))
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
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

  await db.transaction(async (tx) => {
    await tx.insert(hiveMembers).values({ hiveId: invite.hiveId, userId, role: invite.role })

    // C1 T8 hook: hive_joined. Gate on PUBLIC+discoverable. Spec §3.4.
    const [hiveRow] = await tx
      .select({ name: hives.name, visibility: hives.visibility, discoverable: hives.discoverable })
      .from(hives)
      .where(eq(hives.id, invite.hiveId))
      .limit(1)
    if (hiveRow && hiveRow.visibility === 'PUBLIC' && hiveRow.discoverable === true) {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'hive_joined',
        subjectType: 'hive',
        subjectId: invite.hiveId,
        payload: { name: hiveRow.name },
      })
    }
  })
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

    // C1 T8 hook: hive_joined. Gate on PUBLIC+discoverable. Spec §3.4.
    const [hive] = await tx
      .select({ name: hives.name, visibility: hives.visibility, discoverable: hives.discoverable })
      .from(hives)
      .where(eq(hives.id, invite.hiveId))
      .limit(1)
    if (hive && hive.visibility === 'PUBLIC' && hive.discoverable === true) {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'hive_joined',
        subjectType: 'hive',
        subjectId: invite.hiveId,
        payload: { name: hive.name },
      })
    }
  })
  await recordHiveActivity({
    hiveId: invite.hiveId,
    actorId: userId,
    type: 'member_joined',
    subjectId: null,
    payload: { role: invite.role },
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

export async function getDiscoverableHivesAction(): Promise<ActionResult<HiveSummary[]>> {
  const viewerUserId = await requireAuth()

  // Pre-fetch viewer's ACCEPTED friend ids so FRIENDS-tier hives only surface
  // when the viewer is friends with the hive owner. PUBLIC hives surface
  // unconditionally; PRIVATE hives never surface.
  const friendRows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        eq(friendships.requesterId, viewerUserId),
        eq(friendships.recipientId, viewerUserId),
      ),
    ),
    columns: { requesterId: true, recipientId: true },
  })
  const friendIds = friendRows.map((r) =>
    r.requesterId === viewerUserId ? r.recipientId : r.requesterId,
  )

  const rows = await db.query.hives.findMany({
    where: and(
      eq(hives.discoverable, true),
      friendIds.length > 0
        ? or(
            eq(hives.visibility, 'PUBLIC'),
            and(eq(hives.visibility, 'FRIENDS'), inArray(hives.ownerId, friendIds)),
          )
        : eq(hives.visibility, 'PUBLIC'),
    ),
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

export type UserHiveView = {
  id: string
  name: string
  description: string | null
  bookId: string | null
  bookTitle: string | null
  bookCoverUrl: string | null
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  discoverable: boolean
  status: 'ACTIVE' | 'COMPLETED'
  memberCount: number
  lastActiveAt: Date | null
  viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'
}

/**
 * Projection for the /studio Hives section. Returns every hive the viewer
 * is a member of, with denormalized book + member count + last activity.
 * Ordered by most-recent activity (falling back to hive creation time).
 */
export async function getUserHivesView(): Promise<ActionResult<UserHiveView[]>> {
  try {
    const userId = await requireAuth()
    const result = await db.execute(sql`
      SELECT
        h.id,
        h.name,
        h.description,
        h.book_id          AS "bookId",
        b.title            AS "bookTitle",
        b.cover_url        AS "bookCoverUrl",
        h.visibility,
        h.discoverable,
        h.status,
        (SELECT COUNT(*)::int FROM hive_members WHERE hive_id = h.id) AS "memberCount",
        (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id) AS "lastActiveAt",
        m.role::text       AS "viewerRole"
      FROM hives h
      INNER JOIN hive_members m ON m.hive_id = h.id AND m.user_id = ${userId}
      LEFT JOIN books b ON b.id = h.book_id
      ORDER BY COALESCE(
        (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id),
        h.created_at
      ) DESC
    `)

    type RawRow = {
      id: string
      name: string
      description: string | null
      bookId: string | null
      bookTitle: string | null
      bookCoverUrl: string | null
      visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
      discoverable: boolean
      status: 'ACTIVE' | 'COMPLETED'
      memberCount: number
      lastActiveAt: string | Date | null
      viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'
    }

    const data: UserHiveView[] = (result.rows as RawRow[]).map((row) => ({
      ...row,
      lastActiveAt:
        row.lastActiveAt == null
          ? null
          : row.lastActiveAt instanceof Date
          ? row.lastActiveAt
          : new Date(row.lastActiveAt),
    }))

    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
