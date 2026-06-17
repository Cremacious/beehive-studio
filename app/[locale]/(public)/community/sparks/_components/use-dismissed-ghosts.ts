'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GhostVariant } from './pick-ghosts'

const STORAGE_KEY = 'sparks-hub:dismissed-ghosts'

function readStorage(): GhostVariant[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useDismissedGhosts() {
  const [dismissed, setDismissed] = useState<GhostVariant[]>(() => readStorage())

  useEffect(() => {
    // Re-sync if another tab dismissed something
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDismissed(readStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const dismiss = useCallback((v: GhostVariant) => {
    setDismissed((prev) => {
      if (prev.includes(v)) return prev
      const next = [...prev, v]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  return { dismissed, dismiss }
}
