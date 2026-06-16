import { describe, it, expect } from 'vitest'
import { pickHiveGhosts, type HiveGhostVariant } from '../pick-hive-ghosts'

const ctx = {
  ownCount: 1,
  hasSoloHive: true,
  hasActiveWordGoal: false,
  hasRecentBuzz: false,
  dismissed: new Set<HiveGhostVariant>(),
}

describe('pickHiveGhosts', () => {
  it('returns 5 ghosts when realCount = 0 (cap hits first)', () => {
    expect(pickHiveGhosts({ tab: 'all', realCount: 0, ...ctx })).toHaveLength(5)
  })

  it('returns 5 ghosts when realCount = 1 (total reaches 6)', () => {
    expect(pickHiveGhosts({ tab: 'all', realCount: 1, ...ctx })).toHaveLength(5)
  })

  it('returns 0 ghosts when realCount = 6', () => {
    expect(pickHiveGhosts({ tab: 'all', realCount: 6, ...ctx })).toHaveLength(0)
  })

  it("member tab + realCount=0 → first ghost is join-open", () => {
    const ghosts = pickHiveGhosts({ tab: 'member', realCount: 0, ...ctx })
    expect(ghosts[0]).toBe('join-open')
  })

  it('dismissed create-hive on all tab → result excludes create-hive', () => {
    const dismissed = new Set<HiveGhostVariant>(['create-hive'])
    const ghosts = pickHiveGhosts({ tab: 'all', realCount: 0, ...ctx, dismissed })
    expect(ghosts).not.toContain('create-hive')
  })

  it('hasActiveWordGoal=true + tab=yours → result excludes set-word-goal', () => {
    const ghosts = pickHiveGhosts({
      tab: 'yours',
      realCount: 0,
      ...ctx,
      hasActiveWordGoal: true,
    })
    expect(ghosts).not.toContain('set-word-goal')
  })
})
