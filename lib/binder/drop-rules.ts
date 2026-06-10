export type BinderItemType =
  | 'part'
  | 'chapter'
  | 'front_matter'
  | 'back_matter'
  | 'research_folder'
  | 'research_note'
  | 'character'
  | 'outline'
  | 'wiki_entry'
  | 'wiki_folder'

export type BinderItemLite = {
  id: string
  type: BinderItemType
  parentId: string | null
}

// Accept rules:
//  - `part` (collection): only chapters. Parts are manuscript-structure
//    containers; sub-parts and non-chapter document types live elsewhere.
//  - `research_folder`: every non-chapter document type. Research folders are
//    the catch-all organizer for notes, characters, outlines, front/back
//    matter, and sub-folders.
const ACCEPT_TABLE: Partial<Record<BinderItemType, BinderItemType[]>> = {
  part: ['chapter'],
  research_folder: [
    'research_note',
    'research_folder',
    'character',
    'outline',
    'front_matter',
    'back_matter',
  ],
  wiki_folder: ['wiki_entry', 'wiki_folder', 'character'],
}

export function getAcceptedChildTypes(containerType: BinderItemType): BinderItemType[] {
  return ACCEPT_TABLE[containerType] ?? []
}

/**
 * Returns true if `active` can be nested under `target`.
 * Rejects on:
 *  - target type doesn't accept active's type
 *  - active === target (self-nest)
 *  - target is a descendant of active (cycle)
 */
export function canNest(
  active: BinderItemLite,
  target: BinderItemLite,
  allItems: BinderItemLite[],
): boolean {
  if (active.id === target.id) return false
  const accepted = getAcceptedChildTypes(target.type)
  if (!accepted.includes(active.type)) return false

  // Cycle guard: walk up from target via parentId. If we hit active.id,
  // target is inside active's subtree — reject.
  const byId = new Map(allItems.map(i => [i.id, i]))
  let cursor: BinderItemLite | undefined = target
  const seen = new Set<string>()
  while (cursor) {
    if (cursor.id === active.id) return false
    if (seen.has(cursor.id)) break  // defensive against corrupt cycles
    seen.add(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return true
}

/**
 * Classifies pointer Y within a row's bounding rect.
 * - Folder rows: top 3px = before, bottom 3px = after, middle = middle (nest).
 *   The narrow edges make the nest band ~87% of the row, so users don't have
 *   to land precisely in the middle to nest. Reorder still works near the
 *   very top or bottom of the row.
 * - Non-folder rows: split at vertical midpoint — top half = before, bottom half = after.
 * Returns null only if pointer is outside the rect (defensive; caller should pre-check).
 */
export function classifyDropZone(
  pointerY: number,
  rowRect: { top: number; height: number },
  isFolder: boolean,
): 'before' | 'middle' | 'after' | null {
  const { top, height } = rowRect
  const bottom = top + height

  // Pointer ABOVE the row's top edge — caller asked to classify against this
  // row anyway (typically because it's the closest row to a pointer that fell
  // into the gap above the binder list). Treat as "drop before this row" so
  // users can land on the first position without precisely hitting the row's
  // 3px top band.
  if (pointerY < top) return 'before'
  // Pointer BELOW the row's bottom edge — symmetric: "drop after this row".
  if (pointerY > bottom) return 'after'

  const EDGE = 3
  if (isFolder) {
    if (pointerY - top < EDGE) return 'before'
    if (bottom - pointerY < EDGE) return 'after'
    return 'middle'
  }
  // Non-folder row: midpoint split.
  return pointerY - top < height / 2 ? 'before' : 'after'
}
