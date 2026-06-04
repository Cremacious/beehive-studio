'use client'

import { useEffect, useState } from 'react'

/**
 * Reader font-size scale, persisted across every chapter and book.
 *
 * 5 discrete steps — matches Kindle / Apple Books / Kobo accessibility
 * conventions. The value is the index 0..4 mapped to a px size below.
 * Stored as the string size (e.g. "18px") so future steps can be inserted
 * without invalidating saved choices.
 */

export const READER_FONT_SIZES = ['15px', '16.5px', '18px', '20px', '22px'] as const
export type ReaderFontSize = (typeof READER_FONT_SIZES)[number]

export const READER_FONT_SIZE_LABELS: Record<ReaderFontSize, string> = {
  '15px': 'Extra small',
  '16.5px': 'Small',
  '18px': 'Medium',
  '20px': 'Large',
  '22px': 'Extra large',
}

const DEFAULT_SIZE: ReaderFontSize = '18px'
const STORAGE_KEY = 'beehive:reader-font-size'

function isReaderFontSize(v: unknown): v is ReaderFontSize {
  return typeof v === 'string' && (READER_FONT_SIZES as readonly string[]).includes(v)
}

export function useReaderFontSize(): {
  size: ReaderFontSize
  setSize: (next: ReaderFontSize) => void
  increment: () => void
  decrement: () => void
  canIncrement: boolean
  canDecrement: boolean
} {
  const [size, setSizeState] = useState<ReaderFontSize>(DEFAULT_SIZE)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (isReaderFontSize(saved)) setSizeState(saved)
    } catch {
      // localStorage unavailable — keep default
    }
  }, [])

  const setSize = (next: ReaderFontSize) => {
    setSizeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  const index = READER_FONT_SIZES.indexOf(size)
  const canDecrement = index > 0
  const canIncrement = index < READER_FONT_SIZES.length - 1

  const increment = () => {
    if (canIncrement) setSize(READER_FONT_SIZES[index + 1])
  }
  const decrement = () => {
    if (canDecrement) setSize(READER_FONT_SIZES[index - 1])
  }

  return { size, setSize, increment, decrement, canIncrement, canDecrement }
}
