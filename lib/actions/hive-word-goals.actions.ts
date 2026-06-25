'use server'

import { cache } from 'react'
import { db } from '@/db'
import { hiveWordGoals, hiveWordLogs } from '@/db/schema/hive'
import { userProfiles } from '@/db/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canSetWordGoal, type HiveRole } from '@/lib/hive/permissions'
import {
  computeGoalEndDate,
  pickPrimaryActiveGoal,
  aggregateGoalProgress,
  aggregateContributorBreakdown,
  type WordGoalRow,
  type WordGoalType,
  type WordLogRow,
} from '@/lib/hive/goal-progress'
import {
  createWordGoalSchema,
  updateWordGoalSchema,
  type CreateWordGoalInput,
  type UpdateWordGoalInput,
} from '@/lib/validations/hive-word-goals'
import { runAction } from './safe-action'
import type { ActionResult } from './book.actions'

// ── Public types ────────────────────────────────────────────────────────────

export interface WordGoalRecord extends WordGoalRow {
  hiveId: string
  createdBy: string
  createdAt: Date
}

export interface ContributorBreakdownRow {
  userId: string
  username: string | null
  avatarUrl: string | null
  wordsContributed: number
}

export interface RecentLogRow {
  id: string
  userId: string
  username: string | null
  avatarUrl: string | null
  chapterId: string
  wordsAdded: number
  loggedAt: Date
}

export interface WordGoalProgressData {
  goal: WordGoalRecord
  progress: number
  contributors: ContributorBreakdownRow[]
  recentLogs: RecentLogRow[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toGoalRecord(row: typeof hiveWordGoals.$inferSelect): WordGoalRecord {
  return {
    id: row.id,
    hiveId: row.hiveId,
    createdBy: row.createdBy,
    type: row.type as WordGoalType,
    targetWords: row.targetWords,
    startDate: row.startDate,
    endDate: row.endDate,
    isActive: row.isActive,
    createdAt: row.createdAt,
  }
}

/** Postgres unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}

// ── createWordGoalAction ────────────────────────────────────────────────────

export async function createWordGoalAction(
  input: CreateWordGoalInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = createWordGoalSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { hiveId, type, targetWords, startDate, endDate } = parsed.data

  let role: HiveRole
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canSetWordGoal(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const start = startDate ?? new Date()
  const resolvedEnd =
    endDate === undefined ? computeGoalEndDate(type, start) : endDate

  let newId: string | null = null
  try {
    await db.transaction(async (tx) => {
      // Archive any existing active goal of this type in the same tx so the
      // partial-unique index on (hive_id, type) WHERE is_active=true doesn't trip.
      await tx
        .update(hiveWordGoals)
        .set({ isActive: false, endDate: sql`now()` })
        .where(
          and(
            eq(hiveWordGoals.hiveId, hiveId),
            eq(hiveWordGoals.type, type),
            eq(hiveWordGoals.isActive, true),
          ),
        )

      const inserted = await tx
        .insert(hiveWordGoals)
        .values({
          hiveId,
          createdBy: userId,
          type,
          targetWords,
          startDate: start,
          endDate: resolvedEnd,
          isActive: true,
        })
        .returning({ id: hiveWordGoals.id })
      newId = inserted[0]?.id ?? null
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Race: another writer landed an active goal of the same type between
      // our archive sweep and our insert. Treat as recoverable.
      return { success: false, error: 'GOAL_ALREADY_ACTIVE' }
    }
    throw err
  }

  if (!newId) return { success: false, error: 'UNKNOWN' }
  return { success: true, data: { id: newId } }
  })
}

// ── updateWordGoalAction ────────────────────────────────────────────────────

export async function updateWordGoalAction(
  input: UpdateWordGoalInput,
): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = updateWordGoalSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { id, targetWords, endDate } = parsed.data

  const goal = await db.query.hiveWordGoals.findFirst({
    where: eq(hiveWordGoals.id, id),
    columns: { id: true, hiveId: true },
  })
  if (!goal) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(goal.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canSetWordGoal(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const patch: { targetWords?: number; endDate?: Date | null } = {}
  if (targetWords !== undefined) patch.targetWords = targetWords
  if (endDate !== undefined) patch.endDate = endDate

  if (Object.keys(patch).length === 0) {
    return { success: true, data: undefined }
  }

  await db.update(hiveWordGoals).set(patch).where(eq(hiveWordGoals.id, id))

  return { success: true, data: undefined }
  })
}

// ── archiveWordGoalAction ───────────────────────────────────────────────────

export async function archiveWordGoalAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  if (!id) return { success: false, error: 'INVALID_INPUT' }

  const goal = await db.query.hiveWordGoals.findFirst({
    where: eq(hiveWordGoals.id, id),
    columns: { id: true, hiveId: true },
  })
  if (!goal) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(goal.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canSetWordGoal(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  await db
    .update(hiveWordGoals)
    .set({ isActive: false, endDate: sql`now()` })
    .where(eq(hiveWordGoals.id, id))

  return { success: true, data: undefined }
  })
}

// ── listHiveWordGoalsAction ─────────────────────────────────────────────────

export async function listHiveWordGoalsAction(
  hiveId: string,
): Promise<ActionResult<WordGoalRecord[]>> {
  return runAction(async () => {
  const userId = await requireAuth()
  if (!hiveId) return { success: false, error: 'INVALID_INPUT' }

  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // Lazy-archive sweep: any active goal whose end_date has passed becomes inactive.
  await db
    .update(hiveWordGoals)
    .set({ isActive: false })
    .where(
      and(
        eq(hiveWordGoals.hiveId, hiveId),
        eq(hiveWordGoals.isActive, true),
        sql`${hiveWordGoals.endDate} IS NOT NULL`,
        sql`${hiveWordGoals.endDate} < now()`,
      ),
    )

  const rows = await db
    .select()
    .from(hiveWordGoals)
    .where(eq(hiveWordGoals.hiveId, hiveId))
    .orderBy(desc(hiveWordGoals.isActive), desc(hiveWordGoals.createdAt))

  return { success: true, data: rows.map(toGoalRecord) }
  })
}

// ── getWordGoalProgressAction ───────────────────────────────────────────────

export async function getWordGoalProgressAction(input: {
  goalId: string
}): Promise<ActionResult<WordGoalProgressData>> {
  return runAction(async () => {
  const userId = await requireAuth()
  if (!input?.goalId) return { success: false, error: 'INVALID_INPUT' }

  const goalRow = await db.query.hiveWordGoals.findFirst({
    where: eq(hiveWordGoals.id, input.goalId),
  })
  if (!goalRow) return { success: false, error: 'NOT_FOUND' }

  try {
    await requireHiveMember(goalRow.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const goal = toGoalRecord(goalRow)

  // Pull every log for this hive in the [start, end) window. The aggregation
  // helpers double-check the window so we can simplify the SQL bound to the
  // hive id and rely on the helpers' filtering.
  const logsRaw = await db
    .select({
      id: hiveWordLogs.id,
      userId: hiveWordLogs.userId,
      chapterId: hiveWordLogs.chapterId,
      wordsAdded: hiveWordLogs.wordsAdded,
      loggedAt: hiveWordLogs.loggedAt,
    })
    .from(hiveWordLogs)
    .where(eq(hiveWordLogs.hiveId, goal.hiveId))
    .orderBy(desc(hiveWordLogs.loggedAt))

  const logsForAgg: WordLogRow[] = logsRaw.map((l) => ({
    userId: l.userId,
    wordsAdded: l.wordsAdded,
    loggedAt: l.loggedAt,
  }))

  const progress = aggregateGoalProgress(goal, logsForAgg)
  const breakdown = aggregateContributorBreakdown(goal, logsForAgg)

  // Resolve userProfiles for contributors + recent logs.
  const inWindowLogs = logsRaw.filter((l) => {
    if (l.loggedAt < goal.startDate) return false
    if (goal.endDate && l.loggedAt >= goal.endDate) return false
    return true
  })

  const distinctUserIds = Array.from(
    new Set<string>([
      ...breakdown.keys(),
      ...inWindowLogs.slice(0, 20).map((l) => l.userId),
    ]),
  )

  const profiles = distinctUserIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, distinctUserIds),
        columns: { userId: true, username: true, avatarUrl: true },
      })
    : []
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]))

  const contributors: ContributorBreakdownRow[] = Array.from(breakdown.entries())
    .map(([uid, words]) => {
      const prof = profileByUserId.get(uid)
      return {
        userId: uid,
        username: prof?.username ?? null,
        avatarUrl: prof?.avatarUrl ?? null,
        wordsContributed: words,
      }
    })
    .sort((a, b) => b.wordsContributed - a.wordsContributed)

  const recentLogs: RecentLogRow[] = inWindowLogs.slice(0, 20).map((l) => {
    const prof = profileByUserId.get(l.userId)
    return {
      id: l.id,
      userId: l.userId,
      username: prof?.username ?? null,
      avatarUrl: prof?.avatarUrl ?? null,
      chapterId: l.chapterId,
      wordsAdded: l.wordsAdded,
      loggedAt: l.loggedAt,
    }
  })

  return {
    success: true,
    data: { goal, progress, contributors, recentLogs },
  }
  })
}

// ── getActiveWordGoalSummaryAction ──────────────────────────────────────────

/**
 * Returns the highest-priority active goal + its progress, or null.
 * Wrapped in React `cache()` so the hive shell + Word Goals page share one
 * query within a single request.
 */
export const getActiveWordGoalSummaryAction = cache(
  async (
    hiveId: string,
  ): Promise<ActionResult<{ goal: WordGoalRecord; progress: number } | null>> => {
    return runAction(async () => {
    const userId = await requireAuth()
    if (!hiveId) return { success: false, error: 'INVALID_INPUT' }

    try {
      await requireHiveMember(hiveId, userId)
    } catch {
      return { success: false, error: 'NOT_AUTHORIZED' }
    }

    const rows = await db
      .select()
      .from(hiveWordGoals)
      .where(
        and(eq(hiveWordGoals.hiveId, hiveId), eq(hiveWordGoals.isActive, true)),
      )

    const goals = rows.map(toGoalRecord)
    const primary = pickPrimaryActiveGoal(goals)
    if (!primary) return { success: true, data: null }

    const logsRaw = await db
      .select({
        userId: hiveWordLogs.userId,
        wordsAdded: hiveWordLogs.wordsAdded,
        loggedAt: hiveWordLogs.loggedAt,
      })
      .from(hiveWordLogs)
      .where(eq(hiveWordLogs.hiveId, hiveId))

    const progress = aggregateGoalProgress(primary, logsRaw)

    return { success: true, data: { goal: primary as WordGoalRecord, progress } }
    })
  },
)
