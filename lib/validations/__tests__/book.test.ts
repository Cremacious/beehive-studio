import { describe, it, expect } from 'vitest'
import { updateBookDetailsSchema, createBookSchema } from '../book'

describe('book schema discoverable coercion', () => {
  const validDetails = {
    title: 'T',
    synopsis: null,
    coverUrl: null,
    genre: null,
    subgenre: null,
    tags: [],
    targetAudience: null,
    contentWarnings: [],
    compTitles: [],
    language: null,
    seriesName: null,
    seriesNumber: null,
    subtitle: null,
  }

  it('updateBookDetailsSchema: PRIVATE + discoverable=true coerces to false', () => {
    const parsed = updateBookDetailsSchema.parse({
      ...validDetails, visibility: 'PRIVATE', discoverable: true,
    })
    expect(parsed.discoverable).toBe(false)
  })

  it('updateBookDetailsSchema: FRIENDS + discoverable=true coerces to false', () => {
    const parsed = updateBookDetailsSchema.parse({
      ...validDetails, visibility: 'FRIENDS', discoverable: true,
    })
    expect(parsed.discoverable).toBe(false)
  })

  it('updateBookDetailsSchema: PUBLIC + discoverable=true keeps true', () => {
    const parsed = updateBookDetailsSchema.parse({
      ...validDetails, visibility: 'PUBLIC', discoverable: true,
    })
    expect(parsed.discoverable).toBe(true)
  })

  it('createBookSchema: PRIVATE + discoverable=true coerces to false', () => {
    const parsed = createBookSchema.parse({
      title: 'T', visibility: 'PRIVATE', discoverable: true,
    })
    expect(parsed.discoverable).toBe(false)
  })
})
