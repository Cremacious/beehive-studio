import { describe, it, expect } from 'vitest'
import { pickGhosts, type GhostVariant } from '../pick-ghosts'

const ctx = {
  followingCount: 0,
  friendsCount: 0,
  enteredCount: 0,
  ownCount: 0,
  dismissed: new Set<GhostVariant>(),
}

describe('pickGhosts', () => {
  it('returns 0 ghosts when realCount >= 6', () => {
    expect(pickGhosts({ tab: 'all', realCount: 6, ...ctx })).toHaveLength(0)
    expect(pickGhosts({ tab: 'all', realCount: 12, ...ctx })).toHaveLength(0)
  })

  it('returns 5 ghosts when realCount = 0 (cap hits first)', () => {
    expect(pickGhosts({ tab: 'all', realCount: 0, ...ctx })).toHaveLength(5)
  })

  it('returns 5 ghosts when realCount = 1 (total reaches 6)', () => {
    expect(pickGhosts({ tab: 'all', realCount: 1, ...ctx })).toHaveLength(5)
  })

  it('returns 4 ghosts when realCount = 2', () => {
    expect(pickGhosts({ tab: 'all', realCount: 2, ...ctx })).toHaveLength(4)
  })

  it('returns 3 ghosts when realCount = 3', () => {
    expect(pickGhosts({ tab: 'all', realCount: 3, ...ctx })).toHaveLength(3)
  })

  it('returns 1 ghost when realCount = 5', () => {
    expect(pickGhosts({ tab: 'all', realCount: 5, ...ctx })).toHaveLength(1)
  })

  it('yours tab → first ghost is create-first when ownCount = 0', () => {
    const ghosts = pickGhosts({ tab: 'yours', realCount: 0, ...ctx })
    expect(ghosts[0]).toBe('create-first')
  })

  it('following tab → includes follow-writers ghost', () => {
    const ghosts = pickGhosts({ tab: 'following', realCount: 0, ...ctx })
    expect(ghosts).toContain('follow-writers')
  })

  it('friends tab → includes connect-friends ghost', () => {
    const ghosts = pickGhosts({ tab: 'friends', realCount: 0, ...ctx })
    expect(ghosts).toContain('connect-friends')
  })

  it('entered tab → includes enter-a-spark ghost', () => {
    const ghosts = pickGhosts({ tab: 'entered', realCount: 0, ...ctx })
    expect(ghosts).toContain('enter-a-spark')
  })

  it('dismissed ghosts are filtered out', () => {
    const dismissed = new Set<GhostVariant>(['follow-writers', 'connect-friends'])
    const ghosts = pickGhosts({ tab: 'all', realCount: 0, ...ctx, dismissed })
    expect(ghosts).not.toContain('follow-writers')
    expect(ghosts).not.toContain('connect-friends')
  })

  it('always includes from-discover when grid has < 6 real', () => {
    const ghosts = pickGhosts({ tab: 'all', realCount: 0, ...ctx })
    expect(ghosts).toContain('from-discover')
  })
})
