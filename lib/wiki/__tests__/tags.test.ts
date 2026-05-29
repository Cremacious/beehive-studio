import { describe, it, expect } from 'vitest'
import { normalizeTags, acceptTag, MAX_TAGS } from '../tags'

describe('normalizeTags', () => {
  it('returns [] for null / undefined / empty', () => {
    expect(normalizeTags(null)).toEqual([])
    expect(normalizeTags(undefined)).toEqual([])
    expect(normalizeTags([])).toEqual([])
  })
  it('lowercases and trims', () => {
    expect(normalizeTags([' Lore ', 'PLOT', 'hero'])).toEqual(['lore', 'plot', 'hero'])
  })
  it('dedupes after lowercasing', () => {
    expect(normalizeTags(['Lore', 'LORE', 'lore'])).toEqual(['lore'])
  })
  it('drops empty after trim', () => {
    expect(normalizeTags(['', ' '])).toEqual([])
  })
  it(`caps at MAX_TAGS (${MAX_TAGS})`, () => {
    const long = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `t${i}`)
    expect(normalizeTags(long)).toHaveLength(MAX_TAGS)
  })
})

describe('acceptTag', () => {
  it('returns normalized tag when valid', () => {
    expect(acceptTag(['lore'], ' Plot ')).toBe('plot')
  })
  it('returns null on dupe', () => {
    expect(acceptTag(['lore', 'plot'], 'LORE')).toBeNull()
  })
  it('returns null at cap', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(acceptTag(full, 'new')).toBeNull()
  })
  it('returns null on empty', () => {
    expect(acceptTag([], '   ')).toBeNull()
  })
})
