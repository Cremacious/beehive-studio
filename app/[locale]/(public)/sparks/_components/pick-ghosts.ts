import type { SparksTab } from './sparks-tab-strip'

export type GhostVariant =
  | 'from-discover'
  | 'follow-writers'
  | 'connect-friends'
  | 'prompt-template'
  | 'enter-a-spark'
  | 'create-first'

export type PickGhostsInput = {
  tab: SparksTab
  realCount: number
  followingCount: number
  friendsCount: number
  enteredCount: number
  ownCount: number
  dismissed: Set<GhostVariant>
}

const GHOST_MAX = 5
const TARGET_TOTAL = 6

/**
 * Pure selection: returns an ordered list of ghost variants to render after
 * real cards. Honors the cap: 5 max OR until total reaches 6, whichever first.
 */
export function pickGhosts(input: PickGhostsInput): GhostVariant[] {
  const { tab, realCount, followingCount, friendsCount, enteredCount, ownCount, dismissed } = input

  if (realCount >= TARGET_TOTAL) return []
  const room = Math.min(GHOST_MAX, TARGET_TOTAL - realCount)
  if (room <= 0) return []

  // Build ordered priority list per tab; filter to dismissed + room.
  let priority: GhostVariant[]
  switch (tab) {
    case 'yours':
      priority = ownCount === 0
        ? ['create-first', 'prompt-template', 'from-discover', 'prompt-template', 'from-discover']
        : ['prompt-template', 'prompt-template', 'from-discover', 'from-discover', 'from-discover']
      break
    case 'following':
      priority = ['follow-writers', 'from-discover', 'from-discover', 'prompt-template', 'from-discover']
      break
    case 'friends':
      priority = ['connect-friends', 'from-discover', 'from-discover', 'prompt-template', 'from-discover']
      break
    case 'entered':
      priority = ['enter-a-spark', 'from-discover', 'from-discover', 'prompt-template', 'from-discover']
      break
    case 'all':
    default: {
      const list: GhostVariant[] = ['from-discover']
      if (followingCount === 0) list.push('follow-writers')
      if (friendsCount === 0) list.push('connect-friends')
      list.push('prompt-template')
      if (enteredCount === 0) list.push('enter-a-spark')
      // Pad with extra from-discover if short
      while (list.length < 5) list.push('from-discover')
      priority = list
      break
    }
  }

  const out: GhostVariant[] = []
  for (const v of priority) {
    if (out.length >= room) break
    if (dismissed.has(v)) continue
    out.push(v)
  }
  return out
}
