'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HiveGhostVariant } from './pick-hive-ghosts'

const STORAGE_KEY = 'hives-hub:dismissed-ghosts'

function readStorage(): HiveGhostVariant[] {
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

export function useDismissedHiveGhosts() {
  const [dismissed, setDismissed] = useState<HiveGhostVariant[]>(() => readStorage())

  useEffect(() => {
    // Re-sync if another tab dismissed something
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDismissed(readStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const dismiss = useCallback((v: HiveGhostVariant) => {
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
