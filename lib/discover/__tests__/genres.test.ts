import { describe, it, expect } from 'vitest'
import { GENRES, isValidGenre, normalizeGenre } from '../genres'

describe('GENRES', () => {
  it('has exactly 14 entries', () => {
    expect(GENRES.length).toBe(14)
  })
})

describe('isValidGenre', () => {
  it('returns true for known slugs', () => {
    expect(isValidGenre('fantasy')).toBe(true)
    expect(isValidGenre('sci-fi')).toBe(true)
  })
  it('returns false for unknown / null / undefined', () => {
    expect(isValidGenre('xyz')).toBe(false)
    expect(isValidGenre(null)).toBe(false)
    expect(isValidGenre(undefined)).toBe(false)
  })
})

describe('normalizeGenre', () => {
  it('returns matching slug as-is', () => {
    expect(normalizeGenre('Fantasy')).toBe('fantasy')
  })
  it('coerces aliases', () => {
    expect(normalizeGenre('Science Fiction')).toBe('sci-fi')
    expect(normalizeGenre('Young Adult')).toBe('ya')
  })
  it('falls back to "other" for unknown', () => {
    expect(normalizeGenre('xyz')).toBe('other')
    expect(normalizeGenre(null)).toBe('other')
    expect(normalizeGenre('')).toBe('other')
  })
})
