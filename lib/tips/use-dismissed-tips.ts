'use client'

import { useCallback, useEffect, useState } from 'react'

// One-time-tip dismissal state, persisted in localStorage. Mirrors the
// ghost-dismissal hook pattern (app/[locale]/(public)/community/sparks/
// _components/use-dismissed-ghosts.ts): useState + a `storage` event listener
// for cross-tab sync.
//
// Persistence choice (v1): localStorage, keyed under a single `tips:dismissed`
// entry holding an array of dismissed tip keys. No schema, no migration, instant.
// It resets on browser-data wipe / new device, which is acceptable for "seen a
// tip once". This can be promoted to a DB-backed `userProfiles.dismissedTips`
// column + a `dismissTipAction` later if cross-device persistence matters.
//
// `hydrated` starts false and the stored set starts empty so the server render
// and the first client render agree (no SSR flash of a popup). Consumers gate
// rendering on `hydrated`.

const STORAGE_KEY = 'tips:dismissed'

function readStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function useDismissedTips() {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setDismissed(readStorage())
    setHydrated(true)
    // Re-sync if another tab dismissed (or reset) tips.
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDismissed(readStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const isDismissed = useCallback(
    (key: string) => dismissed.includes(key),
    [dismissed],
  )

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      if (prev.includes(key)) return prev
      const next = [...prev, key]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // localStorage may be unavailable (private mode, quota). Best-effort only.
      }
      return next
    })
  }, [])

  // Replay every tip. Used by the "Reset tips" control in Settings.
  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // best-effort
    }
    setDismissed([])
  }, [])

  return { hydrated, dismissed, isDismissed, dismiss, reset }
}
