'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
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

type BinderTreeContextValue = {
  tree: TreeNode[]
  collapsed: Set<string>
  toggleCollapsed: (id: string) => void
  canMoveUp: (id: string) => boolean
  canMoveDown: (id: string) => boolean
  moveItem: (id: string, direction: 'up' | 'down') => void
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

function compareSiblings(a: BinderItemRow, b: BinderItemRow): number {
  const aPin = isItemPinned(a) ? 1 : 0
  const bPin = isItemPinned(b) ? 1 : 0
  if (aPin !== bPin) return bPin - aPin   // pinned first
  return a.order - b.order
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
    nodes.sort(compareSiblings)
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

export function renderTree(nodes: TreeNode[], depth: number): React.ReactNode[] {
  return nodes.map(node => <BinderItem key={node.id} node={node} depth={depth} />)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BinderTree() {
  const { bookId, bookTitle, binderItems, setBinderItems, focusMode } = useBookEditor()
  const params = useParams<{ locale: string }>()
  const locale = params?.locale ?? 'en'
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

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Build a per-parent sibling map keyed off the same compareSiblings the tree uses
  // so arrow-button visibility lines up exactly with rendered order.
  const siblingsByParent = useMemo(() => {
    const byParent = new Map<string | null, BinderItemRow[]>()
    for (const item of binderItems) {
      const arr = byParent.get(item.parentId) ?? []
      arr.push(item)
      byParent.set(item.parentId, arr)
    }
    for (const arr of byParent.values()) arr.sort(compareSiblings)
    return byParent
  }, [binderItems])

  // Boundary checks treat pin-class boundaries as boundary too — swapping
  // orders across pin classes wouldn't change visible position (the
  // pinned-first sort overrides `order`), so the click would silently
  // no-op. Better to disable cleanly.
  const findNeighborInfo = useCallback(
    (id: string): { siblings: BinderItemRow[]; index: number; self: BinderItemRow } | null => {
      const self = binderItems.find(i => i.id === id)
      if (!self) return null
      const siblings = siblingsByParent.get(self.parentId) ?? []
      const index = siblings.findIndex(s => s.id === id)
      if (index === -1) return null
      return { siblings, index, self }
    },
    [binderItems, siblingsByParent],
  )

  const canMoveUp = useCallback(
    (id: string): boolean => {
      const info = findNeighborInfo(id)
      if (!info) return false
      if (info.index === 0) return false
      const prev = info.siblings[info.index - 1]
      return isItemPinned(prev) === isItemPinned(info.self)
    },
    [findNeighborInfo],
  )

  const canMoveDown = useCallback(
    (id: string): boolean => {
      const info = findNeighborInfo(id)
      if (!info) return false
      if (info.index === info.siblings.length - 1) return false
      const next = info.siblings[info.index + 1]
      return isItemPinned(next) === isItemPinned(info.self)
    },
    [findNeighborInfo],
  )

  const moveItem = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      const info = findNeighborInfo(id)
      if (!info) return
      const neighborIdx = direction === 'up' ? info.index - 1 : info.index + 1
      if (neighborIdx < 0 || neighborIdx >= info.siblings.length) return
      const neighbor = info.siblings[neighborIdx]
      if (isItemPinned(neighbor) !== isItemPinned(info.self)) return

      const selfNewOrder = neighbor.order
      const neighborNewOrder = info.self.order

      // Optimistic local swap.
      setBinderItems(prev =>
        prev.map(item => {
          if (item.id === info.self.id) return { ...item, order: selfNewOrder }
          if (item.id === neighbor.id) return { ...item, order: neighborNewOrder }
          return item
        }),
      )

      const result = await reorderBinderItemsAction(bookId, [
        { id: info.self.id, order: selfNewOrder, parentId: info.self.parentId },
        { id: neighbor.id, order: neighborNewOrder, parentId: neighbor.parentId },
      ])

      if (!result.success) {
        // Rollback.
        setBinderItems(prev =>
          prev.map(item => {
            if (item.id === info.self.id) return { ...item, order: info.self.order }
            if (item.id === neighbor.id) return { ...item, order: neighbor.order }
            return item
          }),
        )
      }
    },
    [bookId, findNeighborInfo, setBinderItems],
  )

  const ctxValue = useMemo<BinderTreeContextValue>(
    () => ({
      tree,
      collapsed,
      toggleCollapsed,
      canMoveUp,
      canMoveDown,
      moveItem,
    }),
    [tree, collapsed, toggleCollapsed, canMoveUp, canMoveDown, moveItem],
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
          {renderTree(tree, 0)}
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
