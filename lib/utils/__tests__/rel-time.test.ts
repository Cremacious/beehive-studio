import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { relTime } from '../rel-time'

describe('relTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "never" for null', () => {
    expect(relTime(null)).toBe('never')
  })

  it('returns "never" for undefined', () => {
    expect(relTime(undefined)).toBe('never')
  })

  it('returns "just now" for a date < 1 minute ago', () => {
    expect(relTime(new Date('2026-06-11T11:59:30Z'))).toBe('just now')
  })

  it('returns "2h ago" for a date 2 hours ago', () => {
    expect(relTime(new Date('2026-06-11T10:00:00Z'))).toBe('2h ago')
  })

  it('returns "3d ago" for a date 3 days ago', () => {
    expect(relTime(new Date('2026-06-08T12:00:00Z'))).toBe('3d ago')
  })

  it('returns "1y ago" for a date ~1 year ago', () => {
    expect(relTime(new Date('2025-06-11T12:00:00Z'))).toBe('1y ago')
  })
})
