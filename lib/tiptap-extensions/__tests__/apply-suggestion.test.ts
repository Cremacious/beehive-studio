import { describe, it, expect } from 'vitest'
import { applySuggestionToDoc } from '../apply-suggestion'
import type { PMNode } from '../mark-scanning'

const SID = 's1'
const sMark = (id = SID) => ({
  type: 'hiveSuggestion',
  attrs: { suggestionId: id },
})

function docOf(...paragraphs: PMNode[]): PMNode {
  return { type: 'doc', content: paragraphs }
}
function p(...children: PMNode[]): PMNode {
  return { type: 'paragraph', content: children }
}
function text(
  value: string,
  marks?: { type: string; attrs?: Record<string, unknown> }[],
): PMNode {
  return marks
    ? { type: 'text', text: value, marks }
    : { type: 'text', text: value }
}

describe('applySuggestionToDoc', () => {
  it('replaces a plain marked range with new text (no sibling marks)', () => {
    const doc = docOf(p(text('Hello '), text('world', [sMark()]), text('!')))
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'there')
    expect(found).toBe(true)
    expect(out.content![0]!.content).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'there' },
      { type: 'text', text: '!' },
    ])
  })

  it('coalesces a run of marked text nodes and replaces them as one', () => {
    const doc = docOf(
      p(
        text('A '),
        text('one ', [sMark()]),
        text('two ', [sMark()]),
        text('three', [sMark()]),
        text(' B'),
      ),
    )
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'X')
    expect(found).toBe(true)
    expect(out.content![0]!.content).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'text', text: 'X' },
      { type: 'text', text: ' B' },
    ])
  })

  it('preserves a sibling bold mark on the replacement', () => {
    const bold = { type: 'bold' }
    const doc = docOf(p(text('Hi '), text('old', [sMark(), bold]), text('!')))
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'new')
    expect(found).toBe(true)
    const para = out.content![0]!.content!
    expect(para[1]).toEqual({
      type: 'text',
      text: 'new',
      marks: [{ type: 'bold' }],
    })
  })

  it('preserves both bold AND italic sibling marks', () => {
    const bold = { type: 'bold' }
    const italic = { type: 'italic' }
    const doc = docOf(p(text('old', [sMark(), bold, italic])))
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'new')
    expect(found).toBe(true)
    const para = out.content![0]!.content!
    expect(para[0]).toEqual({
      type: 'text',
      text: 'new',
      marks: [{ type: 'bold' }, { type: 'italic' }],
    })
  })

  it('returns input unchanged with found=false when no mark matches', () => {
    const doc = docOf(p(text('Hello '), text('world', [sMark('other')])))
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'X')
    expect(found).toBe(false)
    expect(out).toBe(doc) // referentially identical — no clone on orphan
  })

  it('lands at the mark current range, not at an original offset', () => {
    // Imagine the suggestion was originally on offsets [6, 11) ("world"), but
    // an upstream edit prepended "PREFIX " and inserted " EXTRA" before the
    // marked run. Marks travel with their text node, so the function should
    // still replace just the marked text wherever it sits.
    const doc = docOf(
      p(
        text('PREFIX Hello'),
        text(' EXTRA '),
        text('world', [sMark()]),
        text(' tail'),
      ),
    )
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'planet')
    expect(found).toBe(true)
    expect(out.content![0]!.content).toEqual([
      { type: 'text', text: 'PREFIX Hello' },
      { type: 'text', text: ' EXTRA ' },
      { type: 'text', text: 'planet' },
      { type: 'text', text: ' tail' },
    ])
  })

  it('only rewrites the first block when the same id appears in two blocks', () => {
    const doc = docOf(
      p(text('A '), text('first', [sMark()]), text(' end')),
      p(text('B '), text('second', [sMark()]), text(' end')),
    )
    const { doc: out, found } = applySuggestionToDoc(doc, SID, 'XXX')
    expect(found).toBe(true)
    expect(out.content![0]!.content).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'text', text: 'XXX' },
      { type: 'text', text: ' end' },
    ])
    // Second paragraph untouched.
    expect(out.content![1]!.content).toEqual([
      { type: 'text', text: 'B ' },
      {
        type: 'text',
        text: 'second',
        marks: [{ type: 'hiveSuggestion', attrs: { suggestionId: SID } }],
      },
      { type: 'text', text: ' end' },
    ])
  })
})
