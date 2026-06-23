// Single source of truth for turning a book's raw binder rows into the ordered
// list of export inputs consumed by ALL three export formats (DOCX, EPUB, PDF).
//
// Previously this logic lived inline in the export route. Extracting it here
// means every format honors the same rules:
//   - empty TipTap chapters are skipped (no blank pages),
//   - empty front/back-matter subtypes are skipped (no phantom nav items),
//   - chapters are emitted in GLOBAL reading order (collections/parts resolved
//     via buildReadingOrder, not parent-scoped binder order).

import type { ChapterInput } from './docx'
import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'
import { buildReadingOrder } from '@/lib/books/build-reading-order'
import {
  renderTitlePage,
  renderCopyright,
  renderDedication,
  renderAcknowledgments,
  renderAboutAuthor,
} from './front-back-matter-templates'

export type ExportRow = {
  id: string
  parentId: string | null
  type: string
  title: string | null
  order: number
  chapterId: string | null
  chapterContent: unknown
  chapterStatus: ChapterStatus | null
  chapterUpdatedAt: Date | string | null
  binderContent: unknown
}

// Walk a TipTap doc; return true if it contains no non-whitespace text.
export function isTiptapEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (typeof value !== 'object') return true
  const stack: unknown[] = [value]
  const seen = new Set<unknown>()
  while (stack.length > 0) {
    const n = stack.pop()
    if (!n || typeof n !== 'object' || seen.has(n)) continue
    seen.add(n)
    const node = n as { text?: string; content?: unknown[] }
    if (typeof node.text === 'string' && node.text.trim().length > 0) return false
    if (Array.isArray(node.content)) for (const c of node.content) stack.push(c)
  }
  return true
}

function isStr(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

// Map a single front/back-matter binder row to an export input, or null if it
// should be skipped (empty prose / empty specialized fields).
export function fbmRowToInput(row: ExportRow): ChapterInput | null {
  const c = row.binderContent as
    | { subtype?: string | null; fields?: Record<string, unknown> }
    | null

  // Legacy item (content === null) — use TipTap chapter content. Skip if
  // there's no prose to emit (would render as a blank page).
  if (c === null || c === undefined) {
    if (isTiptapEmpty(row.chapterContent)) return null
    return { title: row.title ?? '', content: row.chapterContent }
  }

  // Custom subtype (or no subtype) — use TipTap chapter content. Same
  // emptiness check.
  if (c.subtype === 'custom' || !c.subtype) {
    if (isTiptapEmpty(row.chapterContent)) return null
    return { title: row.title ?? '', content: row.chapterContent }
  }

  // Specialized subtype — emit only if at least one required field is set.
  // Templates render whatever fields are present (and gracefully omit ones
  // that aren't), but a totally empty fields object would still consume a
  // page header and add a phantom nav item.
  const fields = (c.fields ?? {}) as Record<string, unknown>
  switch (c.subtype) {
    case 'title_page':
      if (!isStr(fields.bookTitle) && !isStr(fields.authorName)) return null
      break
    case 'copyright':
      if (!fields.copyrightYear && !isStr(fields.copyrightHolder)) return null
      break
    case 'dedication':
      if (!isStr(fields.text)) return null
      break
    case 'acknowledgments':
      if (isTiptapEmpty(fields.text)) return null
      break
    case 'about_author':
      if (isTiptapEmpty(fields.bio) && !isStr(fields.photoUrl)) return null
      break
  }

  // Specialized subtype — render via template, suppress title heading.
  // We keep row.title on the input so the epub nav still has a label.
  const title = row.title ?? ''
  switch (c.subtype) {
    case 'title_page':
      return {
        title,
        content: null,
        htmlOverride: renderTitlePage(fields as Parameters<typeof renderTitlePage>[0]),
      }
    case 'copyright':
      return {
        title,
        content: null,
        htmlOverride: renderCopyright(fields as Parameters<typeof renderCopyright>[0]),
      }
    case 'dedication':
      return {
        title,
        content: null,
        htmlOverride: renderDedication(fields as Parameters<typeof renderDedication>[0]),
      }
    case 'acknowledgments':
      return {
        title,
        content: null,
        htmlOverride: renderAcknowledgments(
          fields as Parameters<typeof renderAcknowledgments>[0],
        ),
      }
    case 'about_author':
      return {
        title,
        content: null,
        htmlOverride: renderAboutAuthor(fields as Parameters<typeof renderAboutAuthor>[0]),
      }
    default:
      return null // unknown subtype — skip silently
  }
}

export type BuildExportInputsResult = {
  front: ChapterInput[]
  chapters: ChapterInput[]
  back: ChapterInput[]
  all: ChapterInput[]
}

/**
 * Assemble the ordered export inputs for a book. Shared by every format so
 * DOCX, EPUB, and PDF stay in lockstep. `chapters` is empty when the book has
 * no exportable prose — callers should return the existing 400 guard.
 */
export function buildExportInputs(rows: ExportRow[]): BuildExportInputsResult {
  const front = rows
    .filter((r) => r.type === 'front_matter')
    .map((r) => fbmRowToInput(r))
    .filter((x): x is ChapterInput => x !== null)

  // Chapter rows need GLOBAL reading order, not parent-scoped binder order —
  // otherwise chapters nested inside a collection (`part`) come out in the
  // wrong sequence.
  const chapterOrder = buildReadingOrder(
    rows
      .filter((r) => r.type === 'chapter' || r.type === 'part')
      .map((r) => ({
        id: r.id,
        parentId: r.parentId,
        type: r.type as 'chapter' | 'part',
        order: r.order,
        title: r.title ?? '',
        chapterId: r.chapterId,
        status: r.chapterStatus,
        updatedAt: r.chapterUpdatedAt,
      })),
  )
  const rowsByChapterId = new Map(
    rows.filter((r) => r.chapterId).map((r) => [r.chapterId as string, r]),
  )
  const chapters = chapterOrder.flat
    .map((c) => rowsByChapterId.get(c.chapterId))
    .filter((r): r is ExportRow => r != null)
    .map((r) => ({ title: r.title ?? 'Untitled', content: r.chapterContent }))
    .filter((x) => !isTiptapEmpty(x.content))

  const back = rows
    .filter((r) => r.type === 'back_matter')
    .map((r) => fbmRowToInput(r))
    .filter((x): x is ChapterInput => x !== null)

  return { front, chapters, back, all: [...front, ...chapters, ...back] }
}
