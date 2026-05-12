import { createBookSchema, updateBookSchema } from '@/lib/validations/book'

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
