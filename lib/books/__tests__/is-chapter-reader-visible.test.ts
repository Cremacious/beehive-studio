import { describe, it, expect } from 'vitest'
import { isChapterReaderVisible, type ChapterStatus } from '../is-chapter-reader-visible'

describe('isChapterReaderVisible', () => {
  it('REVISED is visible', () => {
    expect(isChapterReaderVisible('REVISED')).toBe(true)
  })
  it('FINAL is visible', () => {
    expect(isChapterReaderVisible('FINAL')).toBe(true)
  })
  it('IDEA is not visible', () => {
    expect(isChapterReaderVisible('IDEA')).toBe(false)
  })
  it('OUTLINE is not visible', () => {
    expect(isChapterReaderVisible('OUTLINE')).toBe(false)
  })
  it('FIRST_DRAFT is not visible', () => {
    expect(isChapterReaderVisible('FIRST_DRAFT')).toBe(false)
  })
})
