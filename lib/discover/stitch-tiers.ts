/**
 * Stitches three tiers of candidate rows into a single paged result, with
 * a per-page tier quota (e.g. 6/4/2 for a 12-card page) and tier overflow:
 * if a higher-priority tier is short on this page, lower tiers backfill.
 *
 * Walks forward through each tier in lock-step per page:
 *   page 1: t1[0..quota.tier1] + t2[0..quota.tier2] + t3[0..quota.tier3]
 *   page 2: t1[quota.tier1..2×quota.tier1] + ...
 *
 * Overflow: if tier1's slice on this page is shorter than its quota, the
 * remainder is taken from tier2's slice (extending it past quota.tier2);
 * same chain from tier2 → tier3 → done. The backfilled rows are inserted
 * in tier order (t1, then extended t2, then extended t3) so that the
 * higher-priority tier's backfill sits before the next tier begins.
 */
export function stitchTiers<T>(opts: {
  t1: T[]
  t2: T[]
  t3: T[]
  page: number
  pageSize: number
  quotas: { tier1: number; tier2: number; tier3: number }
}): T[] {
  const { t1, t2, t3, page, pageSize, quotas } = opts

  const start1 = (page - 1) * quotas.tier1
  const end1 = start1 + quotas.tier1
  const start2 = (page - 1) * quotas.tier2
  const end2 = start2 + quotas.tier2
  const start3 = (page - 1) * quotas.tier3
  const end3 = start3 + quotas.tier3

  const slice1 = t1.slice(start1, end1)
  const slice2 = t2.slice(start2, end2)
  const slice3 = t3.slice(start3, end3)

  // Compute backfill from t2 → t1's shortfall, kept after slice2.
  const shortfall1 = quotas.tier1 - slice1.length
  const extra2 = shortfall1 > 0 ? t2.slice(end2, end2 + shortfall1) : []

  // Compute backfill from t3 → (t1+t2)'s remaining shortfall, kept after slice3.
  const filledSoFar = slice1.length + slice2.length + extra2.length + slice3.length
  const shortfall2 = pageSize - filledSoFar
  const extra3 = shortfall2 > 0 ? t3.slice(end3, end3 + shortfall2) : []

  // Final assembly: t1's slice, then t2's slice + t2 backfill, then t3's slice + t3 backfill.
  const result: T[] = [
    ...slice1,
    ...slice2,
    ...extra2,
    ...slice3,
    ...extra3,
  ]

  return result.slice(0, pageSize)
}
