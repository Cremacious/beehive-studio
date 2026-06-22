'use server'

import { cache } from 'react'
import { db } from '@/db'
import {
  readingLists,
  readingListBooks,
  readingListFollows,
} from '@/db/schema/social'
import { userProfiles } from '@/db/schema/auth'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { ActionResult } from './book.actions'
import { loadCoverPreviewsMap, type CoverPreview } from './discover-lists-shared'

// ─── Public types ─────────────────────────────────────────────────────────────

export type CommunityListsTab = 'all' | 'yours' | 'following' | 'liked'
export type CommunityListsSort =
  | 'recent'
  | 'most-followed'
  | 'a-z'
  | 'most-books'

export type ListCard = {
  id: string
  title: string
  description: string | null
  genre: string | null
  tags: string[]
  bookCount: number
  followerCount: number
  sourceTag: 'yours' | 'following' | 'liked' | null
  curator: {
    userId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  }
  coverPreviews: CoverPreview[]
  updatedAt: Date
}

const PAGE_SIZE = 9
const ALL_TAB_BUCKET_CAP = 54 // PAGE_SIZE * 6
const SINGLE_BUCKET_CAP = 126 // PAGE_SIZE * 14

// ─── Bucket id fetchers ───────────────────────────────────────────────────────

async function fetchYoursIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .where(
      and(
        eq(readingLists.userId, viewerId),
        eq(readingLists.kind, 'CUSTOM'),
      ),
    )
    .limit(limit)
  return rows.map((r) => r.id)
}

async function fetchFollowingIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .innerJoin(
      readingListFollows,
      and(
        eq(readingListFollows.listId, readingLists.id),
        eq(readingListFollows.userId, viewerId),
      ),
    )
    .where(eq(readingLists.kind, 'CUSTOM'))
    .limit(limit)
  return rows.map((r) => r.id)
}

async function fetchLikedIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .where(
      and(
        eq(readingLists.userId, viewerId),
        eq(readingLists.kind, 'LIKED'),
      ),
    )
    .limit(limit)
  return rows.map((r) => r.id)
}

// ─── Projection ───────────────────────────────────────────────────────────────

async function projectToListCards(
  ids: string[],
  sourceMap: Map<string, 'yours' | 'following' | 'liked'>,
): Promise<ListCard[]> {
  if (ids.length === 0) return []

  const fullRows = await db
    .select({
      id: readingLists.id,
      title: readingLists.title,
      description: readingLists.description,
      userId: readingLists.userId,
      genre: readingLists.genre,
      tags: readingLists.tags,
      bookCount: readingLists.bookCount,
      followerCount: readingLists.followerCount,
      updatedAt: readingLists.updatedAt,
    })
    .from(readingLists)
    .where(inArray(readingLists.id, ids))

  const ownerIds = Array.from(new Set(fullRows.map((r) => r.userId)))

  const [ownerRows, coverPreviewsMap] = await Promise.all([
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
    loadCoverPreviewsMap(ids),
  ])

  const ownerMap = new Map(ownerRows.map((o) => [o.userId, o]))

  return fullRows.map((r) => {
    const owner = ownerMap.get(r.userId)
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      genre: r.genre,
      tags: r.tags ?? [],
      bookCount: r.bookCount,
      followerCount: r.followerCount,
      sourceTag: sourceMap.get(r.id) ?? null,
      curator: {
        userId: r.userId,
        username: owner?.username ?? null,
        displayName: owner?.displayName ?? null,
        avatarUrl: owner?.avatarUrl ?? null,
      },
      coverPreviews: coverPreviewsMap.get(r.id) ?? [],
      updatedAt: r.updatedAt,
    }
  })
}

// ─── Sort comparator ──────────────────────────────────────────────────────────

function compareBySort(
  sort: CommunityListsSort,
): (a: ListCard, b: ListCard) => number {
  if (sort === 'most-followed') {
    return (a, b) => b.followerCount - a.followerCount
  }
  if (sort === 'a-z') {
    return (a, b) => a.title.localeCompare(b.title)
  }
  if (sort === 'most-books') {
    return (a, b) => b.bookCount - a.bookCount
  }
  // 'recent'
  return (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
}

// ─── Canonical aggregator ─────────────────────────────────────────────────────

/**
 * Reading Lists Hub canonical query. Returns the viewer's 3-bucket community
 * list stream (Yours / Following / Liked), deduped + source-tagged with
 * precedence yours > liked > following. Per-bucket tabs fetch only that
 * bucket. Sort + page-slice run in JS over the projected ListCard rows.
 */
export async function getCommunityListsAction(args: {
  viewerId: string
  tab?: CommunityListsTab
  sort?: CommunityListsSort
  page?: number
  /** Multi-tag filter, AND semantics (issue #22). Each entry normalized
   *  to lowercase before matching. Empty array = no filter. */
  tags?: string[]
  /** Free-text search — matches title OR tags (issue #22). */
  q?: string
}): Promise<
  ActionResult<{
    rows: ListCard[]
    totalCount: number
    hasMore: boolean
  }>
> {
  const { viewerId } = args
  const tab: CommunityListsTab = args.tab ?? 'all'
  const sort: CommunityListsSort = args.sort ?? 'recent'
  const page = Math.max(1, Math.floor(args.page ?? 1))
  const tagFilters = (args.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
  const qFilter = args.q ? args.q.trim().toLowerCase() : null

  const [yoursIds, followingIds, likedIds] = await Promise.all([
    fetchYoursIds(
      viewerId,
      tab === 'yours' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
    fetchFollowingIds(
      viewerId,
      tab === 'following' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
    fetchLikedIds(
      viewerId,
      tab === 'liked' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
  ])

  const yoursSet = new Set(yoursIds)
  const followingSet = new Set(followingIds)
  const likedSet = new Set(likedIds)

  // Source resolver with precedence yours > liked > following.
  function resolveSource(id: string): 'yours' | 'following' | 'liked' {
    if (yoursSet.has(id)) return 'yours'
    if (likedSet.has(id)) return 'liked'
    return 'following'
  }

  // Pick candidate id list per tab.
  let candidateIds: string[]
  if (tab === 'all') {
    candidateIds = Array.from(
      new Set<string>([...yoursIds, ...likedIds, ...followingIds]),
    )
  } else if (tab === 'yours') {
    candidateIds = yoursIds
  } else if (tab === 'following') {
    candidateIds = followingIds
  } else {
    candidateIds = likedIds
  }

  const sourceMap = new Map<string, 'yours' | 'following' | 'liked'>()
  for (const id of candidateIds) sourceMap.set(id, resolveSource(id))

  let projected = await projectToListCards(candidateIds, sourceMap)

  // Apply tag + q filters in JS over the projected rows. Both inputs are
  // already lowercase-normalized above. Tag filter is exact-match contains;
  // search matches title (case-insensitive substring) OR any tag exact-match.
  if (tagFilters.length > 0) {
    projected = projected.filter((r) =>
      tagFilters.every((t) => r.tags.includes(t)),
    )
  }
  if (qFilter) {
    projected = projected.filter((r) => {
      const titleMatch = r.title.toLowerCase().includes(qFilter)
      const tagMatch = r.tags.some((t) => t.includes(qFilter))
      return titleMatch || tagMatch
    })
  }

  // Sort + slice in JS.
  projected.sort(compareBySort(sort))

  const totalCount = projected.length
  const offset = (page - 1) * PAGE_SIZE
  const pageSlice = projected.slice(offset, offset + PAGE_SIZE)
  const hasMore = offset + pageSlice.length < totalCount

  return {
    success: true,
    data: { rows: pageSlice, totalCount, hasMore },
  }
}

// ─── Viewer stats ─────────────────────────────────────────────────────────────

export type ViewerListStats = {
  created: number
  following: number
  followers: number
  booksSaved: number
}

/**
 * Four counts for the viewer's "Your list stats" rail panel.
 * Wrapped in React `cache()` so layout + rail share one query per request.
 */
async function getViewerListStatsImpl(
  viewerId: string,
): Promise<ActionResult<ViewerListStats>> {
  try {
    const [createdRows, followingRows, followersRows, booksSavedRows] =
      await Promise.all([
        db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(readingLists)
          .where(
            and(
              eq(readingLists.userId, viewerId),
              eq(readingLists.kind, 'CUSTOM'),
            ),
          ),
        db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(readingListFollows)
          .where(eq(readingListFollows.userId, viewerId)),
        // SUM(follower_count) denorm across viewer's CUSTOM lists.
        db
          .select({ n: sql<number>`COALESCE(SUM(${readingLists.followerCount}), 0)::int` })
          .from(readingLists)
          .where(
            and(
              eq(readingLists.userId, viewerId),
              eq(readingLists.kind, 'CUSTOM'),
            ),
          ),
        // COUNT(DISTINCT book_id) across viewer's lists.
        db
          .select({
            n: sql<number>`COUNT(DISTINCT ${readingListBooks.bookId})::int`,
          })
          .from(readingListBooks)
          .innerJoin(
            readingLists,
            eq(readingLists.id, readingListBooks.listId),
          )
          .where(eq(readingLists.userId, viewerId)),
      ])

    return {
      success: true,
      data: {
        created: createdRows[0]?.n ?? 0,
        following: followingRows[0]?.n ?? 0,
        followers: followersRows[0]?.n ?? 0,
        booksSaved: booksSavedRows[0]?.n ?? 0,
      },
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}

const getViewerListStatsCached = cache(getViewerListStatsImpl)

export async function getViewerListStatsAction(
  args: { viewerId: string },
): Promise<ActionResult<ViewerListStats>> {
  return getViewerListStatsCached(args.viewerId)
}

// ─── Top tags (issue #22) ─────────────────────────────────────────────────────

export type TopListTag = { tag: string; count: number }

/**
 * Top N most-used tags across PUBLIC discoverable CUSTOM lists. Unnests the
 * text-array column, groups, and orders by occurrence count desc.
 * Wrapped in React `cache()` so layout + filter strip share one query per
 * request.
 */
async function getTopListTagsImpl(
  limit: number,
): Promise<ActionResult<TopListTag[]>> {
  try {
    const result = await db.execute<{ tag: string; count: number }>(sql`
      SELECT tag, COUNT(*)::int AS count
      FROM reading_lists l, UNNEST(l.tags) AS tag
      WHERE l.visibility = 'PUBLIC'
        AND l.discoverable = true
        AND l.kind = 'CUSTOM'
      GROUP BY tag
      ORDER BY count DESC, tag ASC
      LIMIT ${limit}
    `)
    const rows =
      (result as unknown as { rows?: unknown[] }).rows ??
      (result as unknown as unknown[])
    const typed = rows as Array<{ tag: string; count: number }>
    return {
      success: true,
      data: typed.map((r) => ({ tag: r.tag, count: Number(r.count) })),
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}

const getTopListTagsCached = cache(getTopListTagsImpl)

export async function getTopListTagsAction(
  args: { limit?: number } = {},
): Promise<ActionResult<TopListTag[]>> {
  const limit = Math.min(Math.max(1, args.limit ?? 20), 50)
  return getTopListTagsCached(limit)
}

// ─── Trending rail ────────────────────────────────────────────────────────────

export type RailTrendingList = {
  id: string
  title: string
  curator: { username: string | null; avatarUrl: string | null }
  coverPreviews: Array<{ coverUrl: string | null }>
  newFollowersThisWeek: number
}

/**
 * Top discoverable PUBLIC CUSTOM lists ranked by new followers in the last 7d.
 * Used by the Reading Lists Hub right rail.
 */
export async function getTrendingListsForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingList[]>> {
  const limit = Math.min(args.limit ?? 4, 30)

  try {
    const result = await db.execute<{
      id: string
      title: string
      username: string | null
      avatar_url: string | null
      new_followers: number
    }>(sql`
      SELECT
        l.id,
        l.title,
        up.username AS username,
        up.avatar_url AS avatar_url,
        COALESCE(rf.new_followers, 0)::int AS new_followers
      FROM reading_lists l
      LEFT JOIN user_profiles up ON up.user_id = l.user_id
      LEFT JOIN (
        SELECT list_id, COUNT(*)::int AS new_followers
        FROM reading_list_follows
        WHERE created_at >= now() - interval '7 days'
        GROUP BY list_id
      ) rf ON rf.list_id = l.id
      WHERE l.visibility = 'PUBLIC'
        AND l.discoverable = true
        AND l.kind = 'CUSTOM'
      ORDER BY COALESCE(rf.new_followers, 0) DESC, l.created_at DESC
      LIMIT ${limit}
    `)

    const rows =
      (result as unknown as { rows?: unknown[] }).rows ??
      (result as unknown as unknown[])
    const typed = rows as Array<{
      id: string
      title: string
      username: string | null
      avatar_url: string | null
      new_followers: number
    }>

    const ids = typed.map((r) => r.id)
    const coverPreviewsMap = await loadCoverPreviewsMap(ids)

    const data: RailTrendingList[] = typed.map((r) => ({
      id: r.id,
      title: r.title,
      curator: { username: r.username, avatarUrl: r.avatar_url },
      coverPreviews: (coverPreviewsMap.get(r.id) ?? []).map((c) => ({
        coverUrl: c.coverUrl,
      })),
      newFollowersThisWeek: Number(r.new_followers),
    }))

    return { success: true, data }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
