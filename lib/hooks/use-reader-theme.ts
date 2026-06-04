'use client'

import { useEffect, useState } from 'react'

export type ReaderTheme = 'dark' | 'white' | 'cream'

const STORAGE_KEY = 'beehive:reader-theme'

/**
 * Reader-theme toggle, persisted across every chapter and book.
 *
 * SSR-safe: returns 'dark' on first render, then reads localStorage in a
 * useEffect after mount. Avoids hydration mismatch / first-paint flash.
 */
export function useReaderTheme(): [ReaderTheme, (next: ReaderTheme) => void] {
  const [theme, setThemeState] = useState<ReaderTheme>('dark')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'white' || saved === 'cream') {
        setThemeState(saved)
      }
    } catch {
      // localStorage unavailable (private mode etc.) — keep default
    }
  }, [])

  const setTheme = (next: ReaderTheme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return [theme, setTheme]
}
