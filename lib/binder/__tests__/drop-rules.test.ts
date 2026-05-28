import { describe, it, expect } from 'vitest'
import {
  getAcceptedChildTypes,
  canNest,
  classifyDropZone,
  type BinderItemLite,
} from '../drop-rules'

describe('getAcceptedChildTypes', () => {
  it('part accepts only chapter', () => {
    expect(getAcceptedChildTypes('part')).toEqual(['chapter'])
  })
  it('research_folder accepts every non-chapter document type', () => {
    expect(getAcceptedChildTypes('research_folder').sort()).toEqual(
      ['research_note', 'research_folder', 'character', 'outline', 'front_matter', 'back_matter'].sort()
    )
  })
  it('non-container types accept nothing', () => {
    expect(getAcceptedChildTypes('chapter')).toEqual([])
    expect(getAcceptedChildTypes('character')).toEqual([])
    expect(getAcceptedChildTypes('outline')).toEqual([])
    expect(getAcceptedChildTypes('front_matter')).toEqual([])
    expect(getAcceptedChildTypes('back_matter')).toEqual([])
    expect(getAcceptedChildTypes('research_note')).toEqual([])
  })
})

describe('canNest', () => {
  const items: BinderItemLite[] = [
    { id: 'partA', type: 'part', parentId: null },
    { id: 'partA-child1', type: 'chapter', parentId: 'partA' },
    { id: 'partA-sub', type: 'part', parentId: 'partA' },
    { id: 'partA-sub-child', type: 'chapter', parentId: 'partA-sub' },
    { id: 'partB', type: 'part', parentId: null },
    { id: 'folderA', type: 'research_folder', parentId: null },
    { id: 'folderA-sub', type: 'research_folder', parentId: 'folderA' },
    { id: 'folderA-sub-sub', type: 'research_folder', parentId: 'folderA-sub' },
    { id: 'noteA', type: 'research_note', parentId: null },
    { id: 'charA', type: 'character', parentId: null },
    { id: 'chapterTop', type: 'chapter', parentId: null },
  ]
  const get = (id: string) => items.find(i => i.id === id)!

  it('chapter into part is allowed', () => {
    expect(canNest(get('chapterTop'), get('partA'), items)).toBe(true)
  })
  it('part into part is rejected (type — parts only accept chapters)', () => {
    expect(canNest(get('partB'), get('partA'), items)).toBe(false)
  })
  it('research_note into research_folder is allowed', () => {
    expect(canNest(get('noteA'), get('folderA'), items)).toBe(true)
  })
  it('character into research_folder is allowed', () => {
    expect(canNest(get('charA'), get('folderA'), items)).toBe(true)
  })
  it('character into part is rejected (type)', () => {
    expect(canNest(get('charA'), get('partA'), items)).toBe(false)
  })
  it('chapter into research_folder is rejected (type)', () => {
    expect(canNest(get('chapterTop'), get('folderA'), items)).toBe(false)
  })
  it('research_folder into itself is rejected (cycle)', () => {
    expect(canNest(get('folderA'), get('folderA'), items)).toBe(false)
  })
  it('research_folder into its own child is rejected (cycle)', () => {
    expect(canNest(get('folderA'), get('folderA-sub'), items)).toBe(false)
  })
  it('research_folder into its own grandchild is rejected (cycle)', () => {
    expect(canNest(get('folderA'), get('folderA-sub-sub'), items)).toBe(false)
  })
  it('nest into non-container is rejected (type)', () => {
    expect(canNest(get('chapterTop'), get('chapterTop'), items)).toBe(false)
  })
})

describe('classifyDropZone', () => {
  const rect = (top: number, height: number) =>
    ({ top, height, bottom: top + height } as DOMRect)

  it('folder row: pointer in top 3px → before', () => {
    expect(classifyDropZone(101, rect(100, 32), true)).toBe('before')
  })
  it('folder row: pointer in bottom 3px → after', () => {
    expect(classifyDropZone(130, rect(100, 32), true)).toBe('after')
  })
  it('folder row: pointer just inside top edge → middle (87% nest band)', () => {
    expect(classifyDropZone(104, rect(100, 32), true)).toBe('middle')
  })
  it('folder row: pointer in middle → middle', () => {
    expect(classifyDropZone(116, rect(100, 32), true)).toBe('middle')
  })
  it('folder row: pointer just inside bottom edge → middle', () => {
    expect(classifyDropZone(128, rect(100, 32), true)).toBe('middle')
  })
  it('non-folder row: top half → before', () => {
    expect(classifyDropZone(108, rect(100, 32), false)).toBe('before')
  })
  it('non-folder row: bottom half → after', () => {
    expect(classifyDropZone(124, rect(100, 32), false)).toBe('after')
  })
})
