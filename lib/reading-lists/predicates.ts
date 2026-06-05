import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';
import type { bookVisibilityEnum } from '@/db/schema/books';

type BookVisibility = (typeof bookVisibilityEnum.enumValues)[number];

/**
 * Minimal shape required by the reading-list predicates. Callers may pass any
 * object containing at least the owner id and visibility.
 */
type ListLike = {
  userId: string;
  visibility: BookVisibility;
};

/**
 * Can the viewer read the list and its books?
 *
 *  - Bidirectional block always denies.
 *  - PUBLIC: anyone (incl. anonymous).
 *  - PRIVATE: owner only.
 *  - FRIENDS: owner + mutual-accepted friends; anonymous always denied.
 *
 * Not React-cache()-wrapped: callers pass the list object directly so cache
 * keying would be brittle, and visibility changes mid-request should be
 * observable.
 */
export async function canViewList(
  viewerId: string | null,
  list: ListLike,
): Promise<boolean> {
  if (viewerId && (await isBlocked(viewerId, list.userId))) return false;
  if (list.visibility === 'PUBLIC') return true;
  if (list.visibility === 'PRIVATE') return viewerId === list.userId;
  // FRIENDS
  if (!viewerId) return false;
  if (viewerId === list.userId) return true;
  return await areFriends(viewerId, list.userId);
}

/**
 * Can the viewer edit the list (rename, change visibility, add/remove books,
 * reorder, etc.)? Single-owner model — only the list owner can edit.
 */
export function canEditList(
  viewerId: string | null,
  list: ListLike,
): boolean {
  return viewerId !== null && viewerId === list.userId;
}

/**
 * Can the viewer follow the list?
 *  - Requires auth.
 *  - Owner cannot follow their own list.
 *  - Otherwise inherits canViewList (includes block + FRIENDS checks).
 */
export async function canFollowList(
  viewerId: string | null,
  list: ListLike,
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === list.userId) return false;
  return await canViewList(viewerId, list);
}
