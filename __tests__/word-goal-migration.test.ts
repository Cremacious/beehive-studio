import { describe, expect, it, beforeEach, vi } from 'vitest'
import { migrateLegacyWordGoal } from '@/lib/word-goal-migration'

describe('migrateLegacyWordGoal', () => {
  // In-memory localStorage mock so each test starts clean
  beforeEach(() => {
    const store = new Map<string, string>()
    const ls = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: () => null,
      length: 0,
    }
    vi.stubGlobal('localStorage', ls)
    vi.stubGlobal('window', { localStorage: ls })
  })

  it('returns null when no localStorage entry exists', () => {
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })

  it('returns the localStorage value when DB goal is 0 and key exists', () => {
    localStorage.setItem('wcg:item-1', '5000')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(5000)
    expect(localStorage.getItem('wcg:item-1')).toBe(null)
  })

  it('returns null and clears stale localStorage when DB goal is already set', () => {
    localStorage.setItem('wcg:item-1', '5000')
    expect(migrateLegacyWordGoal('item-1', 2000)).toBe(null)
    expect(localStorage.getItem('wcg:item-1')).toBe(null)
  })

  it('returns null when the localStorage value is not a valid number', () => {
    localStorage.setItem('wcg:item-1', 'not-a-number')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })

  it('returns null when the localStorage value is "0"', () => {
    localStorage.setItem('wcg:item-1', '0')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })

  it('returns null when the localStorage value is negative', () => {
    localStorage.setItem('wcg:item-1', '-100')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })
})
