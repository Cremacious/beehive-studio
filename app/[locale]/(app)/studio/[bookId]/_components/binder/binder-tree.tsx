'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
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

function buildTree(items: BinderItemRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const item of items) map.set(item.id, { ...item, children: [] })
  for (const node of map.values()) {
    if (node.parentId) map.get(node.parentId)?.children.push(node)
    else roots.push(node)
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order)
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
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs font-bold text-brand font-comfortaa uppercase tracking-wide truncate">
            {bookTitle}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleCorkboardMode}
              title={corkboardMode ? 'Exit corkboard' : 'Corkboard view'}
              className={cn("text-xs text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded", corkboardMode && "text-brand")}
            >
              ⊞
            </button>
            <BinderAddMenu />
          </div>
        </div>
        <div className="px-3 py-2 border-b border-border">
          <CreateHiveButton bookId={bookId} locale={locale} />
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
