import { describe, expect, it } from 'vitest'
import { normalizeNoteContent, emptyDoc, type ResearchNoteContent } from '@/lib/notes/note-content'

describe('emptyDoc', () => {
  it('returns a valid empty TipTap doc shape', () => {
    expect(emptyDoc()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })
  })
})

describe('normalizeNoteContent', () => {
  it('returns defaults for null input', () => {
    const out = normalizeNoteContent(null)
    expect(out.pinned).toBe(false)
    expect(out.color).toBe(null)
    expect(out.favorited).toBe(false)
    expect(out.text).toEqual(emptyDoc())
  })

  it('returns defaults for undefined input', () => {
    const out = normalizeNoteContent(undefined)
    expect(out.text).toEqual(emptyDoc())
  })

  it('wraps a plain string into a single-paragraph doc', () => {
    const out = normalizeNoteContent('hello world')
    expect(out.text).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'hello world' }],
      }],
    })
    expect(out.pinned).toBe(false)
  })

  it('wraps an empty string into an empty paragraph', () => {
    const out = normalizeNoteContent('')
    expect(out.text).toEqual(emptyDoc())
  })

  it('preserves an existing object with pinned=true', () => {
    const input = {
      text: { type: 'doc', content: [{ type: 'paragraph' }] },
      pinned: true,
    }
    const out = normalizeNoteContent(input)
    expect(out.pinned).toBe(true)
    expect(out.color).toBe(null)        // default filled
    expect(out.favorited).toBe(false)   // default filled
    expect(out.text).toBe(input.text)   // passed through by reference
  })

  it('passes through all four fields when fully specified', () => {
    const input: ResearchNoteContent = {
      text: { type: 'doc', content: [] },
      pinned: true,
      color: 'blue',
      favorited: true,
    }
    const out = normalizeNoteContent(input)
    expect(out).toEqual(input)
  })

  it('clamps invalid color values to null', () => {
    const out = normalizeNoteContent({
      text: { type: 'doc' },
      color: 'magenta',   // not in palette
    } as unknown)
    expect(out.color).toBe(null)
  })

  it('accepts each palette color', () => {
    for (const color of ['yellow', 'blue', 'green', 'pink', 'purple'] as const) {
      const out = normalizeNoteContent({ text: { type: 'doc' }, color })
      expect(out.color).toBe(color)
    }
  })
})
