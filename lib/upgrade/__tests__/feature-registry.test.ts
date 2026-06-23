// lib/upgrade/__tests__/feature-registry.test.ts
import { describe, it, expect } from 'vitest'
import { FEATURE_COPY, PREMIUM_BENEFITS, type GateKey } from '@/lib/upgrade/feature-registry'

const ALL_KEYS: GateKey[] = [
  'book-limit', 'version-history', 'publishing',
  'hive-members', 'overflow', 'import', 'writing-analysis',
]

describe('feature registry', () => {
  it('every gate key resolves copy with no em-dashes', () => {
    for (const key of ALL_KEYS) {
      const c = FEATURE_COPY[key]
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.benefit.length).toBeGreaterThan(0)
      expect(c.title.includes('—')).toBe(false)
      expect(c.benefit.includes('—')).toBe(false)
    }
  })

  it('premium benefits lead with the three headline features', () => {
    expect(PREMIUM_BENEFITS.slice(0, 3).map((b) => b.title)).toEqual([
      'Unlimited books', 'Version history', 'Unlimited hive members',
    ])
  })
})
