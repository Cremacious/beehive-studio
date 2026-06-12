import { describe, it, expect } from 'vitest'
import { computeClubActivityScore7d } from '../club-activity-score'

describe('computeClubActivityScore7d', () => {
  it('returns 0 for all-zero inputs', () => {
    expect(computeClubActivityScore7d({
      discussions7d: 0, bookChanges7d: 0, newMembers7d: 0
    })).toBe(0)
  })
  it('weights book changes 3x in isolation', () => {
    expect(computeClubActivityScore7d({
      discussions7d: 0, bookChanges7d: 1, newMembers7d: 0
    })).toBe(3)
  })
  it('weights new members 2x in isolation', () => {
    expect(computeClubActivityScore7d({
      discussions7d: 0, bookChanges7d: 0, newMembers7d: 1
    })).toBe(2)
  })
  it('weights discussions 1x in isolation', () => {
    expect(computeClubActivityScore7d({
      discussions7d: 1, bookChanges7d: 0, newMembers7d: 0
    })).toBe(1)
  })
})
