import { describe, it, expect } from 'vitest'
import { resolveDefaultMode } from '../resolve-default-mode'

// Issue #22: resolveDefaultMode always returns 'all' regardless of auth/signal.
// The DiscoveryModeToggle (For You / Trending / Popular / All) is now the
// primary control; 'all' is the safest broad-canvas default for first paint.
describe('resolveDefaultMode', () => {
  it('guest always gets all', () => {
    expect(resolveDefaultMode({ isAuthed: false, hasSignal: false })).toBe('all')
    expect(resolveDefaultMode({ isAuthed: false, hasSignal: true })).toBe('all')
  })
  it('authed + signal still gets all', () => {
    expect(resolveDefaultMode({ isAuthed: true, hasSignal: true })).toBe('all')
  })
  it('authed + zero signal still gets all', () => {
    expect(resolveDefaultMode({ isAuthed: true, hasSignal: false })).toBe('all')
  })
})
