'use server'

import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import {
  hives,
  hiveMembers,
  hiveBuzzPosts,
  hiveWordLogs,
  hiveDiscussionPosts,
  hiveSubmissions,
} from '@/db/schema/hive'
import { books, chapters } from '@/db/schema/books'
import { follows, userBlocks } from '@/db/schema/social'
import { userProfiles } from '@/db/schema/auth'
import {
  and,
  eq,
  desc,
  asc,
  sql,
  inArray,
  notInArray,
  isNotNull,
  gt,
  gte,
  lt,
  lte,
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
import { computeHiveActivityScore7d } from '@/lib/discover/hive-activity-score'

import type { ActionResult } from './book.actions'

// ─── Public types ─────────────────────────────────────────────────────────────

export type HiveVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
export type HiveStatus = 'ACTIVE' | 'COMPLETED'

/**
 * HiveCard — the projected row shape for every D2b Discover Hives surface.
 * activityScore7d + buzzPosts7d are 0 on cheap-path rails (only Trending +
 * Featured + search 'most-active' need them). memberPreviews always fetched
 * via window function (B card design needs the avatar stack).
 */
export type HiveCard = {
  id: string
  name: string
  description: string | null
  visibility: HiveVisibility
  status: HiveStatus
  ownerUserId: string
  ownerUsername: string | null
  ownerDisplayName: string | null
  ownerAvatarUrl: string | null
  bookId: string
  bookTitle: string
  bookCoverUrl: string | null
  bookGenre: GenreSlug | null
  memberCount: number
  lastActivityAt: Date | null
  activityScore7d: number // 0 on cheap-path rails
  buzzPosts7d: number // 0 on cheap-path rails
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
}

export type RailResult<T = HiveCard> = {
  // Field name 'books' preserved across D-phase for component reuse.
  books: T[]
  strictCount: number
  nextCursor: string | null
}

export type SizeBucket = 'any' | 'small' | 'mid' | 'large'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12
const NEW_WINDOW_DAYS = 30
const RECENTLY_ACTIVE_WINDOW_DAYS = 7
const LFC_ACTIVITY_WINDOW_DAYS = 30
const BACKFILL_ACTIVITY_WINDOW_DAYS = 30
const FEATURED_MEMBER_CAP = 10

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
 * Mirrors D1's getBlockedAuthorIdsForViewer + D2a's getBlockedSparkCreatorIdsForViewer.
 * Returns bidirectional blocked owner set in a single query. Empty for guests.
 */
async function getBlockedHiveOwnerIdsForViewer(
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

function sizeBucketCondition(size: SizeBucket) {
  switch (size) {
    case 'small':
      return and(gte(hives.memberCount, 2), lte(hives.memberCount, 5))
    case 'mid':
      return and(gte(hives.memberCount, 6), lte(hives.memberCount, 15))
    case 'large':
      return gte(hives.memberCount, 16)
    case 'any':
    default:
      return sql`true`
  }
}

/**
 * Build the canonical public-hive WHERE conditions. NOTE: When a `genre` is
 * supplied the caller MUST `innerJoin(books, eq(books.id, hives.bookId))` so
 * the `books.genre` filter resolves. Without the JOIN this throws at runtime.
 *
 * Returns a flat array of conditions intended for `and(...filters)`.
 */
function buildPublicHiveFilters(
  genre: GenreSlug | undefined,
  size: SizeBucket,
  blocked: Set<string>,
) {
  const filters = [
    eq(hives.visibility, 'PUBLIC'),
    eq(hives.discoverable, true),
    eq(hives.status, 'ACTIVE'),
    sizeBucketCondition(size),
  ]
  if (genre) {
    filters.push(eq(books.genre, genre))
  }
  if (blocked.size > 0) {
    filters.push(notInArray(hives.ownerId, Array.from(blocked)))
  }
  return filters
}

type ProjectionOpts = {
  computeActivityScore: boolean
  computeBuzzCount: boolean
}

/**
 * Project an ordered list of hive ids → HiveCard[] via parallel Map-stitch.
 * Always JOINs books (for title/cover/genre) and fetches memberPreviews
 * (window-function, bounded). activity score + buzz count are conditional
 * on opts so cheap-path rails skip the heavy queries.
 *
 * Preserves the input row order via idIndex (rails may sort by signals not
 * expressible in WHERE).
 */
async function projectToHiveCards(
  rows: Array<{ id: string }>,
  opts: ProjectionOpts,
): Promise<HiveCard[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const fullRows = await db
    .select({
      id: hives.id,
      name: hives.name,
      description: hives.description,
      visibility: hives.visibility,
      status: hives.status,
      ownerId: hives.ownerId,
      bookId: hives.bookId,
      bookTitle: books.title,
      bookCoverUrl: books.coverUrl,
      bookGenre: books.genre,
      memberCount: hives.memberCount,
      lastActivityAt: hives.lastActivityAt,
      createdAt: hives.createdAt,
      firstPubliclyDiscoverableAt: hives.firstPubliclyDiscoverableAt,
    })
    .from(hives)
    .innerJoin(books, eq(books.id, hives.bookId))
    .where(inArray(hives.id, ids))

  const ownerIds = Array.from(new Set(fullRows.map((r) => r.ownerId)))

  const [ownerRows, activityScoreMap, buzzCountMap, memberPreviewsMap] =
    await Promise.all([
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
      opts.computeBuzzCount
        ? loadBuzzCountMap(ids)
        : Promise.resolve(new Map<string, number>()),
      loadMemberPreviewsMap(ids),
    ])

  const ownerMap = new Map(ownerRows.map((o) => [o.userId, o]))
  const inputOrder = new Map(rows.map((r, i) => [r.id, i]))

  const cards: HiveCard[] = fullRows.map((r) => {
    const o = ownerMap.get(r.ownerId)
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      visibility: r.visibility as HiveVisibility,
      status: r.status as HiveStatus,
      ownerUserId: r.ownerId,
      ownerUsername: o?.username ?? null,
      ownerDisplayName: o?.displayName ?? null,
      ownerAvatarUrl: o?.avatarUrl ?? null,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      bookCoverUrl: r.bookCoverUrl,
      bookGenre: r.bookGenre && isValidGenre(r.bookGenre) ? r.bookGenre : null,
      memberCount: r.memberCount,
      lastActivityAt: r.lastActivityAt,
      activityScore7d: activityScoreMap.get(r.id) ?? 0,
      buzzPosts7d: buzzCountMap.get(r.id) ?? 0,
      memberPreviews: memberPreviewsMap.get(r.id) ?? [],
      createdAt: r.createdAt,
      firstPubliclyDiscoverableAt: r.firstPubliclyDiscoverableAt,
    }
  })

  cards.sort((a, b) => (inputOrder.get(a.id) ?? 0) - (inputOrder.get(b.id) ?? 0))
  return cards
}

/**
 * Five parallel GROUP BY queries against the source tables for the 7-day
 * window. Stitched via computeHiveActivityScore7d into a per-hive score Map.
 */
async function loadActivityScoreMap(
  hiveIds: string[],
): Promise<Map<string, number>> {
  if (hiveIds.length === 0) return new Map()
  const since = sql`now() - interval '7 days'`

  const [buzzRows, wordLogRows, discussionRows, chapterUpdateRows, submissionRows] =
    await Promise.all([
      db
        .select({
          hiveId: hiveBuzzPosts.hiveId,
          cnt: sql<number>`COUNT(*)::int`,
        })
        .from(hiveBuzzPosts)
        .where(
          and(
            inArray(hiveBuzzPosts.hiveId, hiveIds),
            gte(hiveBuzzPosts.createdAt, since),
          ),
        )
        .groupBy(hiveBuzzPosts.hiveId),
      db
        .select({
          hiveId: hiveWordLogs.hiveId,
          cnt: sql<number>`COUNT(*)::int`,
        })
        .from(hiveWordLogs)
        .where(
          and(
            inArray(hiveWordLogs.hiveId, hiveIds),
            gte(hiveWordLogs.loggedAt, since),
          ),
        )
        .groupBy(hiveWordLogs.hiveId),
      db
        .select({
          hiveId: hiveDiscussionPosts.hiveId,
          cnt: sql<number>`COUNT(*)::int`,
        })
        .from(hiveDiscussionPosts)
        .where(
          and(
            inArray(hiveDiscussionPosts.hiveId, hiveIds),
            gte(hiveDiscussionPosts.createdAt, since),
          ),
        )
        .groupBy(hiveDiscussionPosts.hiveId),
      // Chapter updates: chapters → books → hives via books.id = hives.bookId.
      db
        .select({
          hiveId: hives.id,
          cnt: sql<number>`COUNT(*)::int`,
        })
        .from(chapters)
        .innerJoin(books, eq(books.id, chapters.bookId))
        .innerJoin(hives, eq(hives.bookId, books.id))
        .where(and(inArray(hives.id, hiveIds), gte(chapters.updatedAt, since)))
        .groupBy(hives.id),
      db
        .select({
          hiveId: hiveSubmissions.hiveId,
          cnt: sql<number>`COUNT(*)::int`,
        })
        .from(hiveSubmissions)
        .where(
          and(
            inArray(hiveSubmissions.hiveId, hiveIds),
            gte(hiveSubmissions.createdAt, since),
          ),
        )
        .groupBy(hiveSubmissions.hiveId),
    ])

  const buzz = new Map(buzzRows.map((r) => [r.hiveId, Number(r.cnt)]))
  const wordLogs = new Map(wordLogRows.map((r) => [r.hiveId, Number(r.cnt)]))
  const discussions = new Map(
    discussionRows.map((r) => [r.hiveId, Number(r.cnt)]),
  )
  const chapterUpdates = new Map(
    chapterUpdateRows.map((r) => [r.hiveId, Number(r.cnt)]),
  )
  const submissions = new Map(
    submissionRows.map((r) => [r.hiveId, Number(r.cnt)]),
  )

  const scoreMap = new Map<string, number>()
  for (const id of hiveIds) {
    scoreMap.set(
      id,
      computeHiveActivityScore7d({
        buzzPosts7d: buzz.get(id) ?? 0,
        wordLogs7d: wordLogs.get(id) ?? 0,
        discussions7d: discussions.get(id) ?? 0,
        chapterUpdates7d: chapterUpdates.get(id) ?? 0,
        submissions7d: submissions.get(id) ?? 0,
      }),
    )
  }
  return scoreMap
}

/**
 * Single GROUP BY on hive_buzz_posts for the 7-day window.
 * Used when a rail/projection needs the buzz count signal independent of
 * the full activity score (search 'most-active', card "buzz this week").
 */
async function loadBuzzCountMap(
  hiveIds: string[],
): Promise<Map<string, number>> {
  if (hiveIds.length === 0) return new Map()
  const rows = await db
    .select({
      hiveId: hiveBuzzPosts.hiveId,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(hiveBuzzPosts)
    .where(
      and(
        inArray(hiveBuzzPosts.hiveId, hiveIds),
        gte(hiveBuzzPosts.createdAt, sql`now() - interval '7 days'`),
      ),
    )
    .groupBy(hiveBuzzPosts.hiveId)
  return new Map(rows.map((r) => [r.hiveId, Number(r.cnt)]))
}

/**
 * Window function: ROW_NUMBER() OVER (PARTITION BY hive_id ORDER BY joined_at)
 * <= 4 returns up to 4 earliest members per hive in a single bounded query.
 * LEFT JOINs user_profiles for the avatarUrl.
 *
 * Plan §11 Q1 resolution: keeps query cost bounded regardless of hive size.
 */
async function loadMemberPreviewsMap(
  hiveIds: string[],
): Promise<Map<string, Array<{ userId: string; avatarUrl: string | null }>>> {
  if (hiveIds.length === 0) return new Map()
  const result = await db.execute<{
    hive_id: string
    user_id: string
    avatar_url: string | null
  }>(sql`
    SELECT hive_id, user_id, avatar_url FROM (
      SELECT
        hm.hive_id,
        hm.user_id,
        up.avatar_url,
        ROW_NUMBER() OVER (PARTITION BY hm.hive_id ORDER BY hm.joined_at) AS rn
      FROM hive_members hm
      LEFT JOIN user_profiles up ON up.user_id = hm.user_id
      WHERE hm.hive_id = ANY(ARRAY[${sql.join(
        hiveIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[])
    ) sub WHERE rn <= 4
  `)
  const rows =
    (result as unknown as { rows?: unknown[] }).rows ??
    (result as unknown as unknown[])
  const typed = rows as Array<{
    hive_id: string
    user_id: string
    avatar_url: string | null
  }>
  const map = new Map<
    string,
    Array<{ userId: string; avatarUrl: string | null }>
  >()
  for (const r of typed) {
    const list = map.get(r.hive_id) ?? []
    list.push({ userId: r.user_id, avatarUrl: r.avatar_url })
    map.set(r.hive_id, list)
  }
  return map
}

// ─── Platform activity median (cached 5min) ───────────────────────────────────

/**
 * Plan §11 Q2: 5min revalidate at v1. Bump to 15min if platform grows
 * past 10k discoverable hives. Single constant edit.
 *
 * Computes median activityScore7d across all PUBLIC + discoverable + ACTIVE
 * hives. Used by Featured Hive hero to gate "above-median" qualification.
 */
const getPlatformActivityMedianCached = unstable_cache(
  async (): Promise<number> => {
    const idRows = await db
      .select({ id: hives.id })
      .from(hives)
      .where(
        and(
          eq(hives.visibility, 'PUBLIC'),
          eq(hives.discoverable, true),
          eq(hives.status, 'ACTIVE'),
        ),
      )
    if (idRows.length === 0) return 0
    const ids = idRows.map((r) => r.id)
    const scoreMap = await loadActivityScoreMap(ids)
    const sorted = ids.map((id) => scoreMap.get(id) ?? 0).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1]! + sorted[mid]!) / 2
    }
    return sorted[mid]!
  },
  ['discover-hives-platform-activity-median'],
  { revalidate: 300, tags: ['discover-hives-platform-activity-median'] },
)

// Issue #32: `getFeaturedHiveAction` removed — the discovery mode toggle
// replaces the featured banner.

// ─── Rail args ────────────────────────────────────────────────────────────────

type RailArgs = {
  genre?: GenreSlug
  size?: SizeBucket
  cursor?: string | null
}

// ─── 2. Trending now ──────────────────────────────────────────────────────────

/**
 * Sort by activityScore7d DESC. Filter activityScore7d > 0 (computed via
 * candidate scoring; no WHERE on raw signals — cost is the same as Featured).
 * Cursor: (activityScore7d DESC, id DESC).
 */
export async function getTrendingHivesAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const size = args.size ?? 'any'
  const cursor = decodeCursor(args.cursor)

  // Wide candidate sweep (last_activity_at DESC), then score + sort + cursor in JS.
  // Same cost shape as Featured. Limit candidate window to 200 like D1 Trending.
  const baseFilters = buildPublicHiveFilters(args.genre, size, blocked)
  baseFilters.push(isNotNull(hives.lastActivityAt))

  const candidates = args.genre
    ? await db
        .select({ id: hives.id })
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .where(and(...baseFilters))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(200)
    : await db
        .select({ id: hives.id })
        .from(hives)
        .where(and(...baseFilters))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(200)

  const ids = candidates.map((r) => r.id)
  const scoreMap = ids.length > 0 ? await loadActivityScoreMap(ids) : new Map<string, number>()
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
    const backRes = await getHiveBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      size,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToHiveCards(stitched.books, {
    computeActivityScore: true,
    computeBuzzCount: true,
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

// ─── 3. Recently active ───────────────────────────────────────────────────────

/**
 * last_activity_at >= now() - 7d, sorted by last_activity_at DESC.
 * Cheap path: computeActivityScore = false.
 * Cursor: (last_activity_at DESC, id DESC).
 */
export async function getRecentlyActiveHivesAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const size = args.size ?? 'any'
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicHiveFilters(args.genre, size, blocked),
    isNotNull(hives.lastActivityAt),
    gte(
      hives.lastActivityAt,
      sql`now() - interval '${sql.raw(String(RECENTLY_ACTIVE_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(hives.lastActivityAt, cursorDate),
      and(eq(hives.lastActivityAt, cursorDate), lt(hives.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const baseSelect = { id: hives.id, lastActivityAt: hives.lastActivityAt }
  const strict = args.genre
    ? await db
        .select(baseSelect)
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)
    : await db
        .select(baseSelect)
        .from(hives)
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getHiveBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      size,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToHiveCards(stitched.books, {
    computeActivityScore: false,
    computeBuzzCount: false,
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

// ─── 4. New communities ───────────────────────────────────────────────────────

/**
 * first_publicly_discoverable_at >= now() - 30d. Sort by first_public DESC.
 * Cheap path: computeActivityScore = false.
 * Cursor: (first_publicly_discoverable_at DESC, id DESC).
 */
export async function getNewHivesAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const size = args.size ?? 'any'
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicHiveFilters(args.genre, size, blocked),
    isNotNull(hives.firstPubliclyDiscoverableAt),
    gte(
      hives.firstPubliclyDiscoverableAt,
      sql`now() - interval '${sql.raw(String(NEW_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(hives.firstPubliclyDiscoverableAt, cursorDate),
      and(
        eq(hives.firstPubliclyDiscoverableAt, cursorDate),
        lt(hives.id, cursor.id),
      ),
    )
    if (tail) conds.push(tail)
  }

  const baseSelect = {
    id: hives.id,
    firstPubliclyDiscoverableAt: hives.firstPubliclyDiscoverableAt,
  }
  const strict = args.genre
    ? await db
        .select(baseSelect)
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .where(and(...conds))
        .orderBy(desc(hives.firstPubliclyDiscoverableAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)
    : await db
        .select(baseSelect)
        .from(hives)
        .where(and(...conds))
        .orderBy(desc(hives.firstPubliclyDiscoverableAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getHiveBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      size,
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToHiveCards(stitched.books, {
    computeActivityScore: false,
    computeBuzzCount: false,
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

// ─── 5. Looking for collaborators ─────────────────────────────────────────────

/**
 * Size LOCKED to 'small' (member_count 2-5). last_activity_at >= 30d.
 * Cheap path: computeActivityScore = false.
 * Cursor: (last_activity_at DESC, id DESC).
 */
export async function getLookingForCollaboratorsHivesAction(args: {
  genre?: GenreSlug
  cursor?: string | null
}): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicHiveFilters(args.genre, 'small', blocked),
    isNotNull(hives.lastActivityAt),
    gte(
      hives.lastActivityAt,
      sql`now() - interval '${sql.raw(String(LFC_ACTIVITY_WINDOW_DAYS))} days'`,
    ),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(hives.lastActivityAt, cursorDate),
      and(eq(hives.lastActivityAt, cursorDate), lt(hives.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const baseSelect = { id: hives.id, lastActivityAt: hives.lastActivityAt }
  const strict = args.genre
    ? await db
        .select(baseSelect)
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)
    : await db
        .select(baseSelect)
        .from(hives)
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getHiveBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      size: 'small',
      limit: 4 - strictPage.length,
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToHiveCards(stitched.books, {
    computeActivityScore: false,
    computeBuzzCount: false,
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

// ─── 6. From writers you follow ───────────────────────────────────────────────

/**
 * Hives whose owner is in viewer's follow set. No backfill — Following hides
 * cleanly when empty (matches D2a Following spark precedent).
 * Auth required: throws AuthError on guests; callers wrap + hide rail.
 * Cursor: (last_activity_at DESC NULLS LAST, id DESC).
 */
export async function getFollowingHivesAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await requireAuth()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const size = args.size ?? 'any'
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
    ...buildPublicHiveFilters(args.genre, size, blocked),
    inArray(hives.ownerId, followeeIds),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(hives.lastActivityAt, cursorDate),
      and(eq(hives.lastActivityAt, cursorDate), lt(hives.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const baseSelect = { id: hives.id, lastActivityAt: hives.lastActivityAt }
  const strict = args.genre
    ? await db
        .select(baseSelect)
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)
    : await db
        .select(baseSelect)
        .from(hives)
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  // NOTE: Following rail does NOT backfill.
  const projected = await projectToHiveCards(strictPage, {
    computeActivityScore: false,
    computeBuzzCount: false,
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
 * Universal Hive backfill: any PUBLIC + discoverable + ACTIVE + size +
 * last_activity_at >= 30d. Sort by last_activity_at DESC. Excludes already-shown ids.
 * Cheap path: computeActivityScore = false.
 */
export async function getHiveBackfillAction(args: {
  excludeIds: string[]
  genre?: GenreSlug
  size?: SizeBucket
  limit?: number
}): Promise<ActionResult<HiveCard[]>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const size = args.size ?? 'any'
  const limit = args.limit ?? 4

  const conds = [
    ...buildPublicHiveFilters(args.genre, size, blocked),
    isNotNull(hives.lastActivityAt),
    gte(
      hives.lastActivityAt,
      sql`now() - interval '${sql.raw(String(BACKFILL_ACTIVITY_WINDOW_DAYS))} days'`,
    ),
  ]
  if (args.excludeIds.length > 0) {
    conds.push(notInArray(hives.id, args.excludeIds))
  }

  const rows = args.genre
    ? await db
        .select({ id: hives.id })
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(limit)
    : await db
        .select({ id: hives.id })
        .from(hives)
        .where(and(...conds))
        .orderBy(desc(hives.lastActivityAt), desc(hives.id))
        .limit(limit)

  const projected = await projectToHiveCards(rows, {
    computeActivityScore: false,
    computeBuzzCount: false,
  })
  return { success: true, data: projected }
}

// ─── 8. Search (Discover) ─────────────────────────────────────────────────────

/**
 * ILIKE on hives.name (primary), hives.description, owner username +
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
export async function searchHivesDiscoverAction(args: {
  q?: string
  genre?: GenreSlug
  /** Multi-select genre; non-empty array takes precedence over single `genre`. */
  genres?: string[]
  size?: SizeBucket
  /**
   * Hive open-state. Accepts:
   *   - 'looking-for-collaborators' → small (member_count 2-5) + active in last 30d.
   *   - 'open-to-join' → no-op for v1 (every discoverable hive accepts invites
   *     via the existing invite-link model; no explicit column exists). The
   *     filter is parsed but the UI checkbox is currently informational only.
   * OR semantics within array: both selected = no narrowing beyond size/recency.
   */
  openStates?: Array<'looking-for-collaborators' | 'open-to-join'>
  /**
   * Linked-book posture. Accepts:
   *   - 'has-book'   → linked book is a real book (status != STANDALONE_HIVE_SHADOW)
   *   - 'standalone' → linked book is a shadow row (status = STANDALONE_HIVE_SHADOW)
   * OR semantics within array: both selected = no filter.
   */
  linked?: Array<'has-book' | 'standalone'>
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
  cursor?: string | null
  /** 1-indexed page number for numbered pagination. */
  page?: number
  /** Filter to hives owned by users the viewer follows. v1 impl; proper algorithm TODO. */
  source?: 'following'
  /** Required when source='following'; ignored otherwise. */
  viewerId?: string
}): Promise<
  ActionResult<{
    books: HiveCard[]
    nextCursor: string | null
    totalCount: number
  }>
> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedHiveOwnerIdsForViewer(viewerId)
  const size = args.size ?? 'any'
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

  // Linked posture — figure out which subset of {has-book, standalone} the
  // viewer chose. Empty (or both selected) = no filter; otherwise narrow.
  const linkedSet = new Set(args.linked ?? [])
  const linkedNarrow = linkedSet.size === 1 ? Array.from(linkedSet)[0] : undefined

  const needsBooksJoin =
    Boolean(singleGenre) || multiGenres.length > 0 || linkedNarrow !== undefined

  const conds = [...buildPublicHiveFilters(singleGenre, size, blocked)]

  if (multiGenres.length > 0) {
    conds.push(sql`${books.genre} = ANY(${multiGenres})`)
  }

  if (linkedNarrow === 'has-book') {
    conds.push(sql`${books.status} != 'STANDALONE_HIVE_SHADOW'`)
  } else if (linkedNarrow === 'standalone') {
    conds.push(sql`${books.status} = 'STANDALONE_HIVE_SHADOW'`)
  }

  // openStates filter — 'looking-for-collaborators' approximates the LFC rail
  // semantics (small + recently active). 'open-to-join' has no schema column
  // and is treated as a no-op (see jsdoc above).
  const openSet = new Set(args.openStates ?? [])
  if (openSet.has('looking-for-collaborators')) {
    conds.push(sql`${hives.memberCount} <= 5`)
    conds.push(
      sql`${hives.lastActivityAt} IS NOT NULL AND ${hives.lastActivityAt} >= now() - interval '${sql.raw(String(LFC_ACTIVITY_WINDOW_DAYS))} days'`,
    )
  }

  if (trimmed.length > 0) {
    const pattern = `%${trimmed}%`
    const titleOr = or(
      sql`${hives.name} ILIKE ${pattern}`,
      sql`${hives.description} ILIKE ${pattern}`,
      sql`${userProfiles.username} ILIKE ${pattern}`,
      sql`${userProfiles.displayName} ILIKE ${pattern}`,
    )
    if (titleOr) conds.push(titleOr)
  }

  // Cursor tail clause for DB-sorted modes (recent / most-members). Skip
  // when using numbered pagination — offset is the source of truth.
  if (cursor && !usePagination) {
    if (sort === 'recent' && typeof cursor.sortKey === 'string') {
      const cursorDate = new Date(cursor.sortKey)
      const tail = or(
        lt(hives.createdAt, cursorDate),
        and(eq(hives.createdAt, cursorDate), lt(hives.id, cursor.id)),
      )
      if (tail) conds.push(tail)
    } else if (sort === 'most-members' && typeof cursor.sortKey === 'number') {
      const sk = cursor.sortKey
      const tail = or(
        lt(hives.memberCount, sk),
        and(eq(hives.memberCount, sk), lt(hives.id, cursor.id)),
      )
      if (tail) conds.push(tail)
    }
  }

  // Total count query — same filters + JOINs as the main fetch. Runs once
  // regardless of sort mode.
  const totalCountRows = needsBooksJoin
    ? await db
        .select({ total: count(hives.id) })
        .from(hives)
        .innerJoin(books, eq(books.id, hives.bookId))
        .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
        .where(and(...conds))
    : await db
        .select({ total: count(hives.id) })
        .from(hives)
        .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
        .where(and(...conds))
  const totalCount = Number(totalCountRows[0]?.total ?? 0)

  // We always JOIN userProfiles for the owner-name ILIKE, and books when genre filter is on.
  // For sort=most-active we collect candidates then re-sort in JS via the scoreMap.
  let rows: Array<{ id: string; createdAt?: Date; memberCount?: number; score?: number }>
  let hasMore = false
  if (sort === 'recent') {
    const dbRows = needsBooksJoin
      ? await db
          .select({ id: hives.id, createdAt: hives.createdAt })
          .from(hives)
          .innerJoin(books, eq(books.id, hives.bookId))
          .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
          .where(and(...conds))
          .orderBy(desc(hives.createdAt), desc(hives.id))
          .limit(PAGE_SIZE + 1)
          .offset(offset)
      : await db
          .select({ id: hives.id, createdAt: hives.createdAt })
          .from(hives)
          .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
          .where(and(...conds))
          .orderBy(desc(hives.createdAt), desc(hives.id))
          .limit(PAGE_SIZE + 1)
          .offset(offset)
    hasMore = dbRows.length > PAGE_SIZE
    rows = dbRows.slice(0, PAGE_SIZE)
  } else if (sort === 'most-members') {
    const dbRows = needsBooksJoin
      ? await db
          .select({ id: hives.id, memberCount: hives.memberCount })
          .from(hives)
          .innerJoin(books, eq(books.id, hives.bookId))
          .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
          .where(and(...conds))
          .orderBy(desc(hives.memberCount), desc(hives.id))
          .limit(PAGE_SIZE + 1)
          .offset(offset)
      : await db
          .select({ id: hives.id, memberCount: hives.memberCount })
          .from(hives)
          .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
          .where(and(...conds))
          .orderBy(desc(hives.memberCount), desc(hives.id))
          .limit(PAGE_SIZE + 1)
          .offset(offset)
    hasMore = dbRows.length > PAGE_SIZE
    rows = dbRows.slice(0, PAGE_SIZE)
  } else {
    // most-active or relevance: collect a wider candidate window and rank by score in JS.
    const candidateRows = needsBooksJoin
      ? await db
          .select({ id: hives.id })
          .from(hives)
          .innerJoin(books, eq(books.id, hives.bookId))
          .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
          .where(and(...conds))
          .orderBy(desc(hives.lastActivityAt), desc(hives.id))
          .limit(200)
      : await db
          .select({ id: hives.id })
          .from(hives)
          .leftJoin(userProfiles, eq(userProfiles.userId, hives.ownerId))
          .where(and(...conds))
          .orderBy(desc(hives.lastActivityAt), desc(hives.id))
          .limit(200)
    const candIds = candidateRows.map((r) => r.id)
    const scoreMap =
      candIds.length > 0 ? await loadActivityScoreMap(candIds) : new Map<string, number>()
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

  const projected = await projectToHiveCards(rows.map((r) => ({ id: r.id })), {
    computeActivityScore: needsActivity,
    computeBuzzCount: needsActivity,
  })

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
 * Per-genre count of discoverable hives via JOIN books for genre.
 * 5min revalidate (matches D1/D2a precedent).
 */
const getHiveGenreCountsCached = unstable_cache(
  async (): Promise<Record<GenreSlug, number>> => {
    const rows = await db
      .select({
        genre: books.genre,
        total: count(),
      })
      .from(hives)
      .innerJoin(books, eq(books.id, hives.bookId))
      .where(
        and(
          eq(hives.visibility, 'PUBLIC'),
          eq(hives.discoverable, true),
          eq(hives.status, 'ACTIVE'),
          isNotNull(books.genre),
        ),
      )
      .groupBy(books.genre)

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
  ['discover-hives-genre-counts'],
  { revalidate: 300, tags: ['discover-hives-genre-counts'] },
)

export async function getHiveGenreCountsAction(): Promise<
  ActionResult<Record<GenreSlug, number>>
> {
  const data = await getHiveGenreCountsCached()
  return { success: true, data }
}
