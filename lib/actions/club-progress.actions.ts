'use server'

import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  bookClubs,
  bookClubMembers,
  clubMemberProgress,
  type BookClubMemberRole,
} from '@/db/schema/social'
import { userProfiles } from '@/db/schema/auth'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { getClubMembership } from '@/lib/book-clubs/get-membership'
import { canViewClub } from '@/lib/book-clubs/predicates'
import { runAction } from './safe-action'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemberProgressRow = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  role: BookClubMemberRole
  isOnTrack: boolean
  updatedAt: Date | null
}

export type ClubProgressData = {
  currentProgressValue: number | null
  totalProgressValue: number | null
  progressUnit: string | null
  currentReadingGoalDescription: string | null
  currentReadingGoalDeadline: Date | null
  currentBookId: string | null
  memberProgress: MemberProgressRow[]
  onTrackCount: number
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getClubProgressAction(
  clubId: string,
): Promise<ActionResult<ClubProgressData>> {
  const viewerId = await getOptionalUserId()

  const club = await db.query.bookClubs.findFirst({
    where: eq(bookClubs.id, clubId),
  })
  if (!club) return { success: false, error: 'NOT_FOUND' }

  const membership = await getClubMembership(viewerId, clubId)
  if (!(await canViewClub(viewerId, club, membership))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  // All members with their on-track status for the current book
  const members = await db
    .select({
      userId: bookClubMembers.userId,
      role: bookClubMembers.role,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(bookClubMembers)
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubMembers.userId))
    .where(eq(bookClubMembers.clubId, clubId))
    .orderBy(bookClubMembers.joinedAt)

  let progressMap = new Map<string, { isOnTrack: boolean; updatedAt: Date }>()
  if (club.currentBookId) {
    const progressRows = await db
      .select()
      .from(clubMemberProgress)
      .where(
        and(
          eq(clubMemberProgress.clubId, clubId),
          eq(clubMemberProgress.bookId, club.currentBookId),
        ),
      )
    for (const row of progressRows) {
      progressMap.set(row.userId, {
        isOnTrack: row.isOnTrack,
        updatedAt: row.updatedAt,
      })
    }
  }

  const memberProgress: MemberProgressRow[] = members.map((m) => {
    const prog = progressMap.get(m.userId)
    return {
      userId: m.userId,
      username: m.username,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      role: m.role,
      isOnTrack: prog?.isOnTrack ?? true,
      updatedAt: prog?.updatedAt ?? null,
    }
  })

  const onTrackCount = memberProgress.filter((m) => m.isOnTrack).length

  return {
    success: true,
    data: {
      currentProgressValue: club.currentProgressValue ?? null,
      totalProgressValue: club.totalProgressValue ?? null,
      progressUnit: club.progressUnit ?? null,
      currentReadingGoalDescription: club.currentReadingGoalDescription ?? null,
      currentReadingGoalDeadline: club.currentReadingGoalDeadline ?? null,
      currentBookId: club.currentBookId ?? null,
      memberProgress,
      onTrackCount,
    },
  }
}

export async function updateGroupProgressAction(input: {
  clubId: string
  currentProgressValue: number
  totalProgressValue: number
  progressUnit: 'page' | 'chapter'
  goalDescription?: string | null
  goalDeadline?: string | null
}): Promise<ActionResult<{ updated: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()

    const club = await db.query.bookClubs.findFirst({
      where: eq(bookClubs.id, input.clubId),
    })
    if (!club) return { success: false, error: 'NOT_FOUND' }

    const membership = await getClubMembership(userId, input.clubId)
    if (membership.role !== 'OWNER' && membership.role !== 'MODERATOR') {
      return { success: false, error: 'NOT_AUTHORIZED' }
    }

    if (input.currentProgressValue < 0 || input.totalProgressValue < 1) {
      return { success: false, error: 'INVALID_INPUT' }
    }

    await db
      .update(bookClubs)
      .set({
        currentProgressValue: input.currentProgressValue,
        totalProgressValue: input.totalProgressValue,
        progressUnit: input.progressUnit,
        ...(input.goalDescription !== undefined
          ? { currentReadingGoalDescription: input.goalDescription }
          : {}),
        ...(input.goalDeadline !== undefined
          ? {
              currentReadingGoalDeadline: input.goalDeadline
                ? new Date(input.goalDeadline)
                : null,
            }
          : {}),
      })
      .where(eq(bookClubs.id, input.clubId))

    return { success: true, data: { updated: true } }
  })
}

export async function clearGroupProgressAction(input: {
  clubId: string
}): Promise<ActionResult<{ updated: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()

    const membership = await getClubMembership(userId, input.clubId)
    if (membership.role !== 'OWNER' && membership.role !== 'MODERATOR') {
      return { success: false, error: 'NOT_AUTHORIZED' }
    }

    await db
      .update(bookClubs)
      .set({
        currentProgressValue: null,
        totalProgressValue: null,
        progressUnit: null,
        currentReadingGoalDescription: null,
        currentReadingGoalDeadline: null,
      })
      .where(eq(bookClubs.id, input.clubId))

    return { success: true, data: { updated: true } }
  })
}

export async function toggleMemberOnTrackAction(input: {
  clubId: string
  isOnTrack: boolean
}): Promise<ActionResult<{ isOnTrack: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()

    const club = await db.query.bookClubs.findFirst({
      where: eq(bookClubs.id, input.clubId),
    })
    if (!club) return { success: false, error: 'NOT_FOUND' }
    if (!club.currentBookId) return { success: false, error: 'NO_CURRENT_BOOK' }

    const membership = await getClubMembership(userId, input.clubId)
    if (membership.role === null) return { success: false, error: 'NOT_MEMBER' }

    // Upsert
    const existing = await db.query.clubMemberProgress.findFirst({
      where: and(
        eq(clubMemberProgress.clubId, input.clubId),
        eq(clubMemberProgress.userId, userId),
        eq(clubMemberProgress.bookId, club.currentBookId),
      ),
    })

    if (existing) {
      await db
        .update(clubMemberProgress)
        .set({ isOnTrack: input.isOnTrack, updatedAt: new Date() })
        .where(eq(clubMemberProgress.id, existing.id))
    } else {
      await db.insert(clubMemberProgress).values({
        id: createId(),
        clubId: input.clubId,
        userId,
        bookId: club.currentBookId,
        isOnTrack: input.isOnTrack,
        updatedAt: new Date(),
      })
    }

    return { success: true, data: { isOnTrack: input.isOnTrack } }
  })
}
