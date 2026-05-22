# Studio Outline Editor (Kanban) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the textarea fallback for `outline` binder items with a Kanban-style board — user-editable columns, draggable cards with title + optional synopsis, optional chapter linking.

**Architecture:** Outline content lives in `binderItems.content` (jsonb, no migration). A new `<OutlineBoard>` component renders the board via the same render-branching pattern Feature B established. Pure helpers (`seedOutline`, `moveCard`, `moveColumn`) are isolated in `lib/outline/board.ts` for unit testing. Drag-and-drop via `@dnd-kit` (already installed, used by the binder tree).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, `@dnd-kit/core` + `@dnd-kit/sortable`, `@paralleldrive/cuid2` (`createId`), Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-22-studio-outline-editor-design.md`](../specs/2026-05-22-studio-outline-editor-design.md)

---

## File Structure

**Create:**
- `lib/outline/board.ts` — `OutlineContent` type, `seedOutline`, `moveCard`, `moveColumn` (pure helpers)
- `__tests__/outline/board.test.ts` — Vitest unit tests for the helpers
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` — top-level board component + DndContext setup
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-column.tsx` — column component with header + card list + add-card button
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx` — card component (title, synopsis, ⋯ menu, link affordance)
- `app/[locale]/(app)/studio/[bookId]/_components/outline/chapter-link-popover.tsx` — popover that lists binder chapters for linking

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — branch on `activeItem.type === 'outline'` to render `OutlineBoard` instead of the textarea fallback

**No DB migration.** No server-action changes (uses existing `updateBinderItemAction`).

---

## Task 1: Pure helpers + unit tests (TDD)

**Files:**
- Create: `lib/outline/board.ts`
- Create: `__tests__/outline/board.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/outline/board.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { seedOutline, moveCard, moveColumn, type OutlineContent } from '@/lib/outline/board'

describe('seedOutline', () => {
  it('returns three columns titled Act 1 / Act 2 / Act 3 with no cards', () => {
    const o = seedOutline()
    expect(o.columns).toHaveLength(3)
    expect(o.columns.map(c => c.title)).toEqual(['Act 1', 'Act 2', 'Act 3'])
    expect(o.columns.every(c => c.cards.length === 0)).toBe(true)
  })

  it('gives each column a unique non-empty id', () => {
    const o = seedOutline()
    const ids = o.columns.map(c => c.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(id => id.length > 0)).toBe(true)
  })
})

describe('moveCard', () => {
  const base: OutlineContent = {
    columns: [
      { id: 'col-a', title: 'A', cards: [
        { id: 'c1', title: '1' },
        { id: 'c2', title: '2' },
      ]},
      { id: 'col-b', title: 'B', cards: [
        { id: 'c3', title: '3' },
      ]},
    ],
  }

  it('reorders within the same column', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c2' }, { columnId: 'col-a', index: 0 })
    expect(next.columns[0].cards.map(c => c.id)).toEqual(['c2', 'c1'])
  })

  it('moves a card to another column at the target index', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'col-b', index: 0 })
    expect(next.columns[0].cards.map(c => c.id)).toEqual(['c2'])
    expect(next.columns[1].cards.map(c => c.id)).toEqual(['c1', 'c3'])
  })

  it('appends when target index >= card count', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'col-b', index: 99 })
    expect(next.columns[1].cards.map(c => c.id)).toEqual(['c3', 'c1'])
  })

  it('returns the input unchanged if the source card is not found', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'nonexistent' }, { columnId: 'col-b', index: 0 })
    expect(next).toEqual(base)
  })

  it('returns the input unchanged if the target column is not found', () => {
    const next = moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'nonexistent', index: 0 })
    expect(next).toEqual(base)
  })

  it('does not mutate the input', () => {
    const snapshot = JSON.parse(JSON.stringify(base))
    moveCard(base, { columnId: 'col-a', cardId: 'c1' }, { columnId: 'col-b', index: 0 })
    expect(base).toEqual(snapshot)
  })
})

describe('moveColumn', () => {
  const base: OutlineContent = {
    columns: [
      { id: 'a', title: 'A', cards: [{ id: 'c1', title: '1' }] },
      { id: 'b', title: 'B', cards: [] },
      { id: 'c', title: 'C', cards: [] },
    ],
  }

  it('reorders columns', () => {
    const next = moveColumn(base, 'c', 0)
    expect(next.columns.map(c => c.id)).toEqual(['c', 'a', 'b'])
  })

  it('preserves cards inside each column after reorder', () => {
    const next = moveColumn(base, 'a', 2)
    const a = next.columns.find(c => c.id === 'a')!
    expect(a.cards.map(c => c.id)).toEqual(['c1'])
  })

  it('returns input unchanged for an unknown column id', () => {
    const next = moveColumn(base, 'nonexistent', 0)
    expect(next).toEqual(base)
  })

  it('clamps toIndex to the valid range', () => {
    const next = moveColumn(base, 'a', 99)
    expect(next.columns.map(c => c.id)).toEqual(['b', 'c', 'a'])
  })
})
```

Run:
```bash
npm test -- outline/board
```

Expected: FAIL — `Cannot find module '@/lib/outline/board'`.

- [ ] **Step 2: Implement the helpers**

Create `lib/outline/board.ts`:

```ts
import { createId } from '@paralleldrive/cuid2'

export type OutlineCard = {
  id: string
  title: string
  synopsis?: string
  linkedChapterId?: string
}

export type OutlineColumn = {
  id: string
  title: string
  cards: OutlineCard[]
}

export type OutlineContent = {
  columns: OutlineColumn[]
}

// Returns the default starting board for a new outline item: three
// columns titled Act 1 / Act 2 / Act 3 with no cards.
export function seedOutline(): OutlineContent {
  return {
    columns: [
      { id: createId(), title: 'Act 1', cards: [] },
      { id: createId(), title: 'Act 2', cards: [] },
      { id: createId(), title: 'Act 3', cards: [] },
    ],
  }
}

// Pure move: relocates a card from one position to another. If the
// source card or target column is missing, returns the input unchanged.
export function moveCard(
  outline: OutlineContent,
  from: { columnId: string; cardId: string },
  to: { columnId: string; index: number },
): OutlineContent {
  const sourceCol = outline.columns.find(c => c.id === from.columnId)
  const targetCol = outline.columns.find(c => c.id === to.columnId)
  if (!sourceCol || !targetCol) return outline

  const card = sourceCol.cards.find(c => c.id === from.cardId)
  if (!card) return outline

  // Deep-clone columns and cards arrays (cards themselves are
  // reused — they're treated as immutable here).
  const nextColumns = outline.columns.map(col => {
    if (col.id === from.columnId && col.id === to.columnId) {
      // Same-column move: remove + reinsert at clamped index
      const filtered = col.cards.filter(c => c.id !== from.cardId)
      const insertAt = Math.min(Math.max(0, to.index), filtered.length)
      return { ...col, cards: [...filtered.slice(0, insertAt), card, ...filtered.slice(insertAt)] }
    }
    if (col.id === from.columnId) {
      return { ...col, cards: col.cards.filter(c => c.id !== from.cardId) }
    }
    if (col.id === to.columnId) {
      const insertAt = Math.min(Math.max(0, to.index), col.cards.length)
      return { ...col, cards: [...col.cards.slice(0, insertAt), card, ...col.cards.slice(insertAt)] }
    }
    return col
  })

  return { columns: nextColumns }
}

// Pure move: relocates a column to a new index. Out-of-range indices
// are clamped. Unknown columnId returns the input unchanged.
export function moveColumn(
  outline: OutlineContent,
  columnId: string,
  toIndex: number,
): OutlineContent {
  const fromIndex = outline.columns.findIndex(c => c.id === columnId)
  if (fromIndex < 0) return outline

  const next = [...outline.columns]
  const [col] = next.splice(fromIndex, 1)
  const clamped = Math.min(Math.max(0, toIndex), next.length)
  next.splice(clamped, 0, col)

  return { columns: next }
}
```

Run:
```bash
npm test -- outline/board
```

Expected: all tests pass.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add lib/outline/ "__tests__/outline/"
git commit -m "feat(studio): outline board pure helpers + tests (SP3 C Task 1)

OutlineContent type + seedOutline / moveCard / moveColumn — all pure
(immutable input/output) functions for the upcoming Kanban board.
seedOutline returns three default columns (Act 1 / Act 2 / Act 3).
moveCard and moveColumn handle same-column, cross-column, and
out-of-range cases without mutating input.

Vitest unit tests cover happy paths, missing IDs, out-of-range
indices, and input immutability."
```

---

## Task 2: OutlineBoard, OutlineColumn, OutlineCard components (no drag yet)

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-column.tsx`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx`

Renders the board with column-header rename, card add/edit/delete, column add/delete. Drag-and-drop is Task 3.

- [ ] **Step 1: Create `outline-card.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { OutlineCard } from '@/lib/outline/board'

type Props = {
  card: OutlineCard
  onChange: (patch: Partial<OutlineCard>) => void
  onDelete: () => void
  onOpenLinkPopover: () => void   // wired in Task 4
  onUnlink: () => void
  onJumpToChapter: () => void
  chapterAvailable: boolean
}

export function OutlineCardView({ card, onChange, onDelete, onOpenLinkPopover, onUnlink, onJumpToChapter, chapterAvailable }: Props) {
  const [editingSynopsis, setEditingSynopsis] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-surface-elevated border border-border rounded-md p-3 flex flex-col gap-2 group relative">
      {/* Title */}
      <input
        type="text"
        value={card.title}
        onChange={e => onChange({ title: e.target.value })}
        placeholder="Card title"
        className="bg-transparent text-sm font-medium text-foreground outline-none placeholder-muted-foreground"
      />

      {/* Synopsis */}
      {editingSynopsis ? (
        <textarea
          autoFocus
          value={card.synopsis ?? ''}
          onChange={e => onChange({ synopsis: e.target.value })}
          onBlur={() => setEditingSynopsis(false)}
          onKeyDown={e => { if (e.key === 'Escape') setEditingSynopsis(false) }}
          placeholder="Add a synopsis…"
          rows={4}
          className="resize-none bg-surface-inset border border-border rounded p-2 text-xs text-foreground/80 outline-none focus:border-brand/40"
        />
      ) : (
        <p
          onClick={() => setEditingSynopsis(true)}
          className={cn(
            'text-xs leading-relaxed cursor-text line-clamp-3 min-h-[2.5em]',
            card.synopsis ? 'text-foreground/70' : 'text-muted-foreground/50 italic',
          )}
        >
          {card.synopsis || 'Add a synopsis…'}
        </p>
      )}

      {/* Chapter link */}
      {card.linkedChapterId && (
        <button
          onClick={onJumpToChapter}
          className={cn(
            'text-[11px] text-left hover:underline',
            chapterAvailable ? 'text-brand' : 'text-destructive/70',
          )}
        >
          {chapterAvailable ? '→ View chapter' : '→ Chapter unavailable'}
        </button>
      )}

      {/* ⋯ menu trigger */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-xs px-1"
        aria-label="Card actions"
      >
        ⋯
      </button>

      {menuOpen && (
        <div
          className="absolute top-7 right-2 bg-surface-elevated border border-border rounded-md shadow-lg p-1 w-44 z-10"
          onBlur={() => setMenuOpen(false)}
        >
          {!card.linkedChapterId ? (
            <button
              onClick={() => { setMenuOpen(false); onOpenLinkPopover() }}
              className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface text-foreground/80 hover:text-foreground"
            >
              Link to chapter…
            </button>
          ) : (
            <button
              onClick={() => { setMenuOpen(false); onUnlink() }}
              className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface text-foreground/80 hover:text-foreground"
            >
              Unlink chapter
            </button>
          )}
          <button
            onClick={() => { setMenuOpen(false); onDelete() }}
            className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface text-destructive hover:text-destructive"
          >
            Delete card
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `outline-column.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { OutlineCard, OutlineColumn } from '@/lib/outline/board'
import { OutlineCardView } from './outline-card'

type Props = {
  column: OutlineColumn
  onChange: (patch: Partial<OutlineColumn>) => void
  onDelete: () => void
  onAddCard: () => void
  onCardChange: (cardId: string, patch: Partial<OutlineCard>) => void
  onCardDelete: (cardId: string) => void
  onCardOpenLinkPopover: (cardId: string) => void
  onCardUnlink: (cardId: string) => void
  onCardJumpToChapter: (cardId: string) => void
  isChapterAvailable: (chapterId: string | undefined) => boolean
}

export function OutlineColumnView({
  column, onChange, onDelete, onAddCard,
  onCardChange, onCardDelete, onCardOpenLinkPopover, onCardUnlink, onCardJumpToChapter, isChapterAvailable,
}: Props) {
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2 w-72 flex-shrink-0 bg-card border border-border rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <input
            autoFocus
            defaultValue={column.title}
            onBlur={e => { onChange({ title: e.target.value.trim() || column.title }); setRenaming(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-foreground border-b border-brand outline-none"
          />
        ) : (
          <h3
            onDoubleClick={() => setRenaming(true)}
            className="flex-1 text-sm font-semibold text-foreground cursor-pointer hover:text-brand transition-colors truncate"
            title="Double-click to rename"
          >
            {column.title}
          </h3>
        )}

        <button
          onClick={() => setMenuOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground text-xs px-1"
          aria-label="Column actions"
        >
          ⋯
        </button>
      </div>

      {menuOpen && !confirmingDelete && (
        <button
          onClick={() => { setMenuOpen(false); setConfirmingDelete(true) }}
          className="text-xs text-left text-destructive hover:underline px-1"
        >
          Delete column
        </button>
      )}

      {confirmingDelete && (
        <div className="text-xs px-1 py-1 flex flex-col gap-1.5">
          <span className="text-foreground/80">Delete column? Cards inside will be lost.</span>
          <div className="flex gap-3">
            <button onClick={onDelete} className="text-destructive font-medium hover:underline">Yes, delete</button>
            <button onClick={() => setConfirmingDelete(false)} className="text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {column.cards.map(card => (
          <OutlineCardView
            key={card.id}
            card={card}
            onChange={patch => onCardChange(card.id, patch)}
            onDelete={() => onCardDelete(card.id)}
            onOpenLinkPopover={() => onCardOpenLinkPopover(card.id)}
            onUnlink={() => onCardUnlink(card.id)}
            onJumpToChapter={() => onCardJumpToChapter(card.id)}
            chapterAvailable={isChapterAvailable(card.linkedChapterId)}
          />
        ))}
      </div>

      <button
        onClick={onAddCard}
        className={cn(
          'text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md py-2 transition-colors',
        )}
      >
        + Add card
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create `outline-board.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createId } from '@paralleldrive/cuid2'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import {
  type OutlineContent, type OutlineCard, type OutlineColumn,
  seedOutline,
} from '@/lib/outline/board'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { OutlineColumnView } from './outline-column'

type Props = { item: BinderItemRow }

export function OutlineBoard({ item }: Props) {
  const { binderItems, setActiveItemId, updateBinderItem } = useBookEditor()
  const [outline, setOutline] = useState<OutlineContent>(() => {
    const c = item.content as OutlineContent | null
    if (c && Array.isArray(c.columns)) return c
    return seedOutline()
  })
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persist seeded content for legacy items so subsequent reloads don't re-seed.
  useEffect(() => {
    const c = item.content as OutlineContent | null
    if (!c || !Array.isArray(c.columns)) {
      void updateBinderItemAction(item.id, { content: outline })
      updateBinderItem(item.id, { content: outline })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit(next: OutlineContent) {
    setOutline(next)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      updateBinderItem(item.id, { content: next })
      const result = await updateBinderItemAction(item.id, { content: next })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  // ─── Column ops ────────────────────────────────────────────────────────────
  function addColumn() {
    commit({ columns: [...outline.columns, { id: createId(), title: 'New column', cards: [] }] })
  }
  function patchColumn(id: string, patch: Partial<OutlineColumn>) {
    commit({ columns: outline.columns.map(c => c.id === id ? { ...c, ...patch } : c) })
  }
  function deleteColumn(id: string) {
    commit({ columns: outline.columns.filter(c => c.id !== id) })
  }

  // ─── Card ops ──────────────────────────────────────────────────────────────
  function addCard(columnId: string) {
    commit({
      columns: outline.columns.map(c => c.id === columnId
        ? { ...c, cards: [...c.cards, { id: createId(), title: '' }] }
        : c),
    })
  }
  function patchCard(columnId: string, cardId: string, patch: Partial<OutlineCard>) {
    commit({
      columns: outline.columns.map(c => c.id === columnId
        ? { ...c, cards: c.cards.map(card => card.id === cardId ? { ...card, ...patch } : card) }
        : c),
    })
  }
  function deleteCard(columnId: string, cardId: string) {
    commit({
      columns: outline.columns.map(c => c.id === columnId
        ? { ...c, cards: c.cards.filter(card => card.id !== cardId) }
        : c),
    })
  }

  // Chapter link helpers (wired more in Task 4)
  function isChapterAvailable(chapterId: string | undefined): boolean {
    if (!chapterId) return false
    return binderItems.some(b => b.type === 'chapter' && b.chapterId === chapterId)
  }
  function jumpToChapter(chapterId: string) {
    const binderItem = binderItems.find(b => b.type === 'chapter' && b.chapterId === chapterId)
    if (binderItem) setActiveItemId(binderItem.id)
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
          <p className="text-[10px] text-muted-foreground">Outline · Kanban board</p>
        </div>
        <SaveStatusBadge status={saveStatus} />
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex items-start gap-4 h-full min-h-0">
          {outline.columns.map(col => (
            <OutlineColumnView
              key={col.id}
              column={col}
              onChange={patch => patchColumn(col.id, patch)}
              onDelete={() => deleteColumn(col.id)}
              onAddCard={() => addCard(col.id)}
              onCardChange={(cardId, patch) => patchCard(col.id, cardId, patch)}
              onCardDelete={cardId => deleteCard(col.id, cardId)}
              onCardOpenLinkPopover={() => { /* wired in Task 4 */ }}
              onCardUnlink={cardId => patchCard(col.id, cardId, { linkedChapterId: undefined })}
              onCardJumpToChapter={cardId => {
                const card = col.cards.find(c => c.id === cardId)
                if (card?.linkedChapterId) jumpToChapter(card.linkedChapterId)
              }}
              isChapterAvailable={isChapterAvailable}
            />
          ))}

          <button
            onClick={addColumn}
            className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-2 px-4 w-48 flex-shrink-0 self-start"
          >
            + Column
          </button>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/"
git commit -m "feat(studio): outline board UI scaffolding — columns + cards (SP3 C Task 2)

OutlineBoard renders a horizontal-scroll column row. Columns have
double-click rename, ⋯ → Delete (with confirmation), + Add card.
Cards have inline title + click-to-expand synopsis + ⋯ menu (Link to
chapter, Unlink, Delete). SaveStatusBadge in the board header.

Drag-and-drop and the chapter-link popover are still TODOs — wired
in Tasks 3 and 4 respectively. onCardOpenLinkPopover is a no-op for
now; onCardJumpToChapter and onCardUnlink are functional."
```

---

## Task 3: Drag-and-drop with `@dnd-kit`

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-column.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx`

Add nested `DndContext` + `SortableContext` for columns (horizontal) and cards (vertical, scoped per column). Use the pure `moveCard` and `moveColumn` helpers on drop.

- [ ] **Step 1: Make `OutlineCardView` sortable**

Wrap the card's root `<div>` with `useSortable`. Add `id={card.id}` to the sortable.

Apply the same pattern used in `binder-item.tsx` (which already uses `useSortable`):

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function OutlineCardView({ card, ...rest }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="...">
      ...
    </div>
  )
}
```

Note: `{...attributes} {...listeners}` make the whole card the drag handle. That means clicking the title input will trigger drag attempts. To avoid this, put the handle on a dedicated grab affordance (small ⠿ icon top-left). See `binder-item.tsx` lines 99-104 for the existing pattern — copy it.

Refactor `OutlineCardView` so the drag handle is a small `<span>` element at top-left with `{...attributes} {...listeners}`, NOT on the root div. The root div just gets `ref={setNodeRef} style={style}`.

- [ ] **Step 2: Make `OutlineColumnView` sortable**

Same pattern for columns. The column root div gets `ref={setNodeRef} style={style}`. The handle is on a grab affordance in the column header (left of the title).

ALSO: each column wraps its card list in a `SortableContext`:

```tsx
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

// inside OutlineColumnView, around the card list:
<SortableContext items={column.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
  {column.cards.map(card => <OutlineCardView ... />)}
</SortableContext>
```

- [ ] **Step 3: Add the top-level `DndContext` in `OutlineBoard`**

```tsx
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { moveCard, moveColumn } from '@/lib/outline/board'

// In the component body:
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const activeId = String(active.id)
  const overId = String(over.id)

  // Was a column dragged?
  const isColumnDrag = outline.columns.some(c => c.id === activeId)
  if (isColumnDrag) {
    const toIndex = outline.columns.findIndex(c => c.id === overId)
    if (toIndex < 0) return
    commit(moveColumn(outline, activeId, toIndex))
    return
  }

  // Otherwise it's a card drag. Find source column.
  const sourceCol = outline.columns.find(c => c.cards.some(card => card.id === activeId))
  if (!sourceCol) return

  // The over.id may be another card OR a column (when dropping into an empty column).
  // Resolve target column + target index.
  const targetColAsCol = outline.columns.find(c => c.id === overId)
  if (targetColAsCol) {
    // Dropped onto a column itself — append to end.
    commit(moveCard(outline, { columnId: sourceCol.id, cardId: activeId }, { columnId: targetColAsCol.id, index: targetColAsCol.cards.length }))
    return
  }
  const targetCol = outline.columns.find(c => c.cards.some(card => card.id === overId))
  if (!targetCol) return
  const targetIndex = targetCol.cards.findIndex(c => c.id === overId)
  commit(moveCard(outline, { columnId: sourceCol.id, cardId: activeId }, { columnId: targetCol.id, index: targetIndex }))
}
```

Wrap the column row in `<DndContext>` + `<SortableContext>`:

```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={outline.columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
    <div className="flex items-start gap-4 ...">
      {outline.columns.map(col => <OutlineColumnView key={col.id} ... />)}
      <button onClick={addColumn}>+ Column</button>
    </div>
  </SortableContext>
</DndContext>
```

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/"
git commit -m "feat(studio): drag-and-drop on outline board (SP3 C Task 3)

@dnd-kit DndContext + nested SortableContexts: horizontal for columns,
vertical for cards within each column. Drop logic uses the pure
moveCard / moveColumn helpers from lib/outline/board.ts, so the same
code path is unit-tested.

Grab affordances are explicit (⠿ icons in column header + card top-left)
matching the binder-tree pattern — clicking title inputs doesn't trigger
drag. Dropping a card onto an empty column appends to the end."
```

---

## Task 4: Chapter-link popover

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/chapter-link-popover.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` — wire it up

- [ ] **Step 1: Create the popover component**

```tsx
'use client'

import { useBookEditor } from '../book-editor-provider'

type Props = {
  onPick: (chapterId: string) => void
  onClose: () => void
}

export function ChapterLinkPopover({ onPick, onClose }: Props) {
  const { binderItems } = useBookEditor()
  const chapters = binderItems
    .filter(b => b.type === 'chapter' && b.chapterId)
    .sort((a, b) => a.order - b.order)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface-elevated border border-border rounded-lg shadow-2xl p-3 max-w-md w-full max-h-[60vh] flex flex-col gap-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Link to chapter</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">×</button>
        </div>
        {chapters.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">No chapters in this book yet. Add a chapter first.</p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-1">
            {chapters.map(c => (
              <button
                key={c.id}
                onClick={() => { onPick(c.chapterId!); onClose() }}
                className="text-left text-xs px-3 py-2 rounded hover:bg-surface text-foreground/80 hover:text-foreground"
              >
                {c.title || 'Untitled chapter'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `OutlineBoard`**

Add state for "which card is opening the link popover":

```tsx
const [linkingCardId, setLinkingCardId] = useState<{ columnId: string; cardId: string } | null>(null)
```

Change the `onCardOpenLinkPopover` prop on `OutlineColumnView` to call:

```tsx
onCardOpenLinkPopover={cardId => setLinkingCardId({ columnId: col.id, cardId })}
```

At the bottom of `OutlineBoard`'s JSX, render the popover when active:

```tsx
{linkingCardId && (
  <ChapterLinkPopover
    onPick={chapterId => {
      patchCard(linkingCardId.columnId, linkingCardId.cardId, { linkedChapterId: chapterId })
    }}
    onClose={() => setLinkingCardId(null)}
  />
)}
```

Import `ChapterLinkPopover` at the top.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/"
git commit -m "feat(studio): chapter-link popover for outline cards (SP3 C Task 4)

Card ⋯ → 'Link to chapter…' opens a modal popover listing all
chapters in the current book (ordered by binder position). Click a
chapter to set card.linkedChapterId; the card then shows '→ View
chapter' (brand-yellow) and clicking it navigates via
setActiveItemId.

If no chapters exist yet, the popover shows a helpful empty-state
message instead of an empty list."
```

---

## Task 5: Wire `OutlineBoard` into `chapter-editor.tsx`

**File:** `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`

Add a branch in the render path that routes `outline` items to `OutlineBoard` instead of the textarea fallback.

- [ ] **Step 1: Add the import and branch**

Read the file. Find the `if (activeItem && !isChapterType) { ... }` block. The character branch is already there (renders `<CharacterProfile>`). Add an outline branch alongside it.

Add at the top of the file:
```tsx
import { OutlineBoard } from '../outline/outline-board'
```

Inside the `!isChapterType` branch, BEFORE the existing character check:
```tsx
if (activeItem && !isChapterType) {
  if (activeItem.type === 'outline') {
    return <OutlineBoard item={activeItem} />
  }
  if (activeItem.type === 'character') {
    return <CharacterProfile item={activeItem} />
  }
  // ... existing textarea fallback
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx"
git commit -m "feat(studio): route outline binder items to OutlineBoard (SP3 C Task 5)

Adds the missing render branch in chapter-editor's !isChapterType
section. Outline items previously fell through to the plain textarea
fallback; they now open the new Kanban board. Other research-side
types (research_folder, research_note) still hit the textarea — those
are Feature D's territory."
```

---

## Task 6: Final verification + Resume Here update

- [ ] **Step 1: Run the full manual checklist**

Per the spec §Testing.Manual checklist:

1. Create an Outline via `+ Add → Research → Outline` → editor pane shows a board with three columns (Act 1, 2, 3), each empty.
2. `+ Add card` in Act 1 → empty card appended, title input focused. Type, Enter commits.
3. Click synopsis area → expands to textarea. Type, blur → committed. SaveStatusBadge: Unsaved → Saving → Saved.
4. Reload page. Card + synopsis persist.
5. Drag card from Act 1 to Act 3 → lands at Act 3. Reload → still in Act 3.
6. Drag Act 3 to leftmost position → columns reorder. Reload → still reordered.
7. `+ Column` → empty column appended → title input focused. Type "Epilogue", Enter.
8. Card `⋯` → "Link to chapter…" → popover lists chapters → pick one → "→ View chapter" link on card.
9. Click "→ View chapter" → editor switches to that chapter.
10. Card `⋯` → Delete card → removed (no prompt).
11. Column `⋯` → Delete column → confirmation prompt → confirm → column + cards removed.
12. Delete a chapter that was linked. Re-open outline → linked card shows "→ Chapter unavailable" (destructive color).
13. `npm test` — passes (existing 92 + new board helper tests).
14. `npx tsc --noEmit` — clean.

If anything fails, fix it BEFORE marking the task complete.

- [ ] **Step 2: Update AGENTS.md Resume Here**

Replace the Resume Here block to mark Feature C done and point at Feature D:

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** SP3 Specialized Editors — Feature D (Research notes UX) — not started
> **Active branch:** `main`
> **Last commit:** <git log -1 --format=%s>
>
> 1. ~~SP1 Stability~~ DONE.
> 2. ~~SP2 Binder UX~~ DONE.
> 3. **SP3 Specialized Editors (IN FLIGHT)**:
>    - ~~Feature B: Front/Back Matter~~ DONE.
>    - ~~Feature C: Outline editor (Kanban)~~ DONE — board with user-editable columns, draggable cards w/ title + synopsis, optional chapter linking. 96+/96+ tests, tsc clean.
>    - **Feature D: Research notes UX (NEXT)** — smallest of the three; brainstorm what makes a Research Note distinct from a Custom front-matter item.
> 4. SP4 Toolbar + modes.
> 5. SP5 Metadata + persistence.
> 6. SP6 New surfaces.
>
> **Next concrete step when resuming:** invoke `/brainstorming` for SP3 Feature D (Research notes UX). Decide between B1 simpler-editor, B2 note-app features, or B3 plain-text quick-capture.
```

- [ ] **Step 3: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs: close SP3 Feature C (Outline editor), point Resume Here at Feature D"
```

---

## Definition of Done

- All 12 manual checklist items pass.
- `npm test` clean (~96+ tests).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here reflects Feature C complete, Feature D next.
- ~6 atomic commits on `main` (one per task).
