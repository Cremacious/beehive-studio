'use server'

// Schema notes (divergences from any documentation, captured here for future readers):
// - follows table uses followerId / followeeId (NOT followingId).
// - userProfiles uses avatarUrl (NOT image). We alias to `image` in legacy
//   SuggestedWriter shape.
// - books has no publishedAt column; "published" = status='PUBLISHED'. We use
//   books.updatedAt as the publish timestamp for getSuggestedWritersAction.
// - sparks uses `title` for the prompt text (NOT `prompt`).
// - userProfiles.username is nullable; we filter rows missing a username out so
//   FeedAuthor.username is always a string.
// - social_activity event store drives getCommunityFeedAction as of C1.

import { db } from '@/db'
import {
  books,
  binderItems,
  sparks,
  sparkEntries,
  follows,
  users,
  userProfiles,
  socialActivity,
  friendships,
  userBlocks,
  userMutes,
  hives,
  readingLists,
  bookClubs,
  type SocialActivityType,
} from '@/db/schema'
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'
import type { SuggestedWriter, ActiveSparkEntry } from '@/lib/types/community'

// ─── getCommunityFeedAction ───────────────────────────────────────────────────
// Drives the /community feed from the social_activity event store. Returns
// cursor-paginated rows authored by anyone the viewer follows or is friends
// with (set union), minus anyone the viewer has blocked / muted or who has
// blocked the viewer. Hydrates actor profiles + subject titles for book /
// chapter / hive subjects. spark_entry + comment subjects are returned with
// raw subjectId only (T9 UI can fall back to ids; C1 launch deferral).

export type FeedRow = {
  id: string
  type: SocialActivityType
  createdAt: Date
  actor: {
    userId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  }
  subject: {
    type: 'book' | 'chapter' | 'spark_entry' | 'hive' | 'comment' | 'reading_list' | 'book_club'
    id: string
    title?: string | null
    coverUrl?: string | null
    bookId?: string | null
  }
  payload: Record<string, unknown> | null
  isFriend: boolean
}

export async function getCommunityFeedAction(
  input?: { cursor?: string; limit?: number }
): Promise<ActionResult<{ rows: FeedRow[]; nextCursor: string | null }>> {
  const userId = await requireAuth()
  const limit = Math.min(input?.limit ?? 20, 50)

  // 1. Resolve viewer's friend / follow / block / mute sets in parallel.
  const [friendRows, followRows, blockedRows, mutedRows] = await Promise.all([
    db.query.friendships.findMany({
      where: and(
        eq(friendships.status, 'ACCEPTED'),
        or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
      ),
      columns: { requesterId: true, recipientId: true },
    }),
    db.query.follows.findMany({
      where: eq(follows.followerId, userId),
      columns: { followeeId: true },
    }),
    db.query.userBlocks.findMany({
      where: or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)),
      columns: { blockerId: true, blockedId: true },
    }),
    db.query.userMutes.findMany({
      where: eq(userMutes.muterId, userId),
      columns: { mutedId: true },
    }),
  ])

  const friendIds = new Set(
    friendRows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId)),
  )
  const followIds = new Set(followRows.map((r) => r.followeeId))
  const sources = new Set<string>([...friendIds, ...followIds])
  if (sources.size === 0) {
    return { success: true, data: { rows: [], nextCursor: null } }
  }

  const blockedIds = new Set<string>()
  for (const r of blockedRows) {
    blockedIds.add(r.blockerId === userId ? r.blockedId : r.blockerId)
  }
  const mutedIds = new Set(mutedRows.map((r) => r.mutedId))
  const excluded = new Set<string>([...blockedIds, ...mutedIds])

  const actorIds = Array.from(sources).filter((id) => !excluded.has(id))
  if (actorIds.length === 0) {
    return { success: true, data: { rows: [], nextCursor: null } }
  }

  // 2. Decode cursor — extended format {isFriend, createdAt, id}.
  //    Backward-compat: old cursors lacking `isFriend` are treated as false
  //    (followed tail) so in-flight pagination sessions don't break on deploy.
  let cursorIsFriend: boolean | null = null
  let cursorDate: Date | null = null
  let cursorId: string | null = null
  if (input?.cursor) {
    try {
      const decoded = JSON.parse(
        Buffer.from(input.cursor, 'base64url').toString('utf8'),
      ) as { isFriend?: boolean; createdAt: string; id: string }
      cursorIsFriend = typeof decoded.isFriend === 'boolean' ? decoded.isFriend : false
      cursorDate = new Date(decoded.createdAt)
      cursorId = decoded.id
      if (Number.isNaN(cursorDate.getTime()) || !cursorId) {
        return { success: false, error: 'INVALID_CURSOR' }
      }
    } catch {
      return { success: false, error: 'INVALID_CURSOR' }
    }
  }

  // 3. Feed query — friend-first sort tuple (isFriend DESC, createdAt DESC, id DESC).
  //    `isFriend` is a per-row boolean computed from the viewer's friend set;
  //    when friendIds is empty we use NULL = ANY('{}'::text[]) → false, so the
  //    sort becomes equivalent to the prior (createdAt DESC, id DESC).
  const friendIdsArray = Array.from(friendIds)
  const isFriendExpr = sql<boolean>`(${socialActivity.actorId} = ANY(${friendIdsArray}::text[]))`

  const cursorPredicate =
    cursorDate && cursorId
      ? or(
          // Strictly lower isFriend bucket (true → false transition).
          sql`(${isFriendExpr})::int < ${cursorIsFriend ? 1 : 0}`,
          // Same bucket, earlier createdAt.
          and(
            sql`(${isFriendExpr})::int = ${cursorIsFriend ? 1 : 0}`,
            lt(socialActivity.createdAt, cursorDate),
          ),
          // Same bucket + same createdAt, lower id.
          and(
            sql`(${isFriendExpr})::int = ${cursorIsFriend ? 1 : 0}`,
            eq(socialActivity.createdAt, cursorDate),
            lt(socialActivity.id, cursorId),
          ),
        )
      : undefined

  const events = await db.query.socialActivity.findMany({
    where: cursorPredicate
      ? and(inArray(socialActivity.actorId, actorIds), cursorPredicate)
      : inArray(socialActivity.actorId, actorIds),
    orderBy: [desc(isFriendExpr), desc(socialActivity.createdAt), desc(socialActivity.id)],
    limit: limit + 1,
  })

  const hasMore = events.length > limit
  const pageEvents = hasMore ? events.slice(0, limit) : events

  if (pageEvents.length === 0) {
    return { success: true, data: { rows: [], nextCursor: null } }
  }

  // 4. Hydrate actor profiles.
  const actorIdList = Array.from(new Set(pageEvents.map((e) => e.actorId)))
  const actorProfiles = actorIdList.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, actorIdList),
        columns: { userId: true, username: true, displayName: true, avatarUrl: true },
      })
    : []
  const actorMap = new Map(actorProfiles.map((p) => [p.userId, p]))

  // 5. Hydrate subjects by type. spark_entry + comment skipped per C1 launch.
  const bookIds = Array.from(
    new Set(pageEvents.filter((e) => e.subjectType === 'book').map((e) => e.subjectId)),
  )
  const chapterBinderItemIds = Array.from(
    new Set(
      pageEvents.filter((e) => e.subjectType === 'chapter').map((e) => e.subjectId),
    ),
  )
  const hiveIds = Array.from(
    new Set(pageEvents.filter((e) => e.subjectType === 'hive').map((e) => e.subjectId)),
  )
  const readingListIds = Array.from(
    new Set(
      pageEvents.filter((e) => e.subjectType === 'reading_list').map((e) => e.subjectId),
    ),
  )
  const bookClubIds = Array.from(
    new Set(
      pageEvents.filter((e) => e.subjectType === 'book_club').map((e) => e.subjectId),
    ),
  )

  const [bookRows, chapterRows, hiveRows, readingListRows, bookClubRows] = await Promise.all([
    bookIds.length
      ? db.query.books.findMany({
          where: inArray(books.id, bookIds),
          columns: { id: true, title: true, coverUrl: true },
        })
      : Promise.resolve([]),
    chapterBinderItemIds.length
      ? db.query.binderItems.findMany({
          where: inArray(binderItems.id, chapterBinderItemIds),
          columns: { id: true, title: true, bookId: true },
        })
      : Promise.resolve([]),
    hiveIds.length
      ? db.query.hives.findMany({
          where: inArray(hives.id, hiveIds),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
    readingListIds.length
      ? db.query.readingLists.findMany({
          where: inArray(readingLists.id, readingListIds),
          columns: { id: true, title: true },
        })
      : Promise.resolve([]),
    bookClubIds.length
      ? db.query.bookClubs.findMany({
          where: inArray(bookClubs.id, bookClubIds),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])
  const bookMap = new Map(bookRows.map((b) => [b.id, b]))
  const chapterMap = new Map(chapterRows.map((c) => [c.id, c]))
  const hiveMap = new Map(hiveRows.map((h) => [h.id, h]))
  const readingListMap = new Map(readingListRows.map((l) => [l.id, l]))
  const bookClubMap = new Map(bookClubRows.map((c) => [c.id, c]))

  // 6. Compose FeedRow[].
  const rows: FeedRow[] = pageEvents.map((e) => {
    const profile = actorMap.get(e.actorId)
    const actor = {
      userId: e.actorId,
      username: profile?.username ?? null,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    }

    let subjectTitle: string | null = null
    let subjectCover: string | null = null
    let subjectBookId: string | null = null
    if (e.subjectType === 'book') {
      const b = bookMap.get(e.subjectId)
      subjectTitle = b?.title ?? null
      subjectCover = b?.coverUrl ?? null
    } else if (e.subjectType === 'chapter') {
      const c = chapterMap.get(e.subjectId)
      subjectTitle = c?.title ?? null
      subjectBookId = c?.bookId ?? null
    } else if (e.subjectType === 'hive') {
      const h = hiveMap.get(e.subjectId)
      subjectTitle = h?.name ?? null
    } else if (e.subjectType === 'reading_list') {
      const l = readingListMap.get(e.subjectId)
      subjectTitle = l?.title ?? null
    } else if (e.subjectType === 'book_club') {
      const c = bookClubMap.get(e.subjectId)
      subjectTitle = c?.name ?? null
    }

    const subjectType = (
      ['book', 'chapter', 'spark_entry', 'hive', 'comment', 'reading_list', 'book_club'].includes(
        e.subjectType,
      )
        ? e.subjectType
        : 'book'
    ) as FeedRow['subject']['type']

    return {
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      actor,
      subject: {
        type: subjectType,
        id: e.subjectId,
        title: subjectTitle,
        coverUrl: subjectCover,
        bookId: subjectBookId,
      },
      payload: e.payload ?? null,
      isFriend: friendIds.has(e.actorId),
    }
  })

  let nextCursor: string | null = null
  if (hasMore) {
    const last = pageEvents[pageEvents.length - 1]
    nextCursor = Buffer.from(
      JSON.stringify({
        isFriend: friendIds.has(last.actorId),
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
      'utf8',
    ).toString('base64url')
  }

  return { success: true, data: { rows, nextCursor } }
}

// ─── getSuggestedWritersAction ────────────────────────────────────────────────
// Surfaces users with published books touched in the last 30 days, excluding
// the current user and (optionally) anyone they already follow.
//
// NOT IN exclusion: uses Drizzle's `notInArray` helper directly. The pool is
// small in practice; no JS post-filter needed.

export async function getSuggestedWritersAction(args: {
  excludeFollowing?: boolean
  limit?: number
} = {}): Promise<ActionResult<SuggestedWriter[]>> {
  const userId = await requireAuth()
  const limit = Math.min(args.limit ?? 5, 20)
  const excludeFollowing = args.excludeFollowing ?? true

  let excluded: string[] = [userId]
  if (excludeFollowing) {
    const f = await db
      .select({ id: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, userId))
    excluded = excluded.concat(f.map(r => r.id))
  }

  const windowStart = new Date(Date.now() - 30 * 86_400_000)

  const rows = await db
    .select({
      id: users.id,
      username: userProfiles.username,
      image: userProfiles.avatarUrl,
      bio: userProfiles.bio,
      bookCount: sql<number>`COUNT(${books.id})::int`,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .innerJoin(books, eq(books.userId, users.id))
    .where(and(
      eq(books.status, 'PUBLISHED'),
      gte(books.updatedAt, windowStart),
      sql`${userProfiles.username} IS NOT NULL`,
      notInArray(users.id, excluded),
    ))
    .groupBy(users.id, userProfiles.username, userProfiles.avatarUrl, userProfiles.bio)
    .orderBy(desc(sql`MAX(${books.updatedAt})`))
    .limit(limit)

  return {
    success: true,
    data: rows.map(r => ({
      id: r.id,
      username: r.username as string,
      image: r.image,
      bio: r.bio,
      bookCount: r.bookCount,
      isFollowing: false,
    })),
  }
}

// ─── getMyActiveSparksAction ──────────────────────────────────────────────────
// Returns the user's spark entries that are still in motion (no winner yet)
// or recently-won. Status is derived from `sparks.deadline` and the 48h
// voting window (mirroring `computeStatus` in lib/actions/sparks.actions.ts).
// No `finalizedAt` column exists; "recently won" = deadline within last 7d.

const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000

export async function getMyActiveSparksAction(): Promise<ActionResult<ActiveSparkEntry[]>> {
  const userId = await requireAuth()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)

  const rows = await db
    .select({
      entryId: sparkEntries.id,
      sparkId: sparks.id,
      prompt: sparks.title,
      deadline: sparks.deadline,
      winnerEntryId: sparks.winnerEntryId,
      createdAt: sparks.createdAt,
    })
    .from(sparkEntries)
    .innerJoin(sparks, eq(sparkEntries.sparkId, sparks.id))
    .where(and(
      eq(sparkEntries.userId, userId),
      or(
        isNull(sparks.winnerEntryId),
        gte(sparks.deadline, sevenDaysAgo),
      ),
    ))
    .orderBy(desc(sparks.createdAt))

  const now = Date.now()
  const entries: (ActiveSparkEntry | null)[] = rows.map(r => {
    let status: ActiveSparkEntry['status']
    if (r.winnerEntryId === r.entryId) {
      status = 'won'
    } else if (r.winnerEntryId) {
      // Someone else won — don't surface it in the user's "active" panel.
      return null
    } else if (r.deadline === null) {
      // No deadline set — treat as still submittable.
      status = 'submitted'
    } else {
      const dl = r.deadline.getTime()
      if (now < dl) status = 'submitted'
      else if (now < dl + VOTING_WINDOW_MS) status = 'voting'
      else status = 'awaiting_winner'
    }
    return {
      sparkId: r.sparkId,
      sparkPrompt: r.prompt,
      entryId: r.entryId,
      status,
      deadline: r.deadline,
    }
  })

  return {
    success: true,
    data: entries.filter((e): e is ActiveSparkEntry => e !== null),
  }
}
