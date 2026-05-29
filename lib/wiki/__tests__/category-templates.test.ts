import { describe, it, expect } from 'vitest'
import { CATEGORY_TEMPLATES, CATEGORY_TEMPLATE_MAP } from '../category-templates'

const ALL_CATEGORIES = [
  'CHARACTER','LOCATION','LORE','PLOT','ARTIFACT','FACTION','CULTURE',
  'LANGUAGE','BIOLOGY','THEME','ECONOMY','TERMINOLOGY','TIMELINE','OTHER',
] as const

describe('category templates', () => {
  it('exports exactly 14 templates', () => {
    expect(CATEGORY_TEMPLATES).toHaveLength(14)
  })
  it('covers every WikiCategory value', () => {
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_TEMPLATE_MAP[c]).toBeDefined()
      expect(CATEGORY_TEMPLATE_MAP[c].category).toBe(c)
    }
  })
  it('every defaultBody is a valid TipTap doc shape', () => {
    for (const t of CATEGORY_TEMPLATES) {
      const body = t.defaultBody as { type: string; content: unknown[] }
      expect(body.type).toBe('doc')
      expect(Array.isArray(body.content)).toBe(true)
      expect(body.content.length).toBeGreaterThan(0)
    }
  })
  it('every accentColor starts with --wiki-', () => {
    for (const t of CATEGORY_TEMPLATES) {
      expect(t.accentColor.startsWith('--wiki-')).toBe(true)
    }
  })
})
