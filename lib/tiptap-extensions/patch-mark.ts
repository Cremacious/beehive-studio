import type { PMNode, PMMark } from './mark-scanning'

/**
 * Walk a ProseMirror JSON doc and add `markName` (with `attrs`) to all text
 * that falls within `[from, to)` (text-offset coordinates matching
 * `findMarkRanges`). Text outside the range keeps its existing marks; text
 * inside gets the new mark added alongside any existing marks. Text nodes
 * straddling the boundary are split.
 *
 * Treats input as immutable — returns a new doc with the affected branches
 * cloned along the path of the edit.
 */
export function patchDocWithMark(
  doc: PMNode,
  markName: string,
  attrs: Record<string, unknown>,
  from: number,
  to: number,
): PMNode {
  let offset = 0
  const newMark: PMMark = { type: markName, attrs }

  function walk(node: PMNode): PMNode {
    if (node.type === 'text' && typeof node.text === 'string') {
      const start = offset
      const end = offset + node.text.length
      offset = end

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

    if (node.content && node.content.length > 0) {
      const newChildren: PMNode[] = []
      let changed = false
      for (const child of node.content) {
        const result = walk(child)
        if (result.type === '__split__' && result.content) {
          newChildren.push(...result.content)
          changed = true
        } else {
          newChildren.push(result)
          if (result !== child) changed = true
        }
      }
      if (!changed) return node
      return { ...node, content: newChildren }
    }

    return node
  }

  return walk(doc)
}

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
