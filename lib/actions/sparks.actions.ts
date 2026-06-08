'use server'

import { db } from '@/db'
import {
  sparks,
  sparkEntries,
  sparkVotes,
  sparkEntryComments,
  notifications,
  userProfiles,
} from '@/db/schema'
import {
  eq,
  and,
  count,
  sql,
  desc,
  asc,
  gt,
  lte,
  isNull,
  inArray,
} from 'drizzle-orm'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { z } from 'zod'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { canViewSpark, canEnterSpark, canVoteSpark } from '@/lib/sparks/predicates'
import { sweepSparkStatuses } from '@/lib/sparks/sweep-status'
import { isBlocked } from '@/lib/social/is-blocked'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import type { SparkStatus, SparkVisibility } from '@/db/schema/social'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

// NOTE: SparkStatus + SparkVisibility are NOT re-exported from this file.
// Next.js's `'use server'` bundler treats every export as a runtime-callable
// async function; type re-exports fail at build time with "Export X doesn't
// exist in target module". Consumers import these types directly from
// `@/db/schema/social`.

export type SparkSummary = {
  id: string
  prompt: string
  deadline: Date
  wordLimit: number | null
  status: SparkStatus
  visibility: SparkVisibility
  votingEndsAt: Date | null
  entryCount: number
  creatorUsername: string | null
  creatorDisplayName: string | null
  winnerUsername: string | null
}

export type SparkDetail = SparkSummary & {
  description: string | null
  rules: string | null
  creatorUserId: string
  creatorChoiceEntryId: string | null
  winnerEntryId: string | null
}

export type SparkEntrySummary = {
  id: string
  sparkId: string
  authorUserId: string
  authorUsername: string | null
  authorDisplayName: string | null
  title: string | null
  contentPreview: string
  wordCount: number
  voteCount: number
  likeCount: number
  userHasVoted: boolean
  createdAt: Date
}

export type SparkEntryDetail = SparkEntrySummary & {
  content: string
}

export type EntryComment = {
  id: string
  content: string
  createdAt: Date
  parentId: string | null
  authorUserId: string
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000
const PAGE_SIZE = 20
const FREE_SPARK_LIMIT = 1

// Legacy fallback used only when a row's stored `status` is somehow stale; the
// canonical source of truth post-C2 is the stored column populated/maintained
// by `sweepSparkStatuses`.
function computeStatus(deadline: Date): SparkStatus {
  const now = Date.now()
  const dl = deadline.getTime()
  if (now < dl) return 'OPEN'
  if (now < dl + VOTING_WINDOW_MS) return 'VOTING'
  return 'CLOSED'
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createSparkSchema = z
  .object({
    prompt: z.string().min(10).max(500),
    deadline: z.date().refine(
      d => d.getTime() > Date.now() + 60 * 60 * 1000,
      { message: 'Deadline must be at least 1 hour from now' }
    ),
    wordLimit: z.number().int().positive().optional(),
    visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
    discoverable: z.boolean().optional().default(true),
    votingDurationHours: z.number().int().min(1).max(720).default(48),
  })
  .transform((data) => ({
    ...data,
    // 3-layer defense: server-side coercion mirrors createBookSchema precedent.
    discoverable: data.visibility === 'PUBLIC' ? data.discoverable : false,
  }))

const submitEntrySchema = z.object({
  content: z.string().min(1),
  title: z.string().trim().max(120).nullable().optional(),
})

const updateEntrySchema = z.object({
  content: z.string().min(1),
  title: z.string().trim().max(120).nullable().optional(),
})

const addCommentSchema = z.object({
  content: z.string().min(1).max(1000),
})

const replyToSparkCommentSchema = z.object({
  entryId: z.string().min(1),
  parentId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
})

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * List sparks with pagination.
 *
 * Post-C2: status is sourced from the stored column (kept fresh by the lazy
 * `sweepSparkStatuses` call at the top of the action) so OPEN/VOTING/CLOSED is
 * the authoritative truth without relying on deadline math.
 *
 * Each row is then filtered through `canViewSpark` so FRIENDS/PRIVATE sparks
 * silently disappear for viewers who can't read them (block masquerade).
 */
export async function getSparksAction(
  filter: 'active' | 'closed' = 'active',
  page = 1
): Promise<ActionResult<{ sparks: SparkSummary[]; hasMore: boolean }>> {
  await sweepSparkStatuses()

  const viewerId = await getOptionalUserId()
  const offset = (page - 1) * PAGE_SIZE

  const activeStatuses: SparkStatus[] = ['OPEN', 'VOTING']
  const closedStatuses: SparkStatus[] = ['CLOSED']
  const whereStatus =
    filter === 'active'
      ? inArray(sparks.status, activeStatuses)
      : inArray(sparks.status, closedStatuses)

  const rows = await db
    .select({
      id: sparks.id,
      title: sparks.title,
      deadline: sparks.deadline,
      wordLimit: sparks.wordLimit,
      winnerEntryId: sparks.winnerEntryId,
      visibility: sparks.visibility,
      status: sparks.status,
      votingEndsAt: sparks.votingEndsAt,
      creatorId: sparks.creatorId,
      creatorUsername: userProfiles.username,
      creatorDisplayName: userProfiles.displayName,
      entryCount: count(sparkEntries.id),
    })
    .from(sparks)
    .leftJoin(userProfiles, eq(userProfiles.userId, sparks.creatorId))
    .leftJoin(sparkEntries, eq(sparkEntries.sparkId, sparks.id))
    .where(whereStatus)
    .groupBy(
      sparks.id,
      sparks.title,
      sparks.deadline,
      sparks.wordLimit,
      sparks.winnerEntryId,
      sparks.visibility,
      sparks.status,
      sparks.votingEndsAt,
      sparks.creatorId,
      userProfiles.username,
      userProfiles.displayName
    )
    .orderBy(
      filter === 'active' ? asc(sparks.deadline) : desc(sparks.deadline)
    )
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  // canViewSpark gate (parallel) — block masquerade hides blocked-creator
  // sparks AND non-PUBLIC sparks the viewer isn't friends with / doesn't own.
  const visibleRows = (
    await Promise.all(
      rows.map(async (r) =>
        (await canViewSpark(viewerId, {
          creatorId: r.creatorId,
          visibility: r.visibility,
          status: r.status,
        }))
          ? r
          : null
      )
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null)

  const hasMore = visibleRows.length > PAGE_SIZE
  const page_rows = visibleRows.slice(0, PAGE_SIZE)

  // For closed sparks with a winner, fetch winner username
  const winnerEntryIds = page_rows
    .filter((r) => r.winnerEntryId != null)
    .map((r) => r.winnerEntryId as string)

  let winnerUsernameMap: Record<string, string | null> = {}
  if (winnerEntryIds.length > 0) {
    const winnerRows = await db
      .select({
        entryId: sparkEntries.id,
        userId: sparkEntries.userId,
        username: userProfiles.username,
      })
      .from(sparkEntries)
      .leftJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
      .where(inArray(sparkEntries.id, winnerEntryIds))

    for (const wr of winnerRows) {
      winnerUsernameMap[wr.entryId] = wr.username ?? null
    }
  }

  const result: SparkSummary[] = page_rows.map((r) => ({
    id: r.id,
    prompt: r.title,
    deadline: r.deadline ?? new Date(0),
    wordLimit: r.wordLimit ?? null,
    status: r.status,
    visibility: r.visibility,
    votingEndsAt: r.votingEndsAt ?? null,
    entryCount: Number(r.entryCount),
    creatorUsername: r.creatorUsername ?? null,
    creatorDisplayName: r.creatorDisplayName ?? null,
    winnerUsername: r.winnerEntryId
      ? (winnerUsernameMap[r.winnerEntryId] ?? null)
      : null,
  }))

  return { success: true, data: { sparks: result, hasMore } }
}

/**
 * Get a single spark by ID with lazy finalization:
 * if CLOSED and winnerEntryId is null, find the top-voted entry and set it.
 *
 * Post-C2: runs `sweepSparkStatuses` first so the stored `status` is accurate,
 * then `canViewSpark` masquerades denied viewers as NOT_FOUND.
 */
export async function getSparkAction(
  sparkId: string
): Promise<ActionResult<SparkDetail>> {
  await sweepSparkStatuses()
  const viewerId = await getOptionalUserId()

  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  if (
    !(await canViewSpark(viewerId, {
      creatorId: spark.creatorId,
      visibility: spark.visibility,
      status: spark.status,
    }))
  ) {
    return { success: false, error: 'NOT_FOUND' } // masquerade
  }

  const deadline = spark.deadline ?? new Date(0)
  const status = spark.status

  // Lazy finalization
  let winnerEntryId = spark.winnerEntryId
  if (status === 'CLOSED' && winnerEntryId === null) {
    const topEntries = await db
      .select({
        entryId: sparkVotes.entryId,
        voteCount: count(sparkVotes.userId),
      })
      .from(sparkVotes)
      .innerJoin(sparkEntries, eq(sparkEntries.id, sparkVotes.entryId))
      .where(eq(sparkEntries.sparkId, sparkId))
      .groupBy(sparkVotes.entryId)
      .orderBy(desc(count(sparkVotes.userId)))
      .limit(1)

    const top = topEntries[0]
    if (top) {
      await db.transaction(async (tx) => {
        // Guard against race: only update if still null, use .returning() to know if we won the race
        const updated = await tx
          .update(sparks)
          .set({ winnerEntryId: top.entryId })
          .where(and(eq(sparks.id, sparkId), isNull(sparks.winnerEntryId)))
          .returning({ id: sparks.id })

        // Only fire notification + activity if THIS request was the one that set the winner
        if (updated.length > 0) {
          const [entry] = await tx
            .select({ userId: sparkEntries.userId })
            .from(sparkEntries)
            .where(eq(sparkEntries.id, top.entryId))
            .limit(1)

          if (entry) {
            await tx.insert(notifications).values({
              userId: entry.userId,
              type: 'SPARK_WIN',
              resourceType: 'spark',
              resourceId: sparkId,
            })

            // C2 T8: gate feed event on PUBLIC visibility. FRIENDS/PRIVATE
            // winners stay off the global activity feed because the feed
            // redistributes to follows + friends-of-actor — leaking a private
            // win there would expose the spark's existence.
            if (spark.visibility === 'PUBLIC') {
              await recordSocialActivityTx(tx, {
                actorId: entry.userId,
                type: 'spark_won_community',
                subjectType: 'spark_entry',
                subjectId: top.entryId,
                payload: { sparkId, sparkTitle: spark.title },
              })
            }
          }
        }
      })

      winnerEntryId = top.entryId
    }
  }

  const [creatorProfile] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, spark.creatorId))
    .limit(1)

  const [entryCounts] = await db
    .select({ count: count() })
    .from(sparkEntries)
    .where(eq(sparkEntries.sparkId, sparkId))

  let winnerUsername: string | null = null
  if (winnerEntryId) {
    const [winnerEntry] = await db
      .select({ userId: sparkEntries.userId })
      .from(sparkEntries)
      .where(eq(sparkEntries.id, winnerEntryId))
      .limit(1)
    if (winnerEntry) {
      const [wp] = await db
        .select({ username: userProfiles.username })
        .from(userProfiles)
        .where(eq(userProfiles.userId, winnerEntry.userId))
        .limit(1)
      winnerUsername = wp?.username ?? null
    }
  }

  const detail: SparkDetail = {
    id: spark.id,
    prompt: spark.title,
    deadline,
    wordLimit: spark.wordLimit ?? null,
    status,
    visibility: spark.visibility,
    votingEndsAt: spark.votingEndsAt ?? null,
    entryCount: Number(entryCounts?.count ?? 0),
    creatorUsername: creatorProfile?.username ?? null,
    creatorDisplayName: creatorProfile?.displayName ?? null,
    winnerUsername,
    description: spark.description ?? null,
    rules: spark.rules ?? null,
    creatorUserId: spark.creatorId,
    creatorChoiceEntryId: spark.creatorChoiceEntryId ?? null,
    winnerEntryId: winnerEntryId ?? null,
  }

  return { success: true, data: detail }
}

/**
 * Create a new Spark. Free users limited to 1 active Spark.
 *
 * Post-C2: accepts visibility (PUBLIC/FRIENDS/PRIVATE), discoverable
 * (coerced to false when visibility !== PUBLIC), and votingDurationHours
 * (1-720, default 48). Computes votingEndsAt = deadline + duration. Inserts
 * with status='OPEN'.
 */
export async function createSparkAction(input: {
  prompt: string
  deadline: Date
  wordLimit?: number
  visibility?: SparkVisibility
  discoverable?: boolean
  votingDurationHours?: number
}): Promise<ActionResult<{ sparkId: string }>> {
  const userId = await requireAuth()

  const parsed = createSparkSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  // Free tier: max 1 active spark
  const votingEnd = new Date(Date.now() - VOTING_WINDOW_MS)
  const [activeCount] = await db
    .select({ count: count() })
    .from(sparks)
    .where(
      and(eq(sparks.creatorId, userId), gt(sparks.deadline, votingEnd))
    )

  if (Number(activeCount?.count ?? 0) >= FREE_SPARK_LIMIT) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const votingEndsAt = new Date(
    parsed.data.deadline.getTime() + parsed.data.votingDurationHours * 3600_000
  )

  const [created] = await db
    .insert(sparks)
    .values({
      creatorId: userId,
      title: parsed.data.prompt,
      deadline: parsed.data.deadline,
      wordLimit: parsed.data.wordLimit ?? null,
      visibility: parsed.data.visibility,
      discoverable: parsed.data.discoverable,
      status: 'OPEN',
      votingEndsAt,
    })
    .returning({ id: sparks.id })

  return { success: true, data: { sparkId: created.id } }
}

/**
 * Get paginated entries for a spark.
 *
 * Post-C2: returns `title` + `likeCount` per entry. Sort branches on parent
 * spark's status — OPEN: chronological (newest first); VOTING/CLOSED: by
 * denormalized likeCount desc, then createdAt desc as tiebreaker.
 */
export async function getSparkEntriesAction(
  sparkId: string,
  sort: 'top' | 'new' = 'top',
  page = 1
): Promise<ActionResult<{ entries: SparkEntrySummary[]; hasMore: boolean }>> {
  let currentUserId: string | null = null
  try {
    currentUserId = await requireAuth()
  } catch {
    // unauthenticated — ok
  }

  const offset = (page - 1) * PAGE_SIZE

  // Look up the parent spark's status to branch sort order.
  const [parentSpark] = await db
    .select({ status: sparks.status })
    .from(sparks)
    .where(eq(sparks.id, sparkId))
    .limit(1)

  // OPEN: chronological. VOTING/CLOSED: by likes (denorm), then createdAt.
  // `sort='new'` arg preserved as an explicit override.
  const useLikeSort =
    sort === 'top' && parentSpark && parentSpark.status !== 'OPEN'

  const rows = await db
    .select({
      id: sparkEntries.id,
      sparkId: sparkEntries.sparkId,
      userId: sparkEntries.userId,
      content: sparkEntries.content,
      title: sparkEntries.title,
      wordCount: sparkEntries.wordCount,
      likeCount: sparkEntries.likeCount,
      createdAt: sparkEntries.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      voteCount: count(sparkVotes.userId),
    })
    .from(sparkEntries)
    .leftJoin(userProfiles, eq(userProfiles.userId, sparkEntries.userId))
    .leftJoin(sparkVotes, eq(sparkVotes.entryId, sparkEntries.id))
    .where(eq(sparkEntries.sparkId, sparkId))
    .groupBy(
      sparkEntries.id,
      sparkEntries.sparkId,
      sparkEntries.userId,
      sparkEntries.content,
      sparkEntries.title,
      sparkEntries.wordCount,
      sparkEntries.likeCount,
      sparkEntries.createdAt,
      userProfiles.username,
      userProfiles.displayName
    )
    .orderBy(
      ...(useLikeSort
        ? [desc(sparkEntries.likeCount), desc(sparkEntries.createdAt)]
        : [desc(sparkEntries.createdAt)])
    )
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  const pageRows = rows.slice(0, PAGE_SIZE)

  // Fetch which entries the current user has voted on
  let votedEntryIds = new Set<string>()
  if (currentUserId && pageRows.length > 0) {
    const entryIds = pageRows.map((r) => r.id)
    const votedRows = await db
      .select({ entryId: sparkVotes.entryId })
      .from(sparkVotes)
      .where(
        and(
          eq(sparkVotes.userId, currentUserId),
          inArray(sparkVotes.entryId, entryIds)
        )
      )
    votedEntryIds = new Set(votedRows.map((v) => v.entryId))
  }

  const entries: SparkEntrySummary[] = pageRows.map((r) => ({
    id: r.id,
    sparkId: r.sparkId,
    authorUserId: r.userId,
    authorUsername: r.authorUsername ?? null,
    authorDisplayName: r.authorDisplayName ?? null,
    title: r.title ?? null,
    contentPreview: r.content.slice(0, 300),
    wordCount: r.wordCount,
    voteCount: Number(r.voteCount),
    likeCount: r.likeCount,
    userHasVoted: votedEntryIds.has(r.id),
    createdAt: r.createdAt,
  }))

  return { success: true, data: { entries, hasMore } }
}

/**
 * Get a single spark entry with full content. Includes optional `title`.
 */
export async function getSparkEntryAction(
  sparkId: string,
  entryId: string
): Promise<ActionResult<SparkEntryDetail>> {
  const [entry] = await db
    .select()
    .from(sparkEntries)
    .where(eq(sparkEntries.id, entryId))
    .limit(1)

  if (!entry) return { success: false, error: 'NOT_FOUND' }
  if (entry.sparkId !== sparkId) return { success: false, error: 'NOT_FOUND' }

  let currentUserId: string | null = null
  try {
    currentUserId = await requireAuth()
  } catch {
    // unauthenticated — ok
  }

  const [profile] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, entry.userId))
    .limit(1)

  const [voteResult] = await db
    .select({ voteCount: count() })
    .from(sparkVotes)
    .where(eq(sparkVotes.entryId, entryId))

  let userHasVoted = false
  if (currentUserId) {
    const [voteCheck] = await db
      .select()
      .from(sparkVotes)
      .where(
        and(eq(sparkVotes.userId, currentUserId), eq(sparkVotes.entryId, entryId))
      )
      .limit(1)
    userHasVoted = !!voteCheck
  }

  const detail: SparkEntryDetail = {
    id: entry.id,
    sparkId: entry.sparkId,
    authorUserId: entry.userId,
    authorUsername: profile?.username ?? null,
    authorDisplayName: profile?.displayName ?? null,
    title: entry.title ?? null,
    contentPreview: entry.content.slice(0, 300),
    content: entry.content,
    wordCount: entry.wordCount,
    voteCount: Number(voteResult?.voteCount ?? 0),
    likeCount: entry.likeCount,
    userHasVoted,
    createdAt: entry.createdAt,
  }

  return { success: true, data: detail }
}

/**
 * Submit a new entry to a spark.
 *
 * Post-C2: accepts optional `title`. Uses `canEnterSpark` (which composes
 * canViewSpark + status check + creator-can't-enter-own) as the authoritative
 * gate. The `spark_entry_submitted` activity event is gated on PUBLIC
 * visibility so private/friends entries don't leak into the global feed.
 */
export async function submitSparkEntryAction(
  sparkId: string,
  content: string,
  title?: string | null
): Promise<ActionResult<{ entryId: string }>> {
  const userId = await requireAuth()

  const parsed = submitEntrySchema.safeParse({ content, title })
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  if (
    !(await canEnterSpark(userId, {
      creatorId: spark.creatorId,
      visibility: spark.visibility,
      status: spark.status,
    }))
  ) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  // Check for duplicate entry
  const [existing] = await db
    .select()
    .from(sparkEntries)
    .where(and(eq(sparkEntries.sparkId, sparkId), eq(sparkEntries.userId, userId)))
    .limit(1)

  if (existing) return { success: false, error: 'ALREADY_SUBMITTED' }

  // Word count
  const words = parsed.data.content.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  if (spark.wordLimit != null && wordCount > spark.wordLimit) {
    return { success: false, error: 'WORD_LIMIT_EXCEEDED' }
  }

  const normalizedTitle = parsed.data.title?.trim() || null

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sparkEntries)
      .values({
        sparkId,
        userId,
        content: parsed.data.content,
        title: normalizedTitle,
        wordCount,
      })
      .returning({ id: sparkEntries.id })

    // C2 T8: gate the feed event on PUBLIC visibility. FRIENDS/PRIVATE
    // spark entries never write to the feed.
    if (spark.visibility === 'PUBLIC') {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'spark_entry_submitted',
        subjectType: 'spark_entry',
        subjectId: row.id,
        payload: { sparkId, sparkTitle: spark.title },
      })
    }

    return row
  })

  return { success: true, data: { entryId: created.id } }
}

/**
 * Update an existing spark entry. Only allowed while spark is OPEN.
 * Post-C2: accepts optional `title`.
 */
export async function updateSparkEntryAction(
  entryId: string,
  content: string,
  title?: string | null
): Promise<ActionResult<void>> {
  const userId = await requireAuth()

  const parsed = updateEntrySchema.safeParse({ content, title })
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [entry] = await db
    .select()
    .from(sparkEntries)
    .where(eq(sparkEntries.id, entryId))
    .limit(1)

  if (!entry) return { success: false, error: 'NOT_FOUND' }
  if (entry.userId !== userId) return { success: false, error: 'NOT_OWNER' }

  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, entry.sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  if (spark.status !== 'OPEN') {
    return { success: false, error: 'SPARK_NOT_OPEN' }
  }

  const words = parsed.data.content.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  if (spark.wordLimit != null && wordCount > spark.wordLimit) {
    return { success: false, error: 'WORD_LIMIT_EXCEEDED' }
  }

  const normalizedTitle = parsed.data.title?.trim() || null

  await db
    .update(sparkEntries)
    .set({ content: parsed.data.content, title: normalizedTitle, wordCount })
    .where(eq(sparkEntries.id, entryId))

  return { success: true, data: undefined }
}

/**
 * Toggle a vote on a spark entry. Only allowed during VOTING window.
 *
 * Post-C2:
 *  - `canVoteSpark` gate fronts the call (status=VOTING + viewable + auth).
 *  - vote insert/delete + `like_count` ±1 atomic via tx.
 */
export async function voteSparkEntryAction(
  entryId: string
): Promise<ActionResult<{ voted: boolean }>> {
  const userId = await requireAuth()

  const [entry] = await db
    .select()
    .from(sparkEntries)
    .where(eq(sparkEntries.id, entryId))
    .limit(1)

  if (!entry) return { success: false, error: 'NOT_FOUND' }

  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, entry.sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  if (entry.userId === userId) {
    return { success: false, error: 'CANNOT_VOTE_OWN_ENTRY' }
  }

  if (
    !(await canVoteSpark(userId, {
      creatorId: spark.creatorId,
      visibility: spark.visibility,
      status: spark.status,
    }))
  ) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  const voted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(sparkVotes)
      .where(and(eq(sparkVotes.userId, userId), eq(sparkVotes.entryId, entryId)))
      .limit(1)

    if (existing) {
      await tx
        .delete(sparkVotes)
        .where(
          and(eq(sparkVotes.userId, userId), eq(sparkVotes.entryId, entryId))
        )
      await tx
        .update(sparkEntries)
        .set({ likeCount: sql`${sparkEntries.likeCount} - 1` })
        .where(eq(sparkEntries.id, entryId))
      return false
    }

    await tx.insert(sparkVotes).values({ userId, entryId })
    await tx
      .update(sparkEntries)
      .set({ likeCount: sql`${sparkEntries.likeCount} + 1` })
      .where(eq(sparkEntries.id, entryId))
    return true
  })

  return { success: true, data: { voted } }
}

/**
 * Set the creator's choice entry for a spark. Only allowed after OPEN phase ends.
 * Post-C2: winner activity event gated on PUBLIC visibility.
 */
export async function setCreatorChoiceAction(
  sparkId: string,
  entryId: string
): Promise<ActionResult<void>> {
  const userId = await requireAuth()

  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }
  if (spark.creatorId !== userId) return { success: false, error: 'NOT_SPARK_CREATOR' }

  if (spark.status === 'OPEN') {
    return { success: false, error: 'SPARK_STILL_OPEN' }
  }

  // Verify entry belongs to this spark
  const [entryCheck] = await db
    .select({ sparkId: sparkEntries.sparkId })
    .from(sparkEntries)
    .where(eq(sparkEntries.id, entryId))
    .limit(1)
  if (!entryCheck || entryCheck.sparkId !== sparkId) {
    return { success: false, error: 'ENTRY_NOT_IN_SPARK' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sparks)
      .set({ creatorChoiceEntryId: entryId })
      .where(eq(sparks.id, sparkId))

    // Look up entry author and fire SPARK_WIN notification
    const [entry] = await tx
      .select({ userId: sparkEntries.userId })
      .from(sparkEntries)
      .where(eq(sparkEntries.id, entryId))
      .limit(1)

    if (entry && entry.userId !== userId) {
      await tx.insert(notifications).values({
        userId: entry.userId,
        type: 'SPARK_WIN',
        actorId: userId,
        resourceType: 'spark',
        resourceId: sparkId,
      })
    }

    // C2 T8: actor is the WINNER (entry author), gated on PUBLIC visibility so
    // FRIENDS/PRIVATE wins don't leak through the feed redistribution surface.
    if (entry && spark.visibility === 'PUBLIC') {
      await recordSocialActivityTx(tx, {
        actorId: entry.userId,
        type: 'spark_won_creator_choice',
        subjectType: 'spark_entry',
        subjectId: entryId,
        payload: { sparkId, sparkTitle: spark.title },
      })
    }
  })

  return { success: true, data: undefined }
}

/**
 * Get paginated comments on a spark entry, joined with author profile info.
 * Post-C2: includes `parentId` so callers can group comments + replies.
 */
export async function getSparkEntryCommentsAction(
  entryId: string,
  page = 1
): Promise<ActionResult<{ comments: EntryComment[]; hasMore: boolean }>> {
  const offset = (page - 1) * PAGE_SIZE

  const rows = await db
    .select({
      id: sparkEntryComments.id,
      content: sparkEntryComments.content,
      createdAt: sparkEntryComments.createdAt,
      parentId: sparkEntryComments.parentId,
      authorUserId: sparkEntryComments.userId,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(sparkEntryComments)
    .leftJoin(userProfiles, eq(userProfiles.userId, sparkEntryComments.userId))
    .where(eq(sparkEntryComments.entryId, entryId))
    .orderBy(asc(sparkEntryComments.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  const pageRows = rows.slice(0, PAGE_SIZE)

  const comments: EntryComment[] = pageRows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
    parentId: r.parentId ?? null,
    authorUserId: r.authorUserId,
    authorUsername: r.authorUsername ?? null,
    authorDisplayName: r.authorDisplayName ?? null,
    authorAvatarUrl: r.authorAvatarUrl ?? null,
  }))

  return { success: true, data: { comments, hasMore } }
}

/**
 * Add a top-level comment to a spark entry. Fires a NEW_COMMENT notification
 * to the entry author if the commenter is a different user.
 */
export async function addSparkEntryCommentAction(
  entryId: string,
  content: string
): Promise<ActionResult<EntryComment>> {
  const userId = await requireAuth()

  const parsed = addCommentSchema.safeParse({ content })
  if (!parsed.success) return { success: false, error: 'INVALID_CONTENT' }

  // Verify the entry exists
  const [entry] = await db
    .select({ userId: sparkEntries.userId })
    .from(sparkEntries)
    .where(eq(sparkEntries.id, entryId))
    .limit(1)

  if (!entry) return { success: false, error: 'NOT_FOUND' }

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(parsed.data.content)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sparkEntryComments)
      .values({
        entryId,
        userId,
        content: parsed.data.content,
      })
      .returning({
        id: sparkEntryComments.id,
        content: sparkEntryComments.content,
        createdAt: sparkEntryComments.createdAt,
        parentId: sparkEntryComments.parentId,
      })

    // Notify the entry author if they are not the commenter
    if (entry.userId !== userId) {
      await tx.insert(notifications).values({
        userId: entry.userId,
        type: 'NEW_COMMENT',
        actorId: userId,
        resourceType: 'spark_entry',
        resourceId: entryId,
      })
    }

    // Mention notifications
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'spark_entry_comment',
        resourceId: row.id,
      })
      if (!mentionResult.ok) {
        throw new Error(mentionResult.error)
      }
      const toNotify = mentionResult.users
        .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
        .map((u) => u.userId)
      if (toNotify.length > 0) {
        await recordMentionNotificationsTx(tx, {
          actorId: userId,
          mentionedUserIds: toNotify,
          resourceType: 'spark_entry_comment',
          resourceId: row.id,
        })
      }
    }

    return row
  })

  const [profile] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  const comment: EntryComment = {
    id: inserted.id,
    content: inserted.content,
    createdAt: inserted.createdAt,
    parentId: inserted.parentId ?? null,
    authorUserId: userId,
    authorUsername: profile?.username ?? null,
    authorDisplayName: profile?.displayName ?? null,
    authorAvatarUrl: profile?.avatarUrl ?? null,
  }

  return { success: true, data: comment }
}

/**
 * Reply to a top-level spark-entry comment. One-level enforcement: returns
 * REPLY_DEPTH_EXCEEDED if the target comment is itself a reply (parentId set).
 *
 * Blocks the reply if author is bidirectionally blocked with the parent
 * commenter; runs through canViewSpark so denied viewers see NOT_ALLOWED.
 */
export async function replyToSparkCommentAction(input: {
  entryId: string
  parentId: string
  content: string
}): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = replyToSparkCommentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [parent] = await db
    .select({
      id: sparkEntryComments.id,
      parentId: sparkEntryComments.parentId,
      userId: sparkEntryComments.userId,
      entryId: sparkEntryComments.entryId,
    })
    .from(sparkEntryComments)
    .where(eq(sparkEntryComments.id, parsed.data.parentId))
    .limit(1)

  if (!parent) return { success: false, error: 'PARENT_NOT_FOUND' }
  if (parent.parentId !== null) {
    return { success: false, error: 'REPLY_DEPTH_EXCEEDED' }
  }
  if (parent.entryId !== parsed.data.entryId) {
    return { success: false, error: 'PARENT_MISMATCH' }
  }

  if (await isBlocked(userId, parent.userId)) {
    return { success: false, error: 'BLOCKED' }
  }

  // canViewSpark gate on the parent spark.
  const [entry] = await db
    .select({ sparkId: sparkEntries.sparkId })
    .from(sparkEntries)
    .where(eq(sparkEntries.id, parsed.data.entryId))
    .limit(1)
  if (!entry) return { success: false, error: 'NOT_FOUND' }

  const [spark] = await db
    .select({
      creatorId: sparks.creatorId,
      visibility: sparks.visibility,
      status: sparks.status,
    })
    .from(sparks)
    .where(eq(sparks.id, entry.sparkId))
    .limit(1)
  if (
    !spark ||
    !(await canViewSpark(userId, {
      creatorId: spark.creatorId,
      visibility: spark.visibility,
      status: spark.status,
    }))
  ) {
    return { success: false, error: 'NOT_ALLOWED' }
  }

  // Mention extraction + early cap check
  const textUsernames = extractMentionUsernamesFromText(parsed.data.content)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sparkEntryComments)
      .values({
        entryId: parsed.data.entryId,
        userId,
        content: parsed.data.content,
        parentId: parsed.data.parentId,
      })
      .returning({ id: sparkEntryComments.id })

    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'spark_entry_comment_reply',
        resourceId: row.id,
      })
      if (!mentionResult.ok) {
        throw new Error(mentionResult.error)
      }
      const toNotify = mentionResult.users
        .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
        .map((u) => u.userId)
      if (toNotify.length > 0) {
        await recordMentionNotificationsTx(tx, {
          actorId: userId,
          mentionedUserIds: toNotify,
          resourceType: 'spark_entry_comment_reply',
          resourceId: row.id,
        })
      }
    }

    return row
  })

  return { success: true, data: { id: inserted.id } }
}
