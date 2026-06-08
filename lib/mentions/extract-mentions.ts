// lib/mentions/extract-mentions.ts

type PMNode = {
  type: string
  content?: PMNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export function extractMentionUserIdsFromTiptap(doc: unknown): string[] {
  const seen = new Set<string>()
  walk(doc as PMNode, (node) => {
    if (node.type === 'text' && node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'mention') {
          const userId = mark.attrs?.userId
          if (typeof userId === 'string' && userId.length > 0) seen.add(userId)
        }
      }
    }
  })
  return Array.from(seen)
}

function walk(node: PMNode | undefined, visit: (n: PMNode) => void): void {
  if (!node || typeof node !== 'object') return
  visit(node)
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, visit)
  }
}

const MENTION_TEXT_REGEX = /@([a-z0-9_]{3,20})(?![a-z0-9_])/gi

export function extractMentionUsernamesFromText(text: string): string[] {
  if (!text) return []
  const seen = new Set<string>()
  for (const match of text.matchAll(MENTION_TEXT_REGEX)) {
    seen.add(match[1].toLowerCase())
  }
  return Array.from(seen)
}
