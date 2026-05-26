/**
 * One-shot migration of pre-SP5 word goals from localStorage to DB.
 *
 * Before SP5, word goals were stored in localStorage keyed as
 * `wcg:<binderItemId>`. SP5 moved them to chapters.wordGoal so they
 * sync across devices. On chapter load, we check whether a localStorage
 * value should be ported to the DB.
 *
 * Returns:
 *   - The value to write to DB if migration is needed (caller invokes
 *     updateChapterWordGoalAction with the returned number).
 *   - null if no migration is needed.
 *
 * In all cases where a localStorage key exists, it is removed — even
 * if the DB already has a value (the localStorage value is now stale
 * and cleanup keeps the user's storage tidy).
 *
 * Safe to call multiple times: idempotent because removing the key
 * makes subsequent calls return null.
 */
export function migrateLegacyWordGoal(
  binderItemId: string,
  currentDbGoal: number,
): number | null {
  if (typeof window === 'undefined') return null

  const key = `wcg:${binderItemId}`
  const raw = localStorage.getItem(key)
  if (raw === null) return null

  // Stale key cleanup — happens whether we migrate or not.
  localStorage.removeItem(key)

  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null

  // DB already has a non-zero goal — that wins. Don't overwrite.
  if (currentDbGoal > 0) return null

  return parsed
}
