import { describe, it, expect } from 'vitest'
import { tiptapToHtml } from '../tiptap-to-html'

describe('tiptapToHtml', () => {
  it('converts a plain paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>Hello world</p>')
  })

  it('converts bold and italic marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><strong>Bold</strong> and <em>italic</em></p>')
  })

  it('converts headings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter One' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<h1>Chapter One</h1><h2>Section</h2>')
  })

  it('converts bullet and ordered lists', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] },
          ],
        },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<ul><li><p>Item A</p></li><li><p>Item B</p></li></ul>')
  })

  it('converts blockquote', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quote' }] }] },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<blockquote><p>A quote</p></blockquote>')
  })

  it('converts horizontal rule', () => {
    const doc = { type: 'doc', content: [{ type: 'horizontalRule' }] }
    expect(tiptapToHtml(doc)).toBe('<hr/>')
  })

  it('converts underline and strikethrough', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'under', marks: [{ type: 'underline' }] },
          { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><u>under</u><s>strike</s></p>')
  })

  it('handles hardBreak', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'hardBreak' },
          { type: 'text', text: 'Line 2' },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>Line 1<br/>Line 2</p>')
  })

  it('returns empty string for null or empty doc', () => {
    expect(tiptapToHtml(null)).toBe('')
    expect(tiptapToHtml(undefined)).toBe('')
    expect(tiptapToHtml({ type: 'doc', content: [] })).toBe('')
  })

  it('escapes HTML special characters in text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<b>not bold</b> & "quotes"' }] }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>&lt;b&gt;not bold&lt;/b&gt; &amp; &quot;quotes&quot;</p>')
  })

  it('converts ordered list', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<ol><li><p>First</p></li><li><p>Second</p></li></ol>')
  })

  it('converts highlight mark', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'highlighted', marks: [{ type: 'highlight' }] },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><mark>highlighted</mark></p>')
  })

  it('renders empty paragraph as <p></p>', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }
    expect(tiptapToHtml(doc)).toBe('<p></p>')
  })
})
