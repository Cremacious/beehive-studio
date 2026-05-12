import {
  createBookSchema,
  updateBookSchema,
  createBinderItemSchema,
  reorderBinderItemsSchema,
  updateChapterNotesSchema,
  updatePublishingMetadataSchema,
  updateBinderItemSchema,
  chapterStatusSchema,
} from '@/lib/validations/book'

describe('createBookSchema', () => {
  it('accepts valid input', () => {
    const result = createBookSchema.safeParse({ title: 'My Novel', genre: 'Fantasy' })
    expect(result.success).toBe(true)
  })

  it('accepts minimal input (title only)', () => {
    const result = createBookSchema.safeParse({ title: 'My Novel' })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createBookSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title over 200 characters', () => {
    const result = createBookSchema.safeParse({ title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts all optional fields', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      genre: 'Fantasy',
      subgenre: 'Epic Fantasy',
      tags: ['Found Family', 'Slow Burn'],
      targetAudience: 'Adult',
      contentWarnings: ['Violence'],
      compTitles: ['A Name of the Wind', 'The Way of Kings'],
      language: 'English',
      templateId: 'some-id',
      seriesName: 'The Stormlight Archive',
      seriesNumber: 1,
      publisherName: 'Tor Books',
      trimSize: '6x9',
      edition: 'First Edition',
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 10 tags', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 5 comp titles', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      compTitles: ['A', 'B', 'C', 'D', 'E', 'F'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects seriesNumber below 1', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      seriesNumber: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateBookSchema', () => {
  it('accepts partial updates', () => {
    const result = updateBookSchema.safeParse({ synopsis: 'A story about bees.' })
    expect(result.success).toBe(true)
  })

  it('rejects visibility outside allowed values', () => {
    const result = updateBookSchema.safeParse({ visibility: 'FRIENDS' })
    expect(result.success).toBe(false)
  })

  it('accepts valid visibility', () => {
    const result = updateBookSchema.safeParse({ visibility: 'PUBLIC' })
    expect(result.success).toBe(true)
  })
})

describe('createBinderItemSchema', () => {
  it('accepts valid chapter item', () => {
    const result = createBinderItemSchema.safeParse({
      bookId: 'book-1',
      type: 'chapter',
      title: 'Chapter 1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown type', () => {
    const result = createBinderItemSchema.safeParse({
      bookId: 'book-1',
      type: 'unknown_type',
      title: 'Bad Item',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty bookId', () => {
    const result = createBinderItemSchema.safeParse({
      bookId: '',
      type: 'chapter',
      title: 'Chapter 1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects title over 200 characters', () => {
    const result = createBinderItemSchema.safeParse({
      bookId: 'book-1',
      type: 'chapter',
      title: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

describe('updateBinderItemSchema', () => {
  it('accepts an object for content', () => {
    const result = updateBinderItemSchema.safeParse({
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a string for content', () => {
    const result = updateBinderItemSchema.safeParse({
      content: 'not-an-object',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null content (clearing)', () => {
    const result = updateBinderItemSchema.safeParse({ content: null })
    expect(result.success).toBe(true)
  })
})

describe('reorderBinderItemsSchema', () => {
  it('accepts valid array', () => {
    const result = reorderBinderItemsSchema.safeParse([
      { id: 'item-1', order: 0, parentId: null },
      { id: 'item-2', order: 1, parentId: 'item-1' },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts empty array', () => {
    const result = reorderBinderItemsSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('rejects non-integer order', () => {
    const result = reorderBinderItemsSchema.safeParse([
      { id: 'item-1', order: 1.5, parentId: null },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects empty id', () => {
    const result = reorderBinderItemsSchema.safeParse([
      { id: '', order: 0, parentId: null },
    ])
    expect(result.success).toBe(false)
  })
})

describe('updateChapterNotesSchema', () => {
  it('accepts valid notes', () => {
    const result = updateChapterNotesSchema.safeParse({ notes: 'My notes.' })
    expect(result.success).toBe(true)
  })

  it('accepts null (clearing notes)', () => {
    const result = updateChapterNotesSchema.safeParse({ notes: null })
    expect(result.success).toBe(true)
  })

  it('rejects notes over 10000 characters', () => {
    const result = updateChapterNotesSchema.safeParse({ notes: 'a'.repeat(10001) })
    expect(result.success).toBe(false)
  })
})

describe('chapterStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const status of ['IDEA', 'OUTLINE', 'FIRST_DRAFT', 'REVISED', 'FINAL']) {
      expect(chapterStatusSchema.safeParse(status).success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    expect(chapterStatusSchema.safeParse('DONE').success).toBe(false)
  })
})

describe('updatePublishingMetadataSchema', () => {
  it('accepts empty update (all optional)', () => {
    const result = updatePublishingMetadataSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects ISBN over 20 characters', () => {
    const result = updatePublishingMetadataSchema.safeParse({
      isbn: '1'.repeat(21),
    })
    expect(result.success).toBe(false)
  })

  it('accepts null for nullable fields', () => {
    const result = updatePublishingMetadataSchema.safeParse({
      isbn: null,
      subtitle: null,
      authorBio: null,
    })
    expect(result.success).toBe(true)
  })
})
