import { describe, it, expect } from 'vitest'
import { generateHTML, generateJSON } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { MentionMark } from '../mention-mark'

const extensions = [StarterKit, MentionMark]

type JSONNode = {
  type: string
  text?: string
  content?: JSONNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

describe('MentionMark', () => {
  it('round-trips a simple mention through HTML', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            {
              type: 'text',
              text: '@bob',
              marks: [{ type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } }],
            },
          ],
        },
      ],
    }
    const html = generateHTML(doc, extensions)
    expect(html).toContain('data-mention-user-id="u_bob"')
    expect(html).toContain('data-mention-username="bob"')
    expect(html).toContain('@bob')

    const reparsed = generateJSON(html, extensions) as JSONNode
    const para = reparsed.content?.[0]
    const mentionNode = para?.content?.find((n) => n.text === '@bob')
    const reMark = mentionNode?.marks?.find((m) => m.type === 'mention')
    expect(reMark?.attrs).toEqual({ userId: 'u_bob', username: 'bob' })
  })

  it('preserves sibling bold mark on the same text run', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '@bob',
              marks: [
                { type: 'bold' },
                { type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } },
              ],
            },
          ],
        },
      ],
    }
    const html = generateHTML(doc, extensions)
    const reparsed = generateJSON(html, extensions) as JSONNode
    const para = reparsed.content?.[0]
    const node = para?.content?.[0]
    const reMarks = node?.marks ?? []
    expect(reMarks.some((m) => m.type === 'bold')).toBe(true)
    expect(reMarks.some((m) => m.type === 'mention')).toBe(true)
    const mention = reMarks.find((m) => m.type === 'mention')
    expect(mention?.attrs).toEqual({ userId: 'u_bob', username: 'bob' })
  })

  it('handles multiple distinct mentions in one paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '@a',
              marks: [{ type: 'mention', attrs: { userId: 'u_a', username: 'a' } }],
            },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              text: '@b',
              marks: [{ type: 'mention', attrs: { userId: 'u_b', username: 'b' } }],
            },
          ],
        },
      ],
    }
    const html = generateHTML(doc, extensions)
    expect(html).toContain('data-mention-user-id="u_a"')
    expect(html).toContain('data-mention-user-id="u_b"')
    expect(html).toContain('data-mention-username="a"')
    expect(html).toContain('data-mention-username="b"')
  })

  it('parses HTML with data-mention-user-id back to a mark', () => {
    const html =
      '<p>Hello <span class="mention" data-mention-user-id="u_bob" data-mention-username="bob">@bob</span></p>'
    const doc = generateJSON(html, extensions) as JSONNode
    const para = doc.content?.[0]
    const mentionNode = para?.content?.find((n) => n.text === '@bob')
    const mark = mentionNode?.marks?.find((m) => m.type === 'mention')
    expect(mark?.attrs).toEqual({ userId: 'u_bob', username: 'bob' })
  })
})
