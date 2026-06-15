import { describe, it, expect } from 'vitest'
import { resolveDefaultMode } from '../resolve-default-mode'

describe('resolveDefaultMode', () => {
  it('guest always gets trending', () => {
    expect(resolveDefaultMode({ isAuthed: false, hasSignal: false })).toBe('trending')
    expect(resolveDefaultMode({ isAuthed: false, hasSignal: true })).toBe('trending')
  })
  it('authed + signal gets for-you', () => {
    expect(resolveDefaultMode({ isAuthed: true, hasSignal: true })).toBe('for-you')
  })
  it('authed + zero signal gets trending', () => {
    expect(resolveDefaultMode({ isAuthed: true, hasSignal: false })).toBe('trending')
  })
})
