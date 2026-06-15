import { describe, it, expect } from 'vitest'
import { stitchTiers } from '../stitch-tiers'

const QUOTAS = { tier1: 6, tier2: 4, tier3: 2 }
const PAGE_SIZE = 12

describe('stitchTiers', () => {
  it('returns empty when all tiers are empty', () => {
    expect(stitchTiers({ t1: [], t2: [], t3: [], page: 1, pageSize: PAGE_SIZE, quotas: QUOTAS })).toEqual([])
  })

  it('page 1 with all tiers full → 6 from t1, 4 from t2, 2 from t3', () => {
    const t1 = Array.from({ length: 60 }, (_, i) => `t1-${i}`)
    const t2 = Array.from({ length: 60 }, (_, i) => `t2-${i}`)
    const t3 = Array.from({ length: 60 }, (_, i) => `t3-${i}`)
    const result = stitchTiers({ t1, t2, t3, page: 1, pageSize: PAGE_SIZE, quotas: QUOTAS })
    expect(result).toEqual([
      't1-0', 't1-1', 't1-2', 't1-3', 't1-4', 't1-5',
      't2-0', 't2-1', 't2-2', 't2-3',
      't3-0', 't3-1',
    ])
  })

  it('page 2 walks forward through each tier', () => {
    const t1 = Array.from({ length: 60 }, (_, i) => `t1-${i}`)
    const t2 = Array.from({ length: 60 }, (_, i) => `t2-${i}`)
    const t3 = Array.from({ length: 60 }, (_, i) => `t3-${i}`)
    const result = stitchTiers({ t1, t2, t3, page: 2, pageSize: PAGE_SIZE, quotas: QUOTAS })
    expect(result).toEqual([
      't1-6', 't1-7', 't1-8', 't1-9', 't1-10', 't1-11',
      't2-4', 't2-5', 't2-6', 't2-7',
      't3-2', 't3-3',
    ])
  })

  it('tier1 short on page 1 → tier2 backfills to keep page at pageSize', () => {
    const t1 = ['t1-0', 't1-1', 't1-2']
    const t2 = Array.from({ length: 60 }, (_, i) => `t2-${i}`)
    const t3 = Array.from({ length: 60 }, (_, i) => `t3-${i}`)
    const result = stitchTiers({ t1, t2, t3, page: 1, pageSize: PAGE_SIZE, quotas: QUOTAS })
    expect(result).toHaveLength(12)
    expect(result.slice(0, 3)).toEqual(['t1-0', 't1-1', 't1-2'])
    expect(result.slice(3, 10)).toEqual(['t2-0', 't2-1', 't2-2', 't2-3', 't2-4', 't2-5', 't2-6'])
    expect(result.slice(10)).toEqual(['t3-0', 't3-1'])
  })

  it('t1 and t2 both empty → t3 fills all 12', () => {
    const t3 = Array.from({ length: 30 }, (_, i) => `t3-${i}`)
    const result = stitchTiers({ t1: [], t2: [], t3, page: 1, pageSize: PAGE_SIZE, quotas: QUOTAS })
    expect(result).toEqual(Array.from({ length: 12 }, (_, i) => `t3-${i}`))
  })

  it('all tiers short → returns short page (no error)', () => {
    const result = stitchTiers({
      t1: ['t1-0'], t2: ['t2-0'], t3: ['t3-0'],
      page: 1, pageSize: PAGE_SIZE, quotas: QUOTAS,
    })
    expect(result).toEqual(['t1-0', 't2-0', 't3-0'])
  })

  it('page beyond available rows → returns empty', () => {
    const result = stitchTiers({
      t1: ['t1-0', 't1-1'], t2: ['t2-0'], t3: [],
      page: 5, pageSize: PAGE_SIZE, quotas: QUOTAS,
    })
    expect(result).toEqual([])
  })

  it('does not mutate input arrays', () => {
    const t1 = ['t1-0', 't1-1']
    const t2 = ['t2-0']
    const t3 = ['t3-0']
    stitchTiers({ t1, t2, t3, page: 1, pageSize: PAGE_SIZE, quotas: QUOTAS })
    expect(t1).toEqual(['t1-0', 't1-1'])
    expect(t2).toEqual(['t2-0'])
    expect(t3).toEqual(['t3-0'])
  })
})
