import { extractWordCount } from '@/lib/tiptap-utils'

describe('extractWordCount', () => {
  it('returns 0 for empty doc', () => {
    expect(extractWordCount({ type: 'doc', content: [] })).toBe(0)
  })

  it('returns 0 for null/undefined', () => {
    expect(extractWordCount(null)).toBe(0)
    expect(extractWordCount(undefined)).toBe(0)
  })

  it('counts words in a single paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(2)
  })

  it('counts words across multiple paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph here.' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph here.' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(6)
  })

  it('handles nested content (headings, bold, etc.)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Chapter One' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Some ' },
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'bold words',
            },
            { type: 'text', text: ' here.' },
          ],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(6)
  })

  it('ignores whitespace-only text nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '   ' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(0)
  })

  it('handles scene break horizontal rule nodes (no text)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Before break.' }],
        },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After break.' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(4)
  })
})
