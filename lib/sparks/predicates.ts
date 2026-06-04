import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';
import type { SparkVisibility, SparkStatus } from '@/db/schema/social';

/**
 * Minimal shape required by the spark predicates. Callers may pass any object
 * containing at least the creator id and visibility; `status` is required for
 * the enter/vote predicates but optional for `canViewSpark`.
 */
type SparkLike = {
  creatorId: string;
  visibility: SparkVisibility;
  status?: SparkStatus;
};

/**
 * Can the viewer read a spark's details (prompt, entries when visible, etc.)?
 *
 *  - Bidirectional block always denies.
 *  - PUBLIC: anyone (incl. anonymous).
 *  - PRIVATE: creator only.
 *  - FRIENDS: creator + mutual-accepted friends; anonymous always denied.
 */
export async function canViewSpark(
  viewerId: string | null,
  spark: SparkLike,
): Promise<boolean> {
  if (viewerId && (await isBlocked(viewerId, spark.creatorId))) return false;
  if (spark.visibility === 'PUBLIC') return true;
  if (spark.visibility === 'PRIVATE') return viewerId === spark.creatorId;
  // FRIENDS
  if (!viewerId) return false;
  if (viewerId === spark.creatorId) return true;
  return await areFriends(viewerId, spark.creatorId);
}

/**
 * Can the viewer submit a new entry to the spark?
 * Requires auth, non-creator, OPEN status, and view access.
 */
export async function canEnterSpark(
  viewerId: string | null,
  spark: SparkLike,
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === spark.creatorId) return false;
  if (spark.status !== 'OPEN') return false;
  return await canViewSpark(viewerId, spark);
}

/**
 * Can the viewer vote on the spark's entries?
 * Requires auth, VOTING status, and view access.
 */
export async function canVoteSpark(
  viewerId: string | null,
  spark: SparkLike,
): Promise<boolean> {
  if (!viewerId) return false;
  if (spark.status !== 'VOTING') return false;
  return await canViewSpark(viewerId, spark);
}
