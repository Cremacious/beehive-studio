'use server'

// Schema notes (divergences from the plan code, captured here for future readers):
// - follows table uses followerId / followeeId (NOT followingId).
// - userProfiles uses avatarUrl (NOT image). We alias to `image` in FeedAuthor.
// - books has no publishedAt column; "published" = status='PUBLISHED'. We use
//   books.updatedAt as the publish timestamp for new_book items (the row is
//   touched when publishBookAction sets status, see lib/actions/book.actions.ts).
// - chapters table has no publishedAt either. Per spec §10 we fall back to
//   binderItems.updatedAt for chapter feed items, scoped to chapters whose
//   parent book is PUBLISHED.
// - sparks uses `title` for the prompt text (NOT `prompt`).
// - userProfiles.username is nullable; we filter rows missing a username out so
//   FeedAuthor.username is always a string.

import { db } from '@/db'
import { books, sparks, sparkEntries, follows, users, userProfiles } from '@/db/schema'
import { and, eq, notInArray, or, isNull, sql, gte, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'
import type { SuggestedWriter, ActiveSparkEntry } from '@/lib/types/community'

// getCommunityFeedAction removed in H1-T10 — replaced by getHiveActivityFeedAction
// (lib/actions/hive-activity.actions.ts). Page wiring lands in H1-T14.

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
