'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import {
  canNest,
  getAcceptedChildTypes,
  type BinderItemLite,
} from '@/lib/binder/drop-rules'
import { useBookEditor } from '../book-editor-provider'
import { BinderAddMenu } from './binder-add-menu'
import { BinderItem } from './binder-item'
import { BinderSlot } from './binder-slot'
import { BinderHiveFooter } from './binder-hive-footer'
import { reorderBinderItemsAction } from '@/lib/actions/binder.actions'
import { updateBookAction } from '@/lib/actions/book.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Settings } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TreeNode = BinderItemRow & { children: TreeNode[] }

// Drop hint state. Slot model (2026-06-10 v2): the dragged item resolves
// to ONE of two outcomes, never both:
//
//  - INSERT into a SLOT: a dashed rectangle between two siblings. Slot id
//    encodes parent + insert index. The hovered slot lights up yellow,
//    other slots stay dashed-gray, and release drops the item exactly
//    where the highlight was.
//
//  - NEST: a folder row gets a brand-yellow ring + tinted bg. Release
//    appends the dragged item as the folder's last child. To reorder a
//    folder's siblings, drop on the slot above/below the folder (not on
//    the folder row).
export type DropZoneState =
  | { kind: 'insert'; parentId: string | null; index: number }
  | { kind: 'nest'; folderId: string }
  | null

type BinderTreeContextValue = {
  tree: TreeNode[]
  collapsed: Set<string>
  toggleCollapsed: (id: string) => void
  dropZone: DropZoneState
  // Slot model state: the id of the item being dragged + which slots are
  // visible. Slots only mount during a drag, and only at parent containers
  // whose acceptance + cycle rules allow the active item.
  draggingItemId: string | null
  visibleSlotIds: Set<string>
}

// ─── Local context ────────────────────────────────────────────────────────────

const BinderTreeContext = createContext<BinderTreeContextValue | null>(null)

export function useBinderTree(): BinderTreeContextValue {
  const ctx = useContext(BinderTreeContext)
  if (!ctx) throw new Error('useBinderTree must be used within BinderTree')
  return ctx
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns true only when content is a structured object with pinned=true.
// Safe to call on chapters, parts, etc. (their content shape doesn't have
// a pinned field, so returns false).
function isItemPinned(item: BinderItemRow): boolean {
  const c = item.content
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false
  return (c as { pinned?: boolean }).pinned === true
}

function buildTree(items: BinderItemRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const item of items) map.set(item.id, { ...item, children: [] })
  for (const node of map.values()) {
    if (node.parentId) map.get(node.parentId)?.children.push(node)
    else roots.push(node)
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aPin = isItemPinned(a) ? 1 : 0
      const bPin = isItemPinned(b) ? 1 : 0
      if (aPin !== bPin) return bPin - aPin   // pinned first
      return a.order - b.order
    })
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

function flattenVisible(nodes: TreeNode[], collapsed: Set<string>): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    ids.push(node.id)
    if (!collapsed.has(node.id) && node.children.length > 0) {
      ids.push(...flattenVisible(node.children, collapsed))
    }
  }
  return ids
}

// Render the tree with interleaved Slot droppables. Slots only render when
// draggingItemId is set (i.e., during a drag) AND the slot id is in the
// `visibleSlotIds` set (i.e., the dragged item is allowed to land here and
// the position isn't a no-op).
//
// Format of slot id: `slot:<parentId|ROOT>:<index>`. Index is the position
// within the parent's children (0 = before first child, N = after last child).
export function renderTreeWithSlots(
  nodes: TreeNode[],
  parentId: string | null,
  depth: number,
  draggingItemId: string | null,
  visibleSlotIds: Set<string>,
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const parentSlotKey = parentId ?? 'ROOT'

  const renderSlot = (index: number) => {
    if (!draggingItemId) return null
    const id = `slot:${parentSlotKey}:${index}`
    if (!visibleSlotIds.has(id)) return null
    return <BinderSlot key={id} id={id} depth={depth} />
  }

  out.push(renderSlot(0))
  nodes.forEach((node, i) => {
    out.push(<BinderItem key={node.id} node={node} depth={depth} />)
    out.push(renderSlot(i + 1))
  })
  return out
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BinderTree() {
  const { bookId, bookTitle, binderItems, setBinderItems, focusMode } = useBookEditor()
  const params = useParams<{ locale: string }>()
  const locale = params?.locale ?? 'en'
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dropZone, setDropZone] = useState<DropZoneState>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoExpandTargetRef = useRef<string | null>(null)

  // Track the user's real pointer Y. dnd-kit's `active.rect.current.translated`
  // gives the dragged GHOST's position, which is offset from the pointer by
  // wherever the user grabbed the row — so its center never lines up with the
  // folder's middle band when the user expects it to. We need the actual
  // pointer clientY for zone classification.
  const pointerYRef = useRef(0)
  useEffect(() => {
    const handler = (e: PointerEvent) => { pointerYRef.current = e.clientY }
    window.addEventListener('pointermove', handler, { passive: true })
    return () => window.removeEventListener('pointermove', handler)
  }, [])

  // Book title inline rename (double-click the title in the binder header)
  const [isRenamingBook, setIsRenamingBook] = useState(false)
  const [localBookTitle, setLocalBookTitle] = useState(bookTitle)
  const bookTitleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenamingBook) {
      bookTitleInputRef.current?.focus()
      bookTitleInputRef.current?.select()
    }
  }, [isRenamingBook])

  async function commitBookRename() {
    const next = bookTitleInputRef.current?.value.trim() || localBookTitle
    setIsRenamingBook(false)
    if (next === localBookTitle) return
    const prev = localBookTitle
    setLocalBookTitle(next)
    const result = await updateBookAction(bookId, { title: next })
    if (!result.success) setLocalBookTitle(prev)
  }

  const tree = useMemo(() => buildTree(binderItems), [binderItems])

  const flatIds = useMemo(() => flattenVisible(tree, collapsed), [tree, collapsed])

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const cancelAutoExpand = useCallback(() => {
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current)
      autoExpandTimerRef.current = null
    }
    autoExpandTargetRef.current = null
  }, [])

  const scheduleAutoExpand = useCallback((folderId: string) => {
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
  }, [cancelAutoExpand])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Folder-row predicate. Used in collision detection + drop classification.
  const isFolderType = (t: BinderItemRow['type']): boolean =>
    t === 'part' || t === 'research_folder' || t === 'wiki_folder'

  // Quick guard: can `active` be inserted as a sibling under `parentId`?
  // Root accepts every top-level item type; folders accept only what the
  // ACCEPT_TABLE allows; cycles (dropping a folder into its own descendant)
  // are blocked.
  const canInsertInto = useCallback(
    (
      active: BinderItemLite,
      parentId: string | null,
      allItems: BinderItemLite[],
    ): boolean => {
      if (parentId === null) return true
      const byId = new Map(allItems.map((i) => [i.id, i]))
      const parent = byId.get(parentId)
      if (!parent) return false
      if (parent.id === active.id) return false
      if (!getAcceptedChildTypes(parent.type).includes(active.type)) return false
      let cursor: BinderItemLite | undefined = parent
      const seen = new Set<string>()
      while (cursor) {
        if (cursor.id === active.id) return false
        if (seen.has(cursor.id)) break
        seen.add(cursor.id)
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
      }
      return true
    },
    [],
  )

  // Slot ids encode "drop into <parent> at <index>". ROOT sentinel handles
  // the null-parent case (top-level container).
  const slotId = (parentId: string | null, index: number) =>
    `slot:${parentId ?? 'ROOT'}:${index}`

  // Compute the set of valid slot ids for the current dragged item. A slot
  // is omitted when:
  //  - Its parent doesn't accept the dragged item's type (or would cycle).
  //  - It would be a no-op for the dragged item (same parent, index equal
  //    to dragged's current index or current + 1, since both produce no
  //    movement).
  const visibleSlotIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    if (!draggingItemId) return set
    const active = binderItems.find((i) => i.id === draggingItemId)
    if (!active) return set
    const allLite: BinderItemLite[] = binderItems.map((i) => ({
      id: i.id,
      type: i.type,
      parentId: i.parentId,
    }))
    const activeLite: BinderItemLite = {
      id: active.id,
      type: active.type,
      parentId: active.parentId,
    }

    // Group all binder items by parent and sort each group by display order
    // (pinned first, then `order`). Matches buildTree exactly so slot indices
    // line up with what the user sees.
    const byParent = new Map<string | null, BinderItemRow[]>()
    for (const item of binderItems) {
      const arr = byParent.get(item.parentId) ?? []
      arr.push(item)
      byParent.set(item.parentId, arr)
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => {
        const aPin = isItemPinned(a) ? 1 : 0
        const bPin = isItemPinned(b) ? 1 : 0
        if (aPin !== bPin) return bPin - aPin
        return a.order - b.order
      })
    }

    // The set of parent ids that should expose slots. Always include root
    // (null parent). For folders, only include those whose subtree doesn't
    // contain the active item (cycle guard) AND the folder is currently
    // visible (not inside a collapsed ancestor) — but expansion state is
    // handled at render time. Here, we just enumerate every potential parent.
    const candidateParents: (string | null)[] = [null]
    for (const item of binderItems) {
      if (isFolderType(item.type)) candidateParents.push(item.id)
    }

    for (const parentId of candidateParents) {
      if (!canInsertInto(activeLite, parentId, allLite)) continue
      const children = byParent.get(parentId) ?? []
      const draggedIndex = children.findIndex((c) => c.id === draggingItemId)
      const slotCount = children.length + 1
      for (let i = 0; i < slotCount; i++) {
        // Same-parent no-op slots: the slot immediately before the dragged
        // item, AND the slot immediately after it (both leave the item in
        // its current position). Hide them.
        if (draggedIndex !== -1 && (i === draggedIndex || i === draggedIndex + 1)) {
          continue
        }
        set.add(slotId(parentId, i))
      }
    }
    return set
  }, [draggingItemId, binderItems, canInsertInto])

  // Parse a slot id back into its components. Returns null for non-slot ids.
  const parseSlotId = (
    id: string,
  ): { parentId: string | null; index: number } | null => {
    if (!id.startsWith('slot:')) return null
    const parts = id.split(':')
    if (parts.length !== 3) return null
    const [, parentRaw, indexRaw] = parts
    const idx = Number(indexRaw)
    if (!Number.isFinite(idx)) return null
    return { parentId: parentRaw === 'ROOT' ? null : parentRaw, index: idx }
  }

  // Collision detection: slot droppables take priority. If the pointer is
  // inside a slot, we use it. Otherwise we fall back to row droppables
  // (which carry the nest-on-folder semantics).
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const hits = pointerWithin(args)
      // Prefer slot hits when any.
      const slotHits = hits.filter((h) => String(h.id).startsWith('slot:'))
      if (slotHits.length > 0) return slotHits
      if (hits.length > 0) return hits

      // No pointer-inside hit — fall back to the row whose vertical center
      // is closest to the pointer (so dragging into the gap above row 0
      // still finds a target). Skip slot droppables here since they're not
      // currently under the pointer; we want a nearby row for the nest
      // affordance only.
      const pointerY = pointerYRef.current
      let closest: { id: string | number; dist: number } | null = null
      for (const container of args.droppableContainers) {
        const id = container.id
        if (String(id).startsWith('slot:')) continue
        const rect = args.droppableRects.get(id)
        if (!rect) continue
        const centerY = rect.top + rect.height / 2
        const dist = Math.abs(centerY - pointerY)
        if (!closest || dist < closest.dist) closest = { id, dist }
      }
      if (!closest) return []
      return [{ id: closest.id, data: { value: closest.dist } }]
    },
    [],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingItemId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) {
        setDropZone(null)
        cancelAutoExpand()
        return
      }

      const overId = String(over.id)

      // SLOT HIT — the dragged item lands at this exact position.
      const slot = parseSlotId(overId)
      if (slot) {
        cancelAutoExpand()
        setDropZone({ kind: 'insert', parentId: slot.parentId, index: slot.index })
        return
      }

      // ROW HIT — only folder rows are valid drop targets here (nest case).
      // Non-folder rows ignore the hit; the user needs to hit a slot.
      if (active.id === overId) {
        setDropZone(null)
        cancelAutoExpand()
        return
      }
      const activeItem = binderItems.find((i) => i.id === active.id)
      const overItem = binderItems.find((i) => i.id === overId)
      if (!activeItem || !overItem) {
        setDropZone(null)
        cancelAutoExpand()
        return
      }
      if (!isFolderType(overItem.type)) {
        setDropZone(null)
        cancelAutoExpand()
        return
      }
      const allLite: BinderItemLite[] = binderItems.map((i) => ({
        id: i.id,
        type: i.type,
        parentId: i.parentId,
      }))
      if (
        canNest(
          { id: activeItem.id, type: activeItem.type, parentId: activeItem.parentId },
          { id: overItem.id, type: overItem.type, parentId: overItem.parentId },
          allLite,
        )
      ) {
        scheduleAutoExpand(overId)
        setDropZone({ kind: 'nest', folderId: overId })
        return
      }
      setDropZone(null)
      cancelAutoExpand()
    },
    [binderItems, cancelAutoExpand, scheduleAutoExpand],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const finalDropZone = dropZone
      setDropZone(null)
      setDraggingItemId(null)
      cancelAutoExpand()

      const { active } = event
      if (!finalDropZone) return
      const activeId = active.id as string
      const activeItem = binderItems.find((i) => i.id === activeId)
      if (!activeItem) return

      if (finalDropZone.kind === 'nest') {
        const folderId = finalDropZone.folderId
        const childrenOfTarget = binderItems.filter(
          (i) => i.parentId === folderId,
        )
        const maxOrder =
          childrenOfTarget.length === 0
            ? -1
            : Math.max(...childrenOfTarget.map((i) => i.order))
        const updates = [
          { id: activeId, order: maxOrder + 1, parentId: folderId },
        ]
        setBinderItems((prev) =>
          prev.map((item) =>
            item.id === activeId
              ? { ...item, parentId: folderId, order: maxOrder + 1 }
              : item,
          ),
        )
        await reorderBinderItemsAction(bookId, updates)
        return
      }

      // INSERT into a slot: place the dragged item at exact { parentId, index }.
      const newParentId = finalDropZone.parentId
      const targetIndex = finalDropZone.index

      // Siblings in the NEW parent, sorted by display order (pinned-first,
      // then `order`), excluding the active item if it's already there.
      const siblings = binderItems
        .filter((i) => i.parentId === newParentId && i.id !== activeId)
        .sort((a, b) => {
          const aPin = isItemPinned(a) ? 1 : 0
          const bPin = isItemPinned(b) ? 1 : 0
          if (aPin !== bPin) return bPin - aPin
          return a.order - b.order
        })

      const insertIndex = Math.max(0, Math.min(targetIndex, siblings.length))
      const newSiblingOrder = [...siblings]
      newSiblingOrder.splice(insertIndex, 0, {
        ...activeItem,
        parentId: newParentId,
      })

      const updates = newSiblingOrder.map((s, idx) => ({
        id: s.id,
        order: idx,
        parentId: newParentId,
      }))

      setBinderItems((prev) =>
        prev.map((item) => {
          const update = updates.find((u) => u.id === item.id)
          return update
            ? { ...item, order: update.order, parentId: update.parentId }
            : item
        }),
      )
      await reorderBinderItemsAction(bookId, updates)
    },
    [bookId, binderItems, dropZone, setBinderItems, cancelAutoExpand],
  )

  const handleDragCancel = useCallback(() => {
    setDropZone(null)
    setDraggingItemId(null)
    cancelAutoExpand()
  }, [cancelAutoExpand])

  const ctxValue = useMemo<BinderTreeContextValue>(
    () => ({
      tree,
      collapsed,
      toggleCollapsed,
      dropZone,
      draggingItemId,
      visibleSlotIds,
    }),
    [tree, collapsed, toggleCollapsed, dropZone, draggingItemId, visibleSlotIds],
  )

  return (
    <BinderTreeContext.Provider value={ctxValue}>
      <aside
        aria-hidden={focusMode}
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className={cn(
          'flex-shrink-0 flex flex-col overflow-hidden',
          'transition-[width,opacity,transform] duration-200 ease-out',
          focusMode
            ? 'w-0 opacity-0 -translate-x-2 pointer-events-none'
            : 'w-60 opacity-100 translate-x-0',
        )}
      >
        <div className="px-3.5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {isRenamingBook ? (
                <input
                  ref={bookTitleInputRef}
                  defaultValue={localBookTitle}
                  style={{ color: 'var(--brand)' }}
                  className="w-full bg-transparent border-b border-brand text-[15px] font-bold font-comfortaa tracking-tight outline-none leading-tight text-center"
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitBookRename()
                    if (e.key === 'Escape') setIsRenamingBook(false)
                  }}
                  onBlur={commitBookRename}
                />
              ) : (
                <Link
                  href={`/${locale}/books/${bookId}`}
                  aria-label="Preview as reader"
                  style={{ color: 'var(--brand)' }}
                  className="block text-center text-[15px] font-bold font-comfortaa tracking-tight leading-tight truncate cursor-pointer hover:underline transition-colors no-underline"
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    setIsRenamingBook(true)
                  }}
                  title="Click to preview · Double-click to rename"
                >
                  {localBookTitle}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-px">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {/* No strategy: skip the verticalListSortingStrategy reorder
                preview (which shifts other rows out of the way during drag).
                With the slot model, reorder targets are the explicit Slot
                droppables between rows — rows themselves only fire when
                dropping ON a folder (nest case). */}
            <SortableContext items={flatIds}>
              {renderTreeWithSlots(tree, null, 0, draggingItemId, visibleSlotIds)}
            </SortableContext>
          </DndContext>
        </div>

        <div className="px-2.5 py-3 flex flex-col gap-2">
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <BinderAddMenu />
            </div>
            <Link
              href={`/${locale}/studio/${bookId}/details`}
              title="Book details"
              aria-label="Book details"
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                borderRadius: 'var(--r-btn)',
                boxShadow: 'var(--sh-tile)',
                border: 'var(--br-card)',
              }}
              className="w-10 inline-flex items-center justify-center text-muted-foreground hover:brightness-110 hover:text-foreground transition-colors no-underline flex-shrink-0"
            >
              <Settings size={14} />
            </Link>
          </div>
          <BinderHiveFooter />
        </div>

      </aside>
    </BinderTreeContext.Provider>
  )
}
