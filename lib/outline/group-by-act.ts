import type { Beat as ExistingBeat } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

// Beat shape used by H2 — adds optional `act`.
export type ActBeat = ExistingBeat & { act?: string | null }

export type ActGroup = {
  /** null = ungrouped ("No Act") */
  act: string | null
  beats: ActBeat[]
}

/**
 * Groups beats into act blocks.
 *
 * - When `actsOrder` is provided, returns groups in that order. Acts listed
 *   in actsOrder that have zero beats still produce an empty group (needed
 *   so the empty-drop-zone can render).
 * - When `actsOrder` is undefined, falls back to insertion order: ungrouped
 *   first, then named acts in order of first appearance.
 * - Beats whose act is not present in actsOrder fall into a synthesized
 *   trailing group (so no data is lost if actsOrder gets out of sync).
 */
export function groupBeatsByAct(
  beats: readonly ActBeat[],
  actsOrder?: ReadonlyArray<string | null>,
): ActGroup[] {
  const byAct = new Map<string | null, ActBeat[]>()
  for (const b of beats) {
    const key = ((b.act ?? '').trim() || null) as string | null
    if (!byAct.has(key)) byAct.set(key, [])
    byAct.get(key)!.push(b)
  }

  if (actsOrder && actsOrder.length > 0) {
    const groups: ActGroup[] = []
    const seen = new Set<string | null>()
    for (const key of actsOrder) {
      const normKey = (typeof key === 'string' ? key.trim() : null) || null
      seen.add(normKey)
      groups.push({ act: normKey, beats: byAct.get(normKey) ?? [] })
    }
    // Trailing groups for acts present in beats but missing from actsOrder.
    for (const [key, list] of byAct) {
      if (!seen.has(key)) groups.push({ act: key, beats: list })
    }
    return groups
  }

  // Legacy fallback — insertion order, ungrouped first.
  const ungrouped = byAct.get(null) ?? []
  const groups: ActGroup[] = []
  if (ungrouped.length) groups.push({ act: null, beats: ungrouped })
  const seen = new Set<string | null>([null])
  for (const b of beats) {
    const key = ((b.act ?? '').trim() || null) as string | null
    if (seen.has(key)) continue
    seen.add(key)
    groups.push({ act: key, beats: byAct.get(key)! })
  }
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
