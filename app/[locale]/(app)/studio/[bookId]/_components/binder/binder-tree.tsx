'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { canNest, classifyDropZone, type BinderItemLite } from '@/lib/binder/drop-rules'
import { useBookEditor } from '../book-editor-provider'
import { BinderAddMenu } from './binder-add-menu'
import { BinderItem } from './binder-item'
import { BinderHiveFooter } from './binder-hive-footer'
import { reorderBinderItemsAction } from '@/lib/actions/binder.actions'
import { updateBookAction } from '@/lib/actions/book.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Settings } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TreeNode = BinderItemRow & { children: TreeNode[] }

type DropZoneState = {
  overId: string
  zone: 'before' | 'middle' | 'after'
} | null

type BinderTreeContextValue = {
  tree: TreeNode[]
  collapsed: Set<string>
  toggleCollapsed: (id: string) => void
  dropZone: DropZoneState
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
  const { bookId, bookTitle, binderItems, setBinderItems, focusMode } = useBookEditor()
  const params = useParams<{ locale: string }>()
  const locale = params?.locale ?? 'en'
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dropZone, setDropZone] = useState<DropZoneState>(null)
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoExpandTargetRef = useRef<string | null>(null)

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

    // Pointer-Y proxy: use the dragged ghost's translated center, which closely
    // tracks where the user's pointer is during a vertical-list drag.
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

    // If zone is 'middle', verify canNest before showing the indicator + scheduling expand.
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
  }, [binderItems, cancelAutoExpand, scheduleAutoExpand])

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
    // then recompute order within that parent group.
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
  }, [bookId, binderItems, dropZone, setBinderItems, cancelAutoExpand])

  const ctxValue = useMemo<BinderTreeContextValue>(
    () => ({ tree, collapsed, toggleCollapsed, dropZone }),
    [tree, collapsed, toggleCollapsed, dropZone]
  )

  return (
    <BinderTreeContext.Provider value={ctxValue}>
      <aside
        aria-hidden={focusMode}
        className={cn(
          'flex-shrink-0 flex flex-col bg-surface border-r border-border overflow-hidden',
          'transition-[width,opacity,transform] duration-200 ease-out',
          focusMode
            ? 'w-0 opacity-0 -translate-x-2 pointer-events-none'
            : 'w-60 opacity-100 translate-x-0',
        )}
      >
        <div className="px-3.5 pt-4 pb-3 border-b border-border">
          <div className="text-[10px] font-mono uppercase tracking-[0.10em] text-muted-foreground mb-1.5">
            Book
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {isRenamingBook ? (
                <input
                  ref={bookTitleInputRef}
                  defaultValue={localBookTitle}
                  className="w-full bg-transparent border-b border-brand text-[15px] font-bold font-comfortaa tracking-tight outline-none text-foreground leading-tight"
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
                  className="block text-[15px] font-bold text-foreground font-comfortaa tracking-tight leading-tight truncate cursor-pointer hover:text-brand hover:underline transition-colors no-underline"
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
            <div className="flex items-center gap-1 flex-shrink-0">
              <Link
                href={`/${locale}/studio/${bookId}/details`}
                title="Book details"
                aria-label="Book details"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors no-underline"
              >
                <Settings size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-px">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
              {tree.map(node => (
                <BinderItem key={node.id} node={node} depth={0} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="border-t border-border px-2.5 py-3 flex flex-col gap-2 bg-surface">
          <BinderAddMenu />
          <BinderHiveFooter />
        </div>

      </aside>
    </BinderTreeContext.Provider>
  )
}
