/**
 * ProseMirror JSON node shape (subset we walk).
 */
export type PMMark = { type: string; attrs?: Record<string, unknown> }
export type PMNode = {
  type: string
  text?: string
  marks?: PMMark[]
  content?: PMNode[]
}

export interface MarkRange {
  from: number // character offset within doc text
  to: number
  attrs: Record<string, unknown>
}

/**
 * Walk a ProseMirror JSON doc and return all character ranges that carry the
 * named mark, along with the mark's attrs. Ranges are based on text-only offsets
 * (the same offsets TipTap reports via editor.state.doc.textBetween).
 */
export function findMarkRanges(doc: PMNode, markName: string): MarkRange[] {
  const out: MarkRange[] = []
  let offset = 0
  let openRange: MarkRange | null = null

  function flush() {
    if (openRange) {
      out.push(openRange)
      openRange = null
    }
  }

  function walk(node: PMNode) {
    if (node.type === 'text' && typeof node.text === 'string') {
      const mark = node.marks?.find((m) => m.type === markName)
      if (mark) {
        const attrs = mark.attrs ?? {}
        if (openRange && shallowEqAttrs(openRange.attrs, attrs)) {
          openRange.to = offset + node.text.length
        } else {
          flush()
          openRange = { from: offset, to: offset + node.text.length, attrs }
        }
      } else {
        flush()
      }
      offset += node.text.length
      return
    }
    flush() // block boundaries break marked runs
    if (node.content) for (const child of node.content) walk(child)
  }

  walk(doc)
  flush()
  return out
}

function shallowEqAttrs(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => a[k] === b[k])
}

/**
 * Given a doc and a set of known mark ids (the rows that exist in DB), report:
 *  - orphanRows: ids that the DB has but no mark exists for (anchor lost — author deleted the text)
 *  - orphanMarks: ids the doc has but no DB row exists (DB row deleted out-of-band; rare)
 */
export function findOrphanMarks(
  doc: PMNode,
  markName: string,
  attrKey: string,
  dbIds: readonly string[],
): { orphanRows: string[]; orphanMarks: string[] } {
  const ranges = findMarkRanges(doc, markName)
  const docIds = new Set<string>()
  for (const r of ranges) {
    const id = r.attrs[attrKey]
    if (typeof id === 'string') docIds.add(id)
  }
  const dbSet = new Set(dbIds)
  return {
    orphanRows: [...dbSet].filter((id) => !docIds.has(id)),
    orphanMarks: [...docIds].filter((id) => !dbSet.has(id)),
  }
}
