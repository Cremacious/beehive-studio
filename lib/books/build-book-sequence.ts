// Top-level book sequence builder. Combines front matter, chapters (via
// buildReadingOrder for collection grouping), and back matter into a single
// linear sequence the public reader can render + navigate.
//
// Order policy: all front matter items (sorted by binder order, ascending)
// → all chapters in reading order → all back matter items (binder order
// ascending). This mirrors what the export pipeline already does and what
// a printed book actually looks like.

import type { ChapterStatus } from './is-chapter-reader-visible'
import {
  buildReadingOrder,
  type RawBinderRow,
  type ReadingChapter,
  type ReadingNode,
} from './build-reading-order'

export type FbmSubtype =
  | 'title_page'
  | 'copyright'
  | 'dedication'
  | 'acknowledgments'
  | 'about_author'
  | 'custom'
  | null

export interface FbmEntry {
  binderItemId: string
  chapterId: string  // FBM items always get a chapters row at create time.
  type: 'front_matter' | 'back_matter'
  title: string
  subtype: FbmSubtype
  fields: Record<string, unknown>
  // The chapters.content TipTap doc — used for `custom` subtype + legacy
  // items (content=null on binder_items). Non-null on every chapters row.
  content: unknown
  updatedAt: Date | string
}

export interface RawBookRow {
  id: string
  parentId: string | null
  type: 'chapter' | 'part' | 'front_matter' | 'back_matter'
  order: number
  title: string
  chapterId: string | null
  status: ChapterStatus | null
  updatedAt: Date | string | null
  binderContent: unknown
  // chapters.content — only populated by reader-page-level callers that
  // also need the prose for `custom` FBM emptiness checks. List-only
  // callers can pass null.
  chapterContent?: unknown
}

export type SequenceEntry =
  | { kind: 'fbm'; entry: FbmEntry }
  | { kind: 'chapter'; chapter: ReadingChapter }

export interface BookSequence {
  frontMatter: FbmEntry[]
  chapters: ReadingChapter[]      // flat reading order, collections folded out
  chaptersTree: ReadingNode[]     // structured tree for the reader UI
  backMatter: FbmEntry[]
  // Concatenated FM → chapters → BM, used by the chapter reader for
  // Prev / Next navigation across the whole book sequence.
  allInOrder: SequenceEntry[]
}

function fbmFromRow(row: RawBookRow): FbmEntry | null {
  // Skip if no chapters row was joined — FBM items always have one (created
  // alongside the binder item), so a missing join row means a corrupt or
  // partially-created item; safest to omit.
  if (!row.chapterId || !row.updatedAt) return null

  const binder = row.binderContent as
    | { subtype?: FbmSubtype | string | null; fields?: Record<string, unknown> }
    | null
  const subtype = (binder?.subtype ?? null) as FbmSubtype
  const fields = (binder?.fields ?? {}) as Record<string, unknown>

  return {
    binderItemId: row.id,
    chapterId: row.chapterId,
    type: row.type as 'front_matter' | 'back_matter',
    title: row.title,
    subtype,
    fields,
    content: row.chapterContent ?? null,
    updatedAt: row.updatedAt,
  }
}

/**
 * Build the full reading sequence for a book.
 *
 * Inputs: every binder item of type chapter / part / front_matter / back_matter,
 * LEFT-joined to its chapters row (so chapter content + status + updatedAt
 * are present). For FBM, also carry binder_items.content (where subtype +
 * fields live).
 *
 * Output: three ordered slices + a concatenated traversal list.
 *
 * Status filtering (REVISED / FINAL gate for non-authors) is left to the
 * caller — this helper returns everything; the caller filters by visibility.
 */
export function buildBookSequence(rows: RawBookRow[]): BookSequence {
  // Front + back matter: simple flat sort by binder order, top-level only.
  // (FBM items live at root; we deliberately don't nest them under parts.)
  const frontRaw = rows
    .filter(r => r.type === 'front_matter' && r.parentId === null)
    .sort((a, b) => a.order - b.order)
  const backRaw = rows
    .filter(r => r.type === 'back_matter' && r.parentId === null)
    .sort((a, b) => a.order - b.order)

  const frontMatter: FbmEntry[] = []
  for (const r of frontRaw) {
    const entry = fbmFromRow(r)
    if (entry) frontMatter.push(entry)
  }
  const backMatter: FbmEntry[] = []
  for (const r of backRaw) {
    const entry = fbmFromRow(r)
    if (entry) backMatter.push(entry)
  }

  // Chapters use the existing reading-order helper so collections work.
  // Pass only chapter + part rows so buildReadingOrder's logic isn't
  // confused by FBM types.
  const chapterRows: RawBinderRow[] = rows
    .filter(r => r.type === 'chapter' || r.type === 'part')
    .map(r => ({
      id: r.id,
      parentId: r.parentId,
      type: r.type as 'chapter' | 'part',
      order: r.order,
      title: r.title,
      chapterId: r.chapterId,
      status: r.status,
      updatedAt: r.updatedAt,
    }))
  const { flat: chapters, tree: chaptersTree } = buildReadingOrder(chapterRows)

  const allInOrder: SequenceEntry[] = [
    ...frontMatter.map(entry => ({ kind: 'fbm' as const, entry })),
    ...chapters.map(chapter => ({ kind: 'chapter' as const, chapter })),
    ...backMatter.map(entry => ({ kind: 'fbm' as const, entry })),
  ]

  return { frontMatter, chapters, chaptersTree, backMatter, allInOrder }
}

// Hide-on-non-author predicate: an FBM item with no usable content shouldn't
// appear on the public reader at all (otherwise it shows as an empty link).
// Authors always see their own items so they can populate them.
export function isFbmEntryEmpty(entry: FbmEntry, content: unknown): boolean {
  // `custom` + legacy (no subtype): blank when the TipTap content is empty.
  if (entry.subtype === 'custom' || entry.subtype === null) {
    return isTiptapDocEmpty(content)
  }
  // Specialized subtypes: blank when no required field is set.
  const f = entry.fields
  switch (entry.subtype) {
    case 'title_page':
      return !str(f.bookTitle) && !str(f.authorName)
    case 'copyright':
      return !f.copyrightYear && !str(f.copyrightHolder)
    case 'dedication':
      return !str(f.text)
    case 'acknowledgments':
      return isTiptapDocEmpty(f.text)
    case 'about_author':
      return isTiptapDocEmpty(f.bio)
    default:
      return true
  }
}

function str(v: unknown): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : ''
}

function isTiptapDocEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (typeof value !== 'object') return true
  // Walk a TipTap doc — empty if no text node anywhere has non-whitespace.
  const seen = new Set<unknown>()
  const stack: unknown[] = [value]
  while (stack.length > 0) {
    const n = stack.pop()
    if (!n || typeof n !== 'object' || seen.has(n)) continue
    seen.add(n)
    const node = n as { text?: string; content?: unknown[] }
    if (typeof node.text === 'string' && node.text.trim().length > 0) return false
    if (Array.isArray(node.content)) {
      for (const child of node.content) stack.push(child)
    }
  }
  return true
}
