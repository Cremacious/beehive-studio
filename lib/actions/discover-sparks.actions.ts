'use server'

import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import { sparks, sparkEntries } from '@/db/schema/social'
import { follows, userBlocks } from '@/db/schema/social'
import { userProfiles } from '@/db/schema'
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

export type SparkStatus = 'OPEN' | 'VOTING' | 'CLOSED'
export type SparkVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

/**
 * SparkCard — the projected row shape for every D2a Discover Sparks surface.
 * voteTotal is 0 on OPEN-only rails (skipped JOIN per §15 Q4 resolution);
 * populated for VOTING / CLOSED / Recently Won projections.
 * winner* fields populated only on CLOSED projections.
 */
export type SparkCard = {
  id: string
  title: string
  prompt: string
  status: SparkStatus
  visibility: SparkVisibility
  genre: GenreSlug | null
  deadline: Date | null
  votingEndsAt: Date | null
  creatorUserId: string
  creatorUsername: string | null
  creatorDisplayName: string | null
  creatorAvatarUrl: string | null
  entryCount: number
  voteTotal: number
  winnerUserId: string | null
  winnerUsername: string | null
  winnerDisplayName: string | null
  createdAt: Date
  firstPubliclyDiscoverableAt: Date | null
  likeCount: number
}

export type RailResult<T = SparkCard> = {
  // Field name 'books' preserved from D1 RailResult shape so the
  // <DiscoverRailSubPage> generic + <DiscoverSparkRail> wrappers can reuse it.
  books: T[]
  strictCount: number
  nextCursor: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12
// FALLBACK_WINDOW: widen to 180 if dev shows the Recently Won rail persistently empty.
const RECENTLY_WON_WINDOW_DAYS = 90
const HERO_DEADLINE_WINDOW_HOURS = 72

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
 * Mirrors D1's getBlockedAuthorIdsForViewer. Resolves the bidirectional blocked
 * spark-creator set for a viewer in a single query. Empty Set for guests.
 */
async function getBlockedSparkCreatorIdsForViewer(
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
 * Canonical public-spark filters: PUBLIC + discoverable + optional genre +
 * exclude blocked creators. NOTE: the live `sparks.genre` column is plain
 * text (not a pgEnum), so genre matching uses eq() against the slug string.
 */
function buildPublicSparkFilters(
  genre: GenreSlug | undefined,
  blocked: Set<string>,
) {
  const filters = [
    eq(sparks.visibility, 'PUBLIC'),
    eq(sparks.discoverable, true),
  ]
  if (genre) {
    filters.push(eq(sparks.genre, genre))
  }
  if (blocked.size > 0) {
    filters.push(notInArray(sparks.creatorId, Array.from(blocked)))
  }
  return filters
}

type ProjectionOpts = { computeVoteTotal: boolean; computeWinner: boolean }

/**
 * Projects an ordered list of spark ids → SparkCard[] via 3-parallel Map-stitch
 * (mirrors D1's projectToBookCards). Author profile join is always run; vote
 * total + winner-entry joins are conditional on opts so OPEN-only rails skip
 * the unnecessary round-trips.
 */
export async function projectToSparkCards(
  rows: Array<{ id: string }>,
  opts: ProjectionOpts,
): Promise<SparkCard[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const fullRows = await db
    .select({
      id: sparks.id,
      title: sparks.title,
      prompt: sparks.prompt,
      status: sparks.status,
      visibility: sparks.visibility,
      genre: sparks.genre,
      deadline: sparks.deadline,
      votingEndsAt: sparks.votingEndsAt,
      creatorUserId: sparks.creatorId,
      entryCount: sparks.entryCount,
      winnerEntryId: sparks.winnerEntryId,
      createdAt: sparks.createdAt,
      firstPubliclyDiscoverableAt: sparks.firstPubliclyDiscoverableAt,
      likeCount: sparks.likeCount,
    })
    .from(sparks)
    .where(inArray(sparks.id, ids))

  const authorIds = Array.from(new Set(fullRows.map((r) => r.creatorUserId)))
  const winnerEntryIds = fullRows
    .map((r) => r.winnerEntryId)
    .filter((v): v is string => v != null)

  const [authorRows, winnerRows, voteRows] = await Promise.all([
    authorIds.length > 0
      ? db
          .select({
            userId: userProfiles.userId,
            username: userProfiles.username,
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
          })
          .from(userProfiles)
          .where(inArray(userProfiles.userId, authorIds))
      : Promise.resolve(
          [] as Array<{
            userId: string
            username: string | null
            displayName: string | null
            avatarUrl: string | null
          }>,
        ),
    opts.computeWinner && winnerEntryIds.length > 0
      ? db
          .select({
            entryId: sparkEntries.id,
            sparkId: sparkEntries.sparkId,
            userId: sparkEntries.userId,
            username: userProfiles.username,
            displayName: userProfiles.displayName,
          })
          .from(sparkEntries)
          .leftJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
          .where(inArray(sparkEntries.id, winnerEntryIds))
      : Promise.resolve(
          [] as Array<{
            entryId: string
            sparkId: string
            userId: string
            username: string | null
            displayName: string | null
          }>,
        ),
    opts.computeVoteTotal
      ? db
          .select({
            sparkId: sparkEntries.sparkId,
            voteSum: sql<number>`COALESCE(SUM(${sparkEntries.likeCount}), 0)::int`,
          })
          .from(sparkEntries)
          .where(inArray(sparkEntries.sparkId, ids))
          .groupBy(sparkEntries.sparkId)
      : Promise.resolve([] as Array<{ sparkId: string; voteSum: number }>),
  ])

  const authorMap = new Map(authorRows.map((a) => [a.userId, a]))
  const winnerMap = new Map(winnerRows.map((w) => [w.sparkId, w]))
  const voteMap = new Map(voteRows.map((v) => [v.sparkId, Number(v.voteSum)]))
  const inputOrder = new Map(rows.map((r, i) => [r.id, i]))

  const cards: SparkCard[] = fullRows.map((r) => {
    const a = authorMap.get(r.creatorUserId)
    const w = winnerMap.get(r.id)
    return {
      id: r.id,
      title: r.title,
      prompt: r.prompt,
      status: r.status as SparkStatus,
      visibility: r.visibility as SparkVisibility,
      genre: r.genre && isValidGenre(r.genre) ? r.genre : null,
      deadline: r.deadline,
      votingEndsAt: r.votingEndsAt,
      creatorUserId: r.creatorUserId,
      creatorUsername: a?.username ?? null,
      creatorDisplayName: a?.displayName ?? null,
      creatorAvatarUrl: a?.avatarUrl ?? null,
      entryCount: r.entryCount,
      voteTotal: voteMap.get(r.id) ?? 0,
      winnerUserId: w?.userId ?? null,
      winnerUsername: w?.username ?? null,
      winnerDisplayName: w?.displayName ?? null,
      createdAt: r.createdAt,
      firstPubliclyDiscoverableAt: r.firstPubliclyDiscoverableAt,
      likeCount: r.likeCount,
    }
  })

  // Preserve input row order (rails may sort by signals not expressible in WHERE).
  cards.sort(
    (a, b) => (inputOrder.get(a.id) ?? 0) - (inputOrder.get(b.id) ?? 0),
  )
  return cards
}

// ─── 1. Featured Spark hero ───────────────────────────────────────────────────

/**
 * OPEN spark with deadline within 72h, highest entryCount tiebroken by
 * earliest deadline. Returns null when no qualifier (hero hides cleanly per §15 Q3).
 */
export async function getFeaturedSparkAction(args: {
  genre?: GenreSlug
}): Promise<ActionResult<SparkCard | null>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const genre = args.genre

  const rows = await db
    .select({ id: sparks.id })
    .from(sparks)
    .where(
      and(
        ...buildPublicSparkFilters(genre, blocked),
        eq(sparks.status, 'OPEN'),
        isNotNull(sparks.deadline),
        gt(sparks.deadline, sql`now()`),
        sql`${sparks.deadline} <= now() + interval '${sql.raw(String(HERO_DEADLINE_WINDOW_HOURS))} hours'`,
      ),
    )
    .orderBy(desc(sparks.entryCount), asc(sparks.deadline))
    .limit(1)

  if (rows.length === 0) return { success: true, data: null }
  const projected = await projectToSparkCards(rows, {
    computeVoteTotal: false,
    computeWinner: false,
  })
  return { success: true, data: projected[0] ?? null }
}

// ─── Rail args type ───────────────────────────────────────────────────────────

type RailArgs = {
  genre?: GenreSlug
  cursor?: string | null
}

// ─── 2. Live now ──────────────────────────────────────────────────────────────

/**
 * OPEN sparks with future deadline, sorted by closest deadline first.
 * Cursor: (deadline ASC, id DESC).
 */
export async function getLiveNowSparksAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicSparkFilters(args.genre, blocked),
    eq(sparks.status, 'OPEN'),
    isNotNull(sparks.deadline),
    gt(sparks.deadline, sql`now()`),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      gt(sparks.deadline, cursorDate),
      and(eq(sparks.deadline, cursorDate), lt(sparks.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: sparks.id, deadline: sparks.deadline })
    .from(sparks)
    .where(and(...conds))
    .orderBy(asc(sparks.deadline), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getSparkBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
      source: 'open',
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToSparkCards(stitched.books, {
    computeVoteTotal: false,
    computeWinner: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.deadline
      ? encodeCursor({ sortKey: last.deadline.toISOString(), id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 3. Voting now ────────────────────────────────────────────────────────────

/**
 * VOTING sparks with votingEndsAt > now, sorted by soonest voting close.
 * Cursor: (votingEndsAt ASC, id DESC). Projection includes voteTotal.
 */
export async function getVotingNowSparksAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicSparkFilters(args.genre, blocked),
    eq(sparks.status, 'VOTING'),
    isNotNull(sparks.votingEndsAt),
    gt(sparks.votingEndsAt, sql`now()`),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      gt(sparks.votingEndsAt, cursorDate),
      and(eq(sparks.votingEndsAt, cursorDate), lt(sparks.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: sparks.id, votingEndsAt: sparks.votingEndsAt })
    .from(sparks)
    .where(and(...conds))
    .orderBy(asc(sparks.votingEndsAt), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getSparkBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
      source: 'open',
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToSparkCards(stitched.books, {
    computeVoteTotal: true,
    computeWinner: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.votingEndsAt
      ? encodeCursor({
          sortKey: last.votingEndsAt.toISOString(),
          id: last.id,
        })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 4. Heating up ────────────────────────────────────────────────────────────

/**
 * OPEN sparks with entry_count >= 3, sorted by entry_count DESC.
 * Cursor: (entry_count DESC, id DESC).
 */
export async function getHeatingUpSparksAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicSparkFilters(args.genre, blocked),
    eq(sparks.status, 'OPEN'),
    gte(sparks.entryCount, 3),
  ]
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk = cursor.sortKey
    const tail = or(
      lt(sparks.entryCount, sk),
      and(eq(sparks.entryCount, sk), lt(sparks.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: sparks.id, entryCount: sparks.entryCount })
    .from(sparks)
    .where(and(...conds))
    .orderBy(desc(sparks.entryCount), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getSparkBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
      source: 'open',
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToSparkCards(stitched.books, {
    computeVoteTotal: false,
    computeWinner: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.entryCount, id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 5. Newly opened ──────────────────────────────────────────────────────────

/**
 * OPEN sparks with first_publicly_discoverable_at within last 7 days.
 * Cursor: (first_publicly_discoverable_at DESC, id DESC).
 */
export async function getNewlyOpenedSparksAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicSparkFilters(args.genre, blocked),
    eq(sparks.status, 'OPEN'),
    isNotNull(sparks.firstPubliclyDiscoverableAt),
    gte(sparks.firstPubliclyDiscoverableAt, sql`now() - interval '7 days'`),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(sparks.firstPubliclyDiscoverableAt, cursorDate),
      and(
        eq(sparks.firstPubliclyDiscoverableAt, cursorDate),
        lt(sparks.id, cursor.id),
      ),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({
      id: sparks.id,
      firstPubliclyDiscoverableAt: sparks.firstPubliclyDiscoverableAt,
    })
    .from(sparks)
    .where(and(...conds))
    .orderBy(desc(sparks.firstPubliclyDiscoverableAt), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getSparkBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
      source: 'open',
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToSparkCards(stitched.books, {
    computeVoteTotal: false,
    computeWinner: false,
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

// ─── 6. From writers you follow ───────────────────────────────────────────────

/**
 * Sparks by followee creators, status != CLOSED. Cursor: (createdAt DESC, id DESC).
 * No backfill — Following rail hides cleanly when empty (hideWhenEmpty on the rail wrapper).
 * Auth required: throws AuthError on guests; callers wrap in try/catch + hide rail.
 */
export async function getFollowingSparksAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await requireAuth()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
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
    ...buildPublicSparkFilters(args.genre, blocked),
    inArray(sparks.creatorId, followeeIds),
    sql`${sparks.status} != 'CLOSED'`,
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(sparks.createdAt, cursorDate),
      and(eq(sparks.createdAt, cursorDate), lt(sparks.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: sparks.id, createdAt: sparks.createdAt })
    .from(sparks)
    .where(and(...conds))
    .orderBy(desc(sparks.createdAt), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  // NOTE: Following rail does NOT backfill.
  const projected = await projectToSparkCards(strictPage, {
    computeVoteTotal: false,
    computeWinner: false,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.createdAt.toISOString(), id: last.id })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: projected.length, nextCursor },
  }
}

// ─── 7. Recently won ──────────────────────────────────────────────────────────

/**
 * CLOSED sparks with votingEndsAt within last RECENTLY_WON_WINDOW_DAYS (90),
 * AND winner_entry_id IS NOT NULL. Cursor: (votingEndsAt DESC, id DESC).
 * Projection includes voteTotal + winner attribution.
 */
export async function getRecentlyWonSparksAction(
  args: RailArgs,
): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)

  const conds = [
    ...buildPublicSparkFilters(args.genre, blocked),
    eq(sparks.status, 'CLOSED'),
    isNotNull(sparks.votingEndsAt),
    gte(
      sparks.votingEndsAt,
      sql`now() - interval '${sql.raw(String(RECENTLY_WON_WINDOW_DAYS))} days'`,
    ),
    isNotNull(sparks.winnerEntryId),
  ]
  if (cursor && typeof cursor.sortKey === 'string') {
    const cursorDate = new Date(cursor.sortKey)
    const tail = or(
      lt(sparks.votingEndsAt, cursorDate),
      and(eq(sparks.votingEndsAt, cursorDate), lt(sparks.id, cursor.id)),
    )
    if (tail) conds.push(tail)
  }

  const strict = await db
    .select({ id: sparks.id, votingEndsAt: sparks.votingEndsAt })
    .from(sparks)
    .where(and(...conds))
    .orderBy(desc(sparks.votingEndsAt), desc(sparks.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = strict.length > PAGE_SIZE
  const strictPage = strict.slice(0, PAGE_SIZE)

  let backfill: Array<{ id: string }> = []
  if (strictPage.length < 4 && !args.cursor) {
    const backRes = await getSparkBackfillAction({
      excludeIds: strictPage.map((r) => r.id),
      genre: args.genre,
      limit: 4 - strictPage.length,
      source: 'closed',
    })
    if (backRes.success) backfill = backRes.data.map((b) => ({ id: b.id }))
  }

  const stitched = applyBackfill(strictPage, backfill)
  const projected = await projectToSparkCards(stitched.books, {
    computeVoteTotal: true,
    computeWinner: true,
  })

  const last = strictPage[strictPage.length - 1]
  const nextCursor =
    hasMore && last && last.votingEndsAt
      ? encodeCursor({
          sortKey: last.votingEndsAt.toISOString(),
          id: last.id,
        })
      : null

  return {
    success: true,
    data: { books: projected, strictCount: stitched.strictCount, nextCursor },
  }
}

// ─── 8. Backfill (public) ─────────────────────────────────────────────────────

/**
 * Universal Spark backfill source. source='open' = OPEN sparks with deadline in
 * next 30d (default rail fallback); source='closed' = CLOSED sparks with a winner
 * in the RECENTLY_WON_WINDOW (Recently Won fallback). Excludes already-shown ids.
 */
export async function getSparkBackfillAction(args: {
  excludeIds: string[]
  genre?: GenreSlug
  limit?: number
  source?: 'open' | 'closed'
}): Promise<ActionResult<SparkCard[]>> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const limit = args.limit ?? 4
  const source = args.source ?? 'open'

  const conds = [...buildPublicSparkFilters(args.genre, blocked)]
  if (args.excludeIds.length > 0) {
    conds.push(notInArray(sparks.id, args.excludeIds))
  }
  if (source === 'open') {
    conds.push(eq(sparks.status, 'OPEN'))
    conds.push(isNotNull(sparks.deadline))
    conds.push(gt(sparks.deadline, sql`now()`))
    conds.push(sql`${sparks.deadline} <= now() + interval '30 days'`)
  } else {
    conds.push(eq(sparks.status, 'CLOSED'))
    conds.push(isNotNull(sparks.votingEndsAt))
    conds.push(
      gte(
        sparks.votingEndsAt,
        sql`now() - interval '${sql.raw(String(RECENTLY_WON_WINDOW_DAYS))} days'`,
      ),
    )
    conds.push(isNotNull(sparks.winnerEntryId))
  }

  const rows =
    source === 'open'
      ? await db
          .select({ id: sparks.id })
          .from(sparks)
          .where(and(...conds))
          .orderBy(asc(sparks.deadline), desc(sparks.id))
          .limit(limit)
      : await db
          .select({ id: sparks.id })
          .from(sparks)
          .where(and(...conds))
          .orderBy(desc(sparks.votingEndsAt), desc(sparks.id))
          .limit(limit)

  const projected = await projectToSparkCards(rows, {
    computeVoteTotal: source === 'closed',
    computeWinner: source === 'closed',
  })
  return { success: true, data: projected }
}

// ─── 9. Search (Discover) ─────────────────────────────────────────────────────

/**
 * ILIKE on sparks.title (which IS the prompt per C2 schema). Empty q → empty result.
 * status optional refinement (OPEN/VOTING/CLOSED/'all'). Sort:
 *   relevance → collapses to recent for v1 (TODO: real relevance scoring)
 *   recent    → createdAt DESC
 *   urgent    → deadline ASC (OPEN-meaningful only)
 *   most-entered → entryCount DESC
 * Cursor pagination: standard (sortKey, id) tuple per sort mode.
 *   recent/relevance → (createdAt ISO string, id)
 *   urgent → (deadline ISO string, id) ASC
 *   most-entered → (entryCount, id)
 */
export async function searchSparksDiscoverAction(args: {
  q?: string
  genre?: GenreSlug
  /** Multi-select genre; non-empty array takes precedence over single `genre`. */
  genres?: string[]
  /** Legacy direct enum input — preserved. */
  status?: SparkStatus | 'all'
  /** New W2.2 friendly alias mapping live→OPEN, voting→VOTING, ended→CLOSED. */
  state?: 'live' | 'voting' | 'ended' | 'all'
  /** Word-limit bucket. NULL wordLimit is excluded from every bucket. */
  wordLimit?: 'any' | 'flash' | 'medium' | 'long'
  /** Time-left bucket. Applied to `deadline` when state is live; ignored otherwise. */
  timeLeft?: 'any' | '24h' | 'week'
  /** anyone (default) / following (creator must be in the viewer's follow set). */
  creator?: 'anyone' | 'following'
  sort?: 'relevance' | 'recent' | 'urgent' | 'most-entered'
  cursor?: string | null
  /** 1-indexed page number for numbered pagination. When set, overrides cursor. */
  page?: number
}): Promise<
  ActionResult<{
    books: SparkCard[]
    nextCursor: string | null
    totalCount: number
  }>
> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedSparkCreatorIdsForViewer(viewerId)
  const sort = args.sort ?? 'recent'
  const cursor = decodeCursor(args.cursor)
  const trimmed = (args.q ?? '').trim()
  const pageNum = Math.max(1, Math.floor(args.page ?? 1))
  const usePagination = (args.page ?? 0) > 0
  const offset = (pageNum - 1) * PAGE_SIZE

  // Multi-genre takes precedence; falls back to legacy single-genre helper.
  const multiGenres = (args.genres ?? []).filter(
    (g): g is string => typeof g === 'string',
  )
  const singleGenre =
    multiGenres.length === 0 ? args.genre : undefined
  const conds = [...buildPublicSparkFilters(singleGenre, blocked)]
  if (multiGenres.length > 0) {
    conds.push(sql`${sparks.genre} = ANY(${multiGenres})`)
  }

  if (trimmed.length > 0) {
    conds.push(sql`${sparks.title} ILIKE ${`%${trimmed}%`}`)
  }

  // Status / state resolution. `state` (new) wins over `status` (legacy) when both
  // supplied; either maps to the same `sparks.status` column.
  const resolvedStatus: SparkStatus | 'all' | undefined =
    args.state === 'live'
      ? 'OPEN'
      : args.state === 'voting'
        ? 'VOTING'
        : args.state === 'ended'
          ? 'CLOSED'
          : args.state === 'all'
            ? 'all'
            : args.status
  if (resolvedStatus && resolvedStatus !== 'all') {
    conds.push(eq(sparks.status, resolvedStatus))
  }

  // Word-limit bucket (NULL wordLimit excluded — treated as "not yet classified").
  if (args.wordLimit && args.wordLimit !== 'any') {
    if (args.wordLimit === 'flash') {
      conds.push(sql`${sparks.wordLimit} IS NOT NULL AND ${sparks.wordLimit} < 500`)
    } else if (args.wordLimit === 'medium') {
      conds.push(
        sql`${sparks.wordLimit} >= 500 AND ${sparks.wordLimit} < 2000`,
      )
    } else if (args.wordLimit === 'long') {
      conds.push(sql`${sparks.wordLimit} >= 2000`)
    }
  }

  // Time-left bucket — only meaningful for OPEN (submission window) sparks.
  // We apply it to `deadline` regardless of state filter; sparks with NULL
  // deadlines are excluded.
  if (args.timeLeft && args.timeLeft !== 'any') {
    const hours = args.timeLeft === '24h' ? 24 : 24 * 7
    const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000)
    conds.push(sql`${sparks.deadline} IS NOT NULL AND ${sparks.deadline} <= ${cutoff}`)
  }

  // Creator-following filter — only effective when viewer is authed. Guest
  // requests with creator='following' silently fall through (no Following
  // affordance is shown to guests in the UI per spec §4).
  if (args.creator === 'following' && viewerId) {
    const followedSubquery = sql<string>`(SELECT ${follows.followeeId} FROM ${follows} WHERE ${follows.followerId} = ${viewerId})`
    conds.push(sql`${sparks.creatorId} IN ${followedSubquery}`)
  }

  // Cursor tail clause per sort mode. Skip when using numbered pagination.
  if (cursor && !usePagination) {
    if (sort === 'urgent' && typeof cursor.sortKey === 'string') {
      const cursorDate = new Date(cursor.sortKey)
      const tail = or(
        gt(sparks.deadline, cursorDate),
        and(eq(sparks.deadline, cursorDate), lt(sparks.id, cursor.id)),
      )
      if (tail) conds.push(tail)
    } else if (sort === 'most-entered' && typeof cursor.sortKey === 'number') {
      const sk = cursor.sortKey
      const tail = or(
        lt(sparks.entryCount, sk),
        and(eq(sparks.entryCount, sk), lt(sparks.id, cursor.id)),
      )
      if (tail) conds.push(tail)
    } else if (typeof cursor.sortKey === 'string') {
      // recent / relevance
      const cursorDate = new Date(cursor.sortKey)
      const tail = or(
        lt(sparks.createdAt, cursorDate),
        and(eq(sparks.createdAt, cursorDate), lt(sparks.id, cursor.id)),
      )
      if (tail) conds.push(tail)
    }
  }

  const orderClause =
    sort === 'urgent'
      ? [asc(sparks.deadline), desc(sparks.id)]
      : sort === 'most-entered'
        ? [desc(sparks.entryCount), desc(sparks.id)]
        : // 'recent' + 'relevance' (TODO: real relevance scoring)
          [desc(sparks.createdAt), desc(sparks.id)]

  const [rows, totalCountRows] = await Promise.all([
    usePagination
      ? db
          .select({
            id: sparks.id,
            createdAt: sparks.createdAt,
            deadline: sparks.deadline,
            entryCount: sparks.entryCount,
          })
          .from(sparks)
          .where(and(...conds))
          .orderBy(...orderClause)
          .limit(PAGE_SIZE + 1)
          .offset(offset)
      : db
          .select({
            id: sparks.id,
            createdAt: sparks.createdAt,
            deadline: sparks.deadline,
            entryCount: sparks.entryCount,
          })
          .from(sparks)
          .where(and(...conds))
          .orderBy(...orderClause)
          .limit(PAGE_SIZE + 1),
    db.select({ total: count(sparks.id) }).from(sparks).where(and(...conds)),
  ])
  const totalCount = Number(totalCountRows[0]?.total ?? 0)

  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const projected = await projectToSparkCards(page, {
    computeVoteTotal: true,
    computeWinner: true,
  })

  const last = page[page.length - 1]
  let nextCursor: string | null = null
  if (hasMore && last) {
    if (sort === 'urgent' && last.deadline) {
      nextCursor = encodeCursor({
        sortKey: last.deadline.toISOString(),
        id: last.id,
      })
    } else if (sort === 'most-entered') {
      nextCursor = encodeCursor({ sortKey: last.entryCount, id: last.id })
    } else {
      nextCursor = encodeCursor({
        sortKey: last.createdAt.toISOString(),
        id: last.id,
      })
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

// ─── 10. Spark genre counts (cached 5min) ─────────────────────────────────────

const getSparkGenreCountsCached = unstable_cache(
  async (): Promise<Record<GenreSlug, number>> => {
    const rows = await db
      .select({ genre: sparks.genre, total: count() })
      .from(sparks)
      .where(
        and(
          eq(sparks.visibility, 'PUBLIC'),
          eq(sparks.discoverable, true),
          isNotNull(sparks.genre),
        ),
      )
      .groupBy(sparks.genre)

    const counts: Record<GenreSlug, number> = GENRES.reduce(
      (acc, slug) => {
        acc[slug] = 0
        return acc
      },
      {} as Record<GenreSlug, number>,
    )
    for (const r of rows) {
      const slug = normalizeGenre(r.genre)
      counts[slug] += Number(r.total)
    }
    return counts
  },
  ['discover-sparks-genre-counts'],
  { revalidate: 300, tags: ['discover-sparks-genre-counts'] },
)

export async function getSparkGenreCountsAction(): Promise<
  ActionResult<Record<GenreSlug, number>>
> {
  const data = await getSparkGenreCountsCached()
  return { success: true, data }
}
