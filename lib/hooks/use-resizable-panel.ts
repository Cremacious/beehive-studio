'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ResizableSide = 'left' | 'right'

type Options = {
  storageKey: string
  collapsedStorageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  side: ResizableSide
}

export type UseResizablePanelReturn = {
  width: number
  collapsed: boolean
  isDragging: boolean
  hydrated: boolean
  startDrag: (e: React.PointerEvent) => void
  toggleCollapsed: () => void
  setCollapsed: (next: boolean) => void
  reset: () => void
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function readNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (raw === null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (raw === null) return fallback
  return raw === '1' || raw === 'true'
}

export function useResizablePanel({
  storageKey,
  collapsedStorageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
}: Options): UseResizablePanelReturn {
  const [width, setWidth] = useState<number>(defaultWidth)
  const [collapsed, setCollapsedState] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount only (SSR-safe — server renders default).
  useEffect(() => {
    const stored = readNumber(storageKey, defaultWidth)
    setWidth(clamp(stored, minWidth, maxWidth))
    setCollapsedState(readBool(collapsedStorageKey, false))
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dragStateRef = useRef<{
    startX: number
    startWidth: number
  } | null>(null)

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const state = dragStateRef.current
      if (!state) return
      const dx = e.clientX - state.startX
      // Left-side panel: dragging right → wider. Right-side panel: dragging right → narrower.
      const delta = side === 'left' ? dx : -dx
      const next = clamp(state.startWidth + delta, minWidth, maxWidth)
      setWidth(next)
    },
    [minWidth, maxWidth, side],
  )

  const endDrag = useCallback(() => {
    if (!dragStateRef.current) return
    dragStateRef.current = null
    setIsDragging(false)
    document.body.classList.remove('is-resizing-panel')
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
  }, [onPointerMove])

  // Persist width when drag ends (avoid spamming localStorage during drag).
  useEffect(() => {
    if (!hydrated || isDragging) return
    try {
      window.localStorage.setItem(storageKey, String(width))
    } catch {
      // localStorage may be unavailable (private mode, quota). Best-effort only.
    }
  }, [width, isDragging, hydrated, storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(collapsedStorageKey, collapsed ? '1' : '0')
    } catch {
      // see above
    }
  }, [collapsed, hydrated, collapsedStorageKey])

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return
      e.preventDefault()
      dragStateRef.current = { startX: e.clientX, startWidth: width }
      setIsDragging(true)
      document.body.classList.add('is-resizing-panel')
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', endDrag)
      window.addEventListener('pointercancel', endDrag)
    },
    [collapsed, width, onPointerMove, endDrag],
  )

  // Clean up listeners if the consumer unmounts mid-drag.
  useEffect(() => {
    return () => {
      if (dragStateRef.current) {
        document.body.classList.remove('is-resizing-panel')
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', endDrag)
        window.removeEventListener('pointercancel', endDrag)
      }
    }
  }, [onPointerMove, endDrag])

  const toggleCollapsed = useCallback(() => {
    setCollapsedState(c => !c)
  }, [])

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next)
  }, [])

  const reset = useCallback(() => {
    setWidth(defaultWidth)
    setCollapsedState(false)
  }, [defaultWidth])

  return {
    width,
    collapsed,
    isDragging,
    hydrated,
    startDrag,
    toggleCollapsed,
    setCollapsed,
    reset,
  }
}
