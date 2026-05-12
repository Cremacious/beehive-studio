import { describe, it, expect } from 'vitest'
import { createHiveSchema, createTaskSchema, updateTaskSchema } from '../hive'

describe('createHiveSchema', () => {
  it('accepts valid input', () => {
    const result = createHiveSchema.safeParse({ bookId: 'abc', name: 'My Hive' })
    expect(result.success).toBe(true)
  })
  it('rejects empty name', () => {
    const result = createHiveSchema.safeParse({ bookId: 'abc', name: '' })
    expect(result.success).toBe(false)
  })
  it('rejects missing bookId', () => {
    const result = createHiveSchema.safeParse({ name: 'My Hive' })
    expect(result.success).toBe(false)
  })
  it('defaults visibility to PRIVATE', () => {
    const result = createHiveSchema.safeParse({ bookId: 'abc', name: 'My Hive' })
    expect(result.success && result.data.visibility).toBe('PRIVATE')
  })
})

describe('updateTaskSchema', () => {
  it('accepts valid status', () => {
    const result = updateTaskSchema.safeParse({ status: 'IN_PROGRESS' })
    expect(result.success).toBe(true)
  })
  it('rejects invalid status', () => {
    const result = updateTaskSchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })
})

describe('createTaskSchema', () => {
  it('accepts minimal input', () => {
    const result = createTaskSchema.safeParse({ title: 'Write chapter 3' })
    expect(result.success).toBe(true)
  })
  it('rejects empty title', () => {
    const result = createTaskSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })
})
