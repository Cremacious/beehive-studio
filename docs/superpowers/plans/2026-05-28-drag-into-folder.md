# Drag-into-Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the binder's existing dnd-kit setup so dragging a document onto a folder row nests it. Three drop zones per folder row (top edge before, middle body nest, bottom edge after) + auto-expand on hover + type-strict accept rules + cycle guard. No DB / schema / server-action changes.

**Architecture:** Pure validation/classification helpers in a new `lib/binder/drop-rules.ts` module — unit-testable without React. `binder-tree.tsx` owns drop-intent state and routes drop behavior through one of three branches (reorder-before / reorder-after / nest-into). `binder-item.tsx` consumes the active drop-zone state via the existing `BinderTreeContext` and renders the appropriate indicator (top line / middle ring / bottom line). All updates flow through the existing `reorderBinderItemsAction` — confirmed pre-flight to accept arbitrary `{id, order, parentId}` tuples.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, dnd-kit (PointerSensor + SortableContext + verticalListSortingStrategy already wired), Tailwind v4, vitest.

**Spec:** [docs/superpowers/specs/2026-05-28-drag-into-folder-design.md](../specs/2026-05-28-drag-into-folder-design.md)

**Pre-flight findings (recorded from spec-phase grep):**
- `reorderBinderItemsAction(bookId, updates[])` already accepts arbitrary `{id, order, parentId}` tuples — see [lib/actions/binder.actions.ts:236-264](lib/actions/binder.actions.ts). Per-item update with the same `(eq(id), eq(bookId))` guard. Safe for parent transitions; no action changes needed.
- `lib/binder/` directory does NOT exist yet. Task 1 creates it.
- Existing test location convention: `lib/<module>/__tests__/*.test.ts` (see `lib/books/__tests__/can-read.test.ts`). Follow it.
- Existing item types from `BinderItemRow` (in `lib/actions/binder.actions.ts:23`): `'part' | 'chapter' | 'front_matter' | 'back_matter' | 'research_folder' | 'research_note' | 'character' | 'outline'`.

---

### Task 1: Pure helpers + unit tests

**Files:**
- Create: `lib/binder/drop-rules.ts`
- Create: `lib/binder/__tests__/drop-rules.test.ts`

- [ ] **Step 1: Write failing tests at `lib/binder/__tests__/drop-rules.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  getAcceptedChildTypes,
  canNest,
  classifyDropZone,
  type BinderItemLite,
} from '../drop-rules'

describe('getAcceptedChildTypes', () => {
  it('part accepts chapter and part', () => {
    expect(getAcceptedChildTypes('part').sort()).toEqual(['chapter', 'part'].sort())
  })
  it('research_folder accepts research_note and research_folder', () => {
    expect(getAcceptedChildTypes('research_folder').sort()).toEqual(['research_folder', 'research_note'].sort())
  })
  it('non-container types accept nothing', () => {
    expect(getAcceptedChildTypes('chapter')).toEqual([])
    expect(getAcceptedChildTypes('character')).toEqual([])
    expect(getAcceptedChildTypes('outline')).toEqual([])
    expect(getAcceptedChildTypes('front_matter')).toEqual([])
    expect(getAcceptedChildTypes('back_matter')).toEqual([])
    expect(getAcceptedChildTypes('research_note')).toEqual([])
  })
})

describe('canNest', () => {
  const items: BinderItemLite[] = [
    { id: 'partA', type: 'part', parentId: null },
    { id: 'partA-child1', type: 'chapter', parentId: 'partA' },
    { id: 'partA-sub', type: 'part', parentId: 'partA' },
    { id: 'partA-sub-child', type: 'chapter', parentId: 'partA-sub' },
    { id: 'partB', type: 'part', parentId: null },
    { id: 'folderA', type: 'research_folder', parentId: null },
    { id: 'noteA', type: 'research_note', parentId: null },
    { id: 'charA', type: 'character', parentId: null },
    { id: 'chapterTop', type: 'chapter', parentId: null },
  ]
  const get = (id: string) => items.find(i => i.id === id)!

  it('chapter into part is allowed', () => {
    expect(canNest(get('chapterTop'), get('partA'), items)).toBe(true)
  })
  it('part into part is allowed (sub-acts)', () => {
    expect(canNest(get('partB'), get('partA'), items)).toBe(true)
  })
  it('research_note into research_folder is allowed', () => {
    expect(canNest(get('noteA'), get('folderA'), items)).toBe(true)
  })
  it('character into part is rejected (type)', () => {
    expect(canNest(get('charA'), get('partA'), items)).toBe(false)
  })
  it('chapter into research_folder is rejected (type)', () => {
    expect(canNest(get('chapterTop'), get('folderA'), items)).toBe(false)
  })
  it('part into itself is rejected (cycle)', () => {
    expect(canNest(get('partA'), get('partA'), items)).toBe(false)
  })
  it("part into its own child is rejected (cycle)", () => {
    expect(canNest(get('partA'), get('partA-sub'), items)).toBe(false)
  })
  it("part into its own grandchild is rejected (cycle)", () => {
    expect(canNest(get('partA'), get('partA-sub-child'), items)).toBe(false)
  })
  it('nest into non-container is rejected (type)', () => {
    expect(canNest(get('chapterTop'), get('chapterTop'), items)).toBe(false)
  })
})

describe('classifyDropZone', () => {
  // Helper: build a DOMRect-like for tests
  const rect = (top: number, height: number) =>
    ({ top, height, bottom: top + height } as DOMRect)

  it('folder row: pointer in top 6px → before', () => {
    expect(classifyDropZone(102, rect(100, 32), true)).toBe('before')
  })
  it('folder row: pointer in bottom 6px → after', () => {
    expect(classifyDropZone(128, rect(100, 32), true)).toBe('after')
  })
  it('folder row: pointer in middle → middle', () => {
    expect(classifyDropZone(116, rect(100, 32), true)).toBe('middle')
  })
  it('non-folder row: top half → before', () => {
    expect(classifyDropZone(108, rect(100, 32), false)).toBe('before')
  })
  it('non-folder row: bottom half → after', () => {
    expect(classifyDropZone(124, rect(100, 32), false)).toBe('after')
  })
})
```

Run: `npm test -- drop-rules`
Expected: FAIL ("Cannot find module '../drop-rules'").

- [ ] **Step 2: Implement `lib/binder/drop-rules.ts`**

```ts
export type BinderItemType =
  | 'part'
  | 'chapter'
  | 'front_matter'
  | 'back_matter'
  | 'research_folder'
  | 'research_note'
  | 'character'
  | 'outline'

export type BinderItemLite = {
  id: string
  type: BinderItemType
  parentId: string | null
}

const ACCEPT_TABLE: Partial<Record<BinderItemType, BinderItemType[]>> = {
  part: ['chapter', 'part'],
  research_folder: ['research_note', 'research_folder'],
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
 * - Folder rows: top 6px = before, bottom 6px = after, middle = middle (nest).
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
  if (pointerY < top || pointerY > bottom) return null

  const EDGE = 6
  if (isFolder) {
    if (pointerY - top < EDGE) return 'before'
    if (bottom - pointerY < EDGE) return 'after'
    return 'middle'
  }
  // Non-folder row: midpoint split.
  return pointerY - top < height / 2 ? 'before' : 'after'
}
```

- [ ] **Step 3: Verify tests pass**

`npm test -- drop-rules`
Expected: all describe blocks pass (~18 tests).

- [ ] **Step 4: Run tsc**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/binder/
git commit -m "feat(binder): drop-rules helpers + unit tests"
```

---

### Task 2: Wire drop-intent state + dragOver handler in binder-tree

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`

This task adds the controller logic: track which row is the active drop target and which zone within it; expose that state via the existing `BinderTreeContext` so `binder-item.tsx` (Task 3) can render the right indicator; auto-expand collapsed folders on middle-body hover; route `handleDragEnd` through the three intent branches.

- [ ] **Step 1: Import helpers + add state types**

Add to existing imports near the top of `binder-tree.tsx`:

```ts
import { canNest, classifyDropZone, type BinderItemLite } from '@/lib/binder/drop-rules'
import type { DragOverEvent } from '@dnd-kit/core'  // (extend the existing dnd-kit core import line)
```

Also need `DragStartEvent` if not present — verify the existing `type DragEndEvent` import and extend with `DragOverEvent` (and `DragStartEvent` if needed for cleanup).

Define the drop-zone state type near the existing context type:

```ts
type DropZoneState = {
  overId: string
  zone: 'before' | 'middle' | 'after'
} | null
```

Extend `BinderTreeContextValue`:

```ts
type BinderTreeContextValue = {
  tree: TreeNode[]
  collapsed: Set<string>
  toggleCollapsed: (id: string) => void
  dropZone: DropZoneState
}
```

- [ ] **Step 2: Add state and refs inside the BinderTree component**

Inside `BinderTree()`, after the existing `collapsed` state:

```ts
const [dropZone, setDropZone] = useState<DropZoneState>(null)
const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const autoExpandTargetRef = useRef<string | null>(null)
```

- [ ] **Step 3: Add `handleDragOver` callback**

```ts
const handleDragOver = useCallback((event: DragOverEvent) => {
  const { active, over } = event
  if (!over || active.id === over.id) {
    setDropZone(null)
    cancelAutoExpand()
    return
  }

  const activeId = active.id as string
  const overId = over.id as string
  const activeItem = binderItems.find(i => i.id === activeId)
  const overItem = binderItems.find(i => i.id === overId)
  if (!activeItem || !overItem) {
    setDropZone(null)
    cancelAutoExpand()
    return
  }

  // dnd-kit doesn't pass pointer Y in DragOverEvent directly; read from
  // over.rect (the over droppable's bounding rect) + active.rect.current.translated
  // (the dragging item's translated rect, which approximates the pointer's
  // current Y when adjusted by the activator coordinates). Simpler: use the
  // event's `delta` + the starting pointer offset stored on dragStart. But
  // dnd-kit's recommended approach for vertical lists is to compare over.rect's
  // center to active's translated rect center.
  //
  // Pragmatic approximation that works for the binder's vertical list:
  // - over.rect gives us the target row's geometry
  // - active.rect.current.translated.top tells us where the *dragged ghost's*
  //   top edge currently is; subtracting from over.rect.top gives a usable
  //   pointer-Y proxy.
  //
  // For zone classification, we want to know whether the pointer is in the
  // top 6px, middle, or bottom 6px of over.rect. We use the dragged item's
  // *center* relative to over.rect:
  const overRect = over.rect
  const activeTranslated = active.rect.current.translated
  if (!activeTranslated) {
    setDropZone(null)
    cancelAutoExpand()
    return
  }
  const pointerYProxy = activeTranslated.top + activeTranslated.height / 2

  const isFolder = overItem.type === 'part' || overItem.type === 'research_folder'
  const zone = classifyDropZone(pointerYProxy, overRect, isFolder)
  if (!zone) {
    setDropZone(null)
    cancelAutoExpand()
    return
  }

  // If zone is 'middle', verify canNest before showing the indicator.
  if (zone === 'middle') {
    const allLite: BinderItemLite[] = binderItems.map(i => ({
      id: i.id, type: i.type, parentId: i.parentId,
    }))
    if (!canNest(
      { id: activeItem.id, type: activeItem.type, parentId: activeItem.parentId },
      { id: overItem.id, type: overItem.type, parentId: overItem.parentId },
      allLite,
    )) {
      setDropZone(null)
      cancelAutoExpand()
      return
    }
    scheduleAutoExpand(overId)
  } else {
    cancelAutoExpand()
  }

  setDropZone({ overId, zone })
}, [binderItems])
```

Add helper callbacks before `handleDragOver`:

```ts
function cancelAutoExpand() {
  if (autoExpandTimerRef.current) {
    clearTimeout(autoExpandTimerRef.current)
    autoExpandTimerRef.current = null
  }
  autoExpandTargetRef.current = null
}

function scheduleAutoExpand(folderId: string) {
  if (autoExpandTargetRef.current === folderId) return  // already scheduled
  cancelAutoExpand()
  autoExpandTargetRef.current = folderId
  autoExpandTimerRef.current = setTimeout(() => {
    setCollapsed(prev => {
      if (!prev.has(folderId)) return prev  // already expanded
      const next = new Set(prev)
      next.delete(folderId)
      return next
    })
    autoExpandTimerRef.current = null
    autoExpandTargetRef.current = null
  }, 500)
}
```

(The `setCollapsed` setter must exist — it currently is `setCollapsed` from the `useState<Set<string>>` near line 97.)

- [ ] **Step 4: Rewrite `handleDragEnd` to branch on intent**

Replace the existing `handleDragEnd` body (around lines 138-181) with:

```ts
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const finalDropZone = dropZone
  setDropZone(null)
  cancelAutoExpand()

  const { active, over } = event
  if (!over || active.id === over.id || !finalDropZone) return

  const activeId = active.id as string
  const overId = over.id as string
  const activeItem = binderItems.find(i => i.id === activeId)
  const overItem = binderItems.find(i => i.id === overId)
  if (!activeItem || !overItem) return

  if (finalDropZone.zone === 'middle') {
    // Nest into folder: parentId = folder, order = maxOrderInFolder + 1.
    const childrenOfTarget = binderItems.filter(i => i.parentId === overId)
    const maxOrder = childrenOfTarget.length === 0
      ? -1
      : Math.max(...childrenOfTarget.map(i => i.order))
    const updates = [{ id: activeId, order: maxOrder + 1, parentId: overId }]

    setBinderItems(prev =>
      prev.map(item =>
        item.id === activeId
          ? { ...item, parentId: overId, order: maxOrder + 1 }
          : item
      )
    )
    await reorderBinderItemsAction(bookId, updates)
    return
  }

  // reorder-before / reorder-after: dragged item adopts overItem's parentId,
  // then we recompute order within that parent group.
  const newParentId = overItem.parentId
  const siblings = binderItems.filter(i => i.parentId === newParentId && i.id !== activeId)
  const overIndex = siblings.findIndex(s => s.id === overId)
  const insertIndex = finalDropZone.zone === 'before' ? overIndex : overIndex + 1

  const newSiblingOrder = [...siblings]
  newSiblingOrder.splice(insertIndex, 0, { ...activeItem, parentId: newParentId })

  const updates = newSiblingOrder.map((s, idx) => ({
    id: s.id,
    order: idx,
    parentId: newParentId,
  }))

  // Optimistic update
  setBinderItems(prev =>
    prev.map(item => {
      const update = updates.find(u => u.id === item.id)
      return update ? { ...item, order: update.order, parentId: update.parentId } : item
    })
  )

  await reorderBinderItemsAction(bookId, updates)
}, [bookId, binderItems, dropZone, setBinderItems])
```

(Removed the previous `flattenVisible` + `parentGroups` algorithm. The new logic is simpler because the intent state already tells us exactly what to do.)

- [ ] **Step 5: Wire `handleDragOver` into DndContext + propagate dropZone via context**

Find the `<DndContext>` JSX (around line 258-262):

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
```

Add `onDragOver={handleDragOver}`:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
```

Update `ctxValue` to include `dropZone`:

```tsx
const ctxValue = useMemo<BinderTreeContextValue>(
  () => ({ tree, collapsed, toggleCollapsed, dropZone }),
  [tree, collapsed, toggleCollapsed, dropZone]
)
```

- [ ] **Step 6: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean, all existing + drop-rules tests pass.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx"
git commit -m "feat(binder): wire drop-intent state + dragOver handler"
```

---

### Task 3: Render drop indicators in binder-item

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`

- [ ] **Step 1: Read dropZone from context + compute per-row state**

Near the top of `BinderItem()`, after the existing `useBinderTree()` call, derive the active drop state for THIS row:

```ts
const { collapsed, toggleCollapsed, dropZone } = useBinderTree()
const dropZoneForThisRow = dropZone?.overId === node.id ? dropZone.zone : null
```

- [ ] **Step 2: Render conditional indicators**

The current row is rendered inside an outer `<div ref={setNodeRef} style={style}>`. Wrap the existing inner row `<div>` so we can add line indicators above + below.

```tsx
return (
  <div ref={setNodeRef} style={style}>
    {/* Before-line indicator */}
    {dropZoneForThisRow === 'before' && (
      <div
        className="h-0.5 bg-brand rounded-full mx-2"
        aria-hidden
      />
    )}
    <div
      {...dragAttributes}
      {...dragListeners}
      className={cn(
        'group flex items-center gap-2 h-8 pr-2 rounded-md select-none transition-colors relative',
        'text-foreground hover:bg-surface-elevated',
        isRenaming ? 'cursor-text' : 'cursor-grab',
        isActive && 'bg-brand/15 text-foreground shadow-[inset_2px_0_0_var(--brand)]',
        isRenaming && 'bg-surface-elevated',
        // Nest indicator: ring + tint when this folder is the active middle target
        dropZoneForThisRow === 'middle' && 'ring-2 ring-brand bg-brand/10',
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => setActiveItemId(node.id)}
      aria-label={isRenaming ? undefined : 'Drag to reorder'}
    >
      {/* ... existing row contents unchanged ... */}
    </div>
    {/* After-line indicator */}
    {dropZoneForThisRow === 'after' && (
      <div
        className="h-0.5 bg-brand rounded-full mx-2"
        aria-hidden
      />
    )}

    {isCollapsible && !isCollapsed && node.children.map(child => (
      <BinderItem key={child.id} node={child} depth={depth + 1} />
    ))}
  </div>
)
```

The existing row contents (grip span, chevron, icon, title/input, decorations, kebab menu) stay verbatim — only the wrapper structure changes.

- [ ] **Step 3: Run tsc**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Quick visual smoke (manual)**

Run the dev server and verify:
- Hovering a folder row's middle while dragging shows the brand-yellow ring + tint.
- Hovering top edge of any row shows the line above.
- Hovering bottom edge shows the line below.
- Type-mismatched drops show no indicator.
- A collapsed folder auto-expands after ~500ms of middle-body hover.

(This is just a sanity check; the formal manual checklist is in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx"
git commit -m "feat(binder): render drop indicators (before/middle/after)"
```

---

### Task 4: AGENTS.md sync

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a What Has Been Built entry**

Open `AGENTS.md`. Find the "What Has Been Built" section. Insert AFTER the most recent entry:

```markdown
### Drag-into-Folder ✅ COMPLETE (2026-05-28)

Extends the binder's existing dnd-kit setup with nesting. Dropping a document onto a folder row nests it; existing sibling-reorder behavior preserved.

- **Accept rules** (`lib/binder/drop-rules.ts`): `part` accepts `chapter` + `part`; `research_folder` accepts `research_note` + `research_folder`; other types are top-level only. Cycle guard walks `parentId` upward from the target — rejects if active.id is found in the chain. Pure helpers (`getAcceptedChildTypes`, `canNest`, `classifyDropZone`) unit-tested in isolation (~18 tests).
- **Three drop zones per row:** top 6px = reorder before, middle = nest into (folders only), bottom 6px = reorder after. Non-folder rows split at vertical midpoint (before / after only). Zone classified during `onDragOver` from the dragged ghost's center Y relative to the over row's rect.
- **Visual indicators:** thin brand-yellow horizontal line for before/after; brand-yellow `ring-2 + bg-brand/10` on the folder row for nest. Rendered in `binder-item.tsx` via a `dropZone` field added to `BinderTreeContext`.
- **Auto-expand:** middle-body hover on a collapsed folder for ~500ms expands it. Timer cancels on drag end or zone change. Implemented with a `useRef` timer + a `useRef` target id, so re-hovering the same folder doesn't reset the countdown.
- **Drop behavior:** `handleDragEnd` branches on the captured `dropZone`. Middle → `parentId = folderId, order = maxOrderInFolder + 1`. Before/after → adopts the sibling's `parentId`, recomputes sibling order. All updates flow through the existing `reorderBinderItemsAction` — no server-action changes.

No DB / schema changes. Pre-flight confirmed `reorderBinderItemsAction` accepts arbitrary `{id, order, parentId}` tuples.
```

- [ ] **Step 2: Update Resume Here**

Bump `Last updated`, refresh `Current focus` to summarize the drag-into-folder feature as shipped, update `Last commit`, refresh `Next concrete step when resuming`.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: drag-into-folder shipped — sync Resume Here + What Has Been Built"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

`npm test`
Expected: 137 + 18 (drop-rules) = 155/155 pass.

- [ ] **Step 2: Run tsc**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification (Chris runs)**

1. Drag chapter onto middle of part → nests at bottom of part's children. Part auto-scrolls open if collapsed (~500ms wait).
2. Drag chapter onto top edge of part → reorders before the part.
3. Drag chapter onto bottom edge of part → reorders after the part.
4. Drag character onto part → no drop indicator shown; drop is a no-op.
5. Drag chapter onto research_folder → no drop indicator (type mismatch).
6. Drag part-A onto a chapter that's inside part-A → no drop indicator (cycle).
7. Hover collapsed folder middle for ~500ms during drag → folder expands.
8. Drag chapter OUT of a part by dropping between two top-level items → un-nests (chapter's new parentId = null, order recomputed).
9. Existing sibling-reorder behavior still works (drag chapter A above chapter B within same part).
10. Drag-into-self / drag-into-collapsed-descendant gracefully rejected.
11. tsc + npm test clean.

- [ ] **Step 4: Push if Chris asks**

Otherwise stop — commits live on `main`.

---

## Self-Review

**Spec coverage:**
- §1 Accept rules → Task 1 (drop-rules) + Task 2 (canNest gate in dragOver) ✅
- §2 Three drop zones → Task 1 (classifyDropZone) + Task 2 (zone state) + Task 3 (indicators) ✅
- §3 Auto-expand → Task 2 (timer refs + scheduleAutoExpand) ✅
- §4 Drop behavior → Task 2 (handleDragEnd branches) ✅
- §5 Implementation notes → Tasks 1-3 ✅
- §6 Testing → Task 1 (18 unit tests) + Task 5 (manual checklist) ✅
- §7 Out of scope → respected (no server validation, no multi-select, no cross-binder, no smart insertion in folder) ✅

**Placeholder scan:** none. Every code step ships the actual code; every command is a real command.

**Type consistency:** `BinderItemLite` shape used in both `canNest` test fixtures and runtime adapter in Task 2. `DropZoneState` field name `zone` matches across Task 2 (set/clear) and Task 3 (read via context). `dropZone` added to `BinderTreeContextValue` in Task 2 and consumed in Task 3.

**Edge cases handled in the plan:**
- Pointer Y proxy via `active.rect.current.translated.top + height/2` — explained in Task 2 Step 3 comment.
- Same-folder re-hover doesn't reset auto-expand timer (`if (autoExpandTargetRef.current === folderId) return`).
- Drag-over of same id as active id → setDropZone(null) early return.
- canNest rejects on `active.id === target.id` (defensive).
- defensive `seen` set inside `canNest` cycle walk guards against corrupt parent chains.

**Risks / what could go wrong:**
- The pointer-Y proxy may not perfectly match the user's mouse — dnd-kit's `active.rect.current.translated` is the dragged ghost's position. For the binder's tight vertical list this should be a good-enough proxy; if it feels off in manual testing, we can switch to tracking pointer position via a global `pointermove` listener (more code but exact).
- Optimistic update for nesting puts the dragged item at `maxOrderInFolder + 1`. If the user drags multiple items in quick succession before the server responds, two items might end up at the same order temporarily. The server's per-item update doesn't enforce uniqueness, but the next `buildTree` reconstruction sorts by `order` so visual order is deterministic by id-stability. Acceptable.
