/**
 * Given the current chapter word count and the sum of all prior log rows for
 * the same (user, chapter), compute the signed delta to log.
 *
 *  - First-ever log: priorSum=0, returns currentWordCount as-is (the "baseline").
 *  - Steady growth:  delta = currentWordCount - priorSum.
 *  - Deletion:       delta is negative.
 *  - Zero delta:     returns 0 (caller decides whether to skip the row).
 */
export function computeWordDelta(currentWordCount: number, priorSum: number): number {
  if (!Number.isFinite(currentWordCount) || currentWordCount < 0) return 0
  if (!Number.isFinite(priorSum)) priorSum = 0
  return currentWordCount - priorSum
}
