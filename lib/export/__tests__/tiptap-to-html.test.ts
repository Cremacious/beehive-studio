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

  it('converts inline code marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'const x = 1', marks: [{ type: 'code' }] }],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><code>const x = 1</code></p>')
  })

  it('converts code blocks to <pre><code>', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'codeBlock',
        content: [{ type: 'text', text: 'line one\nline two' }],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<pre><code>line one\nline two</code></pre>')
  })

  it('converts link marks with href', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><a href="https://example.com">click</a></p>')
  })

  it('drops a link mark with no href rather than emitting a broken anchor', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'plain', marks: [{ type: 'link', attrs: {} }] }],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>plain</p>')
  })

  it('honors text-align on paragraphs and headings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: 'Centered' }] },
        { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Right' }] },
        { type: 'paragraph', attrs: { textAlign: 'left' }, content: [{ type: 'text', text: 'Default' }] },
      ],
    }
    expect(tiptapToHtml(doc)).toBe(
      '<h2 style="text-align: center">Centered</h2><p style="text-align: right">Right</p><p>Default</p>',
    )
  })

  it('renders a font-size span', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'big', marks: [{ type: 'fontSize', attrs: { size: '24px' } }] }],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><span style="font-size: 24px">big</span></p>')
  })
})
