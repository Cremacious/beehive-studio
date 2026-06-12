import { describe, it, expect } from 'vitest'
import { computeHiveActivityScore7d } from '../hive-activity-score'

describe('computeHiveActivityScore7d', () => {
  it('returns 0 for all-zero inputs', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 0, wordLogs7d: 0, discussions7d: 0, chapterUpdates7d: 0, submissions7d: 0
    })).toBe(0)
  })
  it('weights submissions highest (4x)', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 0, wordLogs7d: 0, discussions7d: 0, chapterUpdates7d: 0, submissions7d: 1
    })).toBe(4)
  })
  it('weights chapter updates 3x and discussions 2x', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 0, wordLogs7d: 0, discussions7d: 1, chapterUpdates7d: 1, submissions7d: 0
    })).toBe(5)
  })
  it('weights buzz posts 1x and word logs 0.5x', () => {
    expect(computeHiveActivityScore7d({
      buzzPosts7d: 1, wordLogs7d: 2, discussions7d: 0, chapterUpdates7d: 0, submissions7d: 0
    })).toBe(2)
  })
})
