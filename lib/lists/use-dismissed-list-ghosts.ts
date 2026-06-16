'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ListGhostVariant } from '@/lib/lists/pick-list-ghosts'

const STORAGE_KEY = 'lists-hub:dismissed-ghosts'

function readStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function useDismissedListGhosts() {
  const [dismissedArr, setDismissedArr] = useState<string[]>(() => readStorage())

  useEffect(() => {
    // Re-sync if another tab dismissed something
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDismissedArr(readStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const dismiss = useCallback((variant: ListGhostVariant) => {
    setDismissedArr((prev) => {
      if (prev.includes(variant)) return prev
      const next = [...prev, variant]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const dismissed = new Set<string>(dismissedArr)

  return { dismissed, dismiss }
}

export default useDismissedListGhosts
