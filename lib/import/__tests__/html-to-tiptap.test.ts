import { describe, it, expect } from 'vitest'
import { htmlToTiptap } from '../html-to-tiptap'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'

// The core correctness invariant: HTML produced by the export serializer, run
// back through the import converter and re-serialized, reproduces the same HTML.
// This proves the supported node/mark vocabulary round-trips losslessly.
function roundTrip(doc: unknown): { before: string; after: string } {
  const before = tiptapToHtml(doc)
  const reimported = htmlToTiptap(before)
  const after = tiptapToHtml(reimported)
  return { before, after }
}

describe('htmlToTiptap round-trip (export -> import -> export)', () => {
  const cases: { name: string; doc: unknown }[] = [
    {
      name: 'plain paragraph',
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
    },
    {
      name: 'bold + italic',
      doc: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ],
        }],
      },
    },
    {
      name: 'underline + strike',
      doc: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'under', marks: [{ type: 'underline' }] },
            { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
          ],
        }],
      },
    },
    {
      name: 'highlight',
      doc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi', marks: [{ type: 'highlight' }] }] }],
      },
    },
    {
      name: 'fontSize span',
      doc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'big', marks: [{ type: 'fontSize', attrs: { size: '24px' } }] }] }],
      },
    },
    {
      name: 'headings 1-3',
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter One' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Sub' }] },
        ],
      },
    },
    {
      name: 'blockquote',
      doc: {
        type: 'doc',
        content: [{ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quote' }] }] }],
      },
    },
    {
      name: 'bullet list',
      doc: {
        type: 'doc',
        content: [{
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] },
          ],
        }],
      },
    },
    {
      name: 'ordered list',
      doc: {
        type: 'doc',
        content: [{
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        }],
      },
    },
    {
      name: 'horizontal rule',
      doc: { type: 'doc', content: [{ type: 'horizontalRule' }, { type: 'paragraph', content: [{ type: 'text', text: 'after' }] }] },
    },
    {
      name: 'hard break',
      doc: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Line 1' }, { type: 'hardBreak' }, { type: 'text', text: 'Line 2' }],
        }],
      },
    },
    {
      name: 'text-align on heading + paragraph',
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: 'Centered' }] },
          { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Right' }] },
        ],
      },
    },
    {
      name: 'escaped special characters',
      doc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '<b>x</b> & "y"' }] }],
      },
    },
  ]

  for (const c of cases) {
    it(`preserves ${c.name}`, () => {
      const { before, after } = roundTrip(c.doc)
      expect(after).toBe(before)
    })
  }
})

describe('htmlToTiptap unsupported-content handling', () => {
  it('always returns a valid doc with at least one paragraph', () => {
    expect(htmlToTiptap('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(htmlToTiptap('   ')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('clamps heading levels above 3 to 3', () => {
    const doc = htmlToTiptap('<h5>Deep</h5>')
    expect(doc.content[0].type).toBe('heading')
    expect(doc.content[0].attrs?.level).toBe(3)
  })

  it('drops link marks but keeps the text', () => {
    const doc = htmlToTiptap('<p><a href="https://example.com">click</a></p>')
    expect(tiptapToHtml(doc)).toBe('<p>click</p>')
  })

  it('drops inline code marks but keeps the text', () => {
    const doc = htmlToTiptap('<p><code>x = 1</code></p>')
    expect(tiptapToHtml(doc)).toBe('<p>x = 1</p>')
  })

  it('drops images entirely', () => {
    const doc = htmlToTiptap('<p>before<img src="x.png"/>after</p>')
    expect(tiptapToHtml(doc)).toBe('<p>beforeafter</p>')
  })

  it('flattens a table row to a paragraph of joined cells', () => {
    const doc = htmlToTiptap('<table><tr><td>A</td><td>B</td></tr></table>')
    expect(tiptapToHtml(doc)).toBe('<p>A · B</p>')
  })

  it('flattens a code block (pre) to a paragraph', () => {
    const doc = htmlToTiptap('<pre>some code</pre>')
    expect(tiptapToHtml(doc)).toBe('<p>some code</p>')
  })

  it('unwraps unknown block wrappers transparently', () => {
    const doc = htmlToTiptap('<section><p>Inside</p></section>')
    expect(tiptapToHtml(doc)).toBe('<p>Inside</p>')
  })

  it('coalesces loose inline content into a paragraph', () => {
    const doc = htmlToTiptap('Loose <strong>text</strong> here')
    expect(tiptapToHtml(doc)).toBe('<p>Loose <strong>text</strong> here</p>')
  })

  it('strips head / script / style wrappers', () => {
    const html = '<html><head><title>x</title></head><body><p>Body</p><script>evil()</script></body></html>'
    expect(tiptapToHtml(htmlToTiptap(html))).toBe('<p>Body</p>')
  })
})
