// Stored on binderItems.content for type 'research_note' items.
// Legacy items may have content as a plain string (pre-feature) or null;
// normalizeNoteContent handles all three shapes.

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple'

export const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'green', 'pink', 'purple']

export const NOTE_COLOR_HEX: Record<NoteColor, string> = {
  yellow: '#FFC300', // brand
  blue:   '#6BB6FF',
  green:  '#7CD994',
  pink:   '#FF9FBB',
  purple: '#C99FFF',
}

export type ResearchNoteContent = {
  text: unknown               // TipTap doc JSON
  pinned?: boolean
  color?: NoteColor | null
  favorited?: boolean
}

export function emptyDoc(): unknown {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function wrapStringInDoc(s: string): unknown {
  if (s.length === 0) return emptyDoc()
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: s }],
    }],
  }
}

function isValidColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as string[]).includes(value)
}

export function normalizeNoteContent(raw: unknown): ResearchNoteContent {
  if (raw === null || raw === undefined) {
    return { text: emptyDoc(), pinned: false, color: null, favorited: false }
  }
  if (typeof raw === 'string') {
    return { text: wrapStringInDoc(raw), pinned: false, color: null, favorited: false }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const text = obj.text ?? emptyDoc()
    const pinned = obj.pinned === true
    const color: NoteColor | null = isValidColor(obj.color) ? obj.color : null
    const favorited = obj.favorited === true
    return { text, pinned, color, favorited }
  }
  // Unknown shape — fall back to defaults
  return { text: emptyDoc(), pinned: false, color: null, favorited: false }
}
