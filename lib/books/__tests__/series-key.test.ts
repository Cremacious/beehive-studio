import { describe, it, expect } from 'vitest'
import { normalizeSeriesKey } from '../series-key'

describe('normalizeSeriesKey', () => {
  it('returns null for null input', () => {
    expect(normalizeSeriesKey(null)).toBe(null)
  })
  it('returns null for empty string', () => {
    expect(normalizeSeriesKey('')).toBe(null)
  })
  it('returns null for whitespace-only string', () => {
    expect(normalizeSeriesKey('   ')).toBe(null)
  })
  it('lowercases and drops leading "The "', () => {
    expect(normalizeSeriesKey('The Stormlight Archive')).toBe('stormlight archive')
  })
  it('produces same key as the no-leading-the version', () => {
    expect(normalizeSeriesKey('Stormlight Archive')).toBe('stormlight archive')
  })
  it('collapses internal whitespace and trims', () => {
    expect(normalizeSeriesKey('  STORMLIGHT  ARCHIVE  ')).toBe('stormlight archive')
  })
  it('preserves non-leading "the"', () => {
    expect(normalizeSeriesKey('Book of the Dead')).toBe('book of the dead')
  })
})
