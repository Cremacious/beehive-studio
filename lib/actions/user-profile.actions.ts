'use server'

import { db } from '@/db'
import {
  books,
  chapters,
  binderItems,
  follows,
  sparks,
  sparkEntries,
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
import type { SparkSummary } from './sparks.actions'
import type { ClubSummary, ClubCurrentBook } from './book-clubs.actions'

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
  isFollowing: boolean
}

export type ActivityEvent = {
  type: 'chapter_published' | 'spark_created' | 'entry_commented' | 'creator_choice'
  label: string
  resourceId: string
  createdAt: Date
}

type ProfileBook = {
  id: string
  title: string
  coverUrl: string | null
  genre: string | null
  wordCount: number
  likeCount: number
  seriesName: string | null
  seriesNumber: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000

function computeSparkStatus(deadline: Date): 'OPEN' | 'VOTING' | 'CLOSED' {
  const now = Date.now()
  const dl = deadline.getTime()
  if (now < dl) return 'OPEN'
  if (now < dl + VOTING_WINDOW_MS) return 'VOTING'
  return 'CLOSED'
}

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
      isFollowing,
    },
  }
}

/**
 * Fetch the 12 most-liked published books for a user.
 */
export async function getProfileBooksAction(
  userId: string
): Promise<ActionResult<ProfileBook[]>> {
  const likeCountSq = db
    .select({ bookId: bookLikes.bookId, likeTotal: count().as('like_total') })
    .from(bookLikes)
    .groupBy(bookLikes.bookId)
    .as('like_counts')

  const wordCountSq = db
    .select({
      bookId: chapters.bookId,
      wordTotal: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)`.as('word_total'),
    })
    .from(chapters)
    .groupBy(chapters.bookId)
    .as('word_counts')

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      coverUrl: books.coverUrl,
      genre: books.genre,
      wordCount: sql<number>`COALESCE(${wordCountSq.wordTotal}, 0)`,
      likeCount: sql<number>`COALESCE(${likeCountSq.likeTotal}, 0)`,
      seriesName: books.seriesName,
      seriesNumber: books.seriesNumber,
    })
    .from(books)
    .leftJoin(likeCountSq, eq(books.id, likeCountSq.bookId))
    .leftJoin(wordCountSq, eq(books.id, wordCountSq.bookId))
    // shadow books are excluded by the PUBLISHED filter
    .where(and(eq(books.userId, userId), eq(books.status, 'PUBLISHED')))
    .orderBy(desc(sql`COALESCE(${likeCountSq.likeTotal}, 0)`))
    .limit(12)

  return { success: true, data: rows }
}

/**
 * Fetch OPEN + VOTING sparks created by a user (deadline > now - 48h).
 */
export async function getProfileSparksAction(
  userId: string
): Promise<ActionResult<SparkSummary[]>> {
  const votingEnd = new Date(Date.now() - VOTING_WINDOW_MS)
  const viewerId = await getOptionalUserId()

  const rows = await db
    .select({
      id: sparks.id,
      title: sparks.title,
      deadline: sparks.deadline,
      wordLimit: sparks.wordLimit,
      winnerEntryId: sparks.winnerEntryId,
      creatorId: sparks.creatorId,
      visibility: sparks.visibility,
      status: sparks.status,
      votingEndsAt: sparks.votingEndsAt,
      creatorUsername: userProfiles.username,
      creatorDisplayName: userProfiles.displayName,
      entryCount: count(sparkEntries.id),
    })
    .from(sparks)
    .leftJoin(userProfiles, eq(userProfiles.userId, sparks.creatorId))
    .leftJoin(sparkEntries, eq(sparkEntries.sparkId, sparks.id))
    .where(and(eq(sparks.creatorId, userId), gt(sparks.deadline, votingEnd)))
    .groupBy(
      sparks.id,
      sparks.title,
      sparks.deadline,
      sparks.wordLimit,
      sparks.winnerEntryId,
      sparks.creatorId,
      sparks.visibility,
      sparks.status,
      sparks.votingEndsAt,
      userProfiles.username,
      userProfiles.displayName
    )
    .orderBy(sparks.deadline)

  // Per-row canViewSpark gate — masquerade FRIENDS/PRIVATE sparks as absent for
  // non-friend / non-creator / blocked viewers. Mirrors getSparksAction pattern (T4).
  const visible = (
    await Promise.all(
      rows.map(async (r) =>
        (await canViewSpark(viewerId, { creatorId: r.creatorId, visibility: r.visibility, status: r.status }))
          ? r
          : null
      )
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null)

  const result: SparkSummary[] = visible.map((r) => ({
    id: r.id,
    prompt: r.title,
    deadline: r.deadline ?? new Date(0),
    wordLimit: r.wordLimit ?? null,
    status: computeSparkStatus(r.deadline ?? new Date(0)),
    visibility: r.visibility,
    votingEndsAt: r.votingEndsAt ?? null,
    entryCount: Number(r.entryCount),
    creatorUsername: r.creatorUsername ?? null,
    creatorDisplayName: r.creatorDisplayName ?? null,
    winnerUsername: null,
  }))

  return { success: true, data: result }
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
  }))

  return { success: true, data: result }
}
