# Drag-into-Folder

**Date:** 2026-05-28
**Status:** Design approved, ready for plan-phase

## Problem

The binder side-panel supports sibling reorder via dnd-kit's `SortableContext` + `verticalListSortingStrategy`, but users can't drag a document into a folder (`part` or `research_folder`) to nest it. The existing `handleDragEnd` algorithm preserves the dragged item's original `parentId` — it only recomputes `order` within the existing parent group.

## Scope

Extend the binder's drag-and-drop so dropping onto a folder row nests, dropping between rows reorders. Type-strict accept rules. Visual drop indicators clearly distinguish the two intents. Auto-expand on hover for collapsed folders. No DB / schema changes — `binderItems.parentId` already exists and `reorderBinderItemsAction` already accepts arbitrary `{id, order, parentId}` tuples.

## 1. Accept rules

| Container | Accepts as children |
|---|---|
| `part` | `chapter`, `part` |
| `research_folder` | `research_note`, `research_folder` |

Non-container types (`front_matter`, `back_matter`, `character`, `outline`) are top-level only — they can be reordered among siblings but cannot be nested into any folder.

Cycle guard: a container cannot be nested into its own descendant. Drop rejected the same way as type mismatch.

Rejected drops produce no visual affordance during drag-over and no-op on drop.

## 2. Drop intent — three zones per row

Each folder row exposes three vertical drop zones for a dragged item:

1. **Top edge** (~6px band) → reorder before the folder. Indicator: thin brand-yellow horizontal line above the row.
2. **Middle body** (rest of the row) → nest into the folder. Indicator: folder row gets a brand-yellow ring + `bg-brand/10` tint. Whole row lights up.
3. **Bottom edge** (~6px band) → reorder after the folder. Indicator: thin brand-yellow horizontal line below the row.

Non-folder rows expose only the top + bottom zones — no "nest" middle band. Indicators identical to today's between-row reorder cue.

Pointer Y within the row's bounding rect determines the zone. Computed during `onDragOver`.

## 3. Auto-expand on hover

When a dragged item hovers the middle body of a **collapsed** folder for ~500ms, the folder auto-expands. If the cursor leaves the middle band before the timeout fires, the timer cancels and the folder stays collapsed.

If the folder is already expanded, no timer — middle-body hover continues to show the "nest" drop affordance.

Cleanup: timer cleared on drag end and on cursor leaving the row. No state persists past the drag.

## 4. Drop behavior

On `dragEnd`, the controller computes a single `DropIntent`:

```ts
type DropIntent =
  | { kind: 'reorder-before'; siblingId: string }
  | { kind: 'reorder-after'; siblingId: string }
  | { kind: 'nest-into'; folderId: string }
  | { kind: 'reject' }
```

Branches:

- **`reorder-before` / `reorder-after`** — dragged item adopts the sibling's `parentId`; order recomputed within that parent group via the existing algorithm.
- **`nest-into`** — dragged item's `parentId` becomes the folder's id; its `order` becomes `(maxOrderInFolder + 1)`. Other items in the folder don't reshuffle.
- **`reject`** — no-op. No optimistic update, no server call.

All updates flow through the existing `reorderBinderItemsAction(bookId, updates[])`. No server-action changes.

Optimistic update + server reconciliation identical to today's flow.

## 5. Implementation notes

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx` — render the right drop indicator (top line / middle ring / bottom line) based on the current hovered zone.
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx` — replace the reorder-only `handleDragEnd` with a `DropIntent`-driven branch. Add an `onDragOver` handler that tracks the hovered row + zone in state so children render the indicator. Auto-expand timer lives here.
- Create: `lib/binder/drop-rules.ts` — pure helper functions, unit-testable without React.
- Create: `lib/binder/drop-rules.test.ts` — vitest unit tests in `__tests__/` (or co-located per existing convention; verify before writing).

**Pure helpers in `lib/binder/drop-rules.ts`:**

```ts
type BinderItemType = 'part' | 'chapter' | 'front_matter' | 'back_matter'
  | 'research_folder' | 'research_note' | 'character' | 'outline'

function getAcceptedChildTypes(containerType: BinderItemType): BinderItemType[]
function canNest(activeItem, targetFolder, allItems): boolean   // type + cycle guard
function classifyDropZone(pointerY: number, rowRect: DOMRect, isFolder: boolean):
  'before' | 'middle' | 'after' | null
```

Edge band: 6px top + 6px bottom of the row; middle is everything else (when `isFolder=true`). Non-folder rows return `'before'` or `'after'` (split at row's vertical midpoint).

**Drop-zone state model in `binder-tree.tsx`:**

```ts
type DropZoneState = { overId: string; zone: 'before' | 'middle' | 'after' } | null
```

Held in component state; propagated to `BinderItem` via context (extend the existing `BinderTreeContext`) so each row knows whether it's the current drop target and which zone is active.

**Cycle guard:** `canNest` walks `allItems` up from `targetFolder.id` checking `parentId`. If it ever equals `activeItem.id`, the drop is a cycle.

**Verify pre-flight:** confirm `reorderBinderItemsAction` does NOT reject parent transitions. If it does (e.g., by re-running ownership checks per-item that happen to fail when the same id appears twice), we adapt then.

## 6. Testing

- **Unit tests in `lib/binder/drop-rules.test.ts`:**
  - `getAcceptedChildTypes` for both containers + non-containers (returns empty list).
  - `canNest`: chapter→part (ok), part→part (ok same-type), character→part (rejected, type), chapter→research_folder (rejected, type), part-A→part-A (rejected, cycle), part-A→part-A's child (rejected, cycle).
  - `classifyDropZone`: pointer in top 6px → 'before'; pointer in bottom 6px → 'after'; pointer in middle of folder row → 'middle'; pointer in middle of non-folder row → splits at midpoint (top half = 'before', bottom half = 'after').
- **No new E2E tests.** Project convention is vitest unit + tsc + manual smoke.
- **Manual smoke (Chris runs):**
  1. Drag chapter onto middle of part → nests at bottom of part's children.
  2. Drag chapter onto top edge of part → reorders before the part (same level as part).
  3. Drag chapter onto bottom edge of part → reorders after the part.
  4. Drag character onto part → no drop indicator shown; drop is a no-op.
  5. Drag chapter onto research_folder → no drop indicator (type mismatch).
  6. Drag part-A onto a chapter that's inside part-A → no drop indicator (cycle).
  7. Hover collapsed folder body for ~500ms while dragging → folder auto-expands.
  8. Drag chapter OUT of a part by dropping between two top-level items → un-nests via existing reorder logic (chapter's new parentId becomes the target sibling's parentId, i.e., null).
  9. Existing sibling-reorder behavior still works (drag chapter A above chapter B within same part).
  10. tsc + npm test clean.

## 7. Out of scope

- Drop indicator animations beyond ring/line.
- Cross-binder moves (research ↔ manuscript) — type-strict precludes these.
- Multi-select drag.
- New touch / keyboard drag affordances (whatever PointerSensor + KeyboardSensor already handle is preserved).
- Smart insertion within a folder. Drop into folder always appends to bottom.
- Server-side accept-rule enforcement. Validation is client-side only. Add later if needed.
