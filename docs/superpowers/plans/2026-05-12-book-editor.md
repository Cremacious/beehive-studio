# Book Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-panel book editor UI — binder tree, TipTap rich-text editor, and chapter metadata panel — wired to the existing Phase 2 server actions.

**Architecture:** A `BookEditorProvider` client context wraps the editor page, owning binder state, the active chapter cache, and auto-save debouncing. Child components consume context via `useBookEditor()`. The `page.tsx` server component fetches initial data and passes it into the provider. Drag-and-drop uses @dnd-kit; reordering is within the same parent level only.

**Tech Stack:** Next.js 16 App Router, React 19, TipTap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`), `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Tailwind v4, TypeScript strict

---

### Task 1: Install @dnd-kit and replace page.tsx with server shell

**Files:**
- Modify: `package.json` (via npm install)
- Rewrite: `app/[locale]/(app)/studio/[bookId]/page.tsx`

- [ ] **Step 1: Install @dnd-kit packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages appear in `package.json` dependencies.

- [ ] **Step 2: Replace the stub page.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/page.tsx
import { notFound } from 'next/navigation'
import { getBookAction } from '@/lib/actions/book.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { BookEditorProvider } from './_components/book-editor-provider'
import { BinderTree } from './_components/binder/binder-tree'
import { ChapterEditor } from './_components/editor/chapter-editor'
import { MetadataPanel } from './_components/metadata/metadata-panel'

type Props = {
  params: Promise<{ locale: string; bookId: string }>
}

export default async function BookEditorPage({ params }: Props) {
  const { bookId } = await params

  const [bookResult, binderResult] = await Promise.all([
    getBookAction(bookId),
    getBinderTreeAction(bookId),
  ])

  if (!bookResult.success || !binderResult.success) notFound()

  return (
    <BookEditorProvider
      bookId={bookId}
      bookTitle={bookResult.data.title}
      initialBinderItems={binderResult.data}
    >
      <div className="flex h-[calc(100vh-var(--header-height,0px))] overflow-hidden">
        <BinderTree />
        <ChapterEditor />
        <MetadataPanel />
      </div>
    </BookEditorProvider>
  )
}
```

- [ ] **Step 3: Create stub placeholders so the page compiles**

Create these four files with minimal exports so TypeScript doesn't error while the real components are built in later tasks:

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx
'use client'
export function BookEditorProvider({ children }: { bookId: string; bookTitle: string; initialBinderItems: unknown[]; children: React.ReactNode }) {
  return <>{children}</>
}
export function useBookEditor() { return {} as never }
```

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx
'use client'
export function BinderTree() { return <aside className="w-60 flex-shrink-0 bg-card border-r border-border" /> }
```

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx
'use client'
export function ChapterEditor() { return <main className="flex-1" /> }
```

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx
'use client'
export function MetadataPanel() { return <aside className="w-60 flex-shrink-0 bg-card border-l border-border" /> }
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/studio/\[bookId\]/ package.json package-lock.json
git commit -m "feat: install @dnd-kit, add book editor page shell"
```

---

### Task 2: BookEditorProvider — context, state, auto-save

**Files:**
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx`

- [ ] **Step 1: Write the full provider**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx
'use client'

import {
  createContext, useCallback, useContext,
  useRef, useState, type ReactNode,
} from 'react'
import type { JSONContent } from '@tiptap/react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { ChapterData } from '@/lib/actions/chapter.actions'
import { getChapterAction, saveChapterAction } from '@/lib/actions/chapter.actions'

type SaveStatus = 'saved' | 'saving' | 'unsaved'
export type ToastError = { id: string; message: string }

export type BookEditorContextValue = {
  bookId: string
  bookTitle: string
  binderItems: BinderItemRow[]
  activeChapterId: string | null
  activeChapter: ChapterData | null
  chapterLoading: boolean
  saveStatus: SaveStatus
  wordCount: number
  errors: ToastError[]
  dismissError: (id: string) => void
  setActiveChapterId: (id: string | null) => void
  onEditorUpdate: (content: JSONContent) => void
  addItem: (item: BinderItemRow) => void
  renameItem: (id: string, title: string) => void
  removeItem: (id: string) => void
  reorderItems: (items: BinderItemRow[]) => void
  addError: (message: string) => void
}

const BookEditorContext = createContext<BookEditorContextValue | null>(null)

export function useBookEditor(): BookEditorContextValue {
  const ctx = useContext(BookEditorContext)
  if (!ctx) throw new Error('useBookEditor must be used within BookEditorProvider')
  return ctx
}

type Props = {
  bookId: string
  bookTitle: string
  initialBinderItems: BinderItemRow[]
  children: ReactNode
}

export function BookEditorProvider({ bookId, bookTitle, initialBinderItems, children }: Props) {
  const [binderItems, setBinderItems] = useState<BinderItemRow[]>(initialBinderItems)
  const [activeChapterId, setActiveChapterIdState] = useState<string | null>(null)
  const [chapterCache, setChapterCache] = useState<Map<string, ChapterData>>(new Map())
  const [chapterLoading, setChapterLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [wordCount, setWordCount] = useState(0)
  const [errors, setErrors] = useState<ToastError[]>([])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep a ref to activeChapterId so the debounced save closure always has the current value
  const activeChapterIdRef = useRef<string | null>(null)

  const addError = useCallback((message: string) => {
    const id = crypto.randomUUID()
    setErrors(prev => [...prev, { id, message }])
    setTimeout(() => setErrors(prev => prev.filter(e => e.id !== id)), 4000)
  }, [])

  const dismissError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id))
  }, [])

  const setActiveChapterId = useCallback(async (id: string | null) => {
    setActiveChapterIdState(id)
    activeChapterIdRef.current = id
    if (!id) return

    setChapterCache(prev => {
      if (prev.has(id)) {
        const cached = prev.get(id)!
        setWordCount(cached.wordCount)
        return prev
      }
      return prev
    })

    // Need to check cache state — use functional check
    setChapterCache(prev => {
      if (prev.has(id)) return prev // already loaded

      // Kick off the fetch outside the setState call
      setChapterLoading(true)
      getChapterAction(id).then(result => {
        setChapterLoading(false)
        if (!result.success) {
          addError('Failed to load chapter. Please try again.')
          return
        }
        setWordCount(result.data.wordCount)
        setChapterCache(p => new Map(p).set(id, result.data))
      })

      return prev
    })
  }, [addError])

  const onEditorUpdate = useCallback((content: JSONContent) => {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(async () => {
      const chapterId = activeChapterIdRef.current
      if (!chapterId) return
      setSaveStatus('saving')
      const result = await saveChapterAction(chapterId, content)
      if (!result.success) {
        setSaveStatus('unsaved')
        addError("Couldn't save. Retrying…")
        return
      }
      setSaveStatus('saved')
      setWordCount(result.data.wordCount)
      setChapterCache(prev => {
        const map = new Map(prev)
        const existing = map.get(chapterId)
        if (existing) map.set(chapterId, { ...existing, content, wordCount: result.data.wordCount })
        return map
      })
    }, 2000)
  }, [addError])

  const addItem = useCallback((item: BinderItemRow) => {
    setBinderItems(prev => [...prev, item])
  }, [])

  const renameItem = useCallback((id: string, title: string) => {
    setBinderItems(prev => prev.map(item => item.id === id ? { ...item, title } : item))
  }, [])

  const removeItem = useCallback((id: string) => {
    // Also remove direct children (server handles grandchildren, but optimistic update should clear children too)
    setBinderItems(prev => prev.filter(item => item.id !== id && item.parentId !== id))
  }, [])

  const reorderItems = useCallback((items: BinderItemRow[]) => {
    setBinderItems(items)
  }, [])

  const activeChapter = activeChapterId ? (chapterCache.get(activeChapterId) ?? null) : null

  return (
    <BookEditorContext.Provider value={{
      bookId, bookTitle, binderItems,
      activeChapterId, activeChapter, chapterLoading,
      saveStatus, wordCount, errors,
      dismissError, setActiveChapterId, onEditorUpdate,
      addItem, renameItem, removeItem, reorderItems, addError,
    }}>
      {children}
    </BookEditorContext.Provider>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx"
git commit -m "feat: add BookEditorProvider with context, cache, and auto-save"
```

---

### Task 3: BinderTree — layout, tree derivation, DnD wrapper

**Files:**
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx` (stub)
- Create: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx` (stub)

- [ ] **Step 1: Create stub binder-item.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx
'use client'
import type { TreeNode } from './binder-tree'
type Props = { node: TreeNode; depth: number; collapsed: Set<string>; onToggleCollapsed: (id: string) => void }
export function BinderItem(_props: Props) { return null }
```

- [ ] **Step 2: Create stub binder-add-menu.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx
'use client'
type Props = { parentId: string | null; open: boolean; onOpenChange: (v: boolean) => void }
export function BinderAddMenu(_props: Props) { return null }
```

- [ ] **Step 3: Write binder-tree.tsx with tree derivation and DnD shell**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx
'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useBookEditor } from '../book-editor-provider'
import { reorderBinderItemsAction } from '@/lib/actions/binder.actions'
import { BinderItem } from './binder-item'
import { BinderAddMenu } from './binder-add-menu'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

export type TreeNode = BinderItemRow & { children: TreeNode[] }

function buildTree(items: BinderItemRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  for (const item of items) map.set(item.id, { ...item, children: [] })

  const roots: TreeNode[] = []
  for (const item of items) {
    const node = map.get(item.id)!
    if (item.parentId) {
      const parent = map.get(item.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order)
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

export function BinderTree() {
  const { bookId, bookTitle, binderItems, reorderItems, addError } = useBookEditor()
  const tree = useMemo(() => buildTree(binderItems), [binderItems])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function toggleCollapsed(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeItem = binderItems.find(i => i.id === active.id)
    const overItem = binderItems.find(i => i.id === over.id)
    if (!activeItem || !overItem) return
    if (activeItem.parentId !== overItem.parentId) return // only reorder within same parent

    const siblings = binderItems.filter(i => i.parentId === activeItem.parentId)
    const activeIdx = siblings.findIndex(i => i.id === active.id)
    const overIdx = siblings.findIndex(i => i.id === over.id)

    const reordered = arrayMove(siblings, activeIdx, overIdx).map((item, index) => ({
      ...item,
      order: index,
    }))

    const snapshot = binderItems
    const newItems = binderItems.map(item => reordered.find(r => r.id === item.id) ?? item)
    reorderItems(newItems) // optimistic

    const result = await reorderBinderItemsAction(
      bookId,
      reordered.map(({ id, order, parentId }) => ({ id, order, parentId })),
    )
    if (!result.success) {
      reorderItems(snapshot) // rollback
      addError("Couldn't reorder items. Please try again.")
    }
  }

  const sortableIds = binderItems.map(i => i.id)

  return (
    <aside className="w-60 flex-shrink-0 bg-card border-r border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border flex-shrink-0">
        <span className="text-xs font-bold text-brand font-comfortaa tracking-wide truncate uppercase">
          {bookTitle}
        </span>
        <BinderAddMenu open={addMenuOpen} onOpenChange={setAddMenuOpen} parentId={null} />
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {tree.map(node => (
              <BinderItem
                key={node.id}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggleCollapsed={toggleCollapsed}
              />
            ))}
          </SortableContext>
        </DndContext>
        {tree.length === 0 && (
          <p className="text-xs text-white/30 text-center mt-8 px-4 leading-relaxed">
            No content yet.<br />Use + to add a part or chapter.
          </p>
        )}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/"
git commit -m "feat: add BinderTree with tree derivation and dnd-kit setup"
```

---

### Task 4: BinderItem — row rendering and active state

**Files:**
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx` (stub)

- [ ] **Step 1: Create stub binder-item-menu.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx
'use client'
import type { TreeNode } from './binder-tree'
type Props = { node: TreeNode; open: boolean; onOpenChange: (v: boolean) => void }
export function BinderItemMenu(_props: Props) { return null }
```

- [ ] **Step 2: Write the full BinderItem component**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx
'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useBookEditor } from '../book-editor-provider'
import { BinderItemMenu } from './binder-item-menu'
import type { TreeNode } from './binder-tree'

const TYPE_ICONS: Record<string, string> = {
  chapter: '📄',
  front_matter: '📄',
  back_matter: '📄',
  research_folder: '📁',
  research_note: '📝',
  character: '👤',
  outline: '📋',
}

type Props = {
  node: TreeNode
  depth: number
  collapsed: Set<string>
  onToggleCollapsed: (id: string) => void
}

export function BinderItem({ node, depth, collapsed, onToggleCollapsed }: Props) {
  const { activeChapterId, setActiveChapterId } = useBookEditor()
  const [menuOpen, setMenuOpen] = useState(false)

  const isFolder = node.type === 'part' || node.type === 'research_folder'
  const isCollapsed = collapsed.has(node.id)
  // Chapter-type items are identified by their chapterId; research items by their own id
  const isChapterType = node.type === 'chapter' || node.type === 'front_matter' || node.type === 'back_matter'
  const itemKey = isChapterType ? (node.chapterId ?? node.id) : node.id
  const isActive = activeChapterId === itemKey

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function handleClick() {
    if (isFolder) {
      onToggleCollapsed(node.id)
    } else {
      setActiveChapterId(itemKey)
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={[
          'group relative flex items-center gap-1.5 rounded-md mx-1.5 my-0.5 text-xs cursor-pointer select-none',
          'pr-1',
          isActive
            ? 'bg-brand/10 text-brand border border-brand/20'
            : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85',
        ].join(' ')}
        style={{ paddingLeft: `${6 + depth * 12}px`, paddingTop: '5px', paddingBottom: '5px' }}
        onClick={handleClick}
      >
        {/* Drag handle — hidden until hover */}
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-30 hover:!opacity-60 flex-shrink-0 cursor-grab active:cursor-grabbing text-[11px] text-white/50 p-0 bg-transparent border-0"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        {/* Folder chevron or type icon */}
        {isFolder ? (
          <span
            className="flex-shrink-0 text-[9px] transition-transform duration-150 text-white/40"
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            ▾
          </span>
        ) : (
          <span className="flex-shrink-0 text-[11px] leading-none">{TYPE_ICONS[node.type]}</span>
        )}

        {/* Title */}
        <span className="truncate flex-1 leading-none">{node.title}</span>

        {/* ⋯ menu trigger — hidden until hover */}
        <span
          className="opacity-0 group-hover:opacity-100 flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <BinderItemMenu node={node} open={menuOpen} onOpenChange={setMenuOpen} />
        </span>
      </div>

      {/* Children — rendered when folder is not collapsed */}
      {isFolder && !isCollapsed && node.children.length > 0 && (
        <SortableContext
          items={node.children.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {node.children.map(child => (
            <BinderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
        </SortableContext>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx" \
        "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx"
git commit -m "feat: add BinderItem row with drag handle and active state"
```

---

### Task 5: BinderItemMenu (⋯ menu) and BinderAddMenu

**Files:**
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx`
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`

- [ ] **Step 1: Write binder-item-menu.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx
'use client'

import { useRef, useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import {
  updateBinderItemAction,
  deleteBinderItemAction,
  createBinderItemAction,
} from '@/lib/actions/binder.actions'
import type { TreeNode } from './binder-tree'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

// Which child types can be added under each parent type
const ADD_CHILD_OPTIONS: Partial<Record<BinderItemRow['type'], Array<{ type: BinderItemRow['type']; label: string }>>> = {
  part: [{ type: 'chapter', label: 'Chapter' }],
  research_folder: [
    { type: 'research_note', label: 'Note' },
    { type: 'character', label: 'Character' },
    { type: 'outline', label: 'Outline' },
  ],
}

type Props = {
  node: TreeNode
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function BinderItemMenu({ node, open, onOpenChange }: Props) {
  const { bookId, addItem, renameItem, removeItem, addError, binderItems } = useBookEditor()
  const [confirming, setConfirming] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const childOptions = ADD_CHILD_OPTIONS[node.type] ?? []
  const hasChildren = binderItems.some(i => i.parentId === node.id)

  async function handleAddChild(type: BinderItemRow['type'], label: string) {
    onOpenChange(false)
    const siblings = binderItems.filter(i => i.parentId === node.id)
    const order = siblings.length

    const result = await createBinderItemAction({
      bookId,
      parentId: node.id,
      type,
      title: `New ${label}`,
      order,
    })

    if (!result.success) {
      addError(`Couldn't add ${label}. Please try again.`)
      return
    }

    const newItem: BinderItemRow = {
      id: result.data.id,
      bookId,
      parentId: node.id,
      type,
      title: `New ${label}`,
      order,
      content: null,
      chapterId: result.data.chapterId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    addItem(newItem)
  }

  function startRename() {
    setRenaming(true)
    setRenameValue(node.title)
    onOpenChange(false)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitRename() {
    const trimmed = renameValue.trim()
    setRenaming(false)
    if (!trimmed || trimmed === node.title) return
    renameItem(node.id, trimmed) // optimistic
    const result = await updateBinderItemAction(node.id, { title: trimmed })
    if (!result.success) {
      renameItem(node.id, node.title) // rollback
      addError("Couldn't rename. Please try again.")
    }
  }

  async function confirmDelete() {
    onOpenChange(false)
    setConfirming(false)
    removeItem(node.id) // optimistic (also removes direct children from state)
    const result = await deleteBinderItemAction(node.id)
    if (!result.success) {
      addError("Couldn't delete. Please try again.")
      // Note: full rollback would require re-fetching the binder tree
      // For now, show error and let user refresh
    }
  }

  if (renaming) {
    return (
      <input
        ref={inputRef}
        className="w-full bg-background border border-brand/40 rounded px-1.5 py-0.5 text-xs text-white outline-none"
        value={renameValue}
        autoFocus
        onChange={e => setRenameValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={e => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') { setRenaming(false) }
        }}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <div className="relative">
      {/* ⋯ trigger button */}
      <button
        className="px-1 py-0.5 rounded text-white/40 hover:text-white/80 hover:bg-white/10 text-sm leading-none"
        onClick={e => { e.stopPropagation(); onOpenChange(!open) }}
        aria-label="Item actions"
      >
        ⋯
      </button>

      {/* Dropdown menu */}
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={e => { e.stopPropagation(); onOpenChange(false); setConfirming(false) }}
          />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-[#222] border border-[#333] rounded-lg shadow-2xl py-1 text-xs">
            {/* Add child options */}
            {childOptions.map(opt => (
              <button
                key={opt.type}
                className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
                onClick={e => { e.stopPropagation(); handleAddChild(opt.type, opt.label) }}
              >
                <span className="text-white/40">+</span> Add {opt.label}
              </button>
            ))}
            {childOptions.length > 0 && <div className="my-1 border-t border-[#333]" />}

            {/* Rename */}
            <button
              className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              onClick={e => { e.stopPropagation(); startRename() }}
            >
              <span className="text-white/40">✎</span> Rename
            </button>

            <div className="my-1 border-t border-[#333]" />

            {/* Delete — shows inline confirmation */}
            {confirming ? (
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-white/50 flex-1">Delete?</span>
                <button
                  className="text-red-400 hover:text-red-300 font-medium"
                  onClick={e => { e.stopPropagation(); confirmDelete() }}
                >Yes</button>
                <button
                  className="text-white/40 hover:text-white/70"
                  onClick={e => { e.stopPropagation(); setConfirming(false) }}
                >Cancel</button>
              </div>
            ) : (
              <button
                className="w-full text-left px-3 py-1.5 text-red-400/80 hover:bg-white/10 hover:text-red-400 flex items-center gap-2"
                onClick={e => { e.stopPropagation(); setConfirming(true) }}
              >
                <span>✕</span> Delete{hasChildren ? ' (and children)' : ''}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write binder-add-menu.tsx (top-level + button)**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx
'use client'

import { useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

const ROOT_OPTIONS: Array<{ type: BinderItemRow['type']; label: string }> = [
  { type: 'part', label: 'Part' },
  { type: 'chapter', label: 'Chapter' },
  { type: 'research_folder', label: 'Research Folder' },
]

type Props = {
  parentId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function BinderAddMenu({ parentId, open, onOpenChange }: Props) {
  const { bookId, binderItems, addItem, addError } = useBookEditor()

  async function handleAdd(type: BinderItemRow['type'], label: string) {
    onOpenChange(false)
    const siblings = binderItems.filter(i => i.parentId === parentId)
    const order = siblings.length

    const result = await createBinderItemAction({ bookId, parentId, type, title: `New ${label}`, order })
    if (!result.success) {
      addError(`Couldn't add ${label}. Please try again.`)
      return
    }

    const newItem: BinderItemRow = {
      id: result.data.id,
      bookId,
      parentId,
      type,
      title: `New ${label}`,
      order,
      content: null,
      chapterId: result.data.chapterId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    addItem(newItem)
  }

  return (
    <div className="relative">
      <button
        className="w-6 h-6 flex items-center justify-center rounded text-brand hover:bg-brand/15 text-lg leading-none"
        onClick={e => { e.stopPropagation(); onOpenChange(!open) }}
        aria-label="Add item"
      >
        +
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-[#222] border border-[#333] rounded-lg shadow-2xl py-1 text-xs">
            {ROOT_OPTIONS.map(opt => (
              <button
                key={opt.type}
                className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
                onClick={() => handleAdd(opt.type, opt.label)}
              >
                <span className="text-white/40">+</span> Add {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/"
git commit -m "feat: add BinderItemMenu and BinderAddMenu with CRUD actions"
```

---

### Task 6: EditorToolbar

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

- [ ] **Step 1: Write the toolbar**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx
'use client'

import type { Editor } from '@tiptap/react'
import { useBookEditor } from '../book-editor-provider'

type ToolbarButtonProps = {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'px-2 py-1 rounded text-xs font-medium transition-colors',
        active
          ? 'bg-brand text-[#0a0a0a]'
          : 'text-white/50 hover:text-white/90 hover:bg-white/[0.06]',
        disabled ? 'opacity-30 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />
}

const SAVE_LABELS: Record<string, string> = {
  saved: '● Saved',
  saving: '○ Saving…',
  unsaved: '● Unsaved',
}

const SAVE_COLORS: Record<string, string> = {
  saved: 'text-white/30',
  saving: 'text-brand/60 animate-pulse',
  unsaved: 'text-brand/80',
}

type Props = { editor: Editor }

export function EditorToolbar({ editor }: Props) {
  const { saveStatus, wordCount } = useBookEditor()

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-[#181818] flex-shrink-0 overflow-x-auto">
      {/* Inline formatting */}
      <ToolbarButton
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
      >
        <s>S</s>
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton
        title="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
      >
        H3
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        1.
      </ToolbarButton>

      <Divider />

      {/* Block */}
      <ToolbarButton
        title="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      >
        "
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </ToolbarButton>

      <Divider />

      {/* History */}
      <ToolbarButton
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        ↪
      </ToolbarButton>

      {/* Right edge: save status + word count */}
      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        <span className={`text-xs tabular-nums ${SAVE_COLORS[saveStatus]}`}>
          {SAVE_LABELS[saveStatus]}
        </span>
        <span className="text-xs text-white/25 tabular-nums">
          {wordCount.toLocaleString()} words
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "feat: add EditorToolbar with formatting buttons and save status"
```

---

### Task 7: ChapterEditor — TipTap + auto-save + research textarea

**Files:**
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`

- [ ] **Step 1: Write the full ChapterEditor**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { JSONContent } from '@tiptap/react'
import { useBookEditor } from '../book-editor-provider'
import { EditorToolbar } from './editor-toolbar'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'

// Research/non-chapter item types that use plain textarea
const RESEARCH_TYPES = new Set(['research_note', 'character', 'outline'])

function ResearchEditor() {
  const { activeChapterId, binderItems, addError } = useBookEditor()
  const item = binderItems.find(i => i.id === activeChapterId)
  const [value, setValue] = useState(
    typeof item?.content === 'string' ? item.content : ''
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const content = typeof item?.content === 'string' ? item.content : ''
    setValue(content)
  }, [activeChapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setValue(text)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!activeChapterId) return
      const result = await updateBinderItemAction(activeChapterId, { content: text })
      if (!result.success) addError("Couldn't save note. Please try again.")
    }, 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
      <h2 className="font-comfortaa font-bold text-lg text-white/80 mb-4">{item?.title}</h2>
      <textarea
        className="w-full h-[calc(100vh-200px)] bg-transparent text-white/70 text-sm leading-relaxed resize-none outline-none placeholder:text-white/20"
        placeholder="Start writing your notes…"
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}

export function ChapterEditor() {
  const { activeChapterId, activeChapter, chapterLoading, onEditorUpdate, binderItems } = useBookEditor()

  // Determine if the active item is a research item (not a chapter)
  const activeBinderItem = binderItems.find(i =>
    i.chapterId === activeChapterId || i.id === activeChapterId
  )
  const isResearchItem = activeBinderItem ? RESEARCH_TYPES.has(activeBinderItem.type) : false

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Start writing…' }),
      ],
      content: activeChapter?.content as JSONContent | undefined ?? '',
      onUpdate: ({ editor }) => {
        onEditorUpdate(editor.getJSON())
      },
      editorProps: {
        attributes: {
          class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px]',
        },
      },
    },
    // key equivalent: destroy and recreate when chapter changes
    [activeChapterId],
  )

  // Empty state: no chapter selected
  if (!activeChapterId) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background">
        <p className="text-white/25 text-sm">Select a chapter from the binder to start writing</p>
      </main>
    )
  }

  // Research item: plain textarea
  if (isResearchItem) {
    return (
      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        <ResearchEditor />
      </main>
    )
  }

  // Loading state
  if (chapterLoading || !activeChapter) {
    return (
      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/25 text-sm animate-pulse">Loading…</p>
        </div>
      </main>
    )
  }

  // Chapter editor
  return (
    <main className="flex-1 flex flex-col bg-background overflow-hidden">
      {editor && <EditorToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          <EditorContent editor={editor} />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Add TipTap prose styles**

TipTap's `prose` classes need Tailwind Typography or manual overrides. Add these to `app/globals.css` under the existing styles:

```css
/* TipTap editor prose overrides */
.prose h1 { @apply text-2xl font-bold text-white/90 mt-8 mb-4 font-comfortaa; }
.prose h2 { @apply text-xl font-bold text-white/85 mt-6 mb-3 font-comfortaa; }
.prose h3 { @apply text-lg font-semibold text-white/80 mt-5 mb-2 font-comfortaa; }
.prose p { @apply text-white/70 leading-relaxed mb-4; }
.prose strong { @apply text-white/90 font-semibold; }
.prose em { @apply italic; }
.prose s { @apply line-through text-white/50; }
.prose blockquote { @apply border-l-2 border-brand/40 pl-4 text-white/50 italic my-4; }
.prose ul { @apply list-disc list-inside text-white/70 mb-4 space-y-1; }
.prose ol { @apply list-decimal list-inside text-white/70 mb-4 space-y-1; }
.prose hr { @apply border-border my-8; }
.prose code { @apply bg-white/10 rounded px-1 py-0.5 text-xs font-mono text-white/80; }
.prose pre { @apply bg-[#1a1a1a] rounded-lg p-4 overflow-x-auto my-4; }
.prose pre code { @apply bg-transparent p-0; }

/* TipTap placeholder */
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  @apply text-white/20 float-left h-0 pointer-events-none;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/" app/globals.css
git commit -m "feat: add ChapterEditor with TipTap, auto-save, and research textarea"
```

---

### Task 8: MetadataPanel — title, status, word count, notes

**Files:**
- Rewrite: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/metadata/status-selector.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/metadata/chapter-notes.tsx`

- [ ] **Step 1: Write status-selector.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/metadata/status-selector.tsx
'use client'

import { useState } from 'react'
import { updateChapterStatusAction } from '@/lib/actions/chapter.actions'
import type { ChapterData } from '@/lib/actions/chapter.actions'
import { useBookEditor } from '../book-editor-provider'

type Status = ChapterData['status']

const STATUSES: Array<{ value: Status; label: string }> = [
  { value: 'IDEA', label: 'Idea' },
  { value: 'OUTLINE', label: 'Outline' },
  { value: 'FIRST_DRAFT', label: 'First Draft' },
  { value: 'REVISED', label: 'Revised' },
  { value: 'FINAL', label: 'Final' },
]

type Props = { chapterId: string; current: Status }

export function StatusSelector({ chapterId, current }: Props) {
  const { addError } = useBookEditor()
  const [status, setStatus] = useState<Status>(current)
  const [saving, setSaving] = useState(false)

  async function handleSelect(value: Status) {
    if (value === status || saving) return
    const prev = status
    setStatus(value) // optimistic
    setSaving(true)
    const result = await updateChapterStatusAction(chapterId, value)
    setSaving(false)
    if (!result.success) {
      setStatus(prev) // rollback
      addError("Couldn't update status. Please try again.")
    }
  }

  return (
    <div>
      <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2">Status</p>
      <div className="flex flex-col gap-1">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => handleSelect(s.value)}
            className={[
              'w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors',
              status === s.value
                ? 'bg-brand/15 text-brand border border-brand/30 font-medium'
                : 'text-white/45 hover:bg-white/[0.04] hover:text-white/70',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write chapter-notes.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/metadata/chapter-notes.tsx
'use client'

import { useRef, useState } from 'react'
import { updateChapterNotesAction } from '@/lib/actions/chapter.actions'
import { useBookEditor } from '../book-editor-provider'

type Props = { chapterId: string; initialNotes: string | null }

export function ChapterNotes({ chapterId, initialNotes }: Props) {
  const { addError } = useBookEditor()
  const [value, setValue] = useState(initialNotes ?? '')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setValue(text)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const result = await updateChapterNotesAction(chapterId, text || null)
      if (!result.success) addError("Couldn't save notes. Please try again.")
    }, 2000)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2">Author Notes</p>
      <textarea
        className="flex-1 w-full bg-[#1c1c1c] border border-border rounded-md p-2.5 text-xs text-white/60 leading-relaxed resize-none outline-none placeholder:text-white/20 focus:border-brand/30 transition-colors"
        placeholder="Private notes — only you can see these."
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}
```

- [ ] **Step 3: Write metadata-panel.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx
'use client'

import { useRef, useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { StatusSelector } from './status-selector'
import { ChapterNotes } from './chapter-notes'

const CHAPTER_TYPES = new Set(['chapter', 'front_matter', 'back_matter'])

export function MetadataPanel() {
  const { activeChapterId, activeChapter, binderItems, wordCount, renameItem, addError } = useBookEditor()

  const activeItem = binderItems.find(i =>
    i.chapterId === activeChapterId || i.id === activeChapterId
  )
  const isChapterType = activeItem ? CHAPTER_TYPES.has(activeItem.type) : false

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  function startEditTitle() {
    if (!activeItem) return
    setTitleValue(activeItem.title)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  async function commitTitle() {
    setEditingTitle(false)
    const trimmed = titleValue.trim()
    if (!trimmed || !activeItem || trimmed === activeItem.title) return
    renameItem(activeItem.id, trimmed) // optimistic
    const result = await updateBinderItemAction(activeItem.id, { title: trimmed })
    if (!result.success) {
      renameItem(activeItem.id, activeItem.title) // rollback
      addError("Couldn't rename chapter. Please try again.")
    }
  }

  // No chapter selected or non-chapter item active
  if (!activeChapterId || !isChapterType || !activeChapter || !activeItem) {
    return (
      <aside className="w-60 flex-shrink-0 bg-card border-l border-border flex items-center justify-center">
        <p className="text-xs text-white/20 text-center px-4 leading-relaxed">
          Select a chapter<br />to see details
        </p>
      </aside>
    )
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-card border-l border-border flex flex-col h-full overflow-hidden">
      <div className="flex flex-col gap-5 p-4 flex-1 min-h-0">
        {/* Chapter title */}
        <div>
          <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Chapter</p>
          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="w-full bg-background border border-brand/40 rounded px-2 py-1 text-sm text-white outline-none font-comfortaa font-bold"
              value={titleValue}
              autoFocus
              onChange={e => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
            />
          ) : (
            <button
              className="w-full text-left text-sm font-comfortaa font-bold text-white/85 hover:text-white truncate"
              onClick={startEditTitle}
              title="Click to rename"
            >
              {activeItem.title}
            </button>
          )}
        </div>

        {/* Status */}
        <StatusSelector chapterId={activeChapter.id} current={activeChapter.status} />

        {/* Word count */}
        <div>
          <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Words</p>
          <p className="text-sm text-white/60 tabular-nums">{wordCount.toLocaleString()}</p>
        </div>

        {/* Notes — fills remaining height */}
        <ChapterNotes chapterId={activeChapter.id} initialNotes={activeChapter.notes} />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/metadata/"
git commit -m "feat: add MetadataPanel with status selector, word count, and notes"
```

---

### Task 9: Error toasts + final wiring

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/error-toasts.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/page.tsx`

- [ ] **Step 1: Write the error toast renderer**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/error-toasts.tsx
'use client'

import { useBookEditor } from './book-editor-provider'

export function ErrorToasts() {
  const { errors, dismissError } = useBookEditor()

  if (errors.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {errors.map(error => (
        <div
          key={error.id}
          className="flex items-center gap-3 bg-[#2a1515] border border-red-900/50 text-red-300 text-xs rounded-lg px-4 py-2.5 shadow-2xl pointer-events-auto max-w-xs"
        >
          <span className="text-red-400">✕</span>
          <span className="flex-1">{error.message}</span>
          <button
            onClick={() => dismissError(error.id)}
            className="text-red-400/60 hover:text-red-400 ml-1"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add ErrorToasts to page.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/page.tsx
import { notFound } from 'next/navigation'
import { getBookAction } from '@/lib/actions/book.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { BookEditorProvider } from './_components/book-editor-provider'
import { BinderTree } from './_components/binder/binder-tree'
import { ChapterEditor } from './_components/editor/chapter-editor'
import { MetadataPanel } from './_components/metadata/metadata-panel'
import { ErrorToasts } from './_components/error-toasts'

type Props = {
  params: Promise<{ locale: string; bookId: string }>
}

export default async function BookEditorPage({ params }: Props) {
  const { bookId } = await params

  const [bookResult, binderResult] = await Promise.all([
    getBookAction(bookId),
    getBinderTreeAction(bookId),
  ])

  if (!bookResult.success || !binderResult.success) notFound()

  return (
    <BookEditorProvider
      bookId={bookId}
      bookTitle={bookResult.data.title}
      initialBinderItems={binderResult.data}
    >
      <div className="flex h-[calc(100vh-var(--header-height,0px))] overflow-hidden">
        <BinderTree />
        <ChapterEditor />
        <MetadataPanel />
      </div>
      <ErrorToasts />
    </BookEditorProvider>
  )
}
```

- [ ] **Step 3: Run full type-check and tests**

```bash
npx tsc --noEmit
npm test
```

Expected: no TypeScript errors, 50/50 tests passing (server action tests are unaffected).

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/"
git commit -m "feat: add error toasts and wire final book editor page"
```

---

## Self-Review Checklist

After all tasks complete, verify these spec requirements are covered:

| Requirement | Task |
|---|---|
| Fixed sidebar binder + center editor + right panel | Task 1 (page layout) |
| Context provider with chapter cache and auto-save | Task 2 |
| Tree derivation (flat → nested, sorted by order) | Task 3 |
| DnD reordering within same parent | Task 3 |
| Item types with correct icons | Task 4 |
| ⋯ hover menu per item | Task 5 |
| Inline rename (Enter/Escape) | Task 5 |
| Delete confirmation inline in menu | Task 5 |
| Top-level + add menu | Task 5 |
| Fixed toolbar with all button groups | Task 6 |
| Save status indicator + word count in toolbar | Task 6 |
| TipTap editor with key={activeChapterId} | Task 7 |
| Research item textarea fallback | Task 7 |
| Empty state when no chapter selected | Task 7 |
| Chapter loading skeleton | Task 7 |
| Inline title editing in metadata panel | Task 8 |
| Status pill selector (5 states) | Task 8 |
| Author notes debounced textarea | Task 8 |
| Metadata panel placeholder when no chapter | Task 8 |
| Error toasts with auto-dismiss | Task 9 |
| Optimistic updates with rollback on error | Tasks 3, 5, 8 |
