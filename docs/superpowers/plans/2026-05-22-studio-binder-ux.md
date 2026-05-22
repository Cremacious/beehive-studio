# Studio Binder UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the binder's primary user intentions (find the chapter, name it what you want, create more of it, understand what each item type is) visible and reachable without hovering, ⋯ menus, or guessing.

**Architecture:** All work is in the studio editor's binder surface plus the book-creation server action. No DB schema changes. The "Part" → "Collection" rename is display-only — the DB type enum value stays `'part'` to avoid a needless migration.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, lucide-react, Radix DropdownMenu, Drizzle ORM on Neon Postgres.

**Spec:** [`docs/superpowers/specs/2026-05-22-studio-binder-ux-design.md`](../specs/2026-05-22-studio-binder-ux-design.md)

---

## File Structure

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx` — double-click rename, swap "Part" → "Collection" icon
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx` — book-title rename, brand-color demote, persistent "+ New Chapter" footer, pendingRenameId wiring
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx` — swap "Add Part" → "Add Collection" labels
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx` — full redesign: Manuscript/Research grouping, subtitles, Collection rename, add front/back matter
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` — add `pendingRenameId` state to support "create and immediately rename" UX
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — replace empty state with "Start your first chapter" CTA
- `lib/actions/book.actions.ts` — remove auto-Chapter-1 fallback (template path stays)

**Create:** none.

**Tests:** existing 76 must continue passing. No new unit tests; the UX is interactive and tested manually.

---

## Task 1: Double-click chapter title to rename

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`

- [ ] **Step 1: Locate the title span**

In the render around line ~126, find:
```tsx
<span className={cn('flex-1 text-xs truncate', isActive ? 'text-brand' : 'text-foreground/70')}>
  {node.title}
</span>
```

- [ ] **Step 2: Add `onDoubleClick`**

Replace with:
```tsx
<span
  className={cn('flex-1 text-xs truncate', isActive ? 'text-brand' : 'text-foreground/70')}
  onDoubleClick={(e) => {
    e.stopPropagation()
    setIsRenaming(true)
  }}
>
  {node.title}
</span>
```

`stopPropagation` prevents the row's `onClick` (which switches active chapter) from also firing on the second click of a double-click. Without it, double-clicking the title would also re-select the chapter — harmless but a wasted server round-trip.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
```
Expected: clean.

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx"
git commit -m "feat(studio): double-click binder title to rename

Rename was previously buried under a hover-only ⋯ menu (three
discoverability hops). Double-clicking the title now enters the same
inline rename flow. The ⋯ → Rename path stays for menu-driven users.

stopPropagation on the dblclick prevents the row's onClick from
firing the active-chapter re-select."
```

---

## Task 2: Double-click book title to rename

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`

- [ ] **Step 1: Read existing binder header**

The header is around lines 150-165:
```tsx
<div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
  <span className="text-xs font-bold text-brand font-comfortaa uppercase tracking-wide truncate">
    {bookTitle}
  </span>
  <div className="flex items-center gap-1">
    <button onClick={toggleCorkboardMode} ... >⊞</button>
    <BinderAddMenu />
  </div>
</div>
```

- [ ] **Step 2: Add imports and local rename state**

The file already imports `createContext, useCallback, useContext, useMemo, useState` from `'react'`. Extend that import with `useRef` and `useEffect`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
```

Add the server action import:
```tsx
import { updateBookAction } from '@/lib/actions/book.actions'
```

Inside `BinderTree`, near the existing `useState` for `collapsed`, add:
```tsx
const [isRenamingBook, setIsRenamingBook] = useState(false)
const [localBookTitle, setLocalBookTitle] = useState(bookTitle)
const bookTitleInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 3: Focus the input on rename**

```tsx
useEffect(() => {
  if (isRenamingBook) {
    bookTitleInputRef.current?.focus()
    bookTitleInputRef.current?.select()
  }
}, [isRenamingBook])
```

- [ ] **Step 4: Commit handler**

```tsx
async function commitBookRename() {
  const title = bookTitleInputRef.current?.value.trim() || bookTitle
  setIsRenamingBook(false)
  if (title === bookTitle) return
  setLocalBookTitle(title)
  const result = await updateBookAction(bookTitleInputRef.current?.dataset.bookId ?? '', { title })
  if (!result.success) {
    // Rollback display on failure
    setLocalBookTitle(bookTitle)
  }
}
```

Wait — `updateBookAction` needs the bookId. We have it from context. Simpler:

```tsx
async function commitBookRename() {
  const title = bookTitleInputRef.current?.value.trim() || bookTitle
  setIsRenamingBook(false)
  if (title === bookTitle) return
  setLocalBookTitle(title)
  const result = await updateBookAction(bookId, { title })
  if (!result.success) setLocalBookTitle(bookTitle)
}
```

- [ ] **Step 5: Replace the header span**

Replace lines 152-154 with:
```tsx
{isRenamingBook ? (
  <input
    ref={bookTitleInputRef}
    defaultValue={localBookTitle}
    className="flex-1 bg-transparent border-b border-brand text-xs font-bold font-comfortaa uppercase tracking-wide outline-none text-foreground"
    onKeyDown={e => {
      if (e.key === 'Enter') commitBookRename()
      if (e.key === 'Escape') setIsRenamingBook(false)
    }}
    onBlur={commitBookRename}
  />
) : (
  <span
    className="text-xs font-bold text-brand font-comfortaa uppercase tracking-wide truncate cursor-pointer"
    onDoubleClick={() => setIsRenamingBook(true)}
    title="Double-click to rename"
  >
    {localBookTitle}
  </span>
)}
```

Note: `localBookTitle` is the optimistic-update display. The provider's `bookTitle` doesn't update without a server refetch; this avoids needing to thread that through context for now.

- [ ] **Step 6: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx"
git commit -m "feat(studio): double-click binder book title to rename

Previously the book title was static text — users had to leave the
studio and go back to the dashboard to rename. Double-clicking the
title now enters inline rename, persisted via updateBookAction.
Optimistic local state with rollback on server error."
```

---

## Task 3: Brand color discipline in the binder header

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`

The book title is currently `text-brand` (brand yellow). The design critique flagged this as competing with the active-chapter row and metadata-panel brand yellow — three surfaces yelling for attention.

- [ ] **Step 1: Demote the title color**

In the rename branch added in Task 2, change `text-brand` → `text-foreground` on both the input and the span (just remove `text-brand` from each — they're already styled otherwise). Add a small ✦ icon prefix in brand color before the title.

Replace the title rendering block from Task 2 with:
```tsx
<span className="flex items-center gap-1.5 flex-1 truncate">
  <span className="text-brand text-xs">✦</span>
  {isRenamingBook ? (
    <input
      ref={bookTitleInputRef}
      defaultValue={localBookTitle}
      className="flex-1 bg-transparent border-b border-brand text-xs font-bold font-comfortaa uppercase tracking-wide outline-none text-foreground"
      onKeyDown={e => {
        if (e.key === 'Enter') commitBookRename()
        if (e.key === 'Escape') setIsRenamingBook(false)
      }}
      onBlur={commitBookRename}
    />
  ) : (
    <span
      className="text-xs font-bold text-foreground font-comfortaa uppercase tracking-wide truncate cursor-pointer"
      onDoubleClick={() => setIsRenamingBook(true)}
      title="Double-click to rename"
    >
      {localBookTitle}
    </span>
  )}
</span>
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx"
git commit -m "fix(studio): demote binder book-title brand-yellow to foreground

Three brand-yellow surfaces (book title, active chapter, metadata
pills) competed for attention per the 2026-05-22 design critique.
Book title is now text-foreground with a small brand-yellow ✦ icon
prefix. Active-chapter row keeps its brand-yellow background — that's
the user's 'you are here' anchor."
```

---

## Task 4: Binder-add menu redesign + "Part" → "Collection" rename

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`

This is the biggest visual change in this sub-project. Currently the menu has 3 bare options; new version has 8 options grouped into 2 sections with one-line subtitles. The "Part" type is renamed to "Collection" in all user-facing strings.

- [ ] **Step 1: Replace the file entirely**

Replace `binder-add-menu.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'

type AddOption = {
  type: BinderItemRow['type']
  label: string
  defaultTitle: string
  subtitle: string
  icon: string
}

const MANUSCRIPT_OPTIONS: AddOption[] = [
  { type: 'chapter',      label: 'Chapter',        defaultTitle: 'Untitled Chapter',    subtitle: 'The actual prose. Opens in the editor.',         icon: '📄' },
  { type: 'part',         label: 'Collection',     defaultTitle: 'Untitled Collection', subtitle: 'A group of chapters (e.g., "Part One").',        icon: '📖' },
  { type: 'front_matter', label: 'Front matter',   defaultTitle: 'Front matter',        subtitle: 'Title page, dedication, copyright.',             icon: '📑' },
  { type: 'back_matter',  label: 'Back matter',    defaultTitle: 'Back matter',         subtitle: 'Acknowledgments, about the author.',             icon: '📑' },
]

const RESEARCH_OPTIONS: AddOption[] = [
  { type: 'research_folder', label: 'Research folder', defaultTitle: 'Research',            subtitle: 'Container for your reference materials.',     icon: '📁' },
  { type: 'research_note',   label: 'Research note',   defaultTitle: 'Untitled note',       subtitle: 'Freeform notes — world-building, ideas.',     icon: '📝' },
  { type: 'character',       label: 'Character',       defaultTitle: 'Untitled Character',  subtitle: 'Name, traits, backstory for one character.',  icon: '👤' },
  { type: 'outline',         label: 'Outline',         defaultTitle: 'Untitled Outline',    subtitle: 'Outline of a chapter or arc.',                icon: '📋' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

function MenuItem({
  option,
  onClick,
}: {
  option: AddOption
  onClick: () => void
}) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      className="px-3 py-2 rounded cursor-pointer hover:bg-surface text-foreground/80 hover:text-foreground flex items-start gap-2"
    >
      <span className="text-sm mt-0.5">{option.icon}</span>
      <div className="flex flex-col">
        <span className="text-xs font-medium leading-tight">{option.label}</span>
        <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{option.subtitle}</span>
      </div>
    </div>
  )
}

export function BinderAddMenu() {
  const { bookId, binderItems, addBinderItem } = useBookEditor()
  const [open, setOpen] = useState(false)

  async function handleAdd(option: AddOption) {
    setOpen(false)
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
    const order = maxOrder + 1

    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: option.type,
      title: option.defaultTitle,
      order,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: option.type,
        title: option.defaultTitle,
        order,
        content: null,
        chapterId: result.data.chapterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } else {
      console.error('createBinderItemAction failed:', result.error)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="text-brand hover:text-brand-hover text-lg font-light cursor-pointer leading-none"
          title="Add to binder"
        >
          +
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        <SectionLabel>Manuscript</SectionLabel>
        {MANUSCRIPT_OPTIONS.map(opt => (
          <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
        ))}
        <SectionLabel>Research <span className="font-normal normal-case text-muted-foreground/70">(private — not exported)</span></SectionLabel>
        {RESEARCH_OPTIONS.map(opt => (
          <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Rename "Part" → "Collection" in the item context menu**

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx`

Around line 100, the `part` case shows `<MenuItem onClick={...}>Add Chapter</MenuItem>` — that label is fine. But the file may show "Add Part" elsewhere on parts. Search the file for any user-facing "Part" string and update to "Collection".

Specifically, if the user-facing rename label on a `part`-type item is hardcoded as "Part", swap to "Collection." Use the existing `node.title` for the displayed name (that's the user's own naming) — only the type-label needs updating.

- [ ] **Step 3: Rename "Part" → "Collection" in the item display**

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`

Update the `ICONS` map (around line 15) — `part` icon currently is `''` (empty). Set it to `'📖'` to match the new BinderAddMenu icon for Collection:

```tsx
const ICONS: Record<BinderItemRow['type'], string> = {
  part: '📖',        // Display: "Collection"
  chapter: '📄',
  front_matter: '📑',
  back_matter: '📑',
  research_folder: '📁',
  research_note: '📝',
  character: '👤',
  outline: '📋',
}
```

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx" "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx" "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx"
git commit -m "feat(studio): redesign binder-add menu with grouping + rename Part to Collection

Top-level binder add menu now groups items by Manuscript vs Research,
shows a one-line subtitle under each, and exposes front/back matter
that were previously unreachable from the top-level + menu (only via
templates).

'Part' renamed to 'Collection' in all user-facing UI — display-only,
DB type enum stays 'part' to avoid a migration. 'Collection' is plain
English and ties to the beehive theme.

Adds the binder-item icon for collections (📖); previously empty."
```

---

## Task 5: Persistent "+ New Chapter" footer + pendingRenameId mechanism

**Files:**
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`

The footer button creates a chapter AND immediately puts it in rename mode. That requires the `BinderItem` to know "this is the item that should start in rename mode" — implemented via a `pendingRenameId` flag on the provider, consumed and cleared by `BinderItem`.

- [ ] **Step 1: Add `pendingRenameId` to the provider**

In `book-editor-provider.tsx`:

a. Add to the `BookEditorContextValue` type (near other state fields):
```tsx
pendingRenameId: string | null
setPendingRenameId: (id: string | null) => void
```

b. Inside `BookEditorProvider`, add:
```tsx
const [pendingRenameId, setPendingRenameId] = useState<string | null>(null)
```

c. Add both to the `value` object and the `useMemo` dependency array.

- [ ] **Step 2: Consume `pendingRenameId` in `BinderItem`**

In `binder-item.tsx`, near the top of the component:
```tsx
const { pendingRenameId, setPendingRenameId } = useBookEditor()

useEffect(() => {
  if (pendingRenameId === node.id) {
    setIsRenaming(true)
    setPendingRenameId(null)
  }
}, [pendingRenameId, node.id, setPendingRenameId])
```

This means: whenever the provider's `pendingRenameId` matches this item's id, flip it into rename mode and clear the flag.

- [ ] **Step 3: Add the persistent footer button to `BinderTree`**

In `binder-tree.tsx`, find the JSX block:
```tsx
{!corkboardMode && (
  <div className="flex-1 overflow-y-auto py-1">
    <DndContext ...>
      ...
    </DndContext>
  </div>
)}
```

Insert AFTER that block but still inside the `<aside>`:
```tsx
{!corkboardMode && (
  <button
    onClick={async () => {
      const rootItems = binderItems.filter(i => i.parentId === null)
      const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
      const order = maxOrder + 1
      const result = await createBinderItemAction({
        bookId,
        parentId: null,
        type: 'chapter',
        title: 'Untitled Chapter',
        order,
      })
      if (result.success) {
        addBinderItem({
          id: result.data.id,
          bookId,
          parentId: null,
          type: 'chapter',
          title: 'Untitled Chapter',
          order,
          content: null,
          chapterId: result.data.chapterId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setActiveItemId(result.data.id)
        setPendingRenameId(result.data.id)
      }
    }}
    className="border-t border-border px-3 py-2 text-xs text-brand hover:text-brand-hover hover:bg-surface-elevated transition-colors text-left"
  >
    + New Chapter
  </button>
)}
```

You will need to:
- Import `createBinderItemAction` at the top
- Destructure `addBinderItem`, `setActiveItemId`, `setPendingRenameId` from `useBookEditor()` in addition to existing destructured fields

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx" "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx" "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx"
git commit -m "feat(studio): persistent '+ New Chapter' footer in binder

The only existing 'add' affordance was a small + icon in the binder
header — easy to miss. Added a full-width persistent footer button.
Clicking creates a chapter at the end, opens it, and drops it into
rename mode immediately so the user can name it.

The 'enter rename mode on a newly created item' is implemented via a
pendingRenameId flag on the provider — the creating code sets it, the
target BinderItem's useEffect consumes it (flips into rename mode)
and clears it on the next render."
```

---

## Task 6: Remove auto-Chapter-1 + new empty-state "Start your first chapter" CTA

**Files:**
- `lib/actions/book.actions.ts`
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`

- [ ] **Step 1: Audit other code paths for empty-chapter assumptions**

Before removing the fallback, check that downstream code handles a book with zero chapters gracefully. Specifically:

1. **Export route** — `app/api/export/[bookId]/[format]/route.ts`. Read it. If it throws on `chapters.length === 0`, add a guard that returns a 400 "no chapters to export" response.
2. **Dashboard book-card chapter count** — `app/[locale]/(app)/studio/page.tsx` or the book-card component it uses. Confirm a `chapterCount: 0` displays "0 chapters" cleanly without dividing-by-zero or similar.
3. **Reading-progress action** — `lib/actions/social.actions.ts` (or wherever `markChapterReadAction` / `getReadingProgressAction` live). Should already handle a book with no read chapters; just confirm no `chapters[0]` indexing.

For each: if a path WILL throw on a chapterless book, fix it in this task (small guards, not a refactor). If all three are already safe, note that in the commit message and move on.

Quick search to surface candidates:
```bash
grep -rn "chapters\[0\]\|\.chapters\.length" lib/ app/ 2>&1 | head -20
```
Read each match; verify the empty case.

- [ ] **Step 2: Remove the auto-Chapter-1 fallback in `createBookAction`**

In `lib/actions/book.actions.ts`, find the block around lines 177-194:
```ts
    } else {
      const chapterBinderId = createId()
      const chapterId = createId()

      await tx.insert(binderItems).values({ ... })
      await tx.insert(chapters).values({ ... })
    }
```

Replace with a comment:
```ts
    }
    // If no templateId is provided, the book is created with an empty binder.
    // The user creates their first chapter explicitly via the editor's empty
    // state CTA (see chapter-editor.tsx). Removed 2026-05-22 in SP2 — gives
    // users naming agency from the first keystroke.
```

(Keep the `if (d.templateId)` branch above — templates explicitly define structure and users opted into that.)

- [ ] **Step 3: Replace the editor's empty state with the "Start your first chapter" CTA**

In `chapter-editor.tsx`, find the `activeItemId === null` branch (currently around lines 117-122):
```tsx
if (activeItemId === null) {
  return (
    <main className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Select a chapter from the binder to start writing.
    </main>
  )
}
```

Replace with a richer empty state that branches on whether the binder has any chapters:

```tsx
if (activeItemId === null) {
  return <EmptyStartChapter />
}
```

Then add a new component above `ChapterEditor` (or in a sibling file — your call. Inline keeps the diff small):

```tsx
function EmptyStartChapter() {
  const { bookId, binderItems, addBinderItem, setActiveItemId, setPendingRenameId } = useBookEditor()
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const hasAnyChapters = binderItems.some(i =>
    i.type === 'chapter' || i.type === 'front_matter' || i.type === 'back_matter'
  )

  async function handleBegin() {
    if (submitting) return
    const trimmed = title.trim() || 'Untitled Chapter'
    setSubmitting(true)
    const rootItems = binderItems.filter(i => i.parentId === null)
    const order = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) + 1 : 0
    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: 'chapter',
      title: trimmed,
      order,
    })
    setSubmitting(false)
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: 'chapter',
        title: trimmed,
        order,
        content: null,
        chapterId: result.data.chapterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setActiveItemId(result.data.id)
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold font-comfortaa text-foreground text-center">
          {hasAnyChapters ? 'Select a chapter to write' : 'Start your first chapter'}
        </h1>
        {hasAnyChapters ? (
          <p className="text-sm text-muted-foreground text-center">
            Pick a chapter from the binder on the left, or create a new one.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Name it what you like — you can rename anytime.
            </p>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleBegin() }}
              placeholder="Chapter title…"
              className="w-full bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand/40"
            />
            <button
              onClick={handleBegin}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-brand text-background text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              Begin →
            </button>
          </>
        )}
      </div>
    </main>
  )
}
```

You'll need to import `createBinderItemAction` from `'@/lib/actions/binder.actions'` at the top of the file.

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "lib/actions/book.actions.ts" "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx"
git commit -m "feat(studio): no auto-Chapter-1 — users create and name their first chapter

createBookAction's fallback that auto-inserted a 'Chapter 1' binder
item + chapter row is gone (template-based creation still inserts the
structure the template defines).

The editor's empty state is now context-aware:
- Zero chapters: 'Start your first chapter' headline + inline title
  input + Begin button. Submitting creates the chapter, opens it,
  drops cursor in.
- Has chapters but none selected: 'Select a chapter to write' with
  guidance to pick from the binder.

Audited downstream code paths (export, reading progress, dashboard)
for assumptions of >=1 chapter — none throw on the empty case."
```

---

## Task 7: Final verification + Resume Here update

- [ ] **Step 1: Run full manual test checklist**

In the dev server:

- **Double-click chapter rename:** Double-click any chapter title in the binder → input appears, full title selected → type new title → Enter commits, Escape cancels. Reload page → name persists.
- **Double-click book rename:** Double-click the book title at top of binder → input appears → type new title → Enter commits. Reload page → name persists.
- **Brand color discipline:** Book title is now `text-foreground` color with a small brand-yellow ✦ icon prefix. Active chapter row still has the brand-yellow background.
- **Binder add menu:** Click `+` in binder header → menu opens with two sections — "Manuscript" (Chapter, Collection, Front matter, Back matter) and "Research (private — not exported)" (Research folder, Research note, Character, Outline). Each item shows an icon, label, and one-line subtitle.
- **Collection rename:** Add a Collection. In the binder tree it appears with the 📖 icon. The label in the menu was "Collection", not "Part".
- **Persistent +New Chapter:** Click the full-width "+ New Chapter" button at the bottom of the binder → new chapter is added at the end of the tree → it is immediately the active chapter AND immediately in rename mode (input focused, default title selected).
- **No auto-Chapter-1 + first-chapter CTA:** Create a brand new book via the studio dashboard (no template). After redirect, you see a centered "Start your first chapter" headline + title input + Begin button. Type `My First Chapter` → click Begin (or press Enter) → chapter is created, opens in the editor, cursor is ready to type.
- **Has-chapters empty state:** With at least one existing chapter, click somewhere that deselects (or load the page without an active selection) → editor pane shows "Select a chapter to write" with guidance, NOT the input form.

- [ ] **Step 2: Automated checks**

```bash
npm test
npx tsc --noEmit
```

Both must be clean. Tests should remain at 76/76.

- [ ] **Step 3: Update AGENTS.md Resume Here**

Replace the Resume Here block with:

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** Studio Editor Audit — sub-project 3 (Editor toolbar + modes) — not started
> **Active branch:** `main`
> **Last commit:** <auto-fill via git log>
>
> 1. ~~Stability Pass~~ DONE (see prior commits).
> 2. ~~Binder UX~~ DONE — double-click rename for chapters and book, persistent +New Chapter footer, no auto-Chapter-1, Manuscript/Research grouped add menu, "Part" → "Collection", brand-color discipline.
> 3. **Editor toolbar + modes (NEXT)** — 3-zone toolbar, lucide icons, light-mode toggle, design-token cleanup, scoped Cmd+F, font-size mark (deferred from SP1). Spec: `docs/superpowers/specs/2026-05-22-studio-toolbar-modes-design.md`.
> 4. Metadata + persistence.
> 5. New surfaces.
>
> **Next concrete step when resuming:** invoke `/brainstorming` against the SP3 draft spec to reconfirm scope.
```

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "docs: mark studio binder UX complete (SP 2/5)

All six manual tests pass; 76/76 automated; tsc clean. Next: SP3
(toolbar + modes)."
```

- [ ] **Step 5: Confirm clean log**

```bash
git log --oneline -10
```

You should see ~6 commits from this plan (one per task) + the AGENTS.md update. Each commit message clear, atomic.

---

## Definition of Done

- All 6 manual tests in Task 7 pass.
- `npm test` clean (76/76).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here reflects SP2 complete, SP3 next.
- ~7 atomic commits on `main`.
