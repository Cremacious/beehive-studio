'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics/track-event'

type Props = { sessionId?: string }

/**
 * Fires the `checkout_completed` analytics event once on mount.
 * Renders nothing. Ref-guarded so React 19 strict-mode effect double-invoke
 * doesn't fire the event twice.
 */
export function WelcomeTracker({ sessionId }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackEvent('checkout_completed', { sessionId })
  }, [sessionId])

  return null
}
