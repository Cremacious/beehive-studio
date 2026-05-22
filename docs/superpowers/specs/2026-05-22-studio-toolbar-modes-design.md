# Studio Editor — Toolbar + Modes

**Date:** 2026-05-22
**Sub-project:** 3 of 5 (Studio Editor Audit)
**Status:** Draft from /design-critique findings — re-confirm via /brainstorming before implementation

## Context

The editor toolbar has accumulated 24+ controls in one row, mixing text
labels (B/I/S), unicode glyphs (≡, ⊡, ↺), and emoji (📊, 🎵, ✍).
Three text-align buttons render the same `≡` character, making them
indistinguishable. Color tokens are inconsistent (hex vs. semantic).
Writers have asked for a light-mode option. The ambient sounds feature
will be removed (user decision, 2026-05-22).

## Goal

Reorganize the toolbar into three clear zones with consistent iconography
and design tokens, fix the duplicate-glyph align bug, add a light-mode
toggle, and remove ambient sounds. This sub-project does NOT redesign
the visual appearance of the toolbar at the pixel level — that's the
Claude Design pass after sub-project 5. This sub-project fixes structural
and behavioral issues *within the current visual language*.

## In Scope

### 1. Three-zone toolbar layout

**Current:** One flex row with 24+ controls and `flex-1` spacer in the
middle. Visually noisy, hard to scan.

**Fix:** Group controls into three zones, each in its own
`<div className="flex items-center gap-1">`, separated by `<Separator />`
and a flexible spacer:

- **Format zone (left):** Bold, Italic, Strike, H1, H2, H3, Bullet list,
  Ordered list, Blockquote, HR, Undo, Redo, Underline, Highlight, Link,
  Align left/center/right.
- **Status zone (center, flex-grow):** Save status indicator + word
  count. (To be moved to a bottom status bar in sub-project 4 — keep here
  for now.)
- **View zone (right):** Find, font-size, light/dark toggle, focus mode,
  typewriter mode, **"View ⌄" overflow menu** (writing analysis,
  corkboard), Export.

### 2. Replace ad-hoc icons with `lucide-react`

`lucide-react` is already in the dependency graph (used elsewhere in the
app). Replace all toolbar emoji and unicode glyphs with the matching
lucide icons. Specific mappings:

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
| `🔗` | `Link` / `Link2Off` |
| `≡` (three align buttons) | `AlignLeft` `AlignCenter` `AlignRight` |
| `✍` | `TypeOutline` (or `MoveVertical` for typewriter mode) |
| `📊` | `BarChart3` |
| `⊡` `⊠` | `Maximize2` `Minimize2` |
| `↓ Export` | `Download` + `Export` text |

Use a consistent size (`size={14}` or `size={16}`) and stroke width.

### 3. Distinct text-align icons

**Current critical bug:** Three buttons at lines 211-229 of
`editor-toolbar.tsx` all render the same `≡` character. Users cannot
tell left from center from right.

**Fix:** Use `AlignLeft`, `AlignCenter`, `AlignRight` from lucide.

### 4. Light-mode toggle

**Current:** App is dark-only. Some writers prefer light backgrounds for
long sessions.

**Fix:**
- Add a single toolbar button in the View zone: `Sun`/`Moon` icon from
  lucide, toggling between light and dark *editor* modes.
- Persist preference to `localStorage` key `editor-theme` (values:
  `dark` (default) | `light`).
- Apply via a `data-editor-theme` attribute on the editor's outermost
  surface (`<main>` element of `chapter-editor.tsx`).
- Add CSS rules to `app/globals.css` scoped to `[data-editor-theme="light"]`:
  - White paper-like background (`#fcfcfa` or similar)
  - Black/near-black prose text
  - Same brand-yellow caret + active state colors
  - Light-mode-appropriate border tones

This only affects the **editor content area**, not the binder or
metadata panels. (Full app light mode is a separate future effort.)

**Files:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
- `app/globals.css`

### 5. Remove ambient sounds

**Current:** Toolbar has a 🎵 button. Clicking opens `AmbientSounds`
overlay.

**Fix:** Delete:
- Toolbar button + `soundsOpen` state in `editor-toolbar.tsx` and
  `chapter-editor.tsx`
- The component file `ambient-sounds.tsx`
- Any related routes, assets, or imports

### 6. Replace raw hex with design tokens

**Current:** `editor-toolbar.tsx` mixes semantic tokens
(`text-foreground/70`, `bg-surface-elevated`) with raw hex (`#888`,
`#2a2a2a`, `#ccc`). The Export button is the worst offender.

**Fix:** Replace every raw hex value in this file with the appropriate
semantic token from `app/globals.css`. The Export button should look
identical to the other right-zone toggle buttons.

### 7. Scope `Cmd+F` find shortcut to the editor

**Current:** The `Cmd+F` handler is attached to `window` and fires
regardless of focus. Typing in the metadata panel + `Cmd+F` opens the
editor's find panel (and overrides the browser's native find).

**Fix:** Either:
- Attach the keydown listener to the editor's DOM root instead of
  `window`, OR
- Add a guard: `if (!editorContainerRef.current?.contains(document.activeElement)) return`

The same scoping applies to the `Cmd+S` handler added in sub-project 1.

## Out of Scope

- Pixel-level visual redesign of the toolbar — that's the Claude Design
  pass after sub-project 5.
- Bottom status bar (consolidating save + word-count + word-goal) →
  sub-project 4.
- Mobile/touch-target accessibility → sub-project 5.

## Testing

Manual.

- Every existing toolbar button still functions (formatting, lists,
  align, undo/redo, find, font size, focus mode, typewriter, export,
  writing analysis).
- The three align buttons are visually distinct and apply the correct
  alignment.
- Toggling light/dark via the new toggle changes the editor background
  and text color. Refreshing the page restores the chosen mode.
- Ambient sounds button is gone; clicking around the toolbar doesn't
  open it.
- `Cmd+F` while focused in the metadata panel does NOT open the
  editor's find. `Cmd+F` while focused in the editor DOES.
- `npm test` passes; `npx tsc --noEmit` clean.

## Risks

- `lucide-react` icon imports add a small bundle cost — should be
  negligible since the lib is tree-shakeable and already used elsewhere.
- Removing ambient sounds: ensure no orphaned references in route
  groups, types, or tests.
- Light-mode CSS scoped to `[data-editor-theme="light"]` must override
  Tailwind's `dark:` prefix where they collide. Verify in browser.

## Definition of Done

- All seven changes land.
- Manual checklist passes.
- AGENTS.md Resume Here updated.
- ~7 atomic commits (one per change).
