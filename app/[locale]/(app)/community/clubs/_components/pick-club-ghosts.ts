import type { ClubsTab } from './clubs-tab-strip'

export type ClubGhostVariant =
  | 'create-club'
  | 'join-suggested'
  | 'invite-members'
  | 'set-current-book'
  | 'add-to-queue'
  | 'start-discussion'

export type PickClubGhostsInput = {
  tab: ClubsTab
  realCount: number
  ownCount: number
  hasSoloClub: boolean
  hasNoCurrentBook: boolean
  hasEmptyQueue: boolean
  hasRecentDiscussion: boolean
  dismissed: Set<ClubGhostVariant>
}

const GHOST_MAX = 5
const TARGET_TOTAL = 6

/**
 * Pure selection: returns an ordered list of club-ghost variants to render after
 * real cards. Honors the cap: 5 max OR until total reaches 6, whichever first.
 */
export function pickClubGhosts(input: PickClubGhostsInput): ClubGhostVariant[] {
  const {
    tab,
    realCount,
    ownCount,
    hasSoloClub,
    hasNoCurrentBook,
    hasEmptyQueue,
    hasRecentDiscussion,
    dismissed,
  } = input

  if (realCount >= TARGET_TOTAL) return []
  const room = Math.min(GHOST_MAX, TARGET_TOTAL - realCount)
  if (room <= 0) return []

  let priority: ClubGhostVariant[]
  switch (tab) {
    case 'member':
      priority = [
        'join-suggested',
        'create-club',
        'start-discussion',
        'invite-members',
        'set-current-book',
        'add-to-queue',
      ]
      break
    case 'suggested':
      priority = [
        'create-club',
        'join-suggested',
        'start-discussion',
        'invite-members',
        'set-current-book',
        'add-to-queue',
      ]
      break
    case 'yours':
    case 'all':
    default:
      priority = [
        'create-club',
        'set-current-book',
        'invite-members',
        'start-discussion',
        'add-to-queue',
        'join-suggested',
      ]
      break
  }

  const out: ClubGhostVariant[] = []
  for (const v of priority) {
    if (out.length >= room) break
    if (dismissed.has(v)) continue
    // Conditional filters
    if (v === 'set-current-book' && !hasNoCurrentBook) continue
    if (v === 'invite-members' && !hasSoloClub) continue
    if (v === 'start-discussion' && (ownCount === 0 || hasRecentDiscussion)) continue
    if (v === 'add-to-queue' && !hasEmptyQueue) continue
    out.push(v)
  }
  return out
}
