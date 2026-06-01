'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

export type SelectionPopoverState = {
  from: number
  to: number
  text: string
  anchorRect: DOMRect
}

export type UseSelectionPopoverResult =
  | (SelectionPopoverState & { close: () => void })
  | {
      from: null
      to: null
      text: null
      anchorRect: null
      close: () => void
    }

/**
 * Listens for non-empty TipTap selections and exposes the selection range +
 * an anchor DOMRect for positioning a floating popover above it.
 *
 * Accepts a possibly-null editor (callers may pass an editor during the
 * SSR / mount window before it's ready).
 */
export function useSelectionPopover(
  editor: Editor | null,
): UseSelectionPopoverResult {
  const [state, setState] = useState<SelectionPopoverState | null>(null)

  const close = useCallback(() => setState(null), [])

  useEffect(() => {
    if (!editor) return

    const handler = () => {
      const { from, to, empty } = editor.state.selection
      if (empty) {
        setState(null)
        return
      }
      const text = editor.state.doc.textBetween(from, to, ' ')
      if (!text || text.trim().length === 0) {
        setState(null)
        return
      }
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      // Build a rect that spans the full selection so callers can center over it.
      const left = Math.min(start.left, end.left)
      const right = Math.max(start.right, end.right)
      const top = Math.min(start.top, end.top)
      const bottom = Math.max(start.bottom, end.bottom)
      const rect = new DOMRect(left, top, right - left, bottom - top)
      setState({ from, to, text, anchorRect: rect })
    }

    const onBlur = () => setState(null)

    editor.on('selectionUpdate', handler)
    editor.on('blur', onBlur)
    return () => {
      editor.off('selectionUpdate', handler)
      editor.off('blur', onBlur)
    }
  }, [editor])

  if (state === null) {
    return { from: null, to: null, text: null, anchorRect: null, close }
  }
  return { ...state, close }
}
