import { createId } from '@paralleldrive/cuid2';
import { db } from '@/db';
import { readingLists } from '@/db/schema/social';

/**
 * Lazy-create the user's Liked auto-list (kind='LIKED'). Idempotent via the
 * partial unique index `reading_lists_user_liked_unique ON (user_id) WHERE kind='LIKED'`
 * shipped in C3 T1 step 5. Best-effort: failure is logged but never throws to
 * the caller (mirrors C1 record-activity precedent — Liked-list creation must
 * not block the like itself).
 */
export async function ensureLikedListAction(userId: string): Promise<void> {
  try {
    await db
      .insert(readingLists)
      .values({
        id: createId(),
        userId,
        kind: 'LIKED',
        title: 'Liked',
        visibility: 'PUBLIC',
        discoverable: false,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.warn('[ensureLikedListAction] best-effort failure:', err);
  }
}
