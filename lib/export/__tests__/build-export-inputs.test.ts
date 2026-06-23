import { describe, it, expect } from 'vitest'
import { buildExportInputs, isTiptapEmpty, fbmRowToInput, type ExportRow } from '../build-export-inputs'

function row(partial: Partial<ExportRow>): ExportRow {
  return {
    id: 'id',
    parentId: null,
    type: 'chapter',
    title: null,
    order: 0,
    chapterId: null,
    chapterContent: null,
    chapterStatus: 'FIRST_DRAFT',
    chapterUpdatedAt: new Date('2026-01-01'),
    binderContent: null,
    ...partial,
  }
}

function doc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

describe('isTiptapEmpty', () => {
  it('treats null / whitespace-only as empty', () => {
    expect(isTiptapEmpty(null)).toBe(true)
    expect(isTiptapEmpty(doc('   '))).toBe(true)
  })
  it('treats real prose as non-empty', () => {
    expect(isTiptapEmpty(doc('Hello'))).toBe(false)
  })
})

describe('buildExportInputs', () => {
  it('returns no chapters for an empty book', () => {
    const result = buildExportInputs([])
    expect(result.chapters).toHaveLength(0)
    expect(result.all).toHaveLength(0)
  })

  it('skips empty chapters', () => {
    const rows = [
      row({ id: 'c1', type: 'chapter', title: 'One', order: 1, chapterId: 'ch1', chapterContent: doc('Real text') }),
      row({ id: 'c2', type: 'chapter', title: 'Empty', order: 2, chapterId: 'ch2', chapterContent: doc('   ') }),
    ]
    const result = buildExportInputs(rows)
    expect(result.chapters.map(c => c.title)).toEqual(['One'])
  })

  it('orders chapters by global reading order across a part collection', () => {
    // Binder order is parent-scoped; a chapter nested in a part must still slot
    // correctly into the flat reading order.
    const rows = [
      row({ id: 'p1', type: 'part', title: 'Part One', order: 1 }),
      row({ id: 'c-intro', type: 'chapter', title: 'Intro', order: 0, chapterId: 'ch0', chapterContent: doc('intro') }),
      row({ id: 'c-a', parentId: 'p1', type: 'chapter', title: 'A', order: 1, chapterId: 'cha', chapterContent: doc('a') }),
      row({ id: 'c-b', parentId: 'p1', type: 'chapter', title: 'B', order: 2, chapterId: 'chb', chapterContent: doc('b') }),
    ]
    const result = buildExportInputs(rows)
    // Intro (root order 0) comes before Part One's children (root order 1).
    expect(result.chapters.map(c => c.title)).toEqual(['Intro', 'A', 'B'])
  })

  it('renders front matter via templates and places it before chapters', () => {
    const rows = [
      row({
        id: 'fm',
        type: 'front_matter',
        title: 'Title Page',
        order: 0,
        binderContent: { subtype: 'title_page', fields: { bookTitle: 'My Book', authorName: 'Me' } },
      }),
      row({ id: 'c1', type: 'chapter', title: 'One', order: 1, chapterId: 'ch1', chapterContent: doc('Real') }),
    ]
    const result = buildExportInputs(rows)
    expect(result.front).toHaveLength(1)
    expect(result.front[0].htmlOverride).toContain('My Book')
    expect(result.all[0].htmlOverride).toContain('My Book')
    expect(result.all[1].title).toBe('One')
  })

  it('skips front/back matter with no meaningful fields', () => {
    const emptyTitle = row({
      type: 'front_matter',
      binderContent: { subtype: 'title_page', fields: {} },
    })
    expect(fbmRowToInput(emptyTitle)).toBeNull()

    const emptyDedication = row({
      type: 'front_matter',
      binderContent: { subtype: 'dedication', fields: { text: '' } },
    })
    expect(fbmRowToInput(emptyDedication)).toBeNull()
  })
})
