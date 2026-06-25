'use server'

import { db } from '@/db'
import {
  books,
  chapters,
  binderItems,
  follows,
  sparks,
  sparkEntryComments,
  bookLikes,
  userProfiles,
  bookClubs,
  bookClubMembers,
  bookClubBooks,
} from '@/db/schema'
import { eq, and, count, sql, desc, gt, inArray } from 'drizzle-orm'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { canViewSpark } from '@/lib/sparks/predicates'
import { canViewClub } from '@/lib/book-clubs/predicates'
import { getClubMembership } from '@/lib/book-clubs/get-membership'
import type { ActionResult } from './book.actions'
import type { ClubSummary, ClubCurrentBook } from './book-clubs.actions'
import { projectToBookCards, type BookCard } from './discover-shared'
import { projectToSparkCards, type SparkCard } from './discover-sparks.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublicProfile = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  followerCount: number
  followingCount: number
  wordCount: number
  bookCount: number
  sparkCount: number
  clubCount: number
  isFollowing: boolean
}

export type ActivityEvent = {
  type: 'chapter_published' | 'spark_created' | 'entry_commented' | 'creator_choice'
  label: string
  resourceId: string
  createdAt: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Fetch a public profile by username, including aggregate stats and
 * whether the calling user is following this profile.
 */
export async function getPublicProfileAction(
  username: string
): Promise<ActionResult<PublicProfile>> {
  const [profile] = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      bio: userProfiles.bio,
    })
    .from(userProfiles)
    .where(eq(userProfiles.username, username))
    .limit(1)

  if (!profile || !profile.username) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const { userId } = profile

  const [
    followerResult,
    followingResult,
    wordCountResult,
    bookCountResult,
    sparkCountResult,
    clubCountResult,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.followeeId, userId)),
    db
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.followerId, userId)),
    db
      .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
      .from(chapters)
      .innerJoin(books, eq(chapters.bookId, books.id))
      // shadow books are excluded by the PUBLISHED filter
      .where(and(eq(books.userId, userId), eq(books.status, 'PUBLISHED'))),
    db
      .select({ total: count() })
      .from(books)
      // shadow books are excluded by the PUBLISHED filter
      .where(and(eq(books.userId, userId), eq(books.status, 'PUBLISHED'))),
    db
      .select({ total: count() })
      .from(sparks)
      .where(eq(sparks.creatorId, userId)),
    db
      .select({ total: count() })
      .from(bookClubMembers)
      .where(eq(bookClubMembers.userId, userId)),
  ])

  let isFollowing = false
  try {
    const currentUserId = await requireAuth()
    const [followRow] = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, currentUserId), eq(follows.followeeId, userId)))
      .limit(1)
    isFollowing = !!followRow
  } catch {
    // unauthenticated — isFollowing stays false
  }

  return {
    success: true,
    data: {
      userId,
      username: profile.username,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      bio: profile.bio ?? null,
      followerCount: Number(followerResult[0]?.total ?? 0),
      followingCount: Number(followingResult[0]?.total ?? 0),
      wordCount: Number(wordCountResult[0]?.total ?? 0),
      bookCount: Number(bookCountResult[0]?.total ?? 0),
      sparkCount: Number(sparkCountResult[0]?.total ?? 0),
      clubCount: Number(clubCountResult[0]?.total ?? 0),
      isFollowing,
    },
  }
}

/**
 * Fetch the 12 most-liked published books for a user as canonical `BookCard`s
 * so the profile renders the same card component as /discover and /community.
 */
export async function getProfileBooksAction(
  userId: string
): Promise<ActionResult<BookCard[]>> {
  const likeCountSq = db
    .select({ bookId: bookLikes.bookId, likeTotal: count().as('like_total') })
    .from(bookLikes)
    .groupBy(bookLikes.bookId)
    .as('like_counts')

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .leftJoin(likeCountSq, eq(books.id, likeCountSq.bookId))
    // shadow books are excluded by the PUBLISHED filter
    .where(and(eq(books.userId, userId), eq(books.status, 'PUBLISHED')))
    .orderBy(desc(sql`COALESCE(${likeCountSq.likeTotal}, 0)`))
    .limit(12)

  const cards = await projectToBookCards(rows)
  return { success: true, data: cards }
}

/**
 * Fetch OPEN + VOTING sparks created by a user (deadline > now - 48h) as
 * canonical `SparkCard`s so the profile renders the same card component as
 * /discover and /community.
 */
export async function getProfileSparksAction(
  userId: string
): Promise<ActionResult<SparkCard[]>> {
  const votingEnd = new Date(Date.now() - VOTING_WINDOW_MS)
  const viewerId = await getOptionalUserId()

  const rows = await db
    .select({
      id: sparks.id,
      creatorId: sparks.creatorId,
      visibility: sparks.visibility,
      status: sparks.status,
    })
    .from(sparks)
    .where(and(eq(sparks.creatorId, userId), gt(sparks.deadline, votingEnd)))
    .orderBy(sparks.deadline)

  // Per-row canViewSpark gate — masquerade FRIENDS/PRIVATE sparks as absent for
  // non-friend / non-creator / blocked viewers. Mirrors getSparksAction pattern (T4).
  const visibleIds: Array<{ id: string }> = []
  for (const r of rows) {
    if (
      await canViewSpark(viewerId, {
        creatorId: r.creatorId,
        visibility: r.visibility,
        status: r.status,
      })
    ) {
      visibleIds.push({ id: r.id })
    }
  }

  const cards = await projectToSparkCards(visibleIds, {
    computeVoteTotal: false,
    computeWinner: false,
  })
  return { success: true, data: cards }
}

/**
 * Build the last 20 activity events for a user across 4 sources,
 * using a raw SQL UNION ALL for efficiency.
 */
export async function getProfileActivityAction(
  userId: string
): Promise<ActionResult<ActivityEvent[]>> {
  const result = await db.execute(sql`
    SELECT 'chapter_published' as type,
           bi.title           as label_extra,
           b.title            as book_title,
           b.id               as resource_id,
           bi.created_at      as created_at
    FROM   binder_items bi
    JOIN   books b ON b.id = bi.book_id
    WHERE  b.user_id = ${userId}
      AND  b.status  = 'PUBLISHED'
      AND  bi.type   = 'chapter'

    UNION ALL

    SELECT 'spark_created' as type,
           s.title         as label_extra,
           NULL            as book_title,
           s.id            as resource_id,
           s.created_at    as created_at
    FROM   sparks s
    WHERE  s.creator_id = ${userId}

    UNION ALL

    SELECT 'entry_commented' as type,
           NULL              as label_extra,
           NULL              as book_title,
           se.spark_id       as resource_id,
           sec.created_at    as created_at
    FROM   spark_entry_comments sec
    JOIN   spark_entries se ON se.id = sec.entry_id
    WHERE  sec.user_id = ${userId}

    UNION ALL

    SELECT 'creator_choice' as type,
           NULL             as label_extra,
           NULL             as book_title,
           s.id             as resource_id,
           s.created_at     as created_at
    FROM   sparks s
    WHERE  s.creator_id              = ${userId}
      AND  s.creator_choice_entry_id IS NOT NULL

    ORDER BY created_at DESC
    LIMIT 20
  `)

  type RawRow = {
    type: string
    label_extra: string | null
    book_title: string | null
    resource_id: string
    created_at: string | Date
  }

  const events: ActivityEvent[] = (result.rows as RawRow[]).map((row) => {
    const createdAt =
      row.created_at instanceof Date ? row.created_at : new Date(row.created_at)

    let label: string
    switch (row.type) {
      case 'chapter_published':
        label = `Published chapter "${row.label_extra ?? ''}" in "${row.book_title ?? ''}"`
        break
      case 'spark_created':
        label = `Created a Spark: "${row.label_extra ?? ''}"`
        break
      case 'entry_commented':
        label = `Commented on an entry in a Spark`
        break
      case 'creator_choice':
        label = `Picked a creator's choice`
        break
      default:
        label = row.type
    }

    return {
      type: row.type as ActivityEvent['type'],
      label,
      resourceId: row.resource_id,
      createdAt,
    }
  })

  return { success: true, data: events }
}

/**
 * Fetch up to `limit` book clubs that `targetUserId` is a member of,
 * filtered through canViewClub so PRIVATE/FRIENDS clubs only surface
 * to viewers who can see them. Mirrors getUserPublicListsAction (C3 T15)
 * with 2× overscan to defuse the per-row visibility filter shrinking
 * the result set.
 */
export async function getUserPublicClubsAction(
  targetUserId: string,
  limit = 5,
): Promise<ActionResult<ClubSummary[]>> {
  const viewerId = await getOptionalUserId()
  const cap = Math.min(Math.max(limit, 1), 20)

  // Clubs hub redesign: correlated subquery projecting top-4 most-recent
  // members per club for V2 card avatar stack. Mirrors hive precedent.
  const memberPreviewsSql = sql<
    Array<{ userId: string; avatarUrl: string | null }>
  >`COALESCE((
    SELECT json_agg(json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url))
    FROM (
      SELECT bcm2.user_id, up2.avatar_url
      FROM book_club_members bcm2
      LEFT JOIN user_profiles up2 ON up2.user_id = bcm2.user_id
      WHERE bcm2.club_id = ${bookClubs.id}
      ORDER BY bcm2.joined_at DESC
      LIMIT 4
    ) sub
  ), '[]'::json)`

  const candidates = await db
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
      coverImageUrl: bookClubs.coverImageUrl,
      lastActivityAt: bookClubs.lastActivityAt,
      memberPreviews: memberPreviewsSql,
      currentReadingGoalDescription: bookClubs.currentReadingGoalDescription,
      currentReadingGoalDeadline: bookClubs.currentReadingGoalDeadline,
      currentProgressValue: bookClubs.currentProgressValue,
      totalProgressValue: bookClubs.totalProgressValue,
      progressUnit: bookClubs.progressUnit,
    })
    .from(bookClubs)
    .innerJoin(
      bookClubMembers,
      and(
        eq(bookClubMembers.clubId, bookClubs.id),
        eq(bookClubMembers.userId, targetUserId),
      ),
    )
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
    .orderBy(desc(bookClubs.createdAt), desc(bookClubs.id))
    .limit(cap * 2)

  // Per-row canViewClub gate — masquerade PRIVATE/FRIENDS clubs as absent
  // for viewers who can't see them. Mirrors getClubsAction discover branch.
  const visible: typeof candidates = []
  for (const row of candidates) {
    const membership = await getClubMembership(viewerId, row.id)
    const allowed = await canViewClub(
      viewerId,
      { ownerId: row.ownerId, visibility: row.visibility },
      membership,
    )
    if (!allowed) continue
    visible.push(row)
    if (visible.length >= cap) break
  }

  // Hydrate currentBook for rows that have a currentBookId
  const currentBookIds = visible
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

  // Hydrate viewerMembership for each row (profile section doesn't render
  // membership-gated CTAs, but ClubSummary requires the field).
  const memberships = await Promise.all(
    visible.map((r) => getClubMembership(viewerId, r.id)),
  )

  const result: ClubSummary[] = visible.map((r, i) => ({
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
    coverImageUrl: r.coverImageUrl,
    memberPreviews: r.memberPreviews ?? [],
    lastActivityAt: r.lastActivityAt,
    currentReadingGoalDescription: r.currentReadingGoalDescription ?? null,
    currentReadingGoalDeadline: r.currentReadingGoalDeadline ?? null,
    currentProgressValue: r.currentProgressValue ?? null,
    totalProgressValue: r.totalProgressValue ?? null,
    progressUnit: r.progressUnit ?? null,
  }))

  return { success: true, data: result }
}
