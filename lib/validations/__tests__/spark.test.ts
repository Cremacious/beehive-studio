import { describe, it, expect } from 'vitest'
import { createSparkSchema, TITLE_MAX, PROMPT_MAX } from '../spark'

describe('createSparkSchema', () => {
  const base = {
    title: 'The Kingdom Heist',
    prompt: 'A heist gone right in a kingdom that does not exist.',
    deadline: new Date(Date.now() + 86400000 * 7),
  }
  it('accepts valid input', () => {
    expect(() => createSparkSchema.parse(base)).not.toThrow()
  })
  it('rejects title under 3 chars', () => {
    expect(() => createSparkSchema.parse({ ...base, title: 'ab' })).toThrow()
  })
  it('rejects title over max', () => {
    expect(() =>
      createSparkSchema.parse({ ...base, title: 'a'.repeat(TITLE_MAX + 1) })
    ).toThrow()
  })
  it('rejects prompt under 10 chars', () => {
    expect(() =>
      createSparkSchema.parse({ ...base, prompt: 'too short' })
    ).toThrow()
  })
  it('rejects prompt over max', () => {
    expect(() =>
      createSparkSchema.parse({ ...base, prompt: 'a'.repeat(PROMPT_MAX + 1) })
    ).toThrow()
  })
  it('accepts optional description + rules', () => {
    const r = createSparkSchema.parse({
      ...base,
      description: 'Extra context.',
      rules: 'No tropes.',
    })
    expect(r.description).toBe('Extra context.')
    expect(r.rules).toBe('No tropes.')
  })
  it('defaults visibility to PUBLIC and discoverable to true', () => {
    const r = createSparkSchema.parse(base)
    expect(r.visibility).toBe('PUBLIC')
    expect(r.discoverable).toBe(true)
  })
})
