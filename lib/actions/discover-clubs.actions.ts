'use server'

import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import {
  bookClubs,
  bookClubMembers,
  bookClubDiscussions,
  bookClubBooks,
  follows,
  userBlocks,
} from '@/db/schema/social'
import { userProfiles } from '@/db/schema/auth'
import {
  and,
  eq,
  desc,
  sql,
  inArray,
  notInArray,
  isNotNull,
  gte,
  lt,
  or,
  count,
} from 'drizzle-orm'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import {
  GENRES,
  type GenreSlug,
  isValidGenre,
  normalizeGenre,
} from '@/lib/discover/genres'
import { applyBackfill } from '@/lib/discover/backfill'
import { computeClubActivityScore7d } from '@/lib/discover/club-activity-score'

import type { ActionResult } from './book.actions'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ClubVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

/**
 * ClubCard — the projected row shape for every D3b Discover Clubs surface.
 * activityScore7d is 0 on cheap-path rails (only Trending + Featured +
 * search 'most-active' need it). memberPreviews always fetched via window
 * function (card design needs the avatar stack).
 */
export type ClubCard = {
  id: string
  name: string
  description: string | null
  visibility: ClubVisibility
  ownerUserId: string
  ownerUsername: string | null
  ownerDisplayName: string | null
  ownerAvatarUrl: string | null
  genre: GenreSlug | null
  tags: string[]
  memberCount: number
  openJoin: boolean
  currentBookId: string | null
  currentBookTitle: string | null
  currentBookCoverUrl: string | null
  activityScore7d: number // 0 on cheap-path rails
  lastActivityAt: Date | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  // Clubs hub redesign: additive cover image URL projection.
  coverImageUrl: string | null
}

export type RailResult<T = ClubCard> = {
  // Field name 'books' preserved across D-phase for component reuse.
  books: T[]
  strictCount: number
  nextCursor: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12
const NEW_WINDOW_DAYS = 30
const ACTIVE_WINDOW_DAYS = 7
const OPEN_TO_JOIN_ACTIVITY_WINDOW_DAYS = 30
const BACKFILL_ACTIVITY_WINDOW_DAYS = 30
const FEATURED_ACTIVITY_WINDOW_DAYS = 14

// ─── Cursor helpers ───────────────────────────────────────────────────────────

type CursorPayload = { sortKey: string | number; id: string } | null

function encodeCursor(p: { sortKey: string | number; id: string }): string {
  return Buffer.from(JSON.stringify(p)).toString('base64url')
}

function decodeCursor(s: string | null | undefined): CursorPayload {
  if (!s) return null
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString())
    if (
      parsed &&
      typeof parsed.id === 'string' &&
      (typeof parsed.sortKey === 'string' || typeof parsed.sortKey === 'number')
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Mirrors D2b's getBlockedHiveOwnerIdsForViewer. Returns bidirectional blocked
 * owner set in a single query. Empty for guests.
 */
async function getBlockedClubOwnerIdsForViewer(
  viewerId: string | null,
): Promise<Set<string>> {
  if (!viewerId) return new Set()
  const rows = await db
    .select({
      blockerId: userBlocks.blockerId,
      blockedId: userBlocks.blockedId,
    })
    .from(userBlocks)
    .where(
      or(
        eq(userBlocks.blockerId, viewerId),
        eq(userBlocks.blockedId, viewerId),
      ),
    )
  const set = new Set<string>()
  for (const r of rows) {
    if (r.blockerId === viewerId) set.add(r.blockedId)
    else set.add(r.blockerId)
  }
  return set
}

/**
 * Build the canonical public-club WHERE conditions. Clubs have no ACTIVE/COMPLETED
 * enum — visibility + discoverable + (genre) + (not-blocked) is the full gate.
 * Returns a flat array of conditions intended for `and(...filters)`.
 */
function buildPublicClubFilters(
  genre: GenreSlug | undefined,
  blocked: Set<string>,
) {
  const filters = [
    eq(bookClubs.visibility, 'PUBLIC'),
    eq(bookClubs.discoverable, true),
  ]
  if (genre) {
    filters.push(eq(bookClubs.genre, genre))
  }
  if (blocked.size > 0) {
    filters.push(notInArray(bookClubs.ownerId, Array.from(blocked)))
  }
  return filters
}

type ProjectionOpts = {
  computeActivityScore: boolean
}

/**
 * Project an ordered list of club ids → ClubCard[] via parallel Map-stitch.
 * LEFT JOINs bookClubBooks for the current_book denorm (title + coverUrl
 * already on the bookClubBooks row). Always fetches memberPreviews via
 * bounded window function. Activity score is conditional on opts.
 *
 * Preserves the input row order via idIndex (rails may sort by signals not
 * expressible in WHERE).
 */
async function projectToClubCards(
  rows: Array<{ id: string }>,
  opts: ProjectionOpts,
): Promise<ClubCard[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const fullRows = await db
    .select({
      id: bookClubs.id,
      name: bookClubs.name,
      description: bookClubs.description,
      visibility: bookClubs.visibility,
      ownerId: bookClubs.ownerId,
      genre: bookClubs.genre,
      tags: bookClubs.tags,
      memberCount: bookClubs.memberCount,
      openJoin: bookClubs.openJoin,
      currentBookId: bookClubs.currentBookId,
      currentBookTitle: bookClubBooks.title,
      currentBookCoverUrl: bookClubBooks.coverUrl,
      lastActivityAt: bookClubs.lastActivityAt,
      createdAt: bookClubs.createdAt,
      firstPubliclyDiscoverableAt: bookClubs.firstPubliclyDiscoverableAt,
      coverImageUrl: bookClubs.coverImageUrl,
    })
    .from(bookClubs)
    .leftJoin(bookClubBooks, eq(bookClubBooks.id, bookClubs.currentBookId))
    .where(inArray(bookClubs.id, ids))

  const ownerIds = Array.from(new Set(fullRows.map((r) => r.ownerId)))

  const [ownerRows, activityScoreMap, memberPreviewsMap] = await Promise.all([
    ownerIds.length > 0
      ? db
          .select({
            userId: userProfiles.userId,
            username: userProfiles.username,
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
          })
          .from(userProfiles)
          .where(inArray(userProfiles.userId, ownerIds))
      : Promise.resolve(
          [] as Array<{
            userId: string
            username: string | null
            displayName: string | null
            avatarUrl: string | null
          }>,
        ),
    opts.computeActivityScore
      ? loadActivityScoreMap(ids)
      : Promise.resolve(new Map<string, number>()),
    loadMemberPreviewsMap(ids),
  ])

  const ownerMap = new Map(ownerRows.map((o) => [o.userId, o]))
  const inputOrder = new Map(rows.map((r, i) => [r.id, i]))

  const cards: ClubCard[] = fullRows.map((r) => {
    const o = ownerMap.get(r.ownerId)
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      visibility: r.visibility as ClubVisibility,
      ownerUserId: r.ownerId,
      ownerUsername: o?.username ?? null,
      ownerDisplayName: o?.displayName ?? null,
      ownerAvatarUrl: o?.avatarUrl ?? null,
      genre: r.genre && isValidGenre(r.genre) ? r.genre : null,
      tags: r.tags ?? [],
      memberCount: r.memberCount,
      openJoin: r.openJoin,
      currentBookId: r.currentBookId,
      currentBookTitle: r.currentBookTitle,
      currentBookCoverUrl: r.currentBookCoverUrl,
      activityScore7d: activityScoreMap.get(r.id) ?? 0,
      lastActivityAt: r.lastActivityAt,
      createdAt: r.createdAt,
      firstPubliclyDiscoverableAt: r.firstPubliclyDiscoverableAt,
      memberPreviews: memberPreviewsMap.get(r.id) ?? [],
      coverImageUrl: r.coverImageUrl,
    }
  })

  cards.sort((a, b) => (inputOrder.get(a.id) ?? 0) - (inputOrder.get(b.id) ?? 0))
  return cards
}

/**
 * Three parallel GROUP BY queries against the source tables for the 7-day
 * window. Stitched via computeClubActivityScore7d into a per-club score Map.
 *
 * Signals (spec §2 Q2 weights — discussions 1x + book changes 3x + new members 2x):
 *  - discussions7d: bookClubDiscussions.createdAt >= 7d
 *  - bookChanges7d: bookClubBooks.addedAt >= 7d  (proxy for "current book changed" signal)
 *  - newMembers7d: bookClubMembers.joinedAt >= 7d
 */
async function loadActivityScoreMap(
  clubIds: string[],
): Promise<Map<string, number>> {
  if (clubIds.length === 0) return new Map()
  const since = sql`now() - interval '7 days'`

  const [discussionRows, bookChangeRows, newMemberRows] = await Promise.all([
    db
      .select({
        clubId: bookClubDiscussions.clubId,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(bookClubDiscussions)
      .where(
        and(
          inArray(bookClubDiscussions.clubId, clubIds),
          gte(bookClubDiscussions.createdAt, since),
        ),
      )
      .groupBy(bookClubDiscussions.clubId),
    db
      .select({
        clubId: bookClubBooks.clubId,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(bookClubBooks)
      .where(
        and(
          inArray(bookClubBooks.clubId, clubIds),
          gte(bookClubBooks.addedAt, since),
        ),
      )
      .groupBy(bookClubBooks.clubId),
    db
      .select({
        clubId: bookClubMembers.clubId,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(bookClubMembers)
      .where(
        and(
          inArray(bookClubMembers.clubId, clubIds),
          gte(bookClubMembers.joinedAt, since),
        ),
      )
      .groupBy(bookClubMembers.clubId),
  ])

  const discussions = new Map(
    discussionRows.map((r) => [r.clubId, Number(r.cnt)]),
  )
  const bookChanges = new Map(
    bookChangeRows.map((r) => [r.clubId, Number(r.cnt)]),
  )
  const newMembers = new Map(
    newMemberRows.map((r) => [r.clubId, Number(r.cnt)]),
  )

  const scoreMap = new Map<string, number>()
  for (const id of clubIds) {
    scoreMap.set(
      id,
      computeClubActivityScore7d({
        discussions7d: discussions.get(id) ?? 0,
        bookChanges7d: bookChanges.get(id) ?? 0,
        newMembers7d: newMembers.get(id) ?? 0,
      }),
    )
  }
  return scoreMap
}

/**
 * Window function: ROW_NUMBER() OVER (PARTITION BY club_id ORDER BY joined_at)
 * <= 4 returns up to 4 earliest members per club in a single bounded query.
 * LEFT JOINs user_profiles for the avatarUrl. Mirrors D2b precedent.
 */
async function loadMemberPreviewsMap(
  clubIds: string[],
): Promise<Map<string, Array<{ userId: string; avatarUrl: string | null }>>> {
  if (clubIds.length === 0) return new Map()
  const result = await db.execute<{
    club_id: string
    user_id: string
    avatar_url: string | null
  }>(sql`
    SELECT club_id, user_id, avatar_url FROM (
      SELECT
        cm.club_id,
        cm.user_id,
        up.avatar_url,
        ROW_NUMBER() OVER (PARTITION BY cm.club_id ORDER BY cm.joined_at) AS rn
      FROM book_club_members cm
      LEFT JOIN user_profiles up ON up.user_id = cm.user_id
      WHERE cm.club_id = ANY(ARRAY[${sql.join(
        clubIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[])
    ) sub WHERE rn <= 4
  `)
  const rows =
    (result as unknown as { rows?: unknown[] }).rows ??
    (result as unknown as unknown[])
  const typed = rows as Array<{
    club_id: string
    user_id: string
    avatar_url: string | null
  }>
  const map = new Map<
    string,
    Array<{ userId: string; avatarUrl: string | null }>
  >()
  for (const r of typed) {
    const list = map.get(r.club_id) ?? []
    list.push({ userId: r.user_id, avatarUrl: r.avatar_url })
    map.set(r.club_id, list)
  }
  return map
}

// ─── 1. Featured Club hero ────────────────────────────────────────────────────

/**
 * "Open + active": openJoin=true AND activityScore7d > 0 AND
 * last_activity_at >= 14d. Sort score DESC, lastActivityAt DESC, id DESC.
 * LIMIT 1. Returns null when no qualifier (hero hides cleanly per spec §6 Q4).
 */
export async function getFeaturedClubAction(args: {
  genre?: GenreSlug
}): Promise<ActionResult<ClubCard | null>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)

  const baseFilters = buildPublicClubFilters(args.genre, blocked)
  baseFilters.push(eq(bookClubs.openJoin, true))
  baseFilters.push(isNotNull(bookClubs.lastActivityAt))
  baseFilters.push(
    gte(
      bookClubs.lastActivityAt,
      sql`now() - interval '${sql.raw(String(FEATURED_ACTIVITY_WINDOW_DAYS))} days'`,
    ),
  )

  // Candidate window: top 200 by lastActivityAt DESC, then score in JS,
  // filter score > 0, take top 1.
  const candidates = await db
    .select({ id: bookClubs.id })
    .from(bookClubs)
    .where(and(...baseFilters))
    .orderBy(desc(bookClubs.lastActivityAt), desc(bookClubs.id))
    .limit(200)

  if (candidates.length === 0) return { success: true, data: null }

  const ids = candidates.map((r) => r.id)
  const scoreMap = await loadActivityScoreMap(ids)
  const qualified = ids
    .map((id) => ({ id, score: scoreMap.get(id) ?? 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
  if (qualified.length === 0) return { success: true, data: null }

  const projected = await projectToClubCards([qualified[0]!], {
    computeActivityScore: true,
  })
  return { success: true, data: projected[0] ?? null }
}

// ─── Rail args ────────────────────────────────────────────────────────────────

type RailArgs = {
  genre?: GenreSlug
  cursor?: string | null
}

// ─── 2. Trending now ──────────────────────────────────────────────────────────

/**
 * Sort by activityScore7d DESC. Filter activityScore7d > 0 (computed via
 * candidate scoring). Cursor: (activityScore7d DESC, id DESC).
 */
export async function getTrendingClubsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const baseFilters = buildPublicClubFilters(args.genre, blocked)
  baseFilters.push(isNotNull(bookClubs.lastActivityAt))

  const candidates = await db
    .select({ id: bookClubs.id })
    .from(bookClubs)
    .where(and(...baseFilters))
    .orderBy(desc(bookClubs.lastActivityAt), desc(bookClubs.id))
    .limit(200)

  const ids = candidates.map((r) => r.id)
  const scoreMap =
    ids.length > 0 ? await loadActivityScoreMap(ids) : new Map<string, number>()
  let ranked = ids
    .map((id) => ({ id, score: scoreMap.get(id) ?? 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.id < b.id ? 1 : -1
    })

  if (cursor && typeof cursor.sortKey === 'number') {
    const sk = cursor.sortKey
    ranked = ranked.filter(
      (r) => r.score < sk || (r.score === sk && r.id < cursor.id),
    )
  }

  const hasMore = ranked.length > PAGE_SIZE
  const strictPage = ranked.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getClubBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToClubCards(stitched.books, {
    computeActivityScore: true,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.score, id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 3. Active clubs ──────────────────────────────────────────────────────────

/**
 * last_activity_at >= now() - 7d, sorted by last_activity_at DESC.
 * Cheap path: computeActivityScore = false.
 * Cursor: (last_activity_at DESC, id DESC).
 */
export async function getActiveClubsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicClubFilters(args.genre, blocked),
    isNotNull(bookClubs.lastActivityAt),
    gte(
      bookClubs.lastActivityAt,
      sql`now() - interval '${sql.raw(String(ACTIVE_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(bookClubs.lastActivityAt, cursorDate),
      and(eq(bookClubs.lastActivityAt, cursorDate), lt(bookClubs.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: bookClubs.id, lastActivityAt: bookClubs.lastActivityAt })
    .from(bookClubs)
    .where(and(...conds))
    .orderBy(desc(bookClubs.lastActivityAt), desc(bookClubs.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getClubBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToClubCards(stitched.books, {
    computeActivityScore: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.lastActivityAt
      ? encodeCursor({ sortKey: last.lastActivityAt.toISOString(), id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 4. New clubs ─────────────────────────────────────────────────────────────

/**
 * first_publicly_discoverable_at >= now() - 30d. Sort by first_public DESC.
 * Cheap path: computeActivityScore = false.
 * Cursor: (first_publicly_discoverable_at DESC, id DESC).
 */
export async function getNewClubsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicClubFilters(args.genre, blocked),
    isNotNull(bookClubs.firstPubliclyDiscoverableAt),
    gte(
      bookClubs.firstPubliclyDiscoverableAt,
      sql`now() - interval '${sql.raw(String(NEW_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(bookClubs.firstPubliclyDiscoverableAt, cursorDate),
      and(
        eq(bookClubs.firstPubliclyDiscoverableAt, cursorDate),
        lt(bookClubs.id, cursor.id),
      ),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({
      id: bookClubs.id,
      firstPubliclyDiscoverableAt: bookClubs.firstPubliclyDiscoverableAt,
    })
    .from(bookClubs)
    .where(and(...conds))
    .orderBy(desc(bookClubs.firstPubliclyDiscoverableAt), desc(bookClubs.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getClubBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToClubCards(stitched.books, {
    computeActivityScore: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.firstPubliclyDiscoverableAt
      ? encodeCursor({
          sortKey: last.firstPubliclyDiscoverableAt.toISOString(),
          id: last.id,
        })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 5. Open to join ──────────────────────────────────────────────────────────

/**
 * openJoin=true AND last_activity_at >= 30d. Sort by memberCount DESC.
 * Cheap path: computeActivityScore = false.
 * Cursor: (memberCount DESC, id DESC).
 */
export async function getOpenToJoinClubsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicClubFilters(args.genre, blocked),
    eq(bookClubs.openJoin, true),
    isNotNull(bookClubs.lastActivityAt),
    gte(
      bookClubs.lastActivityAt,
      sql`now() - interval '${sql.raw(String(OPEN_TO_JOIN_ACTIVITY_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk = cursor.sortKey
    const tail = or(
      lt(bookClubs.memberCount, sk),
      and(eq(bookClubs.memberCount, sk), lt(bookClubs.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: bookClubs.id, memberCount: bookClubs.memberCount })
    .from(bookClubs)
    .where(and(...conds))
    .orderBy(desc(bookClubs.memberCount), desc(bookClubs.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getClubBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToClubCards(stitched.books, {
    computeActivityScore: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.memberCount, id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 6. From writers you follow ───────────────────────────────────────────────

/**
 * Clubs whose owner is in viewer's follow set. No backfill — Following hides
 * cleanly when empty (matches D2a/D2b Following precedent).
 * Auth required: throws AuthError on guests; callers wrap + hide rail.
 * Cursor: (last_activity_at DESC NULLS LAST, id DESC).
 */
export async function getFollowingClubsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await requireAuth()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const followeeRows = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  if (followeeRows.length === 0) {
    return {
      success: true,
      data: { books: [], strictCount: 0, nextCursor: null },
    }
  }
  const followeeIds = followeeRows.map((r) => r.id)

  const conds = [
    ...buildPublicClubFilters(args.genre, blocked),
    inArray(bookClubs.ownerId, followeeIds),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(bookClubs.lastActivityAt, cursorDate),
      and(eq(bookClubs.lastActivityAt, cursorDate), lt(bookClubs.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: bookClubs.id, lastActivityAt: bookClubs.lastActivityAt })
    .from(bookClubs)
    .where(and(...conds))
    .orderBy(desc(bookClubs.lastActivityAt), desc(bookClubs.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  // NOTE: Following rail does NOT backfill.
  const projected = await projectToClubCards(strictPage, {
    computeActivityScore: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.lastActivityAt
      ? encodeCursor({ sortKey: last.lastActivityAt.toISOString(), id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: projected.length, nextCursor },
  }
}

// ─── 7. Backfill source ───────────────────────────────────────────────────────

/**
 * Universal Club backfill: any PUBLIC + discoverable +
 * last_activity_at >= 30d. Sort by last_activity_at DESC. Excludes
 * already-shown ids. Cheap path: computeActivityScore = false.
 */
export async function getClubBackfillAction(args: {
  excludeIds: string[]
  genre?: GenreSlug
  limit?: number
}): Promise<ActionResult<ClubCard[]>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const limit = args.limit ?? 4

  const conds = [
    ...buildPublicClubFilters(args.genre, blocked),
    isNotNull(bookClubs.lastActivityAt),
    gte(
      bookClubs.lastActivityAt,
      sql`now() - interval '${sql.raw(String(BACKFILL_ACTIVITY_WINDOW_DAYS))} days'`,
    ),
  ]
  if (args.excludeIds.length > 0) {
    conds.push(notInArray(bookClubs.id, args.excludeIds))
  }

  const rows = await db
    .select({ id: bookClubs.id })
    .from(bookClubs)
    .where(and(...conds))
    .orderBy(desc(bookClubs.lastActivityAt), desc(bookClubs.id))
    .limit(limit)

  const projected = await projectToClubCards(rows, {
    computeActivityScore: false,
  })
  return { success: true, data: projected }
}

// ─── 8. Search (Discover) ─────────────────────────────────────────────────────

/**
 * ILIKE on bookClubs.name (primary), bookClubs.description, owner username +
 * displayName via leftJoin(userProfiles). Empty q → empty result.
 * Sort:
 *   relevance → collapses to most-active for v1 (TODO: real relevance scoring)
 *   recent → createdAt DESC
 *   most-active → activityScore DESC (computeActivityScore=true)
 *   most-members → memberCount DESC
 * Cursor pagination: standard (sortKey, id) tuple per sort mode.
 *   recent → (createdAt ISO string, id)
 *   most-members → (memberCount, id)
 *   most-active/relevance → (activityScore, id) ranked in JS
 */
export async function searchClubsDiscoverAction(args: {
  q?: string
  genre?: GenreSlug
  /** Multi-select genre; non-empty array takes precedence over single `genre`. */
  genres?: string[]
  /**
   * Member-count bucket — intimate (<=5), mid (6-15), large (>15).
   * 'any' (default) applies no filter.
   */
  size?: 'any' | 'intimate' | 'mid' | 'large'
  /**
   * Access posture. 'open' → openJoin=true; 'approval' → openJoin=false.
   * OR semantics within array: both selected = no narrowing.
   */
  accessStates?: Array<'open' | 'approval'>
  /**
   * Current-book posture. 'has-current' → currentBookId IS NOT NULL;
   * 'between' → currentBookId IS NULL. OR semantics within array.
   */
  currentBook?: Array<'has-current' | 'between'>
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
  cursor?: string | null
  /** 1-indexed page number for numbered pagination. */
  page?: number
  /** Filter to clubs owned by users the viewer follows. v1 impl; proper algorithm TODO. */
  source?: 'following'
  /** Required when source='following'; ignored otherwise. */
  viewerId?: string
}): Promise<
  ActionResult<{
    books: ClubCard[]
    nextCursor: string | null
    totalCount: number
  }>
> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedClubOwnerIdsForViewer(viewerId)
  const sort = args.sort ?? 'recent'
  const needsActivity = sort === 'most-active' || sort === 'relevance'
  const cursor = decodeCursor(args.cursor)
  const trimmed = (args.q ?? '').trim()
  const pageNum = Math.max(1, Math.floor(args.page ?? 1))
  const usePagination = (args.page ?? 0) > 0
  const offset = (pageNum - 1) * PAGE_SIZE

  // Multi-genre takes precedence over single genre.
  const multiGenres = (args.genres ?? []).filter(
    (g): g is string => typeof g === 'string',
  )
  const singleGenre =
    multiGenres.length === 0 ? args.genre : undefined

  const conds = [...buildPublicClubFilters(singleGenre, blocked)]

  if (multiGenres.length > 0) {
    conds.push(sql`${bookClubs.genre} = ANY(${multiGenres})`)
  }

  // Size bucket on memberCount denorm.
  if (args.size === 'intimate') {
    conds.push(sql`${bookClubs.memberCount} <= 5`)
  } else if (args.size === 'mid') {
    conds.push(sql`${bookClubs.memberCount} > 5 AND ${bookClubs.memberCount} <= 15`)
  } else if (args.size === 'large') {
    conds.push(sql`${bookClubs.memberCount} > 15`)
  }

  // Access posture — OR within array; if both selected, no filter added.
  const accessSet = new Set(args.accessStates ?? [])
  const accessNarrow =
    accessSet.size === 1 ? Array.from(accessSet)[0] : undefined
  if (accessNarrow === 'open') {
    conds.push(eq(bookClubs.openJoin, true))
  } else if (accessNarrow === 'approval') {
    conds.push(eq(bookClubs.openJoin, false))
  }

  // Current-book posture — OR within array.
  const currentSet = new Set(args.currentBook ?? [])
  const currentNarrow =
    currentSet.size === 1 ? Array.from(currentSet)[0] : undefined
  if (currentNarrow === 'has-current') {
    conds.push(isNotNull(bookClubs.currentBookId))
  } else if (currentNarrow === 'between') {
    conds.push(sql`${bookClubs.currentBookId} IS NULL`)
  }

  if (trimmed.length > 0) {
    const pattern = `%${trimmed}%`
    const titleOr = or(
      sql`${bookClubs.name} ILIKE ${pattern}`,
      sql`${bookClubs.description} ILIKE ${pattern}`,
      sql`${userProfiles.username} ILIKE ${pattern}`,
      sql`${userProfiles.displayName} ILIKE ${pattern}`,
    )
    if (titleOr) conds.push(titleOr)
  }

  // Cursor tail clause for DB-sorted modes (recent / most-members). Skip
  // when using numbered pagination.
  if (cursor && !usePagination) {
    if (sort === 'recent' && typeof cursor.sortKey === 'string') {
      const cursorDate = new Date(cursor.sortKey)
      const tail = or(
        lt(bookClubs.createdAt, cursorDate),
        and(
          eq(bookClubs.createdAt, cursorDate),
          lt(bookClubs.id, cursor.id),
        ),
      )
      if (tail) conds.push(tail)
    } else if (sort === 'most-members' && typeof cursor.sortKey === 'number') {
      const sk = cursor.sortKey
      const tail = or(
        lt(bookClubs.memberCount, sk),
        and(
          eq(bookClubs.memberCount, sk),
          lt(bookClubs.id, cursor.id),
        ),
      )
      if (tail) conds.push(tail)
    }
  }

  // Total count query — same filters. Runs in parallel with the main fetch.
  const totalCountPromise = db
    .select({ total: count(bookClubs.id) })
    .from(bookClubs)
    .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
    .where(and(...conds))

  let rows: Array<{ id: string; createdAt?: Date; memberCount?: number; score?: number }>
  let hasMore = false
  if (sort === 'recent') {
    const dbRows = await db
      .select({ id: bookClubs.id, createdAt: bookClubs.createdAt })
      .from(bookClubs)
      .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
      .where(and(...conds))
      .orderBy(desc(bookClubs.createdAt), desc(bookClubs.id))
      .limit(PAGE_SIZE + 1)
      .offset(offset)
    hasMore = dbRows.length > PAGE_SIZE
    rows = dbRows.slice(0, PAGE_SIZE)
  } else if (sort === 'most-members') {
    const dbRows = await db
      .select({ id: bookClubs.id, memberCount: bookClubs.memberCount })
      .from(bookClubs)
      .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
      .where(and(...conds))
      .orderBy(desc(bookClubs.memberCount), desc(bookClubs.id))
      .limit(PAGE_SIZE + 1)
      .offset(offset)
    hasMore = dbRows.length > PAGE_SIZE
    rows = dbRows.slice(0, PAGE_SIZE)
  } else {
    // most-active or relevance: collect a wider candidate window and rank by score in JS.
    const candidateRows = await db
      .select({ id: bookClubs.id })
      .from(bookClubs)
      .leftJoin(userProfiles, eq(userProfiles.userId, bookClubs.ownerId))
      .where(and(...conds))
      .orderBy(desc(bookClubs.lastActivityAt), desc(bookClubs.id))
      .limit(200)
    const candIds = candidateRows.map((r) => r.id)
    const scoreMap =
      candIds.length > 0
        ? await loadActivityScoreMap(candIds)
        : new Map<string, number>()
    let ranked = candIds
      .map((id) => ({ id, score: scoreMap.get(id) ?? 0 }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.id < b.id ? 1 : -1
      })
    if (!usePagination && cursor && typeof cursor.sortKey === 'number') {
      const sk = cursor.sortKey
      ranked = ranked.filter(
        (r) => r.score < sk || (r.score === sk && r.id < cursor.id),
      )
    }
    const startIdx = usePagination ? offset : 0
    hasMore = ranked.length > startIdx + PAGE_SIZE
    rows = ranked.slice(startIdx, startIdx + PAGE_SIZE)
  }

  const totalCountRows = await totalCountPromise
  const totalCount = Number(totalCountRows[0]?.total ?? 0)

  const projected = await projectToClubCards(
    rows.map((r) => ({ id: r.id })),
    { computeActivityScore: needsActivity },
  )

  const last = rows[rows.length - 1]
  let nextCursor: string | null = null
  if (hasMore && last) {
    if (sort === 'recent' && last.createdAt) {
      nextCursor = encodeCursor({
        sortKey: last.createdAt.toISOString(),
        id: last.id,
      })
    } else if (sort === 'most-members' && typeof last.memberCount === 'number') {
      nextCursor = encodeCursor({ sortKey: last.memberCount, id: last.id })
    } else if (typeof last.score === 'number') {
      nextCursor = encodeCursor({ sortKey: last.score, id: last.id })
    }
  }
  return {
    success: true,
    data: {
      books: projected,
      nextCursor: usePagination ? null : nextCursor,
      totalCount,
    },
  }
}

// ─── 9. Genre counts (cached 5min) ────────────────────────────────────────────

/**
 * Per-genre count of discoverable clubs. 5min revalidate (matches D1/D2a/D2b).
 */
const getClubGenreCountsCached = unstable_cache(
  async (): Promise<Record<GenreSlug, number>> => {
    const rows = await db
      .select({
        genre: bookClubs.genre,
        total: count(),
      })
      .from(bookClubs)
      .where(
        and(
          eq(bookClubs.visibility, 'PUBLIC'),
          eq(bookClubs.discoverable, true),
          isNotNull(bookClubs.genre),
        ),
      )
      .groupBy(bookClubs.genre)

    const counts: Record<GenreSlug, number> = GENRES.reduce(
      (acc, slug) => {
        acc[slug] = 0
        return acc
      },
      {} as Record<GenreSlug, number>,
    )
    for (const r of rows) {
      const slug = normalizeGenre(r.genre)
      counts[slug] = (counts[slug] ?? 0) + Number(r.total)
    }
    return counts
  },
  ['discover-clubs-genre-counts'],
  { revalidate: 300, tags: ['discover-clubs-genre-counts'] },
)

export async function getClubGenreCountsAction(): Promise<
  ActionResult<Record<GenreSlug, number>>
> {
  const data = await getClubGenreCountsCached()
  return { success: true, data }
}
