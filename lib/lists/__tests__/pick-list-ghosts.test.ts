import { describe, it, expect } from 'vitest'
import { pickListGhosts, type ListGhostContext, type ListGhostVariant } from '../pick-list-ghosts'

const baseCtx: ListGhostContext = {
  tab: 'all',
  ownCount: 0,
  followingCount: 0,
  likedListEmpty: true,
  allListsAreUntagged: false,
  hasHighFollowerList: false,
  trendingFromFriend: null,
  dismissedKeys: new Set<string>(),
}

describe('pickListGhosts', () => {
  it('returns empty when ownCount + followingCount >= TARGET_TOTAL', () => {
    expect(pickListGhosts({ ...baseCtx, ownCount: 6, followingCount: 0 })).toHaveLength(0)
    expect(pickListGhosts({ ...baseCtx, ownCount: 3, followingCount: 3 })).toHaveLength(0)
    expect(pickListGhosts({ ...baseCtx, ownCount: 10, followingCount: 5 })).toHaveLength(0)
  })

  it('yours tab with ownCount === 0 pushes create-list first', () => {
    const ghosts = pickListGhosts({ ...baseCtx, tab: 'yours', ownCount: 0 })
    expect(ghosts[0]).toBe('create-list')
  })

  it('following tab with followingCount === 0 pushes follow-curator first', () => {
    const ghosts = pickListGhosts({ ...baseCtx, tab: 'following', followingCount: 0 })
    expect(ghosts[0]).toBe('follow-curator')
  })

  it('liked tab with likedListEmpty === true shows like-a-book', () => {
    const ghosts = pickListGhosts({ ...baseCtx, tab: 'liked', likedListEmpty: true })
    expect(ghosts).toContain('like-a-book')
  })

  it('dismissed variants filtered out', () => {
    const dismissedKeys = new Set<string>(['create-list', 'follow-curator'])
    const ghosts = pickListGhosts({ ...baseCtx, tab: 'all', dismissedKeys })
    expect(ghosts).not.toContain<ListGhostVariant>('create-list')
    expect(ghosts).not.toContain<ListGhostVariant>('follow-curator')
  })

  it('caps at GHOST_MAX = 5 even when many are eligible', () => {
    // All conditional gates open: trendingFromFriend set, hasHighFollowerList,
    // ownCount>0 + allListsAreUntagged, likedListEmpty, tab='all' (allows
    // like-a-book). All 6 variants eligible, but cap = 5.
    const ghosts = pickListGhosts({
      ...baseCtx,
      tab: 'all',
      ownCount: 1,
      followingCount: 0,
      likedListEmpty: true,
      allListsAreUntagged: true,
      hasHighFollowerList: true,
      trendingFromFriend: { title: 'Cosmic Horror Picks', curator: 'mira' },
    })
    expect(ghosts.length).toBeLessThanOrEqual(5)
    expect(ghosts).toHaveLength(5)
  })
})
