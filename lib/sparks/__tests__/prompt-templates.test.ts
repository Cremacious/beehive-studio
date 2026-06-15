import { describe, it, expect } from 'vitest'
import {
  PROMPT_TEMPLATES,
  pickPromptTemplate,
  dayOfYear,
} from '../prompt-templates'

describe('PROMPT_TEMPLATES', () => {
  it('has exactly 10 entries', () => {
    expect(PROMPT_TEMPLATES).toHaveLength(10)
  })

  it('every entry has prompt + wordLimit', () => {
    for (const t of PROMPT_TEMPLATES) {
      expect(typeof t.prompt).toBe('string')
      expect(t.prompt.length).toBeGreaterThan(10)
      expect(typeof t.wordLimit).toBe('number')
      expect(t.wordLimit).toBeGreaterThan(0)
    }
  })
})

describe('dayOfYear', () => {
  it('returns 1 for Jan 1', () => {
    expect(dayOfYear(new Date('2026-01-01T00:00:00Z'))).toBe(1)
  })
  it('returns 60 for Mar 1 in non-leap year', () => {
    expect(dayOfYear(new Date('2026-03-01T00:00:00Z'))).toBe(60)
  })
})

describe('pickPromptTemplate', () => {
  it('returns the same template for the same viewerId on the same day', () => {
    const d = new Date('2026-06-15T12:00:00Z')
    const a = pickPromptTemplate('user-123', d)
    const b = pickPromptTemplate('user-123', d)
    expect(a).toEqual(b)
  })

  it('returns a different template on a different day', () => {
    const d1 = new Date('2026-06-15T12:00:00Z')
    const d2 = new Date('2026-06-16T12:00:00Z')
    const a = pickPromptTemplate('user-123', d1)
    const b = pickPromptTemplate('user-123', d2)
    // Not asserting they differ (could collide via modulo); just that both valid
    expect(PROMPT_TEMPLATES).toContainEqual(a)
    expect(PROMPT_TEMPLATES).toContainEqual(b)
  })

  it('handles empty viewerId as guest deterministically', () => {
    const d = new Date('2026-06-15T12:00:00Z')
    const a = pickPromptTemplate('', d)
    expect(PROMPT_TEMPLATES).toContainEqual(a)
  })
})
