import { describe, expect, it } from 'vitest'
import { seedOutline, moveCard, moveColumn, type OutlineContent } from '@/lib/outline/board'

describe('seedOutline', () => {
  it('returns three columns titled Act 1 / Act 2 / Act 3 with no cards', () => {
    const o = seedOutline()
    expect(o.columns).toHaveLength(3)
    expect(o.columns.map(c => c.title)).toEqual(['Act 1', 'Act 2', 'Act 3'])
    expect(o.columns.every(c => c.cards.length === 0)).toBe(true)
  })

  it('gives each column a unique non-empty id', () => {
    const o = seedOutline()
    const ids = o.columns.map(c => c.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(id => id.length > 0)).toBe(true)
  })
})

describe('moveCard', () => {
  const base: OutlineContent = {
    columns: [
      { id: 'col-a', title: 'A', cards: [
        { id: 'c1', title: '1' },
        { id: 'c2', title: '2' },
      ]},
      { id: 'col-b', title: 'B', cards: [
        { id: 'c3', title: '3' },
      ]},
    ],
  }

  it('reorders within the same column', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c2' }, { columnId: 'col-a', index: 0 })
    expect(next.columns[0].cards.map(c => c.id)).toEqual(['c2', 'c1'])
  })

  it('moves a card to another column at the target index', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'col-b', index: 0 })
    expect(next.columns[0].cards.map(c => c.id)).toEqual(['c2'])
    expect(next.columns[1].cards.map(c => c.id)).toEqual(['c1', 'c3'])
  })

  it('appends when target index >= card count', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'col-b', index: 99 })
    expect(next.columns[1].cards.map(c => c.id)).toEqual(['c3', 'c1'])
  })

  it('returns the input unchanged if the source card is not found', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'nonexistent' }, { columnId: 'col-b', index: 0 })
    expect(next).toEqual(base)
  })

  it('returns the input unchanged if the target column is not found', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'nonexistent', index: 0 })
    expect(next).toEqual(base)
  })

  it('does not mutate the input', () => {
    const snapshot = JSON.parse(JSON.stringify(base))
    moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'col-b', index: 0 })
    expect(base).toEqual(snapshot)
  })
})

describe('moveColumn', () => {
  const base: OutlineContent = {
    columns: [
      { id: 'a', title: 'A', cards: [{ id: 'c1', title: '1' }] },
      { id: 'b', title: 'B', cards: [] },
      { id: 'c', title: 'C', cards: [] },
    ],
  }

  it('reorders columns', () => {
    const next = moveColumn(base, 'c', 0)
    expect(next.columns.map(c => c.id)).toEqual(['c', 'a', 'b'])
  })

  it('preserves cards inside each column after reorder', () => {
    const next = moveColumn(base, 'a', 2)
    const a = next.columns.find(c => c.id === 'a')!
    expect(a.cards.map(c => c.id)).toEqual(['c1'])
  })

  it('returns input unchanged for an unknown column id', () => {
    const next = moveColumn(base, 'nonexistent', 0)
    expect(next).toEqual(base)
  })

  it('clamps toIndex to the valid range', () => {
    const next = moveColumn(base, 'a', 99)
    expect(next.columns.map(c => c.id)).toEqual(['b', 'c', 'a'])
  })
})
