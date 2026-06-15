'use server'

import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import {
  readingLists,
  readingListBooks,
  readingListFollows,
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

import type { ActionResult } from './book.actions'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ListVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

/**
 * ListCard — projected row shape for every D3a Discover Lists surface.
 * followersGained7d is 0 on cheap-path rails (only Trending needs it).
 * bookCoverPreviews always fetched via window function (B card design
 * needs the fanned book-stack).
 */
export type ListCard = {
  id: string
  title: string
  description: string | null
  visibility: ListVisibility
  ownerUserId: string
  ownerUsername: string | null
  ownerDisplayName: string | null
  ownerAvatarUrl: string | null
  genre: GenreSlug | null
  tags: string[]
  bookCount: number
  followerCount: number
  followersGained7d: number // 0 on cheap-path rails
  lastUpdatedAt: Date | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
  bookCoverPreviews: Array<{
    bookId: string | null
    coverUrl: string | null
    title: string
  }>
}

export type RailResult<T = ListCard> = {
  // Field name 'books' preserved across D-phase for component reuse.
  books: T[]
  strictCount: number
  nextCursor: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12
const NEW_WINDOW_DAYS = 30
const RECENTLY_UPDATED_WINDOW_DAYS = 7
const BACKFILL_UPDATED_WINDOW_DAYS = 30
const FEATURED_FIRST_PUBLIC_WINDOW_DAYS = 14
const TRENDING_CANDIDATE_LIMIT = 200
const COVER_PREVIEW_CAP = 3

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
 * Mirrors D2b's getBlockedHiveOwnerIdsForViewer. Returns bidirectional
 * blocked owner set in a single query. Empty for guests.
 */
async function getBlockedListOwnerIdsForViewer(
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
 * Canonical public-list WHERE conditions. PUBLIC + discoverable + CUSTOM
 * + genre + not-blocked. No JOIN required since `reading_lists.genre` lives
 * on the row itself (unlike D2b which JOINs books).
 */
function buildPublicListFilters(
  genre: GenreSlug | undefined,
  blocked: Set<string>,
) {
  const filters = [
    eq(readingLists.visibility, 'PUBLIC'),
    eq(readingLists.discoverable, true),
    eq(readingLists.kind, 'CUSTOM'),
  ]
  if (genre) {
    filters.push(eq(readingLists.genre, genre))
    filters.push(isNotNull(readingLists.genre))
  }
  if (blocked.size > 0) {
    filters.push(notInArray(readingLists.userId, Array.from(blocked)))
  }
  return filters
}

type ProjectionOpts = {
  computeFollowersGained: boolean
}

/**
 * Project ordered list ids → ListCard[] via parallel Map-stitch.
 * Always fetches authors + bookCoverPreviews. followersGained7d is
 * conditional via opts (cheap-path).
 *
 * Preserves input row order via idIndex (rails may sort by signals not
 * expressible in WHERE).
 */
async function projectToListCards(
  rows: Array<{ id: string }>,
  opts: ProjectionOpts,
): Promise<ListCard[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const fullRows = await db
    .select({
      id: readingLists.id,
      title: readingLists.title,
      description: readingLists.description,
      visibility: readingLists.visibility,
      userId: readingLists.userId,
      genre: readingLists.genre,
      tags: readingLists.tags,
      bookCount: readingLists.bookCount,
      followerCount: readingLists.followerCount,
      lastUpdatedAt: readingLists.lastUpdatedAt,
      createdAt: readingLists.createdAt,
      firstPubliclyDiscoverableAt: readingLists.firstPubliclyDiscoverableAt,
    })
    .from(readingLists)
    .where(inArray(readingLists.id, ids))

  const ownerIds = Array.from(new Set(fullRows.map((r) => r.userId)))

  const [ownerRows, followersGainedMap, bookCoverPreviewsMap] = await Promise.all([
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
    opts.computeFollowersGained
      ? loadFollowersGained7dMap(ids)
      : Promise.resolve(new Map<string, number>()),
    loadBookCoverPreviewsMap(ids),
  ])

  const ownerMap = new Map(ownerRows.map((o) => [o.userId, o]))
  const inputOrder = new Map(rows.map((r, i) => [r.id, i]))

  const cards: ListCard[] = fullRows.map((r) => {
    const o = ownerMap.get(r.userId)
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      visibility: r.visibility as ListVisibility,
      ownerUserId: r.userId,
      ownerUsername: o?.username ?? null,
      ownerDisplayName: o?.displayName ?? null,
      ownerAvatarUrl: o?.avatarUrl ?? null,
      genre: r.genre && isValidGenre(r.genre) ? r.genre : null,
      tags: r.tags ?? [],
      bookCount: r.bookCount,
      followerCount: r.followerCount,
      followersGained7d: followersGainedMap.get(r.id) ?? 0,
      lastUpdatedAt: r.lastUpdatedAt,
      createdAt: r.createdAt,
      firstPubliclyDiscoverableAt: r.firstPubliclyDiscoverableAt,
      bookCoverPreviews: bookCoverPreviewsMap.get(r.id) ?? [],
    }
  })

  cards.sort((a, b) => (inputOrder.get(a.id) ?? 0) - (inputOrder.get(b.id) ?? 0))
  return cards
}

/**
 * Single GROUP BY on reading_list_follows for the 7-day window.
 * Used only when a rail needs the followers-gained signal (Trending).
 */
async function loadFollowersGained7dMap(
  listIds: string[],
): Promise<Map<string, number>> {
  if (listIds.length === 0) return new Map()
  const rows = await db
    .select({
      listId: readingListFollows.listId,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(readingListFollows)
    .where(
      and(
        inArray(readingListFollows.listId, listIds),
        gte(
          readingListFollows.createdAt,
          sql`now() - interval '7 days'`,
        ),
      ),
    )
    .groupBy(readingListFollows.listId)
  return new Map(rows.map((r) => [r.listId, Number(r.cnt)]))
}

/**
 * Window function: ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY "order")
 * <= 3 returns up to 3 earliest books per list in a single bounded query.
 * Reads cover_url + title directly from reading_list_books (denorm copies
 * are populated at add-time; book may be NULL).
 *
 * Plan T2 resolution: keeps query cost bounded regardless of list size.
 */
async function loadBookCoverPreviewsMap(
  listIds: string[],
): Promise<
  Map<
    string,
    Array<{ bookId: string | null; coverUrl: string | null; title: string }>
  >
> {
  if (listIds.length === 0) return new Map()
  const result = await db.execute<{
    list_id: string
    book_id: string | null
    cover_url: string | null
    title: string
  }>(sql`
    SELECT list_id, book_id, cover_url, title FROM (
      SELECT
        rlb.list_id,
        rlb.book_id,
        rlb.cover_url,
        rlb.title,
        ROW_NUMBER() OVER (PARTITION BY rlb.list_id ORDER BY rlb."order") AS rn
      FROM reading_list_books rlb
      WHERE rlb.list_id = ANY(ARRAY[${sql.join(
        listIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[])
    ) sub WHERE rn <= ${COVER_PREVIEW_CAP}
  `)
  const rows =
    (result as unknown as { rows?: unknown[] }).rows ??
    (result as unknown as unknown[])
  const typed = rows as Array<{
    list_id: string
    book_id: string | null
    cover_url: string | null
    title: string
  }>
  const map = new Map<
    string,
    Array<{ bookId: string | null; coverUrl: string | null; title: string }>
  >()
  for (const r of typed) {
    const list = map.get(r.list_id) ?? []
    list.push({ bookId: r.book_id, coverUrl: r.cover_url, title: r.title })
    map.set(r.list_id, list)
  }
  return map
}

// ─── 1. Featured List hero ────────────────────────────────────────────────────

/**
 * "Rising curator": kind='CUSTOM' AND first_publicly_discoverable_at >= now() - 14d.
 * Sort: followerCount DESC, id DESC. LIMIT 1.
 * Returns null when no qualifier (hero hides cleanly per spec §6.4).
 */
export async function getFeaturedListAction(args: {
  genre?: GenreSlug
}): Promise<ActionResult<ListCard | null>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)

  const conds = [
    ...buildPublicListFilters(args.genre, blocked),
    isNotNull(readingLists.firstPubliclyDiscoverableAt),
    gte(
      readingLists.firstPubliclyDiscoverableAt,
      sql`now() - interval '${sql.raw(String(FEATURED_FIRST_PUBLIC_WINDOW_DAYS))} days'`,
    ),
  ]

  const candidates = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .where(and(...conds))
    .orderBy(desc(readingLists.followerCount), desc(readingLists.id))
    .limit(1)

  if (candidates.length === 0) return { success: true, data: null }

  const projected = await projectToListCards([candidates[0]!], {
    computeFollowersGained: false,
  })
  return { success: true, data: projected[0] ?? null }
}

// ─── Rail args ────────────────────────────────────────────────────────────────

type RailArgs = {
  genre?: GenreSlug
  cursor?: string | null
}

// ─── 2. Trending ──────────────────────────────────────────────────────────────

/**
 * Sort by followersGained7d DESC. Filter followersGained7d > 0 (computed via
 * candidate scoring; no WHERE on raw signals — cost is the same as D2b Trending).
 * Cursor: (followersGained7d DESC, id DESC).
 */
export async function getTrendingListsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  // Wide candidate sweep (last_updated_at DESC), then score + sort + cursor in JS.
  const baseFilters = buildPublicListFilters(args.genre, blocked)
  baseFilters.push(isNotNull(readingLists.lastUpdatedAt))

  const candidates = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .where(and(...baseFilters))
    .orderBy(desc(readingLists.lastUpdatedAt), desc(readingLists.id))
    .limit(TRENDING_CANDIDATE_LIMIT)

  const ids = candidates.map((r) => r.id)
  const followersMap =
    ids.length > 0 ? await loadFollowersGained7dMap(ids) : new Map<string, number>()
  let ranked = ids
    .map((id) => ({ id, score: followersMap.get(id) ?? 0 }))
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
    const backRes = await getListBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToListCards(stitched.books, {
    computeFollowersGained: true,
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

// ─── 3. Recently updated ──────────────────────────────────────────────────────

/**
 * last_updated_at >= now() - 7d, sorted by last_updated_at DESC.
 * Cheap path: computeFollowersGained = false.
 * Cursor: (last_updated_at DESC, id DESC).
 */
export async function getRecentlyUpdatedListsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicListFilters(args.genre, blocked),
    isNotNull(readingLists.lastUpdatedAt),
    gte(
      readingLists.lastUpdatedAt,
      sql`now() - interval '${sql.raw(String(RECENTLY_UPDATED_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(readingLists.lastUpdatedAt, cursorDate),
      and(eq(readingLists.lastUpdatedAt, cursorDate), lt(readingLists.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: readingLists.id, lastUpdatedAt: readingLists.lastUpdatedAt })
    .from(readingLists)
    .where(and(...conds))
    .orderBy(desc(readingLists.lastUpdatedAt), desc(readingLists.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getListBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToListCards(stitched.books, {
    computeFollowersGained: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.lastUpdatedAt
      ? encodeCursor({ sortKey: last.lastUpdatedAt.toISOString(), id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 4. New ───────────────────────────────────────────────────────────────────

/**
 * first_publicly_discoverable_at >= now() - 30d. Sort by first_public DESC.
 * Cheap path: computeFollowersGained = false.
 * Cursor: (first_publicly_discoverable_at DESC, id DESC).
 */
export async function getNewListsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicListFilters(args.genre, blocked),
    isNotNull(readingLists.firstPubliclyDiscoverableAt),
    gte(
      readingLists.firstPubliclyDiscoverableAt,
      sql`now() - interval '${sql.raw(String(NEW_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(readingLists.firstPubliclyDiscoverableAt, cursorDate),
      and(
        eq(readingLists.firstPubliclyDiscoverableAt, cursorDate),
        lt(readingLists.id, cursor.id),
      ),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({
      id: readingLists.id,
      firstPubliclyDiscoverableAt: readingLists.firstPubliclyDiscoverableAt,
    })
    .from(readingLists)
    .where(and(...conds))
    .orderBy(desc(readingLists.firstPubliclyDiscoverableAt), desc(readingLists.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getListBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToListCards(stitched.books, {
    computeFollowersGained: false,
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

// ─── 5. Most followed ─────────────────────────────────────────────────────────

/**
 * No time window. Sort by followerCount DESC, id DESC.
 * Cheap path: computeFollowersGained = false.
 * Cursor: (followerCount DESC, id DESC).
 */
export async function getMostFollowedListsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [...buildPublicListFilters(args.genre, blocked)]
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk = cursor.sortKey
    const tail = or(
      lt(readingLists.followerCount, sk),
      and(eq(readingLists.followerCount, sk), lt(readingLists.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: readingLists.id, followerCount: readingLists.followerCount })
    .from(readingLists)
    .where(and(...conds))
    .orderBy(desc(readingLists.followerCount), desc(readingLists.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getListBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToListCards(stitched.books, {
    computeFollowersGained: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.followerCount, id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 6. Following ─────────────────────────────────────────────────────────────

/**
 * Lists whose owner is in viewer's follow set. No backfill — Following hides
 * cleanly when empty (matches D2a/D2b precedent).
 * Auth required: throws AuthError on guests; callers wrap + hide rail.
 * Cursor: (last_updated_at DESC NULLS LAST, id DESC).
 */
export async function getFollowingListsAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await requireAuth()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
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
    ...buildPublicListFilters(args.genre, blocked),
    inArray(readingLists.userId, followeeIds),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(readingLists.lastUpdatedAt, cursorDate),
      and(eq(readingLists.lastUpdatedAt, cursorDate), lt(readingLists.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: readingLists.id, lastUpdatedAt: readingLists.lastUpdatedAt })
    .from(readingLists)
    .where(and(...conds))
    .orderBy(desc(readingLists.lastUpdatedAt), desc(readingLists.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  // NOTE: Following rail does NOT backfill.
  const projected = await projectToListCards(strictPage, {
    computeFollowersGained: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.lastUpdatedAt
      ? encodeCursor({ sortKey: last.lastUpdatedAt.toISOString(), id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: projected.length, nextCursor },
  }
}

// ─── 7. Backfill source ───────────────────────────────────────────────────────

/**
 * Universal List backfill: any PUBLIC + discoverable + CUSTOM +
 * last_updated_at >= 30d. Sort by last_updated_at DESC. Excludes
 * already-shown ids. Cheap path: computeFollowersGained = false.
 */
export async function getListBackfillAction(args: {
  excludeIds: string[]
  genre?: GenreSlug
  limit?: number
}): Promise<ActionResult<ListCard[]>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
  const limit = args.limit ?? 4

  const conds = [
    ...buildPublicListFilters(args.genre, blocked),
    isNotNull(readingLists.lastUpdatedAt),
    gte(
      readingLists.lastUpdatedAt,
      sql`now() - interval '${sql.raw(String(BACKFILL_UPDATED_WINDOW_DAYS))} days'`,
    ),
  ]
  if (args.excludeIds.length > 0) {
    conds.push(notInArray(readingLists.id, args.excludeIds))
  }

  const rows = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .where(and(...conds))
    .orderBy(desc(readingLists.lastUpdatedAt), desc(readingLists.id))
    .limit(limit)

  const projected = await projectToListCards(rows, {
    computeFollowersGained: false,
  })
  return { success: true, data: projected }
}

// ─── 8. Search (Discover) ─────────────────────────────────────────────────────

/**
 * ILIKE on reading_lists.title (primary), description, owner username +
 * displayName via leftJoin(userProfiles). Empty q → empty result.
 * Sort:
 *   relevance → collapses to most-followed for v1 (TODO: real relevance scoring)
 *   recent → createdAt DESC
 *   most-followed → followerCount DESC
 *   most-books → bookCount DESC
 * Cursor pagination: standard (sortKey, id) tuple per sort mode.
 *   recent → (createdAt ISO string, id)
 *   most-books → (bookCount, id)
 *   most-followed/relevance → (followerCount, id)
 */
export async function searchListsDiscoverAction(args: {
  q?: string
  genre?: GenreSlug
  /** Multi-select genre; non-empty array takes precedence over single `genre`. */
  genres?: string[]
  /** Follower-count threshold. '10+' filters to lists with followerCount >= 10. */
  popularity?: 'any' | '10+'
  /** Updated recency — applied to lastUpdatedAt. */
  updated?: 'anytime' | 'month'
  /** anyone (default) / following (curator must be in viewer's follow set). */
  curator?: 'anyone' | 'following'
  sort?: 'relevance' | 'recent' | 'most-followed' | 'most-books'
  cursor?: string | null
}): Promise<ActionResult<{ books: ListCard[]; nextCursor: string | null }>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedListOwnerIdsForViewer(viewerId)
  const sort = args.sort ?? 'recent'
  const cursor = decodeCursor(args.cursor)
  const trimmed = (args.q ?? '').trim()

  // Multi-genre takes precedence over single genre.
  const multiGenres = (args.genres ?? []).filter(
    (g): g is string => typeof g === 'string',
  )
  const singleGenre =
    multiGenres.length === 0 ? args.genre : undefined

  const conds = [...buildPublicListFilters(singleGenre, blocked)]

  if (multiGenres.length > 0) {
    conds.push(sql`${readingLists.genre} = ANY(${multiGenres})`)
    conds.push(isNotNull(readingLists.genre))
  }

  if (trimmed.length > 0) {
    const pattern = `%${trimmed}%`
    const titleOr = or(
      sql`${readingLists.title} ILIKE ${pattern}`,
      sql`${readingLists.description} ILIKE ${pattern}`,
      sql`${userProfiles.username} ILIKE ${pattern}`,
      sql`${userProfiles.displayName} ILIKE ${pattern}`,
    )
    if (titleOr) conds.push(titleOr)
  }

  // Popularity threshold.
  if (args.popularity === '10+') {
    conds.push(gte(readingLists.followerCount, 10))
  }

  // Updated recency.
  if (args.updated === 'month') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    conds.push(
      sql`${readingLists.lastUpdatedAt} IS NOT NULL AND ${readingLists.lastUpdatedAt} >= ${cutoff}`,
    )
  }

  // Curator-following filter — only effective when viewer is authed. Guest
  // requests with curator='following' silently fall through (no Following
  // affordance is shown to guests per spec §4).
  if (args.curator === 'following' && viewerId) {
    const followedSubquery = sql<string>`(SELECT ${follows.followeeId} FROM ${follows} WHERE ${follows.followerId} = ${viewerId})`
    conds.push(sql`${readingLists.userId} IN ${followedSubquery}`)
  }

  // Cursor tail clause per sort mode.
  if (cursor) {
    if (sort === 'recent' && typeof cursor.sortKey === 'string') {
      const cursorDate = new Date(cursor.sortKey)
      const tail = or(
        lt(readingLists.createdAt, cursorDate),
        and(
          eq(readingLists.createdAt, cursorDate),
          lt(readingLists.id, cursor.id),
        ),
      )
      if (tail) conds.push(tail)
    } else if (sort === 'most-books' && typeof cursor.sortKey === 'number') {
      const sk = cursor.sortKey
      const tail = or(
        lt(readingLists.bookCount, sk),
        and(
          eq(readingLists.bookCount, sk),
          lt(readingLists.id, cursor.id),
        ),
      )
      if (tail) conds.push(tail)
    } else if (typeof cursor.sortKey === 'number') {
      // most-followed or relevance
      const sk = cursor.sortKey
      const tail = or(
        lt(readingLists.followerCount, sk),
        and(
          eq(readingLists.followerCount, sk),
          lt(readingLists.id, cursor.id),
        ),
      )
      if (tail) conds.push(tail)
    }
  }

  // Always leftJoin userProfiles for the owner-name ILIKE.
  let rows: Array<{
    id: string
    createdAt: Date
    bookCount: number
    followerCount: number
  }>
  if (sort === 'recent') {
    rows = await db
      .select({
        id: readingLists.id,
        createdAt: readingLists.createdAt,
        bookCount: readingLists.bookCount,
        followerCount: readingLists.followerCount,
      })
      .from(readingLists)
      .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
      .where(and(...conds))
      .orderBy(desc(readingLists.createdAt), desc(readingLists.id))
      .limit(PAGE_SIZE + 1)
  } else if (sort === 'most-books') {
    rows = await db
      .select({
        id: readingLists.id,
        createdAt: readingLists.createdAt,
        bookCount: readingLists.bookCount,
        followerCount: readingLists.followerCount,
      })
      .from(readingLists)
      .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
      .where(and(...conds))
      .orderBy(desc(readingLists.bookCount), desc(readingLists.id))
      .limit(PAGE_SIZE + 1)
  } else {
    // most-followed or relevance: both collapse to followerCount DESC for v1.
    // TODO: real relevance scoring (e.g. Postgres full-text + ts_rank).
    rows = await db
      .select({
        id: readingLists.id,
        createdAt: readingLists.createdAt,
        bookCount: readingLists.bookCount,
        followerCount: readingLists.followerCount,
      })
      .from(readingLists)
      .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
      .where(and(...conds))
      .orderBy(desc(readingLists.followerCount), desc(readingLists.id))
      .limit(PAGE_SIZE + 1)
  }

  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const projected = await projectToListCards(
    page.map((r) => ({ id: r.id })),
    { computeFollowersGained: false },
  )

  const last = page[page.length - 1]
  let nextCursor: string | null = null
  if (hasMore && last) {
    if (sort === 'recent') {
      nextCursor = encodeCursor({
        sortKey: last.createdAt.toISOString(),
        id: last.id,
      })
    } else if (sort === 'most-books') {
      nextCursor = encodeCursor({ sortKey: last.bookCount, id: last.id })
    } else {
      nextCursor = encodeCursor({ sortKey: last.followerCount, id: last.id })
    }
  }
  return { success: true, data: { books: projected, nextCursor } }
}

// ─── 9. Genre counts (cached 5min) ────────────────────────────────────────────

/**
 * Per-genre count of discoverable lists. No JOIN needed — reading_lists.genre
 * lives on the row. 5min revalidate (matches D1/D2a/D2b precedent).
 */
const getListGenreCountsCached = unstable_cache(
  async (): Promise<Record<GenreSlug, number>> => {
    const rows = await db
      .select({
        genre: readingLists.genre,
        total: count(),
      })
      .from(readingLists)
      .where(
        and(
          eq(readingLists.visibility, 'PUBLIC'),
          eq(readingLists.discoverable, true),
          eq(readingLists.kind, 'CUSTOM'),
          isNotNull(readingLists.genre),
        ),
      )
      .groupBy(readingLists.genre)

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
  ['discover-lists-genre-counts'],
  { revalidate: 300, tags: ['discover-lists-genre-counts'] },
)

export async function getListGenreCountsAction(): Promise<
  ActionResult<Record<GenreSlug, number>>
> {
  const data = await getListGenreCountsCached()
  return { success: true, data }
}
