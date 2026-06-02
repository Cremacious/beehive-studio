import { createId } from '@paralleldrive/cuid2'

export type WikiSection = {
  id: string
  label: string
  body: unknown // TipTap doc JSON
}

const EMPTY_DOC = (): unknown => ({ type: 'doc', content: [{ type: 'paragraph' }] })

/**
 * Build a fresh sections array from template seeds (label + per-section hint).
 * The hint isn't embedded in the body — it's surfaced as the section's
 * placeholder by the editor. Each section starts with an empty doc.
 */
export function seedSectionsFromTemplate(
  seeds: ReadonlyArray<{ label: string; hint: string }>,
): WikiSection[] {
  return seeds.map(s => ({
    id: `s_${createId()}`,
    label: s.label,
    body: EMPTY_DOC(),
  }))
}

/**
 * Map of section.id → placeholder hint for new entries seeded from a
 * category template. The editor reads this when constructing per-section
 * Placeholder extension configs.
 */
export function buildHintMap(
  sections: WikiSection[],
  seeds: ReadonlyArray<{ label: string; hint: string }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < sections.length && i < seeds.length; i++) {
    out[sections[i].id] = seeds[i].hint
  }
  return out
}

type TipTapNode = {
  type?: string
  text?: string
  content?: TipTapNode[]
  marks?: unknown[]
  attrs?: Record<string, unknown>
}

/**
 * Lazy migration: split a legacy TipTap doc body (with H2 headings as section
 * dividers) into the new sections array. Lossless for entries that follow the
 * template pattern. Entries with no H2s become a single section labeled "Notes".
 */
export function migrateBodyToSections(body: unknown): WikiSection[] {
  if (!body || typeof body !== 'object') {
    return [{ id: `s_${createId()}`, label: 'Notes', body: EMPTY_DOC() }]
  }
  const doc = body as TipTapNode
  const nodes = Array.isArray(doc.content) ? doc.content : []

  const result: WikiSection[] = []
  let current: WikiSection | null = null

  function flush() {
    if (current) result.push(current)
  }

  function appendNode(n: TipTapNode) {
    if (!current) {
      current = { id: `s_${createId()}`, label: 'Notes', body: { type: 'doc', content: [] } }
    }
    const docBody = current.body as TipTapNode
    if (!Array.isArray(docBody.content)) docBody.content = []
    docBody.content.push(n)
  }

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'heading' && (node.attrs as { level?: number } | undefined)?.level === 2) {
      // Start a new section
      flush()
      const labelText = extractInlineText(node)
      current = {
        id: `s_${createId()}`,
        label: labelText.trim() || 'Untitled section',
        body: { type: 'doc', content: [] },
      }
    } else if (node.type === 'heading') {
      // H1/H3+ — demote to a bold paragraph at the section's body level so
      // prose isn't lost. Wrap the inline content with a bold mark.
      const inline = Array.isArray(node.content) ? node.content : []
      const wrapped = inline.map(child => {
        if (child && typeof child === 'object' && child.type === 'text') {
          const existing = Array.isArray(child.marks) ? child.marks : []
          return { ...child, marks: [...existing, { type: 'bold' }] }
        }
        return child
      })
      appendNode({ type: 'paragraph', content: wrapped })
    } else {
      appendNode(node)
    }
  }
  flush()

  if (result.length === 0) {
    return [{ id: `s_${createId()}`, label: 'Notes', body: EMPTY_DOC() }]
  }
  // Ensure every section has at least an empty paragraph (TipTap requires
  // non-empty content arrays for the placeholder extension to render).
  for (const s of result) {
    const b = s.body as TipTapNode
    if (!Array.isArray(b.content) || b.content.length === 0) {
      b.content = [{ type: 'paragraph' }]
    }
  }
  return result
}

function extractInlineText(node: TipTapNode): string {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content.map(extractInlineText).join('')
}

/** Construct an empty section with a generic label for + Add section. */
export function newBlankSection(label = 'New section'): WikiSection {
  return { id: `s_${createId()}`, label, body: EMPTY_DOC() }
}
