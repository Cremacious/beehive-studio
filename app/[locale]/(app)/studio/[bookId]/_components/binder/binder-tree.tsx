'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { BinderAddMenu } from './binder-add-menu'
import { BinderItem } from './binder-item'
import { reorderBinderItemsAction } from '@/lib/actions/binder.actions'
import { updateBookAction } from '@/lib/actions/book.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { CreateHiveButton } from '../create-hive-button'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TreeNode = BinderItemRow & { children: TreeNode[] }

type BinderTreeContextValue = {
  tree: TreeNode[]
  collapsed: Set<string>
  toggleCollapsed: (id: string) => void
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

// ─── Component ────────────────────────────────────────────────────────────────

export function BinderTree() {
  const { bookId, bookTitle, locale, binderItems, setBinderItems, focusMode, corkboardMode, toggleCorkboardMode } = useBookEditor()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const visibleIds = flattenVisible(tree, collapsed)
    const fromIndex = visibleIds.indexOf(activeId)
    const toIndex = visibleIds.indexOf(overId)
    if (fromIndex === -1 || toIndex === -1) return

    const reordered = [...visibleIds]
    reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, activeId)

    // Build a lookup of the moved item to determine its new parentId
    const itemMap = new Map<string, BinderItemRow>(binderItems.map(i => [i.id, i]))

    // Recalculate order within each parent group
    const parentGroups = new Map<string | null, string[]>()
    for (const id of reordered) {
      const item = itemMap.get(id)
      if (!item) continue
      const parentKey = item.parentId
      if (!parentGroups.has(parentKey)) parentGroups.set(parentKey, [])
      parentGroups.get(parentKey)!.push(id)
    }

    const updates: { id: string; order: number; parentId: string | null }[] = []
    for (const [parentId, ids] of parentGroups.entries()) {
      ids.forEach((id, idx) => updates.push({ id, order: idx, parentId }))
    }

    // Optimistic update
    setBinderItems(prev =>
      prev.map(item => {
        const update = updates.find(u => u.id === item.id)
        return update ? { ...item, order: update.order, parentId: update.parentId } : item
      })
    )

    await reorderBinderItemsAction(bookId, updates)
  }, [bookId, binderItems, tree, collapsed, setBinderItems])

  const ctxValue = useMemo<BinderTreeContextValue>(
    () => ({ tree, collapsed, toggleCollapsed }),
    [tree, collapsed, toggleCollapsed]
  )

  if (focusMode) return null

  return (
    <BinderTreeContext.Provider value={ctxValue}>
      <aside className="w-60 flex-shrink-0 flex flex-col bg-card border-r border-border overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-brand text-xs flex-shrink-0">✦</span>
            {isRenamingBook ? (
              <input
                ref={bookTitleInputRef}
                defaultValue={localBookTitle}
                className="flex-1 min-w-0 bg-transparent border-b border-brand text-xs font-bold font-comfortaa uppercase tracking-wide outline-none text-foreground"
                onKeyDown={e => {
                  if (e.key === 'Enter') commitBookRename()
                  if (e.key === 'Escape') setIsRenamingBook(false)
                }}
                onBlur={commitBookRename}
              />
            ) : (
              <span
                className="text-xs font-bold text-foreground font-comfortaa uppercase tracking-wide truncate cursor-pointer hover:text-brand transition-colors"
                onDoubleClick={() => setIsRenamingBook(true)}
                title="Double-click to rename"
              >
                {localBookTitle}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={toggleCorkboardMode}
              title={corkboardMode ? 'Exit corkboard' : 'Corkboard view'}
              aria-label={corkboardMode ? 'Exit corkboard' : 'Corkboard view'}
              className={cn("text-xs text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded", corkboardMode && "text-brand")}
            >
              ⊞
            </button>
            <BinderAddMenu />
          </div>
        </div>
        <div className="px-3 py-2 border-b border-border flex flex-col gap-1">
          <CreateHiveButton bookId={bookId} locale={locale} />
          <p className="text-[10px] text-muted-foreground leading-snug">
            Invite readers to give feedback on your drafts.
          </p>
        </div>

        {!corkboardMode && (
          <div className="flex-1 overflow-y-auto py-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                {tree.map(node => (
                  <BinderItem key={node.id} node={node} depth={0} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

      </aside>
    </BinderTreeContext.Provider>
  )
}
