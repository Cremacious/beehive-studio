# Studio Editor — Toolbar + Modes

**Date:** 2026-05-22 (drafted) · 2026-05-26 (reconfirmed via /brainstorming, scope locked)
**Sub-project:** 4 of 6 (Studio Editor Audit — sequence revised after SP3 added)
**Status:** Approved — ready for implementation plan

## Reconfirmation note (2026-05-26)

After SP3 closed, this spec was audited against the current code. Net result:
- Item #3 (distinct align icons) was already shipped during SP1 ad-hoc polish — confirmed via grep for `AlignLeft`/`AlignCenter`/`AlignRight` in `editor-toolbar.tsx`.
- Item #5 (remove ambient sounds) is still outstanding despite the SP1 commit message claiming "kill typewriter, move find panel" — ambient sounds was missed.
- Typewriter mode was removed in SP1, so item #2's icon mapping for `MoveVertical` (typewriter) is dropped.
- A new item #8 (font-size mark) was added — deferred from SP1 when Chris asked about "make this word bigger" and learned headings are block-level.

All other items (1, 2 except typewriter, 4, 5, 6, 7) carry forward unchanged from the original draft.

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
| ~~`✍`~~ | ~~`MoveVertical`~~ — *typewriter mode removed in SP1, skip* |
| `📊` | `BarChart3` |
| `⊡` `⊠` | `Maximize2` `Minimize2` |
| `↓ Export` | `Download` + `Export` text |

Use a consistent size (`size={14}` or `size={16}`) and stroke width.

### 3. ~~Distinct text-align icons~~ — DONE in SP1 polish

The three text-align buttons now render lucide `AlignLeft`,
`AlignCenter`, `AlignRight` icons. No work needed in SP4 for this
item. Listed here for historical traceability.

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
  - Editor body background: light paper-like (`#fcfcfa`)
  - Editor prose text: near-black (`#1a1a1a`)
  - Same brand-yellow caret + active state colors
  - Light-mode-appropriate border tones
  - **Toolbar background also flips** to a light tone for cohesion —
    a separate selector `[data-editor-theme="light"] .editor-toolbar`
    (or however the toolbar is referenced via attribute). Without this,
    the toolbar reads as a foreign dark bar over a light editor.

This only affects the **editor content area + its toolbar**, not the
binder or metadata panels. (Full app light mode is a separate future
effort.)

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

### 8. Font-size mark (deferred from SP1)

**Current:** H1/H2/H3 are block-level transformations — clicking them
makes the *entire paragraph* a heading. There is no way to make
*just selected words* bigger without converting the whole block.

When Chris first encountered this in SP1, he asked why H1 affected
every word in the line. We confirmed it was correct block-level
behavior and deferred the per-selection size feature to SP4.

**Fix:** Add an inline font-size *mark* that bumps the rendered size
of the current selection only. Orthogonal to H1/H2/H3 (which remain
block-level).

**Implementation:**
- Try `@tiptap/extension-font-size` first. If not available or it
  brings in extra dependencies for features we don't want, write a
  small custom Mark extension (~30 lines) that adds inline
  `style="font-size: <value>em"` to its rendered span.
- Add the extension to the TipTap config in `chapter-editor.tsx`'s
  `useEditor` extensions array.
- Toolbar control: a small dropdown (or popover) in the Format zone
  with four presets:
  - `Smaller` (0.85em)
  - `Normal` (clear — removes the mark)
  - `Larger` (1.25em)
  - `Largest` (1.5em)
- Em-based so they scale relative to the user's global font-size
  dropdown setting.

**Note: this is distinct from the existing font-size dropdown** which
sets the editor's BASE font size globally via a CSS variable on the
document root. Both stay — they do different things. The dropdown
controls the global "reading size"; the new mark gives per-selection
emphasis.

**Files:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
  — add the extension to `useEditor` extensions
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
  — add the dropdown/popover control in the Format zone
- Possibly `lib/tiptap/font-size-mark.ts` if writing a custom mark
  (decide during implementation)

## Out of Scope

- Pixel-level visual redesign of the toolbar — that's the Claude Design
  pass after sub-project 6 (final audit sub-project).
- Bottom status bar (consolidating save + word-count + word-goal) →
  sub-project 5 (Metadata + persistence).
- Mobile / touch-target accessibility → sub-project 6.
- Light-mode for the binder and metadata panels — out of scope for
  this feature. Defer until after Claude Design's pixel-level pass.
- Color picker for the font-size mark — just the 4 presets, no custom
  em values.

## Testing

Manual.

- Every existing toolbar button still functions (formatting, lists,
  align, undo/redo, find, font size, focus mode, typewriter, export,
  writing analysis).
- The three align buttons are visually distinct and apply the correct
  alignment.
- Toggling light/dark via the new toggle changes the editor background,
  prose text color, AND the toolbar's own background. Binder and
  metadata panels stay dark. Refreshing the page restores the chosen
  mode (localStorage `editor-theme`).
- Ambient sounds button is gone from the toolbar. Grepping the repo for
  `AmbientSounds`, `soundsOpen`, `🎵` returns no orphaned references.
- `Cmd+F` while focused in the metadata panel does NOT open the
  editor's find. `Cmd+F` while focused in the editor DOES.
- Same scoping check for `Cmd+S` — only fires save toast when focus is
  in the editor.
- Select a few words → font-size mark dropdown → pick "Larger" — just
  the selection grows; surrounding text unaffected.
- Pick "Normal" on the same selection → mark removed; selection back to
  baseline size.
- Existing global font-size dropdown still works — bumping it from 16px
  to 20px enlarges everything; the per-selection mark scales relative
  (e.g., "Larger" at base 20px is ~25px).
- `npm test` passes; `npx tsc --noEmit` clean.

## Risks

- `lucide-react` icon imports add a small bundle cost — should be
  negligible since the lib is tree-shakeable and already used elsewhere.
- Removing ambient sounds: ensure no orphaned references in route
  groups, types, or tests.
- Light-mode CSS scoped to `[data-editor-theme="light"]` must override
  Tailwind's `dark:` prefix where they collide. Verify in browser.

## Definition of Done

- All 7 outstanding items land (item #3 was already done in SP1
  polish — confirmed during the 2026-05-26 reconfirmation).
- Manual checklist passes (including font-size mark + light-mode
  toolbar background + Cmd+S scoping).
- `npm test` clean (~113 tests, plus any font-size mark unit tests).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here updated to mark SP4 complete, point at SP5
  (Metadata + persistence) as next.
- ~7 atomic commits on `main`.
