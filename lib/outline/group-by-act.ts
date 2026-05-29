import type { Beat as ExistingBeat } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

// Beat shape used by H2 — adds optional `act`.
export type ActBeat = ExistingBeat & { act?: string | null }

export type ActGroup = {
  /** null = ungrouped (collapsible "No Act" group; only rendered if non-empty) */
  act: string | null
  beats: ActBeat[]
}

/**
 * Groups beats into act blocks while preserving input order both BETWEEN groups
 * (first appearance of a given act name wins its position) and WITHIN groups.
 * Ungrouped beats (`act` null/undefined/empty) collect into a single null-keyed
 * group surfaced at the top of the returned array.
 */
export function groupBeatsByAct(beats: readonly ActBeat[]): ActGroup[] {
  const ungrouped: ActBeat[] = []
  const orderedActs: string[] = []
  const byAct = new Map<string, ActBeat[]>()

  for (const b of beats) {
    const a = (b.act ?? '').trim()
    if (!a) {
      ungrouped.push(b)
      continue
    }
    if (!byAct.has(a)) {
      byAct.set(a, [])
      orderedActs.push(a)
    }
    byAct.get(a)!.push(b)
  }

  const groups: ActGroup[] = []
  if (ungrouped.length) groups.push({ act: null, beats: ungrouped })
  for (const a of orderedActs) groups.push({ act: a, beats: byAct.get(a)! })
  return groups
}

/** Distinct act names in order of first appearance — for autocomplete on the
 *  per-act header input. Excludes null/empty. */
export function distinctActs(beats: readonly ActBeat[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of beats) {
    const a = (b.act ?? '').trim()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
  return out
}
