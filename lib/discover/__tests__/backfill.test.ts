import { describe, it, expect } from 'vitest'
import { applyBackfill } from '../backfill'

describe('applyBackfill', () => {
  it('returns strict as-is when strict.length >= 4', () => {
    const strict = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]
    const res = applyBackfill(strict, [{ id: 'z' }])
    expect(res.books).toEqual(strict)
    expect(res.strictCount).toBe(5)
  })
  it('fills to 4 from backfill when strict is short', () => {
    const strict = [{ id: 'a' }]
    const backfill = [{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'w' }]
    const res = applyBackfill(strict, backfill)
    expect(res.books.length).toBe(4)
    expect(res.strictCount).toBe(1)
    expect(res.books.map((b) => b.id)).toEqual(['a', 'x', 'y', 'z'])
  })
  it('excludes ids already in strict from the backfill', () => {
    const strict = [{ id: 'a' }, { id: 'b' }]
    const backfill = [{ id: 'a' }, { id: 'x' }, { id: 'y' }]
    const res = applyBackfill(strict, backfill)
    expect(res.books.map((b) => b.id)).toEqual(['a', 'b', 'x', 'y'])
  })
  it('handles strict empty', () => {
    const strict: { id: string }[] = []
    const backfill = [{ id: 'x' }, { id: 'y' }]
    const res = applyBackfill(strict, backfill)
    expect(res.books).toEqual(backfill)
    expect(res.strictCount).toBe(0)
  })
  it('handles both empty', () => {
    const res = applyBackfill([], [])
    expect(res.books).toEqual([])
    expect(res.strictCount).toBe(0)
  })
})
