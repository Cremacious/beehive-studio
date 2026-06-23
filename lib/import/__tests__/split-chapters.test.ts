import { describe, it, expect } from 'vitest'
import { splitChapters, mergeToSingleChapter } from '../split-chapters'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'

describe('splitChapters — DOCX (heading split)', () => {
  it('splits on h1 headings and strips the heading from the body', () => {
    const html =
      '<h1>One</h1><p>First body.</p><h1>Two</h1><p>Second body.</p>'
    const chapters = splitChapters({ format: 'docx', html, detectedTitle: null })
    expect(chapters.map((c) => c.title)).toEqual(['One', 'Two'])
    expect(tiptapToHtml(chapters[0].content)).toBe('<p>First body.</p>')
    expect(tiptapToHtml(chapters[1].content)).toBe('<p>Second body.</p>')
    expect(chapters[0].wordCount).toBe(2)
  })

  it('falls back to h2 when there are no h1 headings', () => {
    const html = '<h2>Alpha</h2><p>a</p><h2>Beta</h2><p>b</p>'
    const chapters = splitChapters({ format: 'docx', html, detectedTitle: null })
    expect(chapters.map((c) => c.title)).toEqual(['Alpha', 'Beta'])
  })

  it('produces a single chapter when there are no headings', () => {
    const html = '<p>Just one block of prose.</p>'
    const chapters = splitChapters({ format: 'docx', html, detectedTitle: 'My Book' })
    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('My Book')
    expect(tiptapToHtml(chapters[0].content)).toBe('<p>Just one block of prose.</p>')
  })

  it('keeps leading content before the first heading as its own chapter', () => {
    const html = '<p>Front text.</p><h1>One</h1><p>body</p>'
    const chapters = splitChapters({ format: 'docx', html, detectedTitle: null })
    expect(chapters).toHaveLength(2)
    expect(tiptapToHtml(chapters[0].content)).toBe('<p>Front text.</p>')
    expect(chapters[1].title).toBe('One')
  })
})

describe('splitChapters — EPUB (spine sections)', () => {
  it('produces one chapter per section in order', () => {
    const chapters = splitChapters({
      format: 'epub',
      detectedTitle: null,
      sections: [
        { title: 'Prologue', html: '<p>p</p>' },
        { title: 'Chapter 1', html: '<p>c1</p>' },
      ],
    })
    expect(chapters.map((c) => c.title)).toEqual(['Prologue', 'Chapter 1'])
  })

  it('derives the title from the first heading and strips it', () => {
    const chapters = splitChapters({
      format: 'epub',
      detectedTitle: null,
      sections: [{ title: null, html: '<h1>Discovered</h1><p>body</p>' }],
    })
    expect(chapters[0].title).toBe('Discovered')
    expect(tiptapToHtml(chapters[0].content)).toBe('<p>body</p>')
  })

  it('falls back to Chapter N when a section has no title', () => {
    const chapters = splitChapters({
      format: 'epub',
      detectedTitle: null,
      sections: [{ title: null, html: '<p>untitled body</p>' }],
    })
    expect(chapters[0].title).toBe('Chapter 1')
  })
})

describe('splitChapters — PDF (text heuristics)', () => {
  it('splits on Chapter N lines', () => {
    const text = 'Chapter 1\nThe first part.\n\nChapter 2\nThe second part.'
    const chapters = splitChapters({ format: 'pdf', text, detectedTitle: null })
    expect(chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2'])
    expect(tiptapToHtml(chapters[0].content)).toBe('<p>The first part.</p>')
  })

  it('produces a single chapter when no chapter markers are present', () => {
    const text = 'Just some flowing prose with no chapter markers at all.'
    const chapters = splitChapters({ format: 'pdf', text, detectedTitle: 'PDF Title' })
    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('PDF Title')
  })

  it('splits on Prologue / Epilogue markers too', () => {
    const text = 'Prologue\nbefore\n\nChapter 1\nmiddle\n\nEpilogue\nafter'
    const chapters = splitChapters({ format: 'pdf', text, detectedTitle: null })
    expect(chapters.map((c) => c.title)).toEqual(['Prologue', 'Chapter 1', 'Epilogue'])
  })
})

describe('mergeToSingleChapter', () => {
  it('merges chapters with headings between them', () => {
    const chapters = splitChapters({
      format: 'docx',
      html: '<h1>One</h1><p>a</p><h1>Two</h1><p>b</p>',
      detectedTitle: null,
    })
    const merged = mergeToSingleChapter(chapters, 'Whole Book')
    expect(merged.title).toBe('Whole Book')
    // First chapter body, then a heading separating the second.
    expect(tiptapToHtml(merged.content)).toBe('<p>a</p><h1>Two</h1><p>b</p>')
  })
})
