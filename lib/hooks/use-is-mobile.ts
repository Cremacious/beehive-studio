'use client'

import { useEffect, useState } from 'react'

// Shared mobile breakpoint (issue #50). Matches the `md` breakpoint from the
// #49 page-width ladder (sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536).
// Below 768px = "mobile" for the structural changes (nav, studio drawers).
const MOBILE_QUERY = '(max-width: 767px)'

/**
 * SSR-safe matchMedia hook. Returns false on the server + first client render
 * (so desktop markup is the hydration baseline), then flips to the real value
 * after mount. Components that switch layout on `true` should treat the
 * desktop branch as the default to avoid a hydration mismatch.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isMobile
}
