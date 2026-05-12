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
