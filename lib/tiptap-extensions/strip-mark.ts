import type { PMNode, PMMark } from './mark-scanning'

/**
 * Walk a ProseMirror JSON doc and remove every instance of `markName` whose
 * `attrs[attrKey] === id`. Returns a new doc with the affected branches cloned
 * along the path of the edit; the input is treated as immutable. Other marks
 * on the same text node (e.g. bold/italic) are preserved.
 *
 * Used server-side after resolveAnnotation / rejectSuggestion so the highlight
 * disappears from the chapter content on the next reader load, not just the
 * surface that issued the mutation.
 */
export function stripMarkById(
  doc: PMNode,
  markName: string,
  attrKey: string,
  id: string,
): { doc: PMNode; stripped: boolean } {
  let stripped = false

  function walk(node: PMNode): PMNode {
    if (node.type === 'text' && node.marks && node.marks.length > 0) {
      const next: PMMark[] = []
      let nodeChanged = false
      for (const m of node.marks) {
        if (
          m.type === markName &&
          (m.attrs as Record<string, unknown> | undefined)?.[attrKey] === id
        ) {
          stripped = true
          nodeChanged = true
          continue
        }
        next.push(m)
      }
      if (!nodeChanged) return node
      const out: PMNode = { type: 'text', text: node.text }
      if (next.length > 0) out.marks = next
      return out
    }

    if (!node.content || node.content.length === 0) return node

    const newChildren: PMNode[] = []
    let changed = false
    for (const child of node.content) {
      const result = walk(child)
      newChildren.push(result)
      if (result !== child) changed = true
    }
    if (!changed) return node
    return { ...node, content: newChildren }
  }

  return { doc: walk(doc), stripped }
}
