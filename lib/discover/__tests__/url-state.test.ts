import { describe, it, expect } from 'vitest'
import {
  parseTab,
  parseMultiSelect,
  parseRadio,
  parseIntParam,
  parseStringParam,
  buildUrl,
  toggleMulti,
  TAB_IDS,
} from '../url-state'

describe('parseTab', () => {
  it('returns the tab when valid', () => {
    expect(parseTab('books')).toBe('books')
    expect(parseTab('sparks')).toBe('sparks')
    expect(parseTab('home')).toBe('home')
  })

  it('falls back to home for unknown / missing values', () => {
    expect(parseTab(undefined)).toBe('home')
    expect(parseTab(null)).toBe('home')
    expect(parseTab('')).toBe('home')
    expect(parseTab('xyz')).toBe('home')
  })

  it('exports a stable TAB_IDS tuple of length 6', () => {
    expect(TAB_IDS.length).toBe(6)
  })
})

describe('parseMultiSelect', () => {
  it('returns empty array for empty / undefined / null', () => {
    expect(parseMultiSelect(undefined)).toEqual([])
    expect(parseMultiSelect(null)).toEqual([])
    expect(parseMultiSelect('')).toEqual([])
  })

  it('splits comma-delimited values', () => {
    expect(parseMultiSelect('fantasy,sci-fi,romance')).toEqual(['fantasy', 'sci-fi', 'romance'])
  })

  it('trims whitespace around values', () => {
    expect(parseMultiSelect(' fantasy , sci-fi ')).toEqual(['fantasy', 'sci-fi'])
  })

  it('drops empty entries', () => {
    expect(parseMultiSelect('fantasy,,sci-fi,')).toEqual(['fantasy', 'sci-fi'])
  })

  it('dedupes (first occurrence wins)', () => {
    expect(parseMultiSelect('fantasy,sci-fi,fantasy')).toEqual(['fantasy', 'sci-fi'])
  })
})

describe('parseRadio', () => {
  const allowed = ['any', 'short', 'novel'] as const

  it('returns the value when allowed', () => {
    expect(parseRadio('short', allowed, 'any')).toBe('short')
  })

  it('falls back when not in the allow-list', () => {
    expect(parseRadio('huge', allowed, 'any')).toBe('any')
    expect(parseRadio(undefined, allowed, 'any')).toBe('any')
    expect(parseRadio(null, allowed, 'any')).toBe('any')
    expect(parseRadio('', allowed, 'any')).toBe('any')
  })
})

describe('parseIntParam', () => {
  it('parses integer strings', () => {
    expect(parseIntParam('42', 0)).toBe(42)
    expect(parseIntParam('0', 99)).toBe(0)
  })

  it('falls back on missing / NaN', () => {
    expect(parseIntParam(undefined, 7)).toBe(7)
    expect(parseIntParam('abc', 7)).toBe(7)
    expect(parseIntParam('', 7)).toBe(7)
  })
})

describe('parseStringParam', () => {
  it('returns the trimmed string', () => {
    expect(parseStringParam(' fantasy ')).toBe('fantasy')
  })

  it('returns undefined for empty / blank / null', () => {
    expect(parseStringParam(undefined)).toBeUndefined()
    expect(parseStringParam(null)).toBeUndefined()
    expect(parseStringParam('')).toBeUndefined()
    expect(parseStringParam('   ')).toBeUndefined()
  })

  it('truncates beyond maxLen', () => {
    expect(parseStringParam('a'.repeat(300), 200)).toHaveLength(200)
  })
})

describe('buildUrl', () => {
  it('includes the tab param', () => {
    expect(buildUrl('books', {})).toBe('/discover?tab=books')
  })

  it('adds scalar params', () => {
    expect(buildUrl('books', { sort: 'trending' })).toBe('/discover?tab=books&sort=trending')
  })

  it('joins array params with commas', () => {
    expect(buildUrl('books', { genres: ['fantasy', 'sci-fi'] })).toBe(
      '/discover?tab=books&genres=fantasy%2Csci-fi'
    )
  })

  it('drops undefined / empty-string / empty-array entries', () => {
    expect(
      buildUrl('books', { sort: undefined, q: '', genres: [], length: 'novel' })
    ).toBe('/discover?tab=books&length=novel')
  })

  it('accepts a custom basePath', () => {
    expect(buildUrl('books', {}, '/en/discover')).toBe('/en/discover?tab=books')
  })
})

describe('toggleMulti', () => {
  it('adds when missing', () => {
    expect(toggleMulti(['fantasy'], 'sci-fi')).toEqual(['fantasy', 'sci-fi'])
  })

  it('removes when present', () => {
    expect(toggleMulti(['fantasy', 'sci-fi'], 'fantasy')).toEqual(['sci-fi'])
  })

  it('returns a new array (does not mutate)', () => {
    const input = ['fantasy']
    const output = toggleMulti(input, 'sci-fi')
    expect(input).toEqual(['fantasy'])
    expect(output).not.toBe(input)
  })
})
