import type { PMNode, PMMark } from './mark-scanning'

/**
 * Walk a ProseMirror JSON doc and add `markName` (with `attrs`) to all text
 * within `[from, to)` — where `from`/`to` are **ProseMirror positions**, the
 * same coordinate system the editor reports via `editor.state.selection.{from,to}`.
 *
 * ProseMirror positions count:
 *   - text characters: 1 each
 *   - non-leaf block boundary (e.g. paragraph open/close): 1 each
 *   - leaf inline atoms (hardBreak, image, horizontalRule, etc.): 1 each
 *
 * Without correct PM accounting, the mark either lands in the wrong range or
 * — when the target exceeds total text characters — silently drops the patch
 * entirely. The visible failure is "I just created an annotation and it shows
 * up in the Orphaned tab immediately."
 *
 * Returns a new doc with the affected branches cloned along the path of the
 * edit; the input is treated as immutable.
 */
export function patchDocWithMark(
  doc: PMNode,
  markName: string,
  attrs: Record<string, unknown>,
  from: number,
  to: number,
): PMNode {
  let pmCursor = 0
  const newMark: PMMark = { type: markName, attrs }

  function walk(node: PMNode): PMNode {
    if (node.type === 'text' && typeof node.text === 'string') {
      const start = pmCursor
      const end = pmCursor + node.text.length
      pmCursor = end

      if (end <= from || start >= to) return node

      const sliceStart = Math.max(from, start) - start
      const sliceEnd = Math.min(to, end) - start

      const head = node.text.slice(0, sliceStart)
      const mid = node.text.slice(sliceStart, sliceEnd)
      const tail = node.text.slice(sliceEnd)

      const pieces: PMNode[] = []
      if (head.length > 0) pieces.push(cloneTextWithSameMarks(node, head))
      if (mid.length > 0) pieces.push(cloneTextWithExtraMark(node, mid, newMark))
      if (tail.length > 0) pieces.push(cloneTextWithSameMarks(node, tail))

      if (pieces.length === 1) return pieces[0]
      return { type: '__split__', content: pieces }
    }

    // The doc node itself doesn't consume a position; its descendants do.
    const isDoc = node.type === 'doc'
    const hasChildren = !!(node.content && node.content.length > 0)
    // Leaf inline atoms (hardBreak, image, etc.) take 1 PM position with no
    // descendants. Containers — paragraph, heading, blockquote, list, etc. —
    // take 1 position to enter, then content, then 1 to exit. An empty
    // paragraph (no content) is still a container in PM (2 positions), but in
    // serialized JSON it shows up as `{type: 'paragraph'}` with no `content`
    // key — indistinguishable from a leaf at the JSON level. We use the
    // heuristic: empty `content`-less nodes that are KNOWN block types get
    // container treatment; everything else without children is a leaf.
    const isLeaf = !isDoc && !hasChildren && !KNOWN_EMPTY_BLOCK_TYPES.has(node.type)

    if (isLeaf) {
      pmCursor += 1
      return node
    }

    if (!isDoc) pmCursor += 1 // entering this container

    if (!hasChildren) {
      // Empty container (e.g. empty paragraph): just exit and return.
      if (!isDoc) pmCursor += 1
      return node
    }

    const newChildren: PMNode[] = []
    let changed = false
    for (const child of node.content!) {
      const result = walk(child)
      if (result.type === '__split__' && result.content) {
        newChildren.push(...result.content)
        changed = true
      } else {
        newChildren.push(result)
        if (result !== child) changed = true
      }
    }

    if (!isDoc) pmCursor += 1 // exiting

    if (!changed) return node
    return { ...node, content: newChildren }
  }

  return walk(doc)
}

/**
 * Block-type names that can legitimately appear in JSON with no `content` key
 * but still consume container-shaped PM positions (2: enter + exit). Used by
 * patchDocWithMark to disambiguate empty containers from leaf inline atoms.
 */
const KNOWN_EMPTY_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'bulletList',
  'orderedList',
])

function cloneTextWithSameMarks(original: PMNode, text: string): PMNode {
  const out: PMNode = { type: 'text', text }
  if (original.marks) out.marks = original.marks.map((m) => ({ ...m }))
  return out
}

function cloneTextWithExtraMark(original: PMNode, text: string, extra: PMMark): PMNode {
  const out: PMNode = { type: 'text', text }
  const marks: PMMark[] = original.marks ? original.marks.map((m) => ({ ...m })) : []
  marks.push({ ...extra })
  out.marks = marks
  return out
}
