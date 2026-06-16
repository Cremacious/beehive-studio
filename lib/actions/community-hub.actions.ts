'use server'

/**
 * Community Hub Dashboard — highlight aggregator.
 *
 * One action, 15 parallel sub-queries (3 per category × 5 categories). Each
 * sub-query is independently try/caught so one failure doesn't take down the
 * whole rail. Caller is the /community page server component.
 *
 * Spec: docs/superpowers/specs/2026-06-16-community-hub-dashboard-design.md
 * Plan: docs/superpowers/plans/2026-06-16-community-hub-dashboard.md
 *
 * DB field reality notes (caught during implementation, mirrors community.actions.ts pattern):
 * - hiveWordLogs uses `wordsAdded` (NOT words_delta as the plan said).
 * - bookClubInvites uses `recipientId` (NOT recipient_user_id).
 * - bookClubDiscussionReplies has `authorId` + `createdAt` only; no parent_id (flat).
 * - readingLists uses `userId` (NOT ownerId).
 * - readingListFollows PK is (userId, listId); timestamp is `createdAt` (NOT followed_at).
 * - sparks.creatorId (NOT user_id).
 * - friendships uses requesterId/recipientId.
 * - bookClubs.name (NOT title); hives.name same.
 * - hiveSubmissions.draftStatus is a `text` column (not enum); v1 values: DRAFT/PENDING/APPROVED/REJECTED.
 */

import { cache } from 'react'
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '@/db'
import {
  hives,
  hiveMembers,
  hiveSubmissions,
  hiveWordGoals,
  hiveWordLogs,
} from '@/db/schema/hive'
import {
  bookClubs,
  bookClubBooks,
  bookClubMembers,
  bookClubInvites,
  bookClubDiscussions,
  bookClubDiscussionReplies,
  friendships,
  follows,
  readingLists,
  readingListBooks,
  readingListFollows,
  sparks,
  sparkEntries,
} from '@/db/schema/social'
import { books } from '@/db/schema/books'
import { userProfiles } from '@/db/schema/auth'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'
import { getSuggestedWritersAction } from './community.actions'

// ─── Public payload types ─────────────────────────────────────────────────────

export type HivePanelData = {
  pendingReviewCount: number
  pendingReviewHiveName: string | null
  pendingReviewHiveId: string | null
  wordGoalHiveName: string | null
  wordGoalHiveId: string | null
  wordGoalPct: number | null
  wordGoalDaysLeft: number | null
  staleHiveName: string | null
  staleHiveId: string | null
  staleDaysSinceActivity: number | null
}

export type SparksPanelData = {
  votingEndingTitle: string | null
  votingEndingId: string | null
  votingEndingHoursLeft: number | null
  awaitingResultCount: number
  openFromFollowedCount: number
  openFromFollowedAuthorUsername: string | null
}

export type ListsPanelData = {
  yourTrendingListName: string | null
  yourTrendingListId: string | null
  yourTrendingFollowerGain: number | null
  newFromFollowedListTitle: string | null
  newFromFollowedListId: string | null
  newFromFollowedAuthorUsername: string | null
  booksAddedListName: string | null
  booksAddedListId: string | null
  booksAddedCount: number | null
}

export type ClubsPanelData = {
  currentBookClubName: string | null
  currentBookClubId: string | null
  currentBookTitle: string | null
  unreadRepliesCount: number
  pendingInviteClubName: string | null
  pendingInviteClubId: string | null
  pendingInviteInviterUsername: string | null
}

export type FriendsPanelData = {
  pendingRequestsCount: number
  milestoneUsername: string | null
  milestoneType: 'first_book' | 'spark_win' | null
  suggestionsCount: number
}

export type CommunityHighlights = {
  hives: HivePanelData
  sparks: SparksPanelData
  lists: ListsPanelData
  clubs: ClubsPanelData
  friends: FriendsPanelData
}

export const EMPTY_HIGHLIGHTS: CommunityHighlights = {
  hives: {
    pendingReviewCount: 0,
    pendingReviewHiveName: null,
    pendingReviewHiveId: null,
    wordGoalHiveName: null,
    wordGoalHiveId: null,
    wordGoalPct: null,
    wordGoalDaysLeft: null,
    staleHiveName: null,
    staleHiveId: null,
    staleDaysSinceActivity: null,
  },
  sparks: {
    votingEndingTitle: null,
    votingEndingId: null,
    votingEndingHoursLeft: null,
    awaitingResultCount: 0,
    openFromFollowedCount: 0,
    openFromFollowedAuthorUsername: null,
  },
  lists: {
    yourTrendingListName: null,
    yourTrendingListId: null,
    yourTrendingFollowerGain: null,
    newFromFollowedListTitle: null,
    newFromFollowedListId: null,
    newFromFollowedAuthorUsername: null,
    booksAddedListName: null,
    booksAddedListId: null,
    booksAddedCount: null,
  },
  clubs: {
    currentBookClubName: null,
    currentBookClubId: null,
    currentBookTitle: null,
    unreadRepliesCount: 0,
    pendingInviteClubName: null,
    pendingInviteClubId: null,
    pendingInviteInviterUsername: null,
  },
  friends: {
    pendingRequestsCount: 0,
    milestoneUsername: null,
    milestoneType: null,
    suggestionsCount: 0,
  },
}

// ─── Helper: safe sub-query wrapper ───────────────────────────────────────────

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[community-hub] sub-query failed:', err)
    }
    return fallback
  }
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

// ─── HIVES sub-queries ────────────────────────────────────────────────────────

async function loadHivePendingReview(userId: string): Promise<{
  pendingReviewCount: number
  pendingReviewHiveName: string | null
  pendingReviewHiveId: string | null
}> {
  // OWNER/MODERATOR hives where pending submissions exist.
  // Returns aggregate count + the hive with the most pending.
  const rows = await db
    .select({
      hiveId: hives.id,
      hiveName: hives.name,
      pending: sql<number>`COUNT(${hiveSubmissions.id})::int`,
    })
    .from(hiveMembers)
    .innerJoin(hives, eq(hives.id, hiveMembers.hiveId))
    .innerJoin(hiveSubmissions, eq(hiveSubmissions.hiveId, hives.id))
    .where(and(
      eq(hiveMembers.userId, userId),
      inArray(hiveMembers.role, ['OWNER', 'MODERATOR']),
      eq(hiveSubmissions.draftStatus, 'PENDING'),
    ))
    .groupBy(hives.id, hives.name)
    .orderBy(sql`COUNT(${hiveSubmissions.id}) DESC`)
    .limit(5)

  const totalCount = rows.reduce((acc, r) => acc + (r.pending ?? 0), 0)
  const top = rows[0]
  return {
    pendingReviewCount: totalCount,
    pendingReviewHiveName: top?.hiveName ?? null,
    pendingReviewHiveId: top?.hiveId ?? null,
  }
}

async function loadHiveWordGoal(userId: string): Promise<{
  wordGoalHiveName: string | null
  wordGoalHiveId: string | null
  wordGoalPct: number | null
  wordGoalDaysLeft: number | null
}> {
  // Most-urgent active word goal (lowest progress %) for a hive viewer is in.
  const now = new Date()
  const rows = await db
    .select({
      hiveId: hives.id,
      hiveName: hives.name,
      target: hiveWordGoals.targetWords,
      endDate: hiveWordGoals.endDate,
      progress: sql<number>`COALESCE(SUM(${hiveWordLogs.wordsAdded}), 0)::int`,
    })
    .from(hiveWordGoals)
    .innerJoin(hives, eq(hives.id, hiveWordGoals.hiveId))
    .innerJoin(hiveMembers, and(
      eq(hiveMembers.hiveId, hives.id),
      eq(hiveMembers.userId, userId),
    ))
    .leftJoin(hiveWordLogs, and(
      eq(hiveWordLogs.hiveId, hiveWordGoals.hiveId),
      gte(hiveWordLogs.loggedAt, hiveWordGoals.startDate),
      // endDate is nullable for CUSTOM; treat NULL as far-future
      sql`(${hiveWordGoals.endDate} IS NULL OR ${hiveWordLogs.loggedAt} <= ${hiveWordGoals.endDate})`,
    ))
    .where(and(
      eq(hiveWordGoals.isActive, true),
      or(isNull(hiveWordGoals.endDate), gt(hiveWordGoals.endDate, now)),
    ))
    .groupBy(hives.id, hives.name, hiveWordGoals.id, hiveWordGoals.targetWords, hiveWordGoals.endDate)
    .orderBy(sql`COALESCE(SUM(${hiveWordLogs.wordsAdded}), 0)::float / NULLIF(${hiveWordGoals.targetWords}, 0) ASC`)
    .limit(1)

  const top = rows[0]
  if (!top || !top.target) {
    return { wordGoalHiveName: null, wordGoalHiveId: null, wordGoalPct: null, wordGoalDaysLeft: null }
  }
  const pct = Math.min(100, Math.round((top.progress / top.target) * 100))
  const daysLeft = top.endDate
    ? Math.max(0, Math.ceil((top.endDate.getTime() - now.getTime()) / DAY_MS))
    : null
  return {
    wordGoalHiveName: top.hiveName,
    wordGoalHiveId: top.hiveId,
    wordGoalPct: pct,
    wordGoalDaysLeft: daysLeft,
  }
}

async function loadHiveStale(userId: string): Promise<{
  staleHiveName: string | null
  staleHiveId: string | null
  staleDaysSinceActivity: number | null
}> {
  // OWNER/MOD hives with no activity in 7 days, member_count > 1.
  const cutoff = new Date(Date.now() - 7 * DAY_MS)
  const rows = await db
    .select({
      hiveId: hives.id,
      hiveName: hives.name,
      lastActivityAt: hives.lastActivityAt,
    })
    .from(hives)
    .innerJoin(hiveMembers, and(
      eq(hiveMembers.hiveId, hives.id),
      eq(hiveMembers.userId, userId),
    ))
    .where(and(
      inArray(hiveMembers.role, ['OWNER', 'MODERATOR']),
      gt(hives.memberCount, 1),
      or(isNull(hives.lastActivityAt), lt(hives.lastActivityAt, cutoff)),
    ))
    .orderBy(sql`${hives.lastActivityAt} ASC NULLS FIRST`)
    .limit(1)

  const top = rows[0]
  if (!top) return { staleHiveName: null, staleHiveId: null, staleDaysSinceActivity: null }
  const days = top.lastActivityAt
    ? Math.floor((Date.now() - top.lastActivityAt.getTime()) / DAY_MS)
    : 999
  return {
    staleHiveName: top.hiveName,
    staleHiveId: top.hiveId,
    staleDaysSinceActivity: days,
  }
}

// ─── SPARKS sub-queries ───────────────────────────────────────────────────────

async function loadSparkVotingEnding(userId: string): Promise<{
  votingEndingTitle: string | null
  votingEndingId: string | null
  votingEndingHoursLeft: number | null
}> {
  // Sparks viewer ENTERED that are VOTING + deadline < 24h away.
  const now = new Date()
  const cutoff = new Date(now.getTime() + 24 * HOUR_MS)
  const rows = await db
    .select({
      sparkId: sparks.id,
      title: sparks.title,
      deadline: sparks.deadline,
      votingEndsAt: sparks.votingEndsAt,
    })
    .from(sparkEntries)
    .innerJoin(sparks, eq(sparks.id, sparkEntries.sparkId))
    .where(and(
      eq(sparkEntries.userId, userId),
      eq(sparks.status, 'VOTING'),
      or(
        and(sql`${sparks.votingEndsAt} IS NOT NULL`, lt(sparks.votingEndsAt, cutoff)),
        and(isNull(sparks.votingEndsAt), sql`${sparks.deadline} IS NOT NULL`, lt(sparks.deadline, cutoff)),
      ),
    ))
    .orderBy(sql`COALESCE(${sparks.votingEndsAt}, ${sparks.deadline}) ASC`)
    .limit(1)

  const top = rows[0]
  if (!top) return { votingEndingTitle: null, votingEndingId: null, votingEndingHoursLeft: null }
  const endsAt = top.votingEndsAt ?? top.deadline
  const hoursLeft = endsAt
    ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / HOUR_MS))
    : null
  return {
    votingEndingTitle: top.title,
    votingEndingId: top.sparkId,
    votingEndingHoursLeft: hoursLeft,
  }
}

async function loadSparkAwaitingResult(userId: string) {
  // Distinct CLOSED sparks viewer entered with no winner picked yet.
  const rows = await db
    .selectDistinct({ sparkId: sparks.id })
    .from(sparkEntries)
    .innerJoin(sparks, eq(sparks.id, sparkEntries.sparkId))
    .where(and(
      eq(sparkEntries.userId, userId),
      eq(sparks.status, 'CLOSED'),
      isNull(sparks.winnerEntryId),
    ))
  return { awaitingResultCount: rows.length }
}

async function loadSparkOpenFromFollowed(userId: string): Promise<{
  openFromFollowedCount: number
  openFromFollowedAuthorUsername: string | null
}> {
  // OPEN sparks created in last 7d by writers viewer follows. Count + most-recent author.
  const cutoff = new Date(Date.now() - 7 * DAY_MS)
  const now = new Date()
  const rows = await db
    .select({
      sparkId: sparks.id,
      username: userProfiles.username,
      createdAt: sparks.createdAt,
    })
    .from(sparks)
    .innerJoin(follows, eq(follows.followeeId, sparks.creatorId))
    .leftJoin(userProfiles, eq(userProfiles.userId, sparks.creatorId))
    .where(and(
      eq(follows.followerId, userId),
      eq(sparks.status, 'OPEN'),
      gte(sparks.createdAt, cutoff),
      or(isNull(sparks.deadline), gt(sparks.deadline, now)),
    ))
    .orderBy(desc(sparks.createdAt))
    .limit(20)

  return {
    openFromFollowedCount: rows.length,
    openFromFollowedAuthorUsername: rows[0]?.username ?? null,
  }
}

// ─── LISTS sub-queries ────────────────────────────────────────────────────────

async function loadListsYourTrending(userId: string): Promise<{
  yourTrendingListName: string | null
  yourTrendingListId: string | null
  yourTrendingFollowerGain: number | null
}> {
  // Viewer-owned list with >= 3 new followers in last 7d.
  const cutoff = new Date(Date.now() - 7 * DAY_MS)
  const rows = await db
    .select({
      listId: readingLists.id,
      listTitle: readingLists.title,
      gain: sql<number>`COUNT(${readingListFollows.userId})::int`,
    })
    .from(readingLists)
    .innerJoin(readingListFollows, eq(readingListFollows.listId, readingLists.id))
    .where(and(
      eq(readingLists.userId, userId),
      gte(readingListFollows.createdAt, cutoff),
    ))
    .groupBy(readingLists.id, readingLists.title)
    .having(sql`COUNT(${readingListFollows.userId}) >= 3`)
    .orderBy(sql`COUNT(${readingListFollows.userId}) DESC`)
    .limit(1)

  const top = rows[0]
  return {
    yourTrendingListName: top?.listTitle ?? null,
    yourTrendingListId: top?.listId ?? null,
    yourTrendingFollowerGain: top?.gain ?? null,
  }
}

async function loadListsNewFromFollowed(userId: string): Promise<{
  newFromFollowedListTitle: string | null
  newFromFollowedListId: string | null
  newFromFollowedAuthorUsername: string | null
}> {
  // List created in last 7d by someone viewer follows, kind != LIKED.
  const cutoff = new Date(Date.now() - 7 * DAY_MS)
  const rows = await db
    .select({
      listId: readingLists.id,
      listTitle: readingLists.title,
      username: userProfiles.username,
    })
    .from(readingLists)
    .innerJoin(follows, eq(follows.followeeId, readingLists.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
    .where(and(
      eq(follows.followerId, userId),
      sql`${readingLists.kind} != 'LIKED'`,
      gte(readingLists.createdAt, cutoff),
    ))
    .orderBy(desc(readingLists.createdAt))
    .limit(1)

  const top = rows[0]
  return {
    newFromFollowedListTitle: top?.listTitle ?? null,
    newFromFollowedListId: top?.listId ?? null,
    newFromFollowedAuthorUsername: top?.username ?? null,
  }
}

async function loadListsBooksAddedToFollowed(userId: string): Promise<{
  booksAddedListName: string | null
  booksAddedListId: string | null
  booksAddedCount: number | null
}> {
  // List viewer follows that gained >= 1 book in last 7d.
  const cutoff = new Date(Date.now() - 7 * DAY_MS)
  const rows = await db
    .select({
      listId: readingLists.id,
      listTitle: readingLists.title,
      added: sql<number>`COUNT(${readingListBooks.id})::int`,
    })
    .from(readingLists)
    .innerJoin(readingListFollows, and(
      eq(readingListFollows.listId, readingLists.id),
      eq(readingListFollows.userId, userId),
    ))
    .innerJoin(readingListBooks, and(
      eq(readingListBooks.listId, readingLists.id),
      gte(readingListBooks.addedAt, cutoff),
    ))
    .groupBy(readingLists.id, readingLists.title)
    .orderBy(sql`COUNT(${readingListBooks.id}) DESC`)
    .limit(1)

  const top = rows[0]
  return {
    booksAddedListName: top?.listTitle ?? null,
    booksAddedListId: top?.listId ?? null,
    booksAddedCount: top?.added ?? null,
  }
}

// ─── CLUBS sub-queries ────────────────────────────────────────────────────────

async function loadClubsCurrentBook(userId: string): Promise<{
  currentBookClubName: string | null
  currentBookClubId: string | null
  currentBookTitle: string | null
}> {
  // Club viewer is in with a current book.
  const rows = await db
    .select({
      clubId: bookClubs.id,
      clubName: bookClubs.name,
      bookTitle: bookClubBooks.title,
    })
    .from(bookClubs)
    .innerJoin(bookClubMembers, and(
      eq(bookClubMembers.clubId, bookClubs.id),
      eq(bookClubMembers.userId, userId),
    ))
    .leftJoin(bookClubBooks, eq(bookClubBooks.id, bookClubs.currentBookId))
    .where(sql`${bookClubs.currentBookId} IS NOT NULL`)
    .orderBy(sql`${bookClubs.lastActivityAt} DESC NULLS LAST`)
    .limit(1)

  const top = rows[0]
  return {
    currentBookClubName: top?.clubName ?? null,
    currentBookClubId: top?.clubId ?? null,
    currentBookTitle: top?.bookTitle ?? null,
  }
}

async function loadClubsUnreadReplies(userId: string) {
  // V1 proxy: replies in last 48h to discussions in clubs viewer is a member of,
  // authored by someone else. Capped at 99.
  const cutoff = new Date(Date.now() - 2 * DAY_MS)
  const rows = await db
    .select({ id: bookClubDiscussionReplies.id })
    .from(bookClubDiscussionReplies)
    .innerJoin(bookClubDiscussions, eq(bookClubDiscussions.id, bookClubDiscussionReplies.discussionId))
    .innerJoin(bookClubMembers, and(
      eq(bookClubMembers.clubId, bookClubDiscussions.clubId),
      eq(bookClubMembers.userId, userId),
    ))
    .where(and(
      sql`${bookClubDiscussionReplies.authorId} != ${userId}`,
      gte(bookClubDiscussionReplies.createdAt, cutoff),
    ))
    .limit(100)
  return { unreadRepliesCount: Math.min(99, rows.length) }
}

async function loadClubsPendingInvite(userId: string): Promise<{
  pendingInviteClubName: string | null
  pendingInviteClubId: string | null
  pendingInviteInviterUsername: string | null
}> {
  // PENDING club invite directed at viewer.
  const rows = await db
    .select({
      clubId: bookClubs.id,
      clubName: bookClubs.name,
      inviterUsername: userProfiles.username,
    })
    .from(bookClubInvites)
    .innerJoin(bookClubs, eq(bookClubs.id, bookClubInvites.clubId))
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubInvites.inviterId))
    .where(and(
      eq(bookClubInvites.recipientId, userId),
      eq(bookClubInvites.status, 'PENDING'),
    ))
    .orderBy(desc(bookClubInvites.createdAt))
    .limit(1)

  const top = rows[0]
  return {
    pendingInviteClubName: top?.clubName ?? null,
    pendingInviteClubId: top?.clubId ?? null,
    pendingInviteInviterUsername: top?.inviterUsername ?? null,
  }
}

// ─── FRIENDS sub-queries ──────────────────────────────────────────────────────

async function loadFriendsPendingRequests(userId: string) {
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(
      eq(friendships.recipientId, userId),
      eq(friendships.status, 'PENDING'),
    ))
    .limit(100)
  return { pendingRequestsCount: rows.length }
}

async function loadFriendsMilestones(userId: string) {
  // Friend (bidirectional ACCEPTED) who published a book or won a spark in last 7d.
  const cutoff = new Date(Date.now() - 7 * DAY_MS)

  // Resolve friend userIds (bidirectional union).
  const friendsA = await db
    .select({ otherId: friendships.recipientId })
    .from(friendships)
    .where(and(
      eq(friendships.requesterId, userId),
      eq(friendships.status, 'ACCEPTED'),
    ))
  const friendsB = await db
    .select({ otherId: friendships.requesterId })
    .from(friendships)
    .where(and(
      eq(friendships.recipientId, userId),
      eq(friendships.status, 'ACCEPTED'),
    ))
  const friendIds = Array.from(new Set([...friendsA.map(r => r.otherId), ...friendsB.map(r => r.otherId)]))
  if (friendIds.length === 0) return { milestoneUsername: null, milestoneType: null as 'first_book' | 'spark_win' | null }

  // Most recent of: a published book OR a won spark by any friend, last 7d.
  const bookRow = await db
    .select({ username: userProfiles.username, at: books.updatedAt })
    .from(books)
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(and(
      inArray(books.userId, friendIds),
      eq(books.status, 'PUBLISHED'),
      gte(books.updatedAt, cutoff),
    ))
    .orderBy(desc(books.updatedAt))
    .limit(1)

  const sparkRow = await db
    .select({ username: userProfiles.username, at: sparks.createdAt })
    .from(sparks)
    .innerJoin(sparkEntries, eq(sparkEntries.id, sparks.winnerEntryId))
    .leftJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
    .where(and(
      inArray(sparkEntries.userId, friendIds),
      gte(sparks.createdAt, cutoff),
    ))
    .orderBy(desc(sparks.createdAt))
    .limit(1)

  const book = bookRow[0]
  const spark = sparkRow[0]
  if (!book && !spark) return { milestoneUsername: null, milestoneType: null as 'first_book' | 'spark_win' | null }

  // Pick the most recent.
  if (book && (!spark || (book.at && spark.at && book.at >= spark.at))) {
    return { milestoneUsername: book.username ?? null, milestoneType: 'first_book' as const }
  }
  return { milestoneUsername: spark?.username ?? null, milestoneType: 'spark_win' as const }
}

async function loadFriendsSuggestionsCount() {
  const res = await getSuggestedWritersAction({ limit: 5 })
  return { suggestionsCount: res.success ? res.data.length : 0 }
}

// ─── Public aggregator ────────────────────────────────────────────────────────

async function _getCommunityHubHighlights(): Promise<ActionResult<CommunityHighlights>> {
  try {
    const userId = await requireAuth()

    const [
      hivesPending,
      hivesGoal,
      hivesStale,
      sparksVoting,
      sparksAwaiting,
      sparksOpen,
      listsTrending,
      listsNewFromFollowed,
      listsBooksAdded,
      clubsCurrent,
      clubsUnread,
      clubsInvite,
      friendsPending,
      friendsMilestones,
      friendsSuggestions,
    ] = await Promise.all([
      safe(() => loadHivePendingReview(userId), { pendingReviewCount: 0, pendingReviewHiveName: null, pendingReviewHiveId: null }),
      safe(() => loadHiveWordGoal(userId), { wordGoalHiveName: null, wordGoalHiveId: null, wordGoalPct: null, wordGoalDaysLeft: null }),
      safe(() => loadHiveStale(userId), { staleHiveName: null, staleHiveId: null, staleDaysSinceActivity: null }),
      safe(() => loadSparkVotingEnding(userId), { votingEndingTitle: null, votingEndingId: null, votingEndingHoursLeft: null }),
      safe(() => loadSparkAwaitingResult(userId), { awaitingResultCount: 0 }),
      safe(() => loadSparkOpenFromFollowed(userId), { openFromFollowedCount: 0, openFromFollowedAuthorUsername: null }),
      safe(() => loadListsYourTrending(userId), { yourTrendingListName: null, yourTrendingListId: null, yourTrendingFollowerGain: null }),
      safe(() => loadListsNewFromFollowed(userId), { newFromFollowedListTitle: null, newFromFollowedListId: null, newFromFollowedAuthorUsername: null }),
      safe(() => loadListsBooksAddedToFollowed(userId), { booksAddedListName: null, booksAddedListId: null, booksAddedCount: null }),
      safe(() => loadClubsCurrentBook(userId), { currentBookClubName: null, currentBookClubId: null, currentBookTitle: null }),
      safe(() => loadClubsUnreadReplies(userId), { unreadRepliesCount: 0 }),
      safe(() => loadClubsPendingInvite(userId), { pendingInviteClubName: null, pendingInviteClubId: null, pendingInviteInviterUsername: null }),
      safe(() => loadFriendsPendingRequests(userId), { pendingRequestsCount: 0 }),
      safe(() => loadFriendsMilestones(userId), { milestoneUsername: null, milestoneType: null as 'first_book' | 'spark_win' | null }),
      safe(() => loadFriendsSuggestionsCount(), { suggestionsCount: 0 }),
    ])

    return {
      success: true,
      data: {
        hives: { ...hivesPending, ...hivesGoal, ...hivesStale },
        sparks: { ...sparksVoting, ...sparksAwaiting, ...sparksOpen },
        lists: { ...listsTrending, ...listsNewFromFollowed, ...listsBooksAdded },
        clubs: { ...clubsCurrent, ...clubsUnread, ...clubsInvite },
        friends: { ...friendsPending, ...friendsMilestones, ...friendsSuggestions },
      },
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[community-hub] aggregator failed:', err)
    }
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

// React cache() dedupes per-request when multiple components on the page need slices.
const cachedHighlights = cache(_getCommunityHubHighlights)

export async function getCommunityHubHighlightsAction(): Promise<ActionResult<CommunityHighlights>> {
  return cachedHighlights()
}
