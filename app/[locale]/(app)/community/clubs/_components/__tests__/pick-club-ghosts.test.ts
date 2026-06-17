import { describe, it, expect } from 'vitest'
import { pickClubGhosts, type ClubGhostVariant } from '../pick-club-ghosts'

const ctx = {
  ownCount: 1,
  hasSoloClub: true,
  hasNoCurrentBook: true,
  hasEmptyQueue: true,
  hasRecentDiscussion: false,
  dismissed: new Set<ClubGhostVariant>(),
}

describe('pickClubGhosts', () => {
  it('returns 5 ghosts when realCount = 0 (cap hits first)', () => {
    expect(pickClubGhosts({ tab: 'all', realCount: 0, ...ctx })).toHaveLength(5)
  })

  it('returns 5 ghosts when realCount = 1 (total reaches 6)', () => {
    expect(pickClubGhosts({ tab: 'all', realCount: 1, ...ctx })).toHaveLength(5)
  })

  it('returns 0 ghosts when realCount = 6', () => {
    expect(pickClubGhosts({ tab: 'all', realCount: 6, ...ctx })).toHaveLength(0)
  })

  it('member tab + realCount=0 → first ghost is join-suggested', () => {
    const ghosts = pickClubGhosts({ tab: 'member', realCount: 0, ...ctx })
    expect(ghosts[0]).toBe('join-suggested')
  })

  it('dismissed create-club on all tab → result excludes create-club', () => {
    const dismissed = new Set<ClubGhostVariant>(['create-club'])
    const ghosts = pickClubGhosts({ tab: 'all', realCount: 0, ...ctx, dismissed })
    expect(ghosts).not.toContain('create-club')
  })

  it('hasNoCurrentBook=false + tab=yours → result excludes set-current-book', () => {
    const ghosts = pickClubGhosts({
      tab: 'yours',
      realCount: 0,
      ...ctx,
      hasNoCurrentBook: false,
    })
    expect(ghosts).not.toContain('set-current-book')
  })
})
