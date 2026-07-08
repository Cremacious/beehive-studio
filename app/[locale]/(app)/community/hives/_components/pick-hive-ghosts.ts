import type { HivesTab } from './hives-tab-strip'

export type HiveGhostVariant =
  | 'create-hive'
  | 'join-open'
  | 'invite-collaborators'
  | 'set-word-goal'
  | 'try-standalone'
  | 'set-buzz-up'

export type PickHiveGhostsInput = {
  tab: HivesTab
  realCount: number
  ownCount: number
  hasSoloHive: boolean
  hasActiveWordGoal: boolean
  hasRecentBuzz: boolean
  dismissed: Set<HiveGhostVariant>
}

const GHOST_MAX = 5
const TARGET_TOTAL = 6

/**
 * Pure selection: returns an ordered list of hive-ghost variants to render after
 * real cards. Honors the cap: 5 max OR until total reaches 6, whichever first.
 */
export function pickHiveGhosts(input: PickHiveGhostsInput): HiveGhostVariant[] {
  const { tab, realCount, ownCount, hasSoloHive, hasActiveWordGoal, hasRecentBuzz, dismissed } =
    input

  if (realCount >= TARGET_TOTAL) return []
  const room = Math.min(GHOST_MAX, TARGET_TOTAL - realCount)
  if (room <= 0) return []

  let priority: HiveGhostVariant[]
  switch (tab) {
    case 'member':
      priority = [
        'join-open',
        'create-hive',
        'try-standalone',
        'set-buzz-up',
        'invite-collaborators',
        'set-word-goal',
      ]
      break
    case 'suggested':
      priority = [
        'create-hive',
        'try-standalone',
        'join-open',
        'invite-collaborators',
        'set-word-goal',
        'set-buzz-up',
      ]
      break
    case 'yours':
    case 'all':
    default:
      priority = [
        'create-hive',
        'invite-collaborators',
        'set-word-goal',
        'join-open',
        'try-standalone',
        'set-buzz-up',
      ]
      break
  }

  const out: HiveGhostVariant[] = []
  for (const v of priority) {
    if (out.length >= room) break
    if (dismissed.has(v)) continue
    // Conditional filters
    if (v === 'invite-collaborators' && !hasSoloHive) continue
    // set-word-goal deep-links to an owned hive's word-goals page; hide it when
    // the viewer owns no hive (ownCount === 0) so the CTA never dead-ends on the
    // hub, and when a goal is already active.
    if (v === 'set-word-goal' && (hasActiveWordGoal || ownCount === 0)) continue
    if (v === 'set-buzz-up' && (hasRecentBuzz || ownCount === 0)) continue
    out.push(v)
  }
  return out
}
