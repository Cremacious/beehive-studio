import { describe, it, expect } from 'vitest'
import {
  findMarkRanges,
  findOrphanMarks,
  type PMNode,
} from '../mark-scanning'

const MARK = 'hiveAnnotation'

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
  return { type: 'text', text: value, marks }
}

describe('findMarkRanges', () => {
  it('finds a single-text-node range', () => {
    const doc = docOf(
      p(
        text('Hello '),
        text('world', [{ type: MARK, attrs: { annotationId: 'a1' } }]),
        text('!'),
      ),
    )
    const ranges = findMarkRanges(doc, MARK)
    expect(ranges).toEqual([
      { from: 6, to: 11, attrs: { annotationId: 'a1' } },
    ])
  })

  it('collapses adjacent text nodes with same mark + attrs into one MarkRange', () => {
    const doc = docOf(
      p(
        text('hello ', [{ type: MARK, attrs: { annotationId: 'a1' } }]),
        text('there ', [{ type: MARK, attrs: { annotationId: 'a1' } }]),
        text('world', [{ type: MARK, attrs: { annotationId: 'a1' } }]),
      ),
    )
    const ranges = findMarkRanges(doc, MARK)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]).toEqual({
      from: 0,
      to: 'hello there world'.length,
      attrs: { annotationId: 'a1' },
    })
  })

  it('breaks the range across a block boundary (two paragraphs)', () => {
    const doc = docOf(
      p(text('first', [{ type: MARK, attrs: { annotationId: 'a1' } }])),
      p(text('second', [{ type: MARK, attrs: { annotationId: 'a1' } }])),
    )
    const ranges = findMarkRanges(doc, MARK)
    expect(ranges).toHaveLength(2)
    expect(ranges[0]).toEqual({
      from: 0,
      to: 5,
      attrs: { annotationId: 'a1' },
    })
    expect(ranges[1]).toEqual({
      from: 5,
      to: 11,
      attrs: { annotationId: 'a1' },
    })
  })

  it('does not let bold/italic sibling marks interfere with annotation scanning', () => {
    const doc = docOf(
      p(
        text('plain '),
        text('bolded ', [{ type: 'bold' }]),
        text('annotated', [
          { type: 'bold' },
          { type: MARK, attrs: { annotationId: 'a1' } },
        ]),
        text(' italics', [{ type: 'italic' }]),
      ),
    )
    const ranges = findMarkRanges(doc, MARK)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]).toEqual({
      from: 'plain bolded '.length,
      to: 'plain bolded annotated'.length,
      attrs: { annotationId: 'a1' },
    })
  })
})

describe('findOrphanMarks', () => {
  it('reports orphan rows when DB has an id with no matching mark in the doc', () => {
    const doc = docOf(
      p(text('hi ', [{ type: MARK, attrs: { annotationId: 'a1' } }]), text('rest')),
    )
    const result = findOrphanMarks(doc, MARK, 'annotationId', ['a1', 'a2', 'a3'])
    expect(result.orphanRows.sort()).toEqual(['a2', 'a3'])
    expect(result.orphanMarks).toEqual([])
  })

  it('reports orphan marks when the doc has an id with no matching DB row', () => {
    const doc = docOf(
      p(
        text('one ', [{ type: MARK, attrs: { annotationId: 'a1' } }]),
        text('two', [{ type: MARK, attrs: { annotationId: 'a2' } }]),
      ),
    )
    const result = findOrphanMarks(doc, MARK, 'annotationId', ['a1'])
    expect(result.orphanRows).toEqual([])
    expect(result.orphanMarks).toEqual(['a2'])
  })
})
