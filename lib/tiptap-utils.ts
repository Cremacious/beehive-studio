type TipTapNode = {
  type?: string
  text?: string
  content?: TipTapNode[]
  marks?: unknown[]
  attrs?: Record<string, unknown>
}

/**
 * Recursively extracts word count from a TipTap JSON document.
 * Works on any TipTap node (doc, paragraph, heading, text, etc.).
 */
export function extractWordCount(json: unknown): number {
  if (json === null || json === undefined) return 0
  if (typeof json !== 'object') return 0

  const node = json as TipTapNode
  let count = 0

  if (typeof node.text === 'string') {
    const words = node.text.trim().split(/\s+/).filter(Boolean)
    count += words.length
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      count += extractWordCount(child)
    }
  }

  return count
}

/**
 * Strips a TipTap JSON document (or legacy plain string) to plain text and
 * truncates to `maxLen` characters with an ellipsis. Used for hive wiki excerpts.
 */
export function tipTapToPlain(value: unknown, maxLen: number): string {
  let out = ''
  function walk(node: unknown): void {
    if (out.length >= maxLen) return
    if (node === null || node === undefined) return
    if (typeof node === 'string') {
      out += (out ? ' ' : '') + node
      return
    }
    if (typeof node !== 'object') return
    const n = node as TipTapNode
    if (typeof n.text === 'string') {
      out += (out && !out.endsWith(' ') ? ' ' : '') + n.text
      return
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        if (out.length >= maxLen) break
        walk(child)
      }
    }
  }
  walk(value)
  const trimmed = out.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLen) return trimmed
  return trimmed.slice(0, maxLen).trimEnd() + '…'
}
