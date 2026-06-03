import type { PMNode } from './mark-scanning'

/**
 * Convert a ProseMirror position to a text-only character offset.
 *
 * ProseMirror positions count BOTH text characters AND block-boundary steps
 * (each open or close tag = +1). text offsets count ONLY text characters.
 * `patchDocWithMark` and `findMarkRanges` work in text offsets; the editor's
 * `state.selection.{from,to}` reports PM positions. Without conversion, marks
 * get applied to the wrong range — or, for documents where PM > total text,
 * silently skipped entirely (which surfaces as "the annotation I just made is
 * showing up in the Orphaned list").
 *
 * The walker tracks both cursors simultaneously and stops once the PM cursor
 * reaches the target.
 */
export function pmPosToTextOffset(doc: PMNode, pmPos: number): number {
  if (pmPos <= 0) return 0
  let pmCursor = 0
  let textCursor = 0

  function walk(node: PMNode): boolean {
    if (pmCursor >= pmPos) return true

    if (node.type === 'text' && typeof node.text === 'string') {
      const len = node.text.length
      const remaining = pmPos - pmCursor
      if (remaining <= len) {
        textCursor += remaining
        pmCursor = pmPos
        return true
      }
      pmCursor += len
      textCursor += len
      return false
    }

    // The doc node doesn't consume positions itself; only its descendants do.
    const isContainer = node.type !== 'doc'

    if (isContainer) {
      pmCursor += 1 // entering the block consumes one PM position
      if (pmCursor >= pmPos) return true
    }

    if (node.content) {
      for (const child of node.content) {
        if (walk(child)) return true
      }
    }

    if (isContainer) {
      pmCursor += 1 // exiting the block consumes one PM position
      if (pmCursor >= pmPos) return true
    }

    return false
  }

  walk(doc)
  return textCursor
}
