// lib/analytics/__tests__/track-event.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackEvent } from '@/lib/analytics/track-event'

afterEach(() => vi.restoreAllMocks())

describe('trackEvent', () => {
  it('logs in non-production', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    trackEvent('upgrade_modal_opened', { feature: 'book-limit' })
    expect(spy).toHaveBeenCalledWith('[track]', 'upgrade_modal_opened', { feature: 'book-limit' })
  })

  it('does not throw without props', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    expect(() => trackEvent('checkout_started')).not.toThrow()
  })
})
