import { describe, it, expect } from 'vitest'
import { generatePdf } from '../pdf'
import type { ChapterInput } from '../docx'

function doc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

describe('generatePdf', () => {
  const chapters: ChapterInput[] = [
    {
      title: 'Title Page',
      content: null,
      htmlOverride: '<div style="text-align:center"><h1 style="font-size:24pt">My Book</h1><p>Me</p></div>',
    },
    { title: 'Chapter One', content: doc('Once upon a time, in a land far away.') },
    {
      title: 'Chapter Two',
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quote' }] }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
          ] },
          { type: 'horizontalRule' },
        ],
      },
    },
  ]

  it('produces a valid PDF buffer for the manuscript preset', async () => {
    const buf = await generatePdf(chapters, 'manuscript', 'My Book', 'Me')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(500)
    // PDF magic number.
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    // Ends with the EOF marker.
    expect(buf.subarray(-6).toString('latin1')).toContain('%%EOF')
  })

  it('produces a valid PDF buffer for the basic preset', async () => {
    const buf = await generatePdf(chapters, 'basic', 'My Book', 'Me')
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('never throws on an empty chapter list (defensive)', async () => {
    const buf = await generatePdf([], 'manuscript', 'My Book', 'Me')
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
