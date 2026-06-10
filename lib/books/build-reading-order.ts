// Reader-side helper that takes the flat binder items + joined chapters for
// a book and produces two views: a flat reading-order array (used by
// Prev/Next navigation and progress totals) and a structured tree (used by
// <ChaptersPanel> to render top-level chapters and collapsible collection
// cards).
//
// Why: binder_items.order is parent-scoped, not global. A query that filters
// to type='chapter' and orders by binderItems.order alone produces an
// incorrect reading order whenever a book has collections (type='part') with
// chapters nested inside them. This helper resolves the global reading order
// by walking the tree depth-first, respecting per-parent order at each level.

import type { ChapterStatus } from './is-chapter-reader-visible'

export interface RawBinderRow {
  id: string
  parentId: string | null
  type: 'chapter' | 'part'
  order: number
  title: string
  // Joined chapters columns. Null on type='part' rows because parts have no
  // chapters row.
  chapterId: string | null
  status: ChapterStatus | null
  updatedAt: Date | string | null
}

export interface ReadingChapter {
  binderItemId: string
  chapterId: string
  title: string
  status: ChapterStatus
  updatedAt: Date | string
  // The id of the parent collection (binder item id of the 'part'), if any.
  collectionId: string | null
}

export type ReadingNode =
  | { kind: 'chapter'; chapter: ReadingChapter }
  | {
      kind: 'collection'
      binderItemId: string
      title: string
      children: ReadingChapter[]
    }

export interface ReadingOrder {
  // Flat, depth-first reading order across the whole book. Chapters only,
  // collections excluded. The order Prev/Next walks, the order the progress
  // bar segments are laid out.
  flat: ReadingChapter[]
  // Top-level nodes for rendering. Each node is either a chapter or a
  // collection. Collections carry their child chapters in reading order.
  tree: ReadingNode[]
}

/**
 * Build the reading order for a book from its raw binder rows.
 *
 * Rules:
 *  - Only chapter rows (type='chapter' with a non-null chapterId) appear in
 *    `flat`. Parts (collections) act purely as grouping headers in `tree`.
 *  - Chapters nested below a collection appear AFTER any siblings of the
 *    collection at the same root order — that is, the collection occupies
 *    a single "slot" in the reading order, and its children expand into the
 *    flat list at that slot.
 *  - Nesting beyond one level is not supported (the binder's drop-rules
 *    enforce this — parts only accept chapters, not other parts). We treat
 *    any deeper nesting as flat fallback to be safe.
 *  - Orphan chapters (parentId pointing at a missing/non-part row) fall
 *    back to the top level so they don't disappear from the reader.
 */
export function buildReadingOrder(rows: RawBinderRow[]): ReadingOrder {
  const byId = new Map<string, RawBinderRow>()
  for (const row of rows) byId.set(row.id, row)

  // Group rows by parentId. Sort each group by their per-parent order.
  const childrenByParent = new Map<string | null, RawBinderRow[]>()
  for (const row of rows) {
    // Resolve effective parent: if parentId points at a non-existent or
    // non-part row, treat the row as top-level so it stays reachable.
    const parent = row.parentId ? byId.get(row.parentId) : null
    const effectiveParentId =
      parent && parent.type === 'part' ? parent.id : null
    const bucket = childrenByParent.get(effectiveParentId) ?? []
    bucket.push(row)
    childrenByParent.set(effectiveParentId, bucket)
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => a.order - b.order)
  }

  const flat: ReadingChapter[] = []
  const tree: ReadingNode[] = []

  const roots = childrenByParent.get(null) ?? []

  for (const row of roots) {
    if (row.type === 'part') {
      const kids = (childrenByParent.get(row.id) ?? []).filter(
        (k): k is RawBinderRow & { chapterId: string; status: ChapterStatus; updatedAt: Date | string } =>
          k.type === 'chapter' && k.chapterId !== null && k.status !== null && k.updatedAt !== null,
      )
      const children: ReadingChapter[] = kids.map((k) => ({
        binderItemId: k.id,
        chapterId: k.chapterId,
        title: k.title,
        status: k.status,
        updatedAt: k.updatedAt,
        collectionId: row.id,
      }))
      tree.push({
        kind: 'collection',
        binderItemId: row.id,
        title: row.title,
        children,
      })
      for (const child of children) flat.push(child)
      continue
    }

    // type === 'chapter' at the root
    if (row.chapterId === null || row.status === null || row.updatedAt === null) continue
    const ch: ReadingChapter = {
      binderItemId: row.id,
      chapterId: row.chapterId,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt,
      collectionId: null,
    }
    tree.push({ kind: 'chapter', chapter: ch })
    flat.push(ch)
  }

  return { flat, tree }
}
