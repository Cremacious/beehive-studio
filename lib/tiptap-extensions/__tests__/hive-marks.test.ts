import { describe, it, expect } from 'vitest'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { HiveAnnotationMark } from '../hive-annotation-mark'
import { HiveSuggestionMark } from '../hive-suggestion-mark'

describe('HiveAnnotationMark', () => {
  it('round-trips id + layer through HTML', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello',
              marks: [
                { type: 'hiveAnnotation', attrs: { annotationId: 'ann-1', layer: 'PLOT' } },
              ],
            },
          ],
        },
      ],
    }
    const html = generateHTML(doc, [StarterKit, HiveAnnotationMark])
    expect(html).toContain('data-annotation-id="ann-1"')
    expect(html).toContain('data-layer="PLOT"')
  })
})

describe('HiveSuggestionMark', () => {
  it('round-trips id through HTML', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'World',
              marks: [{ type: 'hiveSuggestion', attrs: { suggestionId: 'sug-1' } }],
            },
          ],
        },
      ],
    }
    const html = generateHTML(doc, [StarterKit, HiveSuggestionMark])
    expect(html).toContain('data-suggestion-id="sug-1"')
  })
})
