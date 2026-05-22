# Studio Research Notes UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-textarea fallback for `research_note` binder items with a dedicated `NoteEditor` (stripped TipTap toolbar + pin/color/favorite attributes), and surface those attributes in the binder display + sort.

**Architecture:** `binderItems.content` carries a `ResearchNoteContent` jsonb object (no DB migration). Legacy string content is normalized on read by a pure helper. `NoteEditor` lives alongside `OutlineBoard` and the FM/BM renderers — same specialized-binder-editor pattern. Binder-tree's sort gets a generic pin-priority pass.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, TipTap (`@tiptap/react`), Radix Popover (via shadcn — verify exists or add), Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-22-studio-research-notes-design.md`](../specs/2026-05-22-studio-research-notes-design.md)

---

## File Structure

**Create:**
- `lib/notes/note-content.ts` — `ResearchNoteContent` type, `NoteColor` type + palette, `normalizeNoteContent` pure helper, `emptyDoc` helper
- `__tests__/notes/note-content.test.ts` — Vitest unit tests for the normalizer
- `app/[locale]/(app)/studio/[bookId]/_components/notes/note-toolbar.tsx` — small B/I/UL/OL toolbar for notes
- `app/[locale]/(app)/studio/[bookId]/_components/notes/note-editor.tsx` — main NoteEditor component (header + toolbar + TipTap)
- `app/[locale]/(app)/studio/[bookId]/_components/notes/note-attribute-controls.tsx` — pin/color/favorite trio in the editor header

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx` — add `isItemPinned` helper, factor into the existing sort
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx` — render color dot / pin icon / favorite icon for research_note items
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — branch on `activeItem.type === 'research_note'` → `<NoteEditor item={activeItem} />`

**No DB migration. No server-action changes** (uses existing `updateBinderItemAction`).

---

## Task 1: Types + normalizer + unit tests (TDD)

**Files:**
- Create: `lib/notes/note-content.ts`
- Create: `__tests__/notes/note-content.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/notes/note-content.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeNoteContent, emptyDoc, type ResearchNoteContent } from '@/lib/notes/note-content'

describe('emptyDoc', () => {
  it('returns a valid empty TipTap doc shape', () => {
    expect(emptyDoc()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })
  })
})

describe('normalizeNoteContent', () => {
  it('returns defaults for null input', () => {
    const out = normalizeNoteContent(null)
    expect(out.pinned).toBe(false)
    expect(out.color).toBe(null)
    expect(out.favorited).toBe(false)
    expect(out.text).toEqual(emptyDoc())
  })

  it('returns defaults for undefined input', () => {
    const out = normalizeNoteContent(undefined)
    expect(out.text).toEqual(emptyDoc())
  })

  it('wraps a plain string into a single-paragraph doc', () => {
    const out = normalizeNoteContent('hello world')
    expect(out.text).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'hello world' }],
      }],
    })
    expect(out.pinned).toBe(false)
  })

  it('wraps an empty string into an empty paragraph', () => {
    const out = normalizeNoteContent('')
    expect(out.text).toEqual(emptyDoc())
  })

  it('preserves an existing object with pinned=true', () => {
    const input = {
      text: { type: 'doc', content: [{ type: 'paragraph' }] },
      pinned: true,
    }
    const out = normalizeNoteContent(input)
    expect(out.pinned).toBe(true)
    expect(out.color).toBe(null)        // default filled
    expect(out.favorited).toBe(false)   // default filled
    expect(out.text).toBe(input.text)   // passed through by reference
  })

  it('passes through all four fields when fully specified', () => {
    const input: ResearchNoteContent = {
      text: { type: 'doc', content: [] },
      pinned: true,
      color: 'blue',
      favorited: true,
    }
    const out = normalizeNoteContent(input)
    expect(out).toEqual(input)
  })

  it('clamps invalid color values to null', () => {
    const out = normalizeNoteContent({
      text: { type: 'doc' },
      color: 'magenta',   // not in palette
    } as unknown)
    expect(out.color).toBe(null)
  })

  it('accepts each palette color', () => {
    for (const color of ['yellow', 'blue', 'green', 'pink', 'purple'] as const) {
      const out = normalizeNoteContent({ text: { type: 'doc' }, color })
      expect(out.color).toBe(color)
    }
  })
})
```

Run:
```bash
npm test -- notes/note-content
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement the module**

Create `lib/notes/note-content.ts`:

```ts
// Stored on binderItems.content for type 'research_note' items.
// Legacy items may have content as a plain string (pre-feature) or null;
// normalizeNoteContent handles all three shapes.

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple'

export const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'green', 'pink', 'purple']

export const NOTE_COLOR_HEX: Record<NoteColor, string> = {
  yellow: '#FFC300', // brand
  blue:   '#6BB6FF',
  green:  '#7CD994',
  pink:   '#FF9FBB',
  purple: '#C99FFF',
}

export type ResearchNoteContent = {
  text: unknown               // TipTap doc JSON
  pinned?: boolean
  color?: NoteColor | null
  favorited?: boolean
}

export function emptyDoc(): unknown {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function wrapStringInDoc(s: string): unknown {
  if (s.length === 0) return emptyDoc()
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: s }],
    }],
  }
}

function isValidColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as string[]).includes(value)
}

export function normalizeNoteContent(raw: unknown): ResearchNoteContent {
  if (raw === null || raw === undefined) {
    return { text: emptyDoc(), pinned: false, color: null, favorited: false }
  }
  if (typeof raw === 'string') {
    return { text: wrapStringInDoc(raw), pinned: false, color: null, favorited: false }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const text = obj.text ?? emptyDoc()
    const pinned = obj.pinned === true
    const color: NoteColor | null = isValidColor(obj.color) ? obj.color : null
    const favorited = obj.favorited === true
    return { text, pinned, color, favorited }
  }
  // Unknown shape — fall back to defaults
  return { text: emptyDoc(), pinned: false, color: null, favorited: false }
}
```

Run:
```bash
npm test -- notes/note-content
```

Expected: all assertions pass.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add lib/notes/ "__tests__/notes/"
git commit -m "feat(studio): research-note types + normalizer (SP3 D Task 1)

ResearchNoteContent, NoteColor, NOTE_COLOR_HEX palette, emptyDoc and
normalizeNoteContent in lib/notes/note-content.ts. The normalizer
handles three legacy shapes on read (null, plain string, structured
object) and fills in safe defaults. Invalid color values clamp to null.

Vitest unit tests cover each input shape + the 5-color palette."
```

---

## Task 2: NoteToolbar component

**File:** `app/[locale]/(app)/studio/[bookId]/_components/notes/note-toolbar.tsx`

Small toolbar with B / I / UL / OL only. NOT the existing `EditorToolbar`.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { Editor } from '@tiptap/react'
import '@tiptap/starter-kit'
import { cn } from '@/lib/utils'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Props = { editor: Editor }

function Btn({ onClick, isActive, title, children }: {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={onClick}
          className={cn(
            'text-xs px-2 py-1 rounded transition-colors',
            'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
            isActive && 'bg-brand/20 text-brand',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}

export function NoteToolbar({ editor }: Props) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-surface">
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (⌘B)"
        >
          <Bold size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (⌘I)"
        >
          <Italic size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </Btn>
      </div>
    </TooltipProvider>
  )
}
```

Notes:
- `onMouseDown={e => e.preventDefault()}` keeps focus on the editor when clicking buttons — same pattern as the chapter toolbar (the lesson from SP1 about TipTap toolbar buttons stealing focus).
- Uses `lucide-react` icons already in the codebase.
- Uses shadcn `Tooltip` already in the codebase.

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/notes/"
git commit -m "feat(studio): NoteToolbar component for research-note editor (SP3 D Task 2)

Stripped-down toolbar — B/I/UL/OL only — for the NoteEditor coming in
Task 3. onMouseDown.preventDefault to avoid stealing focus from the
editor on click (the SP1 lesson). Tooltips on all four buttons.
Lucide icons match the rest of the codebase."
```

---

## Task 3: NoteAttributeControls component (pin / color / favorite)

**File:** `app/[locale]/(app)/studio/[bookId]/_components/notes/note-attribute-controls.tsx`

The three controls grouped for the editor header.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { Pin, Star, Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NOTE_COLORS, NOTE_COLOR_HEX, type NoteColor } from '@/lib/notes/note-content'

type Props = {
  pinned: boolean
  color: NoteColor | null
  favorited: boolean
  onPinChange: (next: boolean) => void
  onColorChange: (next: NoteColor | null) => void
  onFavoriteChange: (next: boolean) => void
}

export function NoteAttributeControls({
  pinned, color, favorited,
  onPinChange, onColorChange, onFavoriteChange,
}: Props) {
  const [colorOpen, setColorOpen] = useState(false)

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Pin */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onPinChange(!pinned)}
              className={cn(
                'p-1.5 rounded transition-colors',
                pinned
                  ? 'bg-brand/20 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              <Pin size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{pinned ? 'Unpin from top' : 'Pin to top'}</TooltipContent>
        </Tooltip>

        {/* Color picker */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'p-1.5 rounded transition-colors text-foreground/60 hover:text-foreground hover:bg-surface-elevated relative',
                  )}
                >
                  <Palette size={14} />
                  {color && (
                    <span
                      className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border border-surface"
                      style={{ backgroundColor: NOTE_COLOR_HEX[color] }}
                    />
                  )}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Color tag</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex items-center gap-1.5">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { onColorChange(c); setColorOpen(false) }}
                  className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: NOTE_COLOR_HEX[c] }}
                  title={c}
                >
                  {color === c && <Check size={12} className="text-background" />}
                </button>
              ))}
              <button
                onClick={() => { onColorChange(null); setColorOpen(false) }}
                className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-elevated ml-1"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Favorite */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onFavoriteChange(!favorited)}
              className={cn(
                'p-1.5 rounded transition-colors',
                favorited
                  ? 'bg-brand/20 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              <Star size={14} fill={favorited ? 'currentColor' : 'none'} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{favorited ? 'Remove favorite' : 'Mark as favorite'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Verify shadcn Popover exists**

Run:
```bash
ls components/ui/popover.tsx 2>&1
```

If the file does NOT exist, install via shadcn CLI:
```bash
npx shadcn@latest add popover
```

(The project already uses Tooltip and DropdownMenu from shadcn — same pattern.)

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/notes/" components/ui/
git commit -m "feat(studio): NoteAttributeControls (pin/color/favorite) (SP3 D Task 3)

Three small icon buttons + a popover color picker. Pin and favorite
are simple toggles with brand-yellow highlight when active. Color
shows a small palette dot in the corner of the icon when set; the
popover offers 5 swatches + Clear. Uses Radix Popover via shadcn.

Wired to props; the NoteEditor (Task 4) supplies state + handlers."
```

---

## Task 4: NoteEditor component

**File:** `app/[locale]/(app)/studio/[bookId]/_components/notes/note-editor.tsx`

The main component — TipTap editor + NoteToolbar + NoteAttributeControls + SaveStatusBadge. Persists via `updateBinderItemAction`.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { normalizeNoteContent, type NoteColor, type ResearchNoteContent } from '@/lib/notes/note-content'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { NoteToolbar } from './note-toolbar'
import { NoteAttributeControls } from './note-attribute-controls'

type Props = { item: BinderItemRow }

export function NoteEditor({ item }: Props) {
  const { updateBinderItem } = useBookEditor()

  // Normalize on mount; legacy string content becomes a structured object.
  const initial = normalizeNoteContent(item.content)
  const [pinned, setPinned] = useState(initial.pinned ?? false)
  const [color, setColor] = useState<NoteColor | null>(initial.color ?? null)
  const [favorited, setFavorited] = useState(initial.favorited ?? false)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep latest attribute values in refs so the save closure picks them up.
  const attrsRef = useRef({ pinned, color, favorited })
  attrsRef.current = { pinned, color, favorited }

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: 'end',
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Note to self…' }),
      ],
      // `unknown` cast — TipTap accepts JSONContent | string | null at runtime;
      // the normalizer returns `unknown` deliberately so we don't take a hard
      // dependency on TipTap's exported types in the helper module.
      content: initial.text as Parameters<typeof useEditor>[0]['content'],
      onUpdate: ({ editor }) => {
        scheduleSave(editor.getJSON())
      },
    },
    [item.id],
  )

  // Persist seed on first mount when content was null (so subsequent loads
  // skip the normalize-from-null path).
  useEffect(() => {
    if (item.content === null || item.content === undefined) {
      const next: ResearchNoteContent = {
        text: initial.text,
        pinned: false,
        color: null,
        favorited: false,
      }
      void updateBinderItemAction(item.id, { content: next })
      updateBinderItem(item.id, { content: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scheduleSave(textJSON: unknown) {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const next: ResearchNoteContent = {
        text: textJSON,
        ...attrsRef.current,
      }
      updateBinderItem(item.id, { content: next })
      const result = await updateBinderItemAction(item.id, { content: next })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  // Attribute changes: update state, then immediately schedule a save with
  // the current editor text + new attrs (no debounce; toggle is intentional).
  function commitAttrs(partial: Partial<{ pinned: boolean; color: NoteColor | null; favorited: boolean }>) {
    if (partial.pinned !== undefined) setPinned(partial.pinned)
    if (partial.color !== undefined) setColor(partial.color)
    if (partial.favorited !== undefined) setFavorited(partial.favorited)
    attrsRef.current = { ...attrsRef.current, ...partial }
    const json = editor?.isDestroyed ? initial.text : (editor?.getJSON() ?? initial.text)
    scheduleSave(json)
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
          <span className="text-[10px] text-muted-foreground">· Research note</span>
        </div>
        <div className="flex items-center gap-3">
          <NoteAttributeControls
            pinned={pinned}
            color={color}
            favorited={favorited}
            onPinChange={v => commitAttrs({ pinned: v })}
            onColorChange={v => commitAttrs({ color: v })}
            onFavoriteChange={v => commitAttrs({ favorited: v })}
          />
          <SaveStatusBadge status={saveStatus} />
        </div>
      </header>

      {editor && <NoteToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto cursor-text" onClick={() => {
        if (editor && !editor.isDestroyed) editor.commands.focus()
      }}>
        <EditorContent
          editor={editor}
          className="min-h-full p-6 max-w-2xl mx-auto prose prose-invert prose-sm focus:outline-none"
          style={{ fontSize: '15px', lineHeight: '1.7' }}
        />
      </div>
    </main>
  )
}
```

Notes:
- The `content` prop in `useEditor` — the TS gymnastics around it work because TipTap accepts `unknown`-shaped JSON at runtime. If TS complains, cast to `any` with an explanatory comment (acceptable trade for not pulling in TipTap's full type).
- `editor.isDestroyed` guard on the click-to-focus handler — the SP3 B lesson.
- The placeholder text "Note to self…" makes the editor feel scratchpad-like even before typing.
- `prose prose-invert prose-sm` reuses the editor styles from chapter-editor — the ProseMirror CSS rules (added in SP1) handle headings/lists/etc. if the user types `# foo` via keyboard shortcut.

- [ ] **Step 2: Verify autofocus + caret on legacy-content open**

The autofocus pattern from SP1 applies. The `useEditor` autofocus prop covers the cache-hit path; if you find legacy items open without a visible cursor, add a `requestAnimationFrame(() => { if (!editor.isDestroyed) editor.commands.focus('end') })` after the initial render — mirror the chapter-editor pattern.

This may not be necessary; verify in manual testing in Task 6.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/notes/"
git commit -m "feat(studio): NoteEditor component (SP3 D Task 4)

The dedicated research_note editor. Header: title + attribute
controls (Pin/Color/Favorite) + SaveStatusBadge. Body: NoteToolbar
above a focused TipTap editor with the Placeholder extension showing
'Note to self…' on empty notes.

Normalizes legacy string content on mount via normalizeNoteContent
(Task 1) and persists the normalized object back to DB on first
save. Click-anywhere-in-body focuses the editor (with isDestroyed
guard for React 19 strict mode)."
```

---

## Task 5: Binder integration — sort + row decorations

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`

- [ ] **Step 1: Add `isItemPinned` helper + use in sort**

In `binder-tree.tsx`, near the top (after imports, before component):

```tsx
// Returns true only when content is a structured object with pinned=true.
// Safe to call on chapters, parts, etc. (their content shape doesn't have
// a pinned field, so returns false).
function isItemPinned(item: BinderItemRow): boolean {
  const c = item.content
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false
  return (c as { pinned?: boolean }).pinned === true
}
```

Find the existing `nodes.sort` call inside `buildTree`. It currently looks like:
```ts
nodes.sort((a, b) => a.order - b.order)
```

Replace with:
```ts
nodes.sort((a, b) => {
  const aPin = isItemPinned(a) ? 1 : 0
  const bPin = isItemPinned(b) ? 1 : 0
  if (aPin !== bPin) return bPin - aPin   // pinned first
  return a.order - b.order
})
```

- [ ] **Step 2: Render color dot / pin / favorite in `binder-item.tsx`**

Read `binder-item.tsx`. Find the existing icon + title row.

The existing pattern shows `{ICONS[node.type]}` followed by the title (or rename input). Augment for research_note items:

Near the top of `BinderItem`, add a helper:

```tsx
type NoteDecorations = {
  color: string | null   // hex, ready to use as backgroundColor
  pinned: boolean
  favorited: boolean
}

function getNoteDecorations(item: BinderItemRow): NoteDecorations {
  if (item.type !== 'research_note') return { color: null, pinned: false, favorited: false }
  const c = item.content
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { color: null, pinned: false, favorited: false }
  const obj = c as { pinned?: boolean; color?: string; favorited?: boolean }
  const validColors = ['yellow', 'blue', 'green', 'pink', 'purple']
  const colorHex: Record<string, string> = {
    yellow: '#FFC300', blue: '#6BB6FF', green: '#7CD994', pink: '#FF9FBB', purple: '#C99FFF',
  }
  const color = obj.color && validColors.includes(obj.color) ? colorHex[obj.color] : null
  return {
    color,
    pinned: obj.pinned === true,
    favorited: obj.favorited === true,
  }
}
```

(The hex map duplicates `NOTE_COLOR_HEX` from Task 1. We accept the small duplication to avoid a cross-import from a UI client component into a `/lib/notes/` server-safe module — Next.js bundle separation. If you want to avoid the duplication, import `NOTE_COLOR_HEX` from `@/lib/notes/note-content` — that module has no React/server-only imports, so it should bundle fine in the client. Try the import first; fall back to the local copy if Next yells about bundle boundaries.)

In the JSX, replace the existing icon span:

```tsx
<span className="text-xs">{icon}</span>
```

with:

```tsx
{(() => {
  const deco = getNoteDecorations(node)
  if (deco.color) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full mr-0.5"
        style={{ backgroundColor: deco.color }}
        aria-label="Note color"
      />
    )
  }
  return <span className="text-xs">{icon}</span>
})()}
```

After the title span / rename input (i.e., toward the right of the row, before the existing `BinderItemMenu`), add:

```tsx
{(() => {
  const deco = getNoteDecorations(node)
  return (
    <>
      {deco.pinned && (
        <span className="text-[10px] text-muted-foreground mr-0.5" title="Pinned">📌</span>
      )}
      {deco.favorited && (
        <span className="text-[10px] text-brand mr-0.5" title="Favorite">⭐</span>
      )}
    </>
  )
})()}
```

(Two anonymous IIFEs are unusual — feel free to refactor into a single `<NoteRowDecorations node={node} position="leading"|"trailing" />` subcomponent if that reads cleaner. The spec called this out as a possible refactor.)

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/"
git commit -m "feat(studio): pin sort + binder decorations for research notes (SP3 D Task 5)

binder-tree's buildTree sort now pulls pinned items to the top of
their parent group via the new isItemPinned helper — generic (reads
.content.pinned), so it only affects items that opt in (today: just
research_notes, which use the new ResearchNoteContent shape).

binder-item row decorations: color dot replaces the default 📝 icon
when content.color is set; 📌 appears at the right when pinned; ⭐
appears at the right when favorited. All faint, small, low-emphasis."
```

---

## Task 6: Wire NoteEditor into chapter-editor.tsx + close SP3

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
- Modify: `AGENTS.md` (Resume Here)

- [ ] **Step 1: Add the import + branch**

In `chapter-editor.tsx`, add the import:
```tsx
import { NoteEditor } from '../notes/note-editor'
```

In the `!isChapterType` branch (where outline and character are routed), add the note branch alongside them:
```tsx
if (activeItem && !isChapterType) {
  if (activeItem.type === 'outline') {
    return <OutlineBoard item={activeItem} />
  }
  if (activeItem.type === 'research_note') {
    return <NoteEditor item={activeItem} />
  }
  if (activeItem.type === 'character') {
    return <CharacterProfile item={activeItem} />
  }
  // ... existing textarea fallback (now only catches research_folder)
}
```

- [ ] **Step 2: Run the full manual checklist** (from the spec)

Reload studio. Test in order:

1. Create a research note via `+ Add → Research → Research note`. Editor pane shows the new NoteEditor — header with pin/color/favorite + SaveStatusBadge, mini toolbar below with B / I / UL / OL only. Placeholder reads "Note to self…".
2. Type, wait — SaveStatusBadge cycles Unsaved → Saving → Saved.
3. Reload page. Text persists.
4. Click 📌 → button highlights brand-yellow. Reload — note floats to the top of its parent (Research folder, or root if no parent) in the binder.
5. Click 🎨 → popover with 5 swatches + Clear. Pick blue. Small blue dot appears at the corner of the palette icon. Binder row shows a blue dot replacing 📝.
6. Click ⭐ Favorite → button highlights and icon fills. Binder row shows ⭐ at the far right.
7. Open a research note that was created BEFORE this feature (legacy string content). Should open with text intact, attributes default. Edit + save once → DB now stores the normalized object.
8. Open a chapter, an outline, a front-matter, a character — all unchanged behavior. Pin sort doesn't affect them.
9. `npm test` clean (~112 tests with the normalizer additions).
10. `npx tsc --noEmit` clean.

If anything fails, fix BEFORE proceeding.

- [ ] **Step 3: Update AGENTS.md Resume Here**

Replace the Resume Here block. SP3 is now COMPLETE.

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** SP4 Toolbar + modes — not started
> **Active branch:** `main`
> **Last commit:** <git log -1 --format=%s>
>
> 1. ~~SP1 Stability~~ DONE.
> 2. ~~SP2 Binder UX~~ DONE.
> 3. ~~SP3 Specialized Editors~~ **DONE** (2026-05-22) — Front/Back Matter (B), Outline editor (C), Research notes UX (D). Three specialized binder editors, all using the same content-jsonb pattern.
> 4. **SP4 Toolbar + modes (NEXT)** — spec drafted at `docs/superpowers/specs/2026-05-22-studio-toolbar-modes-design.md`. Reconfirm via /brainstorming. Also pick up the deferred font-size mark from SP1.
> 5. SP5 Metadata + persistence — synopsis/scene-planner/notes/word-goal/status/publishing-details correctness, bottom status-bar consolidation.
> 6. SP6 New surfaces — Snapshot UI, mobile/tablet responsive, accessibility audit.
>
> After all six: Claude Design redesigns visually, mechanical import. Then Phase 8 (Stripe monetization) resumes.
>
> **Next concrete step when resuming:** invoke `/brainstorming` against the SP4 draft spec to reconfirm scope.
```

- [ ] **Step 4: Commit chapter-editor wiring + AGENTS.md together**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx" AGENTS.md
git commit -m "feat(studio): route research_note to NoteEditor; close SP3 (SP3 D Task 6)

Adds the missing render branch in chapter-editor's !isChapterType
section. Research notes previously fell through to the plain textarea
fallback; they now open the new NoteEditor with toolbar + attribute
controls.

This closes SP3 Specialized Editors — all three features (B, C, D)
shipped. Resume Here now points at SP4 Toolbar + modes."
```

---

## Definition of Done

- All 10 manual checklist items pass.
- `npm test` clean (~112 tests with the normalizer additions).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here reflects SP3 complete, SP4 next.
- ~6 atomic commits on `main`.
