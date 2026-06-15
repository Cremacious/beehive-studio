'use server'

import { db } from '@/db'
import { sparks, sparkEntries, follows } from '@/db/schema/social'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { ActionResult } from './book.actions'
import { canViewSpark } from '@/lib/sparks/predicates'
import {
  projectToSparkCards,
  type SparkCard,
} from './discover-sparks.actions'

// ─── Public types ─────────────────────────────────────────────────────────────

export type CommunitySparkSource = 'yours' | 'following' | 'friend' | 'entered'

export type CommunitySparkRow = SparkCard & {
  source: CommunitySparkSource
}

export type CommunitySparksTab =
  | 'all'
  | 'yours'
  | 'following'
  | 'friends'
  | 'entered'

export type CommunitySparksSort = 'recent' | 'ending' | 'entries' | 'status'

const PAGE_SIZE = 12
const ALL_TAB_BUCKET_CAP = PAGE_SIZE * 4 // 48
const SINGLE_BUCKET_CAP = PAGE_SIZE * 10 // 120

// ─── Bucket id fetchers ───────────────────────────────────────────────────────

/**
 * Friendship counterparties via UNION over requester / recipient sides.
 * Drizzle binds ${viewerId} safely; we cast the inner column to text for
 * inArray() compatibility.
 */
function friendCounterpartiesSql(viewerId: string) {
  return sql<string>`(
    SELECT recipient_id FROM friendships WHERE requester_id = ${viewerId} AND status = 'ACCEPTED'
    UNION
    SELECT requester_id FROM friendships WHERE recipient_id = ${viewerId} AND status = 'ACCEPTED'
  )`
}

async function fetchYoursIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: sparks.id })
    .from(sparks)
    .where(eq(sparks.creatorId, viewerId))
    .limit(limit)
  return rows.map((r) => r.id)
}

async function fetchFollowingIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const followedSubquery = db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  const rows = await db
    .select({ id: sparks.id })
    .from(sparks)
    .where(
      and(
        inArray(sparks.creatorId, followedSubquery),
        ne(sparks.creatorId, viewerId),
      ),
    )
    .limit(limit)
  return rows.map((r) => r.id)
}

async function fetchFriendIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: sparks.id })
    .from(sparks)
    .where(
      and(
        inArray(sparks.creatorId, friendCounterpartiesSql(viewerId)),
        ne(sparks.creatorId, viewerId),
      ),
    )
    .limit(limit)
  return rows.map((r) => r.id)
}

async function fetchEnteredIds(
  viewerId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: sparkEntries.sparkId })
    .from(sparkEntries)
    .where(eq(sparkEntries.userId, viewerId))
    .limit(limit)
  return rows.map((r) => r.id)
}

// ─── Sort comparators ─────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  OPEN: 0,
  VOTING: 1,
  CLOSED: 2,
}

function compareBySort(
  sort: CommunitySparksSort,
): (a: CommunitySparkRow, b: CommunitySparkRow) => number {
  if (sort === 'recent') {
    return (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  }
  if (sort === 'entries') {
    return (a, b) => b.entryCount - a.entryCount
  }
  if (sort === 'status') {
    return (a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99
      const sb = STATUS_ORDER[b.status] ?? 99
      if (sa !== sb) return sa - sb
      return b.createdAt.getTime() - a.createdAt.getTime()
    }
  }
  // 'ending'
  return (a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99
    const sb = STATUS_ORDER[b.status] ?? 99
    if (sa !== sb) return sa - sb
    if (a.status === 'OPEN' && b.status === 'OPEN') {
      const ad = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY
      const bd = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY
      return ad - bd
    }
    if (a.status === 'VOTING' && b.status === 'VOTING') {
      const ad = a.votingEndsAt?.getTime() ?? Number.POSITIVE_INFINITY
      const bd = b.votingEndsAt?.getTime() ?? Number.POSITIVE_INFINITY
      return ad - bd
    }
    // CLOSED tier: most-recent first
    return b.createdAt.getTime() - a.createdAt.getTime()
  }
}

// ─── Canonical action ─────────────────────────────────────────────────────────

/**
 * Sparks Hub canonical query. Returns the viewer's 4-bucket community spark
 * stream (Yours / Following / Friends / Entered), deduped + source-tagged with
 * precedence yours > friend > following > entered. Per-bucket tabs fetch only
 * that bucket. Sort + visibility filter + page-slice run in JS over the
 * projected SparkCard rows.
 */
export async function getCommunitySparksAction(args: {
  viewerId: string
  tab?: CommunitySparksTab
  sort?: CommunitySparksSort
  page?: number
}): Promise<
  ActionResult<{
    sparks: CommunitySparkRow[]
    totalCount: number
    bucketCounts: {
      yours: number
      following: number
      friends: number
      entered: number
      all: number
    }
  }>
> {
  const { viewerId } = args
  const tab: CommunitySparksTab = args.tab ?? 'all'
  const sort: CommunitySparksSort = args.sort ?? 'recent'
  const page = Math.max(1, Math.floor(args.page ?? 1))

  // Fetch all 4 bucket id-lists in parallel. For per-bucket tabs we still
  // fetch all four (cheap id-only queries) so bucket counts in the response
  // are always populated regardless of which tab the viewer is on. The
  // candidate-tab bucket gets the larger cap; the rest get the All-tab cap.
  const [yoursIds, followingIds, friendIds, enteredIds] = await Promise.all([
    fetchYoursIds(
      viewerId,
      tab === 'yours' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
    fetchFollowingIds(
      viewerId,
      tab === 'following' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
    fetchFriendIds(
      viewerId,
      tab === 'friends' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
    fetchEnteredIds(
      viewerId,
      tab === 'entered' ? SINGLE_BUCKET_CAP : ALL_TAB_BUCKET_CAP,
    ),
  ])

  const yoursSet = new Set(yoursIds)
  const followingSet = new Set(followingIds)
  const friendSet = new Set(friendIds)
  const enteredSet = new Set(enteredIds)
  const unionSet = new Set<string>([
    ...yoursIds,
    ...followingIds,
    ...friendIds,
    ...enteredIds,
  ])

  const bucketCounts = {
    yours: yoursSet.size,
    following: followingSet.size,
    friends: friendSet.size,
    entered: enteredSet.size,
    all: unionSet.size,
  }

  // Pick candidate id list per tab.
  let candidateIds: string[]
  if (tab === 'all') {
    candidateIds = Array.from(unionSet)
  } else if (tab === 'yours') {
    candidateIds = yoursIds
  } else if (tab === 'following') {
    candidateIds = followingIds
  } else if (tab === 'friends') {
    candidateIds = friendIds
  } else {
    candidateIds = enteredIds
  }

  // Source resolver with precedence yours > friend > following > entered.
  function resolveSource(id: string): CommunitySparkSource {
    if (yoursSet.has(id)) return 'yours'
    if (friendSet.has(id)) return 'friend'
    if (followingSet.has(id)) return 'following'
    return 'entered'
  }

  // Project to SparkCard shape (handles author + entry + winner enrichment).
  const projected = await projectToSparkCards(
    candidateIds.map((id) => ({ id })),
    { computeVoteTotal: true, computeWinner: true },
  )

  // Tag each row with its source bucket.
  const tagged: CommunitySparkRow[] = projected.map((card) => ({
    ...card,
    source: resolveSource(card.id),
  }))

  // Block-aware visibility filter. Viewer is always authed (page redirects
  // guests upstream) but canViewSpark still enforces block / FRIENDS gates.
  const visibilityChecks = await Promise.all(
    tagged.map((row) =>
      canViewSpark(viewerId, {
        creatorId: row.creatorUserId,
        visibility: row.visibility,
        status: row.status,
      }),
    ),
  )
  const visible = tagged.filter((_row, i) => visibilityChecks[i])

  // Sort in JS.
  visible.sort(compareBySort(sort))

  const totalCount = visible.length
  const offset = (page - 1) * PAGE_SIZE
  const pageSlice = visible.slice(offset, offset + PAGE_SIZE)

  return {
    success: true,
    data: { sparks: pageSlice, totalCount, bucketCounts },
  }
}
