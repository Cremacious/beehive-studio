# Studio Toolbar + Modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 7 outstanding SP4 items — remove ambient sounds, lucide icons across the toolbar, three-zone layout, raw-hex → tokens, scoped Cmd+F/Cmd+S, light-mode toggle, font-size mark.

**Architecture:** All structural and behavioral changes in `editor-toolbar.tsx` + `chapter-editor.tsx` + `app/globals.css`. No DB changes. One new file for the font-size mark if not available via package. The pixel-level visual redesign is the Claude Design pass after SP6 — SP4 stays within the current visual language.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, TipTap (`@tiptap/react`, `@tiptap/core`), lucide-react.

**Spec:** [`docs/superpowers/specs/2026-05-22-studio-toolbar-modes-design.md`](../specs/2026-05-22-studio-toolbar-modes-design.md)

---

## File Structure

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — most of the work (icons, layout, hex→tokens, light toggle, font-size dropdown, ambient-sounds removal)
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — Cmd+F/Cmd+S scoping, light-mode data attribute on `<main>`, ambient-sounds prop removal, font-size mark extension wiring
- `app/globals.css` — light-mode CSS rules scoped to `[data-editor-theme="light"]`

**Delete:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/ambient-sounds.tsx`

**Create (conditionally):**
- `lib/tiptap/font-size-mark.ts` — only if `@tiptap/extension-font-size` is not suitable

**No DB migration. No server-action changes.**

---

## Task 1: Remove ambient sounds

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
- Delete: `app/[locale]/(app)/studio/[bookId]/_components/editor/ambient-sounds.tsx`

- [ ] **Step 1: Find all references**

```bash
grep -rn "AmbientSounds\|soundsOpen\|onToggleSounds\|ambient-sounds" app/ --include="*.tsx" --include="*.ts" 2>&1
```

Expect references in:
- `editor-toolbar.tsx`: `soundsOpen`, `onToggleSounds` props + the toolbar button rendering the 🎵 icon
- `chapter-editor.tsx`: import of `AmbientSounds`, `soundsOpen` state, render of `<AmbientSounds onClose={...}>`, props passed to `<EditorToolbar>`

- [ ] **Step 2: Remove from `editor-toolbar.tsx`**

In the `Props` type, remove `onToggleSounds: () => void` and `soundsOpen: boolean`.

In the destructure at the top of `EditorToolbar({...})`, remove `onToggleSounds` and `soundsOpen`.

In the JSX, find the block rendering the 🎵 button (typically wrapped in a Tooltip + button with `onClick={onToggleSounds}`). Delete the entire `<Tooltip>...</Tooltip>` block for it.

- [ ] **Step 3: Remove from `chapter-editor.tsx`**

Remove these:
- `import { AmbientSounds } from './ambient-sounds'`
- `const [soundsOpen, setSoundsOpen] = useState(false)`
- The `{soundsOpen && <AmbientSounds onClose={() => setSoundsOpen(false)} />}` render
- The `onToggleSounds={() => setSoundsOpen(s => !s)}` and `soundsOpen={soundsOpen}` props passed to `<EditorToolbar>`

- [ ] **Step 4: Delete the component file**

```bash
git rm "app/[locale]/(app)/studio/[bookId]/_components/editor/ambient-sounds.tsx"
```

- [ ] **Step 5: Verify no orphans**

```bash
grep -rn "AmbientSounds\|soundsOpen\|onToggleSounds\|ambient-sounds" app/ --include="*.tsx" --include="*.ts" 2>&1
```

Expected: NO results (empty output).

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 113.

- [ ] **Step 6: Commit**

```bash
git add -A "app/[locale]/(app)/studio/[bookId]/_components/editor/"
git commit -m "feat(studio): remove ambient sounds (SP4 Task 1)

Ambient sounds was supposed to be removed in SP1 — the typewriter-mode
removal commit's message even claimed it. In fact only typewriter was
removed; the AmbientSounds component, its state in chapter-editor, and
the 🎵 toolbar button survived. Cleaning that up now.

Deletes:
- The 🎵 toolbar button (state + props + JSX)
- The AmbientSounds component file
- soundsOpen state in chapter-editor
- The conditional render of <AmbientSounds />"
```

---

## Task 2: Lucide icons across the remaining toolbar buttons

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

The align buttons already use lucide icons. This task replaces every other emoji/unicode/text-letter button with the lucide equivalent.

Spec mapping (typewriter dropped):

| Current | lucide icon |
|---|---|
| `B` | `Bold` |
| `I` | `Italic` |
| `S` | `Strikethrough` |
| `H1` `H2` `H3` | `Heading1` `Heading2` `Heading3` |
| `≡` (bullet list) | `List` |
| `1.` | `ListOrdered` |
| `"` | `Quote` |
| `—` | `Minus` |
| `↺` `↻` | `Undo` `Redo` |
| `🔍` | `Search` |
| `U` | `Underline` |
| `H` (highlight) | `Highlighter` |
| `🔗` | `Link` (link-toggle uses same icon, active state distinguishes) |
| `📊` | `BarChart3` |
| `⊡` `⊠` | `Maximize2` `Minimize2` |
| `↓ Export` text | `Download` + "Export" text |

- [ ] **Step 1: Extend the lucide import**

The file already has `import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'`. Extend:

```tsx
import {
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus,
  Undo, Redo, Search,
  Underline, Highlighter, Link,
  BarChart3,
  Maximize2, Minimize2,
  Download,
} from 'lucide-react'
```

- [ ] **Step 2: Replace each button's children**

For every `<ToolbarButton>` that currently has a text/unicode/emoji child, swap to the matching lucide icon at `size={14}`:

```tsx
// Before
<ToolbarButton onClick={...} title="Bold (⌘B)">B</ToolbarButton>

// After
<ToolbarButton onClick={...} title="Bold (⌘B)"><Bold size={14} /></ToolbarButton>
```

Do this for ALL emoji/text-letter buttons in the file. Reference the mapping table above. Don't touch the align buttons (already done).

The Export button currently is a standalone `<button>` with `<span>↓ Export</span>`-style content. Replace with `<Download size={14} /> <span>Export</span>` inside the same button. Keep the text label since "Export" benefits from an explicit label more than other buttons.

- [ ] **Step 3: Verify each icon renders correctly**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 113.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "feat(studio): lucide icons across the editor toolbar (SP4 Task 2)

Replaces every emoji/unicode/text-letter button with the matching
lucide icon at size=14, matching the align icons that landed in SP1
polish. Now consistent stroke weight across the whole toolbar.

The Export button keeps its 'Export' text label (most other buttons
are icon-only with tooltip labels). Typewriter-mode mapping skipped
since typewriter was removed in SP1."
```

---

## Task 3: Three-zone layout + raw hex → tokens

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

Combined because both touch the same file and the layout reorg is the right moment to clean hex on the Export button (which moves into the View zone group).

- [ ] **Step 1: Find raw hex usages**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" app/\[locale\]/\(app\)/studio/\[bookId\]/_components/editor/editor-toolbar.tsx 2>&1
```

The Export button is the worst offender (`text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc]`). Replace with token classes that match the other right-zone buttons (use the same classes as the existing `<ToolbarButton>` neighbors — likely `text-foreground/60 hover:text-foreground hover:bg-surface-elevated`, or whatever the existing `<ToolbarButton>` resolves to internally).

Other hex usages: scan and replace each with the semantic token.

- [ ] **Step 2: Restructure JSX into three zones**

The current JSX renders all buttons in a flat sequence with `<Separator />` markers and one `<span className="flex-1" />` push between status and view. Refactor into:

```tsx
return (
  <TooltipProvider>
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface">

      {/* FORMAT zone */}
      <div className="flex items-center gap-1">
        {/* Bold, Italic, Strike, Separator, H1/H2/H3, Separator,
            BulletList/OrderedList, Quote, HR, Separator,
            Undo/Redo, Separator, Underline, Highlight, Link, Separator,
            AlignL/AlignC/AlignR, Separator, FontSize mark dropdown (Task 6) */}
      </div>

      <span className="flex-1" />

      {/* STATUS zone */}
      <span className="flex items-center gap-3 text-xs text-foreground/40 min-w-[180px] justify-end tabular-nums">
        {/* Save indicator + word count — preserve the fixed-width pair from SP1 */}
      </span>

      <span className="flex-1" />

      {/* VIEW zone */}
      <div className="flex items-center gap-1">
        {/* Find, FontSize dropdown (existing global one), Light/Dark (Task 5),
            Focus mode, Writing analysis, Export */}
      </div>

    </div>
  </TooltipProvider>
)
```

Preserve every existing button's behavior. The reorg is structural — buttons move position within the row but their handlers and active states stay the same.

**Note:** Tasks 5 (light toggle) and 6 (font-size mark) add new buttons. This task just leaves placeholders/comments where they'll go — they're added in their own tasks below.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 113. STOP and report BLOCKED on failure.

Manually check visually after dev-server reload: all buttons present, status indicator + word count stay centered (the SP1 layout-shift fix should still hold), Export button no longer has the washed-out `#888` look.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "feat(studio): three-zone toolbar layout + replace remaining raw hex (SP4 Task 3)

Restructures the toolbar JSX into explicit Format / Status / View
zones with flex-1 spacers between them. Buttons keep their existing
behavior — only the grouping changes.

Same commit replaces the Export button's raw hex
(#888/#2a2a2a/#ccc) with semantic tokens matching its right-zone
neighbors. No more washed-out Export button.

Placeholders inside the View zone reserve spots for the light-mode
toggle (Task 5) and the font-size mark dropdown (Task 6, lives in
the Format zone)."
```

---

## Task 4: Scope Cmd+F / Cmd+S handlers to the editor

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`

- [ ] **Step 1: Find the keydown handler**

In `chapter-editor.tsx`, there's a `useEffect` that adds a `window` keydown listener handling Cmd+F (toggle find) and Cmd+S (force save). Currently no scope check — typing into a metadata-panel textarea + Cmd+F still triggers the editor's find.

- [ ] **Step 2: Add the focus-scope guard**

Add a `ref` to the editor container element so we can check whether `document.activeElement` is inside it:

```tsx
const editorContainerRef = useRef<HTMLDivElement>(null)
```

Apply it to the wrapper `<div>` that surrounds `<EditorContent>` (the one with `className="flex-1 overflow-y-auto cursor-text"` and the click-to-focus handler).

Update the keydown handler:

```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return

    // Scope: only fire when focus is inside the editor container OR
    // on the body (nothing else focused — user is between actions).
    const active = document.activeElement
    const inEditor = editorContainerRef.current?.contains(active) ?? false
    const onBody = active === document.body
    if (!inEditor && !onBody) return

    if (e.key === 'f' && editor && !editor.isDestroyed) {
      e.preventDefault()
      setFindOpen(f => !f)
      return
    }

    if (e.key === 's' && editor && !editor.isDestroyed) {
      e.preventDefault()
      const json = editor.getJSON()
      updateChapterContent(json)
      void flushPendingSave().then(() => pushFlash('Saved'))
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [editor, updateChapterContent, flushPendingSave, pushFlash])
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual check: focus a textarea in the right-hand metadata panel → press Cmd+F → no find panel opens, browser's native find may appear instead (that's fine). Click into the editor → press Cmd+F → editor find panel toggles.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx"
git commit -m "fix(studio): scope Cmd+F/Cmd+S to the editor container (SP4 Task 4)

Previously the window-scoped keydown listener fired regardless of
focus — typing in a metadata-panel textarea + Cmd+F still toggled
the editor's find panel and intercepted the browser's native find.

Now guards with: focus must be inside the editor container OR on
document.body (which means user is between actions and shortcuts
should still work). Activity inside metadata-panel textareas is
ignored."
```

---

## Task 5: Light-mode toggle

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — add the toggle button
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — apply `data-editor-theme` attr
- Modify: `app/globals.css` — light-mode CSS rules

- [ ] **Step 1: Add `editor-theme` state**

Where to live: the editor toolbar manages a piece of state most cleanly with `useState` + `useEffect` reading/writing localStorage. The `chapter-editor.tsx` `<main>` needs the attribute, so the state needs to be lifted to a common ancestor.

Cleanest: put it in the `BookEditorProvider` (the existing context provider). Adds `editorTheme: 'dark' | 'light'` + `toggleEditorTheme` to the context value.

In `book-editor-provider.tsx`:
- Add to the `BookEditorContextValue` type: `editorTheme: 'dark' | 'light'` + `toggleEditorTheme: () => void`.
- Add `useState`: initialize from `typeof window !== 'undefined' && localStorage.getItem('editor-theme') === 'light' ? 'light' : 'dark'`.
- Add `toggleEditorTheme` callback that flips state AND writes to `localStorage`.
- Add both to the `value` object and the `useMemo` deps.

- [ ] **Step 2: Wire the toggle button in the View zone**

In `editor-toolbar.tsx`:
- Destructure `editorTheme` and `toggleEditorTheme` from `useBookEditor()`.
- Add new imports: `import { Sun, Moon } from 'lucide-react'`.
- In the View zone, add (between Find and Focus mode, say):
  ```tsx
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={toggleEditorTheme}
        className="text-xs px-2 py-1 rounded transition-colors text-foreground/60 hover:text-foreground hover:bg-surface-elevated"
      >
        {editorTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </TooltipTrigger>
    <TooltipContent>
      {editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    </TooltipContent>
  </Tooltip>
  ```

- [ ] **Step 3: Apply `data-editor-theme` in `chapter-editor.tsx`**

Find the outermost `<main>` element of `ChapterEditor` (the one with `className="flex-1 flex flex-col overflow-hidden relative"`). Add:

```tsx
<main
  data-editor-theme={editorTheme}
  className="flex-1 flex flex-col overflow-hidden relative"
>
```

Destructure `editorTheme` from `useBookEditor()` at the top of the component if not already there.

- [ ] **Step 4: Add light-mode CSS rules**

In `app/globals.css`, append at the bottom (after the existing `.ProseMirror` rules):

```css
/* Light-mode for the editor content area + its toolbar.
   Scoped to data-editor-theme="light" so the rest of the app stays
   dark. Toggled via the Sun/Moon button in the toolbar. */

[data-editor-theme="light"] {
  background-color: #fcfcfa;
  color: #1a1a1a;
}

[data-editor-theme="light"] .ProseMirror {
  color: #1a1a1a;
}

[data-editor-theme="light"] .ProseMirror h1,
[data-editor-theme="light"] .ProseMirror h2,
[data-editor-theme="light"] .ProseMirror h3 {
  color: #0a0a0a;
}

[data-editor-theme="light"] .ProseMirror blockquote {
  color: #333;
  /* keep the brand-yellow left border */
}

/* Editor toolbar background flips to light when in light mode */
[data-editor-theme="light"] [data-slot="editor-toolbar"] {
  background-color: #f4f4ee;
  border-bottom-color: #e0e0d8;
  color: #1a1a1a;
}

[data-editor-theme="light"] [data-slot="editor-toolbar"] button {
  color: rgba(26, 26, 26, 0.6);
}
[data-editor-theme="light"] [data-slot="editor-toolbar"] button:hover {
  color: #1a1a1a;
  background-color: #e8e8e0;
}

/* Caret stays brand-yellow even in light mode */
[data-editor-theme="light"] .ProseMirror { caret-color: var(--color-brand); }
```

The selector `[data-slot="editor-toolbar"]` requires adding `data-slot="editor-toolbar"` to the toolbar's outer `<div>` in `editor-toolbar.tsx` (the one inside `<TooltipProvider>`). Add that attribute as part of Step 2 above. The naming follows shadcn's convention.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual check: hard reload, click Sun icon → editor body + toolbar both flip to light. Binder + metadata panels stay dark. Type — caret is still brand-yellow. Click Moon → back to dark. Reload page → preference persists.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/" app/globals.css
git commit -m "feat(studio): light-mode toggle for editor content area + toolbar (SP4 Task 5)

Sun/Moon button in the View zone toggles between editor-only light
and dark modes. Preference persists in localStorage as 'editor-theme'.

Light mode applies via data-editor-theme='light' on the editor's
outermost <main>. CSS rules in globals.css flip:
- Body background to #fcfcfa
- Prose text to near-black #1a1a1a
- Headings slightly darker for contrast
- Toolbar background to light #f4f4ee
- Toolbar button colors invert to dark
- Caret stays brand-yellow (writers know where they are)

Binder and metadata panels stay dark — this is editor-area only.
Whole-app light mode is a future Claude Design effort."
```

---

## Task 6: Font-size mark

**Files:**
- Conditionally create: `lib/tiptap/font-size-mark.ts` (if no usable package)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — add extension
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — add dropdown
- Optionally create: `__tests__/tiptap/font-size-mark.test.ts` for HTML round-trip

- [ ] **Step 1: Check for an existing font-size extension**

```bash
npm view @tiptap/extension-font-size 2>&1 | head -3
```

If the package exists and works with TipTap v3 (check `peerDependencies`), prefer it:
```bash
npm install @tiptap/extension-font-size
```

Else write a custom mark — see Step 2.

- [ ] **Step 2 (only if needed): Write the custom mark**

Create `lib/tiptap/font-size-mark.ts`:

```ts
import { Mark } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType  // e.g. '1.25em'
      unsetFontSize: () => ReturnType
    }
  }
}

// An inline mark that renders <span style="font-size: <value>">…</span>.
// Used for per-selection size emphasis, orthogonal to block-level H1/H2/H3.
export const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      size: {
        default: null as string | null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attributes => {
          if (!attributes.size) return {}
          return { style: `font-size: ${attributes.size}` }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        style: 'font-size',
        getAttrs: value => (typeof value === 'string' && value.length > 0 ? { size: value } : false),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    }
  },
})
```

- [ ] **Step 3: Add the extension to `useEditor`**

In `chapter-editor.tsx`, add the import:
```ts
// If using the package:
import FontSize from '@tiptap/extension-font-size'
// Or, if custom:
import { FontSize } from '@/lib/tiptap/font-size-mark'
```

Add to the `extensions` array in `useEditor`:
```ts
extensions: [
  StarterKit,
  Placeholder.configure({ placeholder: 'Start writing…' }),
  Underline,
  Highlight.configure({ multicolor: false }),
  Link.configure({ openOnClick: false, ... }),
  Typography,
  CharacterCount,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  FontSize,   // ← new
],
```

Make sure this is added to the chapter editor's `useEditor` AND to the NoteEditor's `useEditor` (SP3 D's note editor — keep notes consistent with chapters; users may expect font-size mark in both).

- [ ] **Step 4: Add the dropdown control in the Format zone**

In `editor-toolbar.tsx`, near the align buttons in the Format zone, add a small popover-driven dropdown:

```tsx
import { Type } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Inside the Format zone:
const [sizeOpen, setSizeOpen] = useState(false)

function applySize(size: string | null) {
  setSizeOpen(false)
  if (size === null) {
    editor.chain().focus().unsetFontSize().run()
  } else {
    editor.chain().focus().setFontSize(size).run()
  }
}

<Popover open={sizeOpen} onOpenChange={setSizeOpen}>
  <Tooltip>
    <TooltipTrigger asChild>
      <PopoverTrigger asChild>
        <button
          onMouseDown={e => e.preventDefault()}
          className="text-xs px-2 py-1 rounded transition-colors text-foreground/60 hover:text-foreground hover:bg-surface-elevated"
        >
          <Type size={14} />
        </button>
      </PopoverTrigger>
    </TooltipTrigger>
    <TooltipContent>Selection size</TooltipContent>
  </Tooltip>
  <PopoverContent className="w-auto p-1" align="start">
    <div className="flex flex-col">
      <button onClick={() => applySize('0.85em')} className="text-xs text-left px-3 py-1.5 rounded hover:bg-surface text-foreground/80">Smaller</button>
      <button onClick={() => applySize(null)} className="text-xs text-left px-3 py-1.5 rounded hover:bg-surface text-foreground/80">Normal</button>
      <button onClick={() => applySize('1.25em')} className="text-xs text-left px-3 py-1.5 rounded hover:bg-surface text-foreground/80">Larger</button>
      <button onClick={() => applySize('1.5em')} className="text-xs text-left px-3 py-1.5 rounded hover:bg-surface text-foreground/80">Largest</button>
    </div>
  </PopoverContent>
</Popover>
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 113 (or rise if you added the optional HTML round-trip test in Step 6).

- [ ] **Step 6 (optional): Add unit test for the custom mark**

Only if you wrote the custom mark in Step 2 — the package version is well-tested upstream. Create `__tests__/tiptap/font-size-mark.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { FontSize } from '@/lib/tiptap/font-size-mark'

describe('FontSize mark', () => {
  it('round-trips HTML with font-size style', () => {
    const editor = new Editor({
      extensions: [StarterKit, FontSize],
      content: '<p>hello <span style="font-size: 1.25em">world</span></p>',
    })
    const html = editor.getHTML()
    expect(html).toContain('font-size: 1.25em')
    expect(html).toContain('world')
    editor.destroy()
  })

  it('setFontSize applies to selection', () => {
    const editor = new Editor({
      extensions: [StarterKit, FontSize],
      content: '<p>hello world</p>',
    })
    editor.commands.selectAll()
    editor.commands.setFontSize('1.5em')
    expect(editor.getHTML()).toContain('font-size: 1.5em')
    editor.destroy()
  })

  it('unsetFontSize removes the mark', () => {
    const editor = new Editor({
      extensions: [StarterKit, FontSize],
      content: '<p><span style="font-size: 2em">hi</span></p>',
    })
    editor.commands.selectAll()
    editor.commands.unsetFontSize()
    expect(editor.getHTML()).not.toContain('font-size')
    editor.destroy()
  })
})
```

- [ ] **Step 7: Commit**

```bash
git add lib/ "app/[locale]/(app)/studio/[bookId]/_components/editor/" "__tests__/tiptap/" 2>/dev/null || true
git commit -m "feat(studio): font-size mark for per-selection emphasis (SP4 Task 6)

Inline TipTap mark that bumps the rendered size of just the selected
text — orthogonal to H1/H2/H3 which are block-level. Resolves the
deferred SP1 feature when Chris asked why H1 affected the whole line.

Toolbar control: small Type-icon popover in the Format zone with
four presets (Smaller 0.85em / Normal / Larger 1.25em / Largest
1.5em). Em-based so they scale relative to the user's global
font-size dropdown.

Available in both the chapter editor and the note editor (SP3 D),
since both share the TipTap config pattern. The mark survives
save/reload via TipTap's native getJSON/setContent round-trip."
```

---

## Task 7: Final verification + Resume Here update (closes SP4)

- [ ] **Step 1: Full manual checklist** (from spec §Testing)

In the dev server:

1. Every existing toolbar button still functions (formatting, lists, align, undo/redo, find, font size, focus mode, export, writing analysis). Verify by clicking each.
2. The three align buttons remain visually distinct and apply the correct alignment (already from SP1).
3. Toggling light/dark via the new Sun/Moon button changes editor background, prose color, AND toolbar background. Binder + metadata panels stay dark. Refreshing the page restores the chosen mode.
4. Ambient sounds button is gone from the toolbar. Grep returns no orphan references.
5. Cmd+F while focused in a metadata-panel textarea does NOT open the editor's find. Cmd+F while focused in the editor DOES.
6. Cmd+S while focused in metadata panel does NOT fire the save toast. Cmd+S while focused in editor DOES.
7. Select a few words → font-size dropdown → pick "Larger" → just the selection grows. Pick "Normal" → reverts.
8. Existing global font-size dropdown still works (bumping it from 16px to 20px enlarges everything; the per-selection mark scales relative).
9. Export button looks identical to other right-zone buttons (no more washed-out #888 look).

- [ ] **Step 2: Automated checks**

```bash
npm test
npx tsc --noEmit
```

Both clean. Test count: 113 (or +3 if the optional font-size mark test was added in Task 6).

- [ ] **Step 3: Update AGENTS.md Resume Here**

Replace the Resume Here block to mark SP4 complete and point at SP5:

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** SP5 Metadata + persistence — not started
> **Active branch:** `main`
> **Last commit:** <git log -1 --format=%s>
>
> 1. ~~SP1 Stability~~ DONE.
> 2. ~~SP2 Binder UX~~ DONE.
> 3. ~~SP3 Specialized Editors~~ DONE.
> 4. ~~SP4 Toolbar + modes~~ DONE — three-zone layout, lucide icons across the toolbar, ambient sounds removed (for real this time), Cmd+F/Cmd+S scoped to editor, light-mode toggle, font-size mark for per-selection emphasis.
> 5. **SP5 Metadata + persistence (NEXT)** — synopsis/scene-planner/notes/word-goal/status/publishing-details correctness, bottom status-bar consolidation.
> 6. SP6 New surfaces — Snapshot UI, mobile/tablet responsive, accessibility audit.
>
> After all six: Claude Design redesigns visually, mechanical import. Then Phase 8 (Stripe monetization) resumes.
>
> **Next concrete step when resuming:** invoke `/brainstorming` for SP5 Metadata + persistence.
```

- [ ] **Step 4: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs: close SP4 Toolbar + modes, point Resume Here at SP5"
```

---

## Definition of Done

- All 9 manual checklist items in Task 7 pass.
- `npm test` clean (113+).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here reflects SP4 complete, SP5 next.
- ~7 atomic commits on `main`.
