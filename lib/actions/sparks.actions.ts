'use server'

import { db } from '@/db'
import {
  sparks,
  sparkEntries,
  sparkVotes,
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
import { requireAuth } from '@/lib/require-auth'
import { z } from 'zod'
import type { ActionResult } from './book.actions'
import { createId } from '@paralleldrive/cuid2'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SparkStatus = 'OPEN' | 'VOTING' | 'CLOSED'

export type SparkSummary = {
  id: string
  prompt: string
  deadline: Date
  wordLimit: number | null
  status: SparkStatus
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
  contentPreview: string
  wordCount: number
  voteCount: number
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
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000
const PAGE_SIZE = 20
const FREE_SPARK_LIMIT = 1

function computeStatus(deadline: Date): SparkStatus {
  const now = Date.now()
  const dl = deadline.getTime()
  if (now < dl) return 'OPEN'
  if (now < dl + VOTING_WINDOW_MS) return 'VOTING'
  return 'CLOSED'
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createSparkSchema = z.object({
  prompt: z.string().min(10).max(500),
  deadline: z.date().min(new Date(Date.now() + 60 * 60 * 1000)),
  wordLimit: z.number().int().positive().optional(),
})

const submitEntrySchema = z.object({
  content: z.string().min(1),
})

const updateEntrySchema = z.object({
  content: z.string().min(1),
})

const addCommentSchema = z.object({
  content: z.string().min(1).max(1000),
})

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * List sparks with pagination.
 * active = OPEN or VOTING (deadline > now - 48h)
 * closed = CLOSED (deadline <= now - 48h)
 */
export async function getSparksAction(
  filter: 'active' | 'closed' = 'active',
  page = 1
): Promise<ActionResult<{ sparks: SparkSummary[]; hasMore: boolean }>> {
  const offset = (page - 1) * PAGE_SIZE
  const votingEnd = new Date(Date.now() - VOTING_WINDOW_MS)

  // Alias for creator profile
  const creatorProfile = db
    .$with('creator_profile')
    .as(
      db
        .select({
          userId: userProfiles.userId,
          username: userProfiles.username,
          displayName: userProfiles.displayName,
        })
        .from(userProfiles)
    )

  // We do a straightforward join approach
  const rows = await db
    .select({
      id: sparks.id,
      title: sparks.title,
      deadline: sparks.deadline,
      wordLimit: sparks.wordLimit,
      winnerEntryId: sparks.winnerEntryId,
      creatorUsername: userProfiles.username,
      creatorDisplayName: userProfiles.displayName,
      entryCount: count(sparkEntries.id),
    })
    .from(sparks)
    .leftJoin(userProfiles, eq(userProfiles.userId, sparks.creatorId))
    .leftJoin(sparkEntries, eq(sparkEntries.sparkId, sparks.id))
    .where(
      filter === 'active'
        ? gt(sparks.deadline, votingEnd)
        : lte(sparks.deadline, votingEnd)
    )
    .groupBy(
      sparks.id,
      sparks.title,
      sparks.deadline,
      sparks.wordLimit,
      sparks.winnerEntryId,
      userProfiles.username,
      userProfiles.displayName
    )
    .orderBy(
      filter === 'active'
        ? asc(sparks.deadline)
        : desc(sparks.deadline)
    )
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  const page_rows = rows.slice(0, PAGE_SIZE)

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
    status: computeStatus(r.deadline ?? new Date(0)),
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
 */
export async function getSparkAction(
  sparkId: string
): Promise<ActionResult<SparkDetail>> {
  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  const deadline = spark.deadline ?? new Date(0)
  const status = computeStatus(deadline)

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
      // Guard against race: only update if still null
      await db
        .update(sparks)
        .set({ winnerEntryId: top.entryId })
        .where(and(eq(sparks.id, sparkId), isNull(sparks.winnerEntryId)))

      // Look up the entry's userId for notification
      const [entry] = await db
        .select({ userId: sparkEntries.userId })
        .from(sparkEntries)
        .where(eq(sparkEntries.id, top.entryId))
        .limit(1)

      if (entry) {
        await db.insert(notifications).values({
          userId: entry.userId,
          type: 'SPARK_WIN',
          resourceType: 'spark',
          resourceId: sparkId,
        })
      }

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
 */
export async function createSparkAction(input: {
  prompt: string
  deadline: Date
  wordLimit?: number
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

  const [created] = await db
    .insert(sparks)
    .values({
      creatorId: userId,
      title: parsed.data.prompt,
      deadline: parsed.data.deadline,
      wordLimit: parsed.data.wordLimit ?? null,
    })
    .returning({ id: sparks.id })

  return { success: true, data: { sparkId: created.id } }
}

/**
 * Get paginated entries for a spark.
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

  const rows = await db
    .select({
      id: sparkEntries.id,
      sparkId: sparkEntries.sparkId,
      userId: sparkEntries.userId,
      content: sparkEntries.content,
      wordCount: sparkEntries.wordCount,
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
      sparkEntries.wordCount,
      sparkEntries.createdAt,
      userProfiles.username,
      userProfiles.displayName
    )
    .orderBy(
      sort === 'top'
        ? desc(count(sparkVotes.userId))
        : desc(sparkEntries.createdAt)
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
    contentPreview: r.content.slice(0, 300),
    wordCount: r.wordCount,
    voteCount: Number(r.voteCount),
    userHasVoted: votedEntryIds.has(r.id),
    createdAt: r.createdAt,
  }))

  return { success: true, data: { entries, hasMore } }
}

/**
 * Get a single spark entry with full content.
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
    contentPreview: entry.content.slice(0, 300),
    content: entry.content,
    wordCount: entry.wordCount,
    voteCount: Number(voteResult?.voteCount ?? 0),
    userHasVoted,
    createdAt: entry.createdAt,
  }

  return { success: true, data: detail }
}

/**
 * Submit a new entry to a spark. Only allowed while OPEN.
 */
export async function submitSparkEntryAction(
  sparkId: string,
  content: string
): Promise<ActionResult<{ entryId: string }>> {
  const userId = await requireAuth()

  const parsed = submitEntrySchema.safeParse({ content })
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [spark] = await db
    .select()
    .from(sparks)
    .where(eq(sparks.id, sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  const status = computeStatus(spark.deadline ?? new Date(0))
  if (status !== 'OPEN') return { success: false, error: 'SPARK_NOT_OPEN' }

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

  const [created] = await db
    .insert(sparkEntries)
    .values({
      sparkId,
      userId,
      content: parsed.data.content,
      wordCount,
    })
    .returning({ id: sparkEntries.id })

  return { success: true, data: { entryId: created.id } }
}

/**
 * Update an existing spark entry. Only allowed while spark is OPEN.
 */
export async function updateSparkEntryAction(
  entryId: string,
  content: string
): Promise<ActionResult<void>> {
  const userId = await requireAuth()

  const parsed = updateEntrySchema.safeParse({ content })
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

  const status = computeStatus(spark.deadline ?? new Date(0))
  if (status !== 'OPEN') return { success: false, error: 'SPARK_NOT_OPEN' }

  const words = parsed.data.content.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  if (spark.wordLimit != null && wordCount > spark.wordLimit) {
    return { success: false, error: 'WORD_LIMIT_EXCEEDED' }
  }

  await db
    .update(sparkEntries)
    .set({ content: parsed.data.content, wordCount })
    .where(eq(sparkEntries.id, entryId))

  return { success: true, data: undefined }
}

/**
 * Toggle a vote on a spark entry. Only allowed during VOTING window.
 * Returns whether the vote is now active.
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

  const status = computeStatus(spark.deadline ?? new Date(0))
  if (status !== 'VOTING') return { success: false, error: 'VOTING_NOT_OPEN' }

  if (entry.userId === userId) {
    return { success: false, error: 'CANNOT_VOTE_OWN_ENTRY' }
  }

  // Check if already voted
  const [existing] = await db
    .select()
    .from(sparkVotes)
    .where(and(eq(sparkVotes.userId, userId), eq(sparkVotes.entryId, entryId)))
    .limit(1)

  if (existing) {
    // Un-vote
    await db
      .delete(sparkVotes)
      .where(and(eq(sparkVotes.userId, userId), eq(sparkVotes.entryId, entryId)))
    return { success: true, data: { voted: false } }
  }

  // Vote
  await db.insert(sparkVotes).values({ userId, entryId })
  return { success: true, data: { voted: true } }
}

/**
 * Set the creator's choice entry for a spark. Only allowed after OPEN phase ends.
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

  const status = computeStatus(spark.deadline ?? new Date(0))
  if (status === 'OPEN') return { success: false, error: 'SPARK_STILL_OPEN' }

  await db
    .update(sparks)
    .set({ creatorChoiceEntryId: entryId })
    .where(eq(sparks.id, sparkId))

  // Look up entry author and fire SPARK_WIN notification
  const [entry] = await db
    .select({ userId: sparkEntries.userId })
    .from(sparkEntries)
    .where(eq(sparkEntries.id, entryId))
    .limit(1)

  if (entry && entry.userId !== userId) {
    await db.insert(notifications).values({
      userId: entry.userId,
      type: 'SPARK_WIN',
      actorId: userId,
      resourceType: 'spark',
      resourceId: sparkId,
    })
  }

  return { success: true, data: undefined }
}

/**
 * Get comments on a spark entry.
 *
 * NOTE: There is no `sparkEntryComments` table in the current schema.
 * This action returns an empty list until a migration adds that table.
 * The add action below is similarly a no-op stub.
 */
export async function getSparkEntryCommentsAction(
  _entryId: string,
  _page = 1
): Promise<ActionResult<{ comments: EntryComment[]; hasMore: boolean }>> {
  // TODO: Migrate to add a sparkEntryComments table, then implement this.
  return { success: true, data: { comments: [], hasMore: false } }
}

/**
 * Add a comment to a spark entry.
 *
 * NOTE: There is no `sparkEntryComments` table in the current schema.
 * This action is a stub until a migration adds that table.
 */
export async function addSparkEntryCommentAction(
  _entryId: string,
  _content: string
): Promise<ActionResult<EntryComment>> {
  await requireAuth()
  // TODO: Migrate to add a sparkEntryComments table, then implement this.
  return { success: false, error: 'NOT_IMPLEMENTED' }
}
