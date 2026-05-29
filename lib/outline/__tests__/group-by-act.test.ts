import { describe, it, expect } from 'vitest'
import { groupBeatsByAct, distinctActs, type ActBeat } from '../group-by-act'

const beat = (id: string, act?: string | null): ActBeat => ({ id, title: id, act, status: 'idea' })

describe('groupBeatsByAct', () => {
  it('returns empty array for no input', () => {
    expect(groupBeatsByAct([])).toEqual([])
  })
  it('returns one null group when nothing has acts', () => {
    expect(groupBeatsByAct([beat('a'), beat('b')])).toEqual([
      { act: null, beats: [beat('a'), beat('b')] },
    ])
  })
  it('omits the null group when every beat has an act', () => {
    const r = groupBeatsByAct([beat('a', 'Act 1'), beat('b', 'Act 2')])
    expect(r.map(g => g.act)).toEqual(['Act 1', 'Act 2'])
  })
  it('preserves first-appearance act order', () => {
    const r = groupBeatsByAct([beat('a', 'II'), beat('b', 'I'), beat('c', 'II')])
    expect(r.map(g => g.act)).toEqual(['II', 'I'])
    expect(r[0].beats.map(b => b.id)).toEqual(['a', 'c'])
  })
  it('puts null-act beats first', () => {
    const r = groupBeatsByAct([beat('a', 'Act 1'), beat('b'), beat('c', 'Act 1')])
    expect(r.map(g => g.act)).toEqual([null, 'Act 1'])
  })
  it('trims & treats empty-string acts as ungrouped', () => {
    const r = groupBeatsByAct([beat('a', '  '), beat('b', 'Act 1')])
    expect(r[0].act).toBeNull()
  })
})

describe('distinctActs', () => {
  it('returns unique acts in first-appearance order', () => {
    expect(distinctActs([beat('a', 'I'), beat('b', 'II'), beat('c', 'I')])).toEqual(['I', 'II'])
  })
  it('excludes empty + null', () => {
    expect(distinctActs([beat('a', ''), beat('b'), beat('c', 'I')])).toEqual(['I'])
  })
})
