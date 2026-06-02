import { tipTapToPlain } from '@/lib/tiptap-utils'

/**
 * Build a card excerpt from wiki entry content. Handles both shapes:
 *
 *   New: { sections: Array<{ label, body }> } → joins "Label: body…" pieces
 *   Old: { body: TipTapDoc }                    → falls through to tipTapToPlain
 *
 * For the new shape, including labels in the excerpt makes the cards more
 * informative AND makes a substring search on the entry list match section
 * names (e.g., typing "geography" finds entries with a Geography section).
 */
export function extractWikiExcerpt(content: unknown, maxLen: number): string {
  if (!content || typeof content !== 'object') return ''
  const c = content as {
    sections?: Array<{ label?: string; body?: unknown }>
    body?: unknown
  }
  if (Array.isArray(c.sections)) {
    const parts: string[] = []
    for (const s of c.sections) {
      if (!s || typeof s !== 'object') continue
      const text = tipTapToPlain(s.body, maxLen).trim()
      const label = (s.label ?? '').trim()
      if (!text && !label) continue
      parts.push(text ? `${label || 'Section'}: ${text}` : label)
      if (parts.join(' · ').length >= maxLen) break
    }
    const joined = parts.join(' · ')
    return joined.length <= maxLen ? joined : joined.slice(0, maxLen).trimEnd() + '…'
  }
  return tipTapToPlain(c.body, maxLen)
}
