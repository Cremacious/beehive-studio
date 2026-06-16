export type ListGhostVariant =
  | 'create-list'
  | 'follow-curator'
  | 'themed-list-nudge'
  | 'trending-from-network'
  | 'like-a-book'
  | 'share-list-link'

export type ListGhostContext = {
  tab: 'all' | 'yours' | 'following' | 'liked'
  ownCount: number
  followingCount: number
  likedListEmpty: boolean
  allListsAreUntagged: boolean
  hasHighFollowerList: boolean
  trendingFromFriend: { title: string; curator: string } | null
  dismissedKeys: Set<string>
}

const GHOST_MAX = 5
const TARGET_TOTAL = 6

/**
 * Pure selection: returns an ordered list of list-ghost variants to render
 * after real cards. Honors the cap: 5 max OR until total reaches 6, whichever
 * first. Dismissed variants are filtered out AFTER priority/conditional
 * resolution.
 */
export function pickListGhosts(ctx: ListGhostContext): ListGhostVariant[] {
  const {
    tab,
    ownCount,
    followingCount,
    likedListEmpty,
    allListsAreUntagged,
    hasHighFollowerList,
    trendingFromFriend,
    dismissedKeys,
  } = ctx

  const realCount = ownCount + followingCount
  if (realCount >= TARGET_TOTAL) return []
  const room = Math.min(GHOST_MAX, TARGET_TOTAL - realCount)
  if (room <= 0) return []

  let priority: ListGhostVariant[]
  switch (tab) {
    case 'yours':
      priority =
        ownCount === 0
          ? [
              'create-list',
              'themed-list-nudge',
              'follow-curator',
              'trending-from-network',
              'like-a-book',
              'share-list-link',
            ]
          : [
              'themed-list-nudge',
              'create-list',
              'share-list-link',
              'follow-curator',
              'trending-from-network',
              'like-a-book',
            ]
      break
    case 'following':
      priority = [
        'follow-curator',
        'trending-from-network',
        'create-list',
        'themed-list-nudge',
        'like-a-book',
        'share-list-link',
      ]
      break
    case 'liked':
      priority = [
        'like-a-book',
        'follow-curator',
        'trending-from-network',
        'create-list',
        'themed-list-nudge',
        'share-list-link',
      ]
      break
    case 'all':
    default:
      priority = [
        'create-list',
        'follow-curator',
        'trending-from-network',
        'themed-list-nudge',
        'like-a-book',
        'share-list-link',
      ]
      break
  }

  const out: ListGhostVariant[] = []
  for (const v of priority) {
    if (out.length >= room) break
    // Conditional filters
    if (v === 'like-a-book' && !(tab === 'all' || tab === 'liked') ) continue
    if (v === 'like-a-book' && !likedListEmpty) continue
    if (v === 'share-list-link' && !hasHighFollowerList) continue
    if (v === 'trending-from-network' && trendingFromFriend === null) continue
    if (v === 'themed-list-nudge' && !(ownCount > 0 && allListsAreUntagged)) continue
    if (dismissedKeys.has(v)) continue
    out.push(v)
  }
  return out
}
