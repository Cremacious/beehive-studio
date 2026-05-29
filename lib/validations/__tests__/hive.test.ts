import { describe, it, expect } from 'vitest'
import { createHiveSchema, createTaskSchema, updateTaskSchema } from '../hive'

describe('createHiveSchema', () => {
  it('coerces discoverable=false when visibility != PUBLIC', () => {
    const r = createHiveSchema.parse({
      name: 'X', visibility: 'PRIVATE', discoverable: true,
    })
    expect(r.discoverable).toBe(false)
  })
  it('keeps discoverable=true when visibility=PUBLIC', () => {
    const r = createHiveSchema.parse({
      name: 'X', visibility: 'PUBLIC', discoverable: true,
    })
    expect(r.discoverable).toBe(true)
  })
  it('defaults discoverable=false and visibility=PRIVATE', () => {
    const r = createHiveSchema.parse({ name: 'X' })
    expect(r.discoverable).toBe(false)
    expect(r.visibility).toBe('PRIVATE')
  })
  it('rejects empty name', () => {
    expect(() => createHiveSchema.parse({ name: '' })).toThrow()
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
