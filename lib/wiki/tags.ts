export const MAX_TAGS = 10

/** Lowercase + trim + drop empties + dedupe + cap at MAX_TAGS. */
export function normalizeTags(input: readonly string[] | undefined | null): string[] {
  if (!input) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    const t = raw.trim().toLowerCase()
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

/** Validate a single proposed new tag against an existing list. Returns the
 *  normalized form or null if the tag would be rejected. */
export function acceptTag(existing: readonly string[], candidate: string): string | null {
  const t = candidate.trim().toLowerCase()
  if (!t) return null
  if (existing.length >= MAX_TAGS) return null
  if (existing.includes(t)) return null
  return t
}
