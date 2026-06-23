// lib/analytics/track-event.ts
'use client'

/**
 * Conversion analytics wrapper. Console-logs in dev, no-ops in prod.
 * Swap the body for PostHog / Vercel Analytics later without touching callers.
 *
 * Known event names (keep this list in sync as callers are added):
 *   'upgrade_prompt_shown'   { feature }
 *   'upgrade_modal_opened'   { feature }
 *   'checkout_started'       { feature?, cycle }
 *   'checkout_completed'     { sessionId? }
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[track]', name, props ?? {})
    return
  }
  // TODO: wire PostHog / Vercel Analytics here. No-op in prod for now.
}
