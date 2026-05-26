# Studio UI Inventory

> **Purpose:** complete catalog of every surface inside `/[locale]/studio/[bookId]` so the Claude Design pass doesn't miss anything. Grouped into three buckets that map to three Claude Design prompts.
>
> **Date:** 2026-05-26 · post-SP6 (editor audit complete).
>
> **Brand direction (locked):** mixed palette — warm cream/paper writing surfaces inside dark chrome. Brand yellow `#FFC300` as primary accent. Supporting palette TBD by Claude Design to cover status, item-type, and validation states. Stacked-card / paper-layer visual language ("cozy library / writer's desk").

## Source URL for screenshots
`http://localhost:3000/en/studio/z3triuo9acfe6hug8skbn29a`

## Page composition
`app/[locale]/(app)/studio/[bookId]/page.tsx` mounts inside the (app) layout (which provides a `h-14` nav). Body is a single flex row pinned to `h-[calc(100vh-56px)]`:

```
┌─ App nav (h-14, from (app) layout) ─────────────────────────────┐
│                                                                 │
├─ <BinderTree> ┬─ <CorkboardOrEditor> ┬─ <RightPanelSlot> ───────┤
│   left panel  │   editor / corkboard │   metadata | history     │
│   w-60        │   flex-1             │   w-60                   │
└───────────────┴──────────────────────┴──────────────────────────┘
<ErrorToasts /> (fixed-positioned)
```

The studio surface has **three editor "modes"** layered on top of this composition:
- **Normal** — three columns.
- **Focus mode** — sidebars hidden; only editor visible.
- **Corkboard mode** — center column shows chapter card grid instead of editor.

---

## Prompt 1: Studio Shell + All Menus

Everything that's persistent chrome — visible all the time on a normal /studio/[bookId] view.

### 1.1 App nav (top bar) — **OUT OF SCOPE**
- **File:** parent `(app)/layout.tsx` — not inside studio components.
- **Status:** Chris will redesign the global app nav separately. Not part of this studio Claude Design pass. Claude Design should assume the existing h-14 dark nav stays and design the studio chrome to sit cleanly under it.

### 1.2 Binder (left panel)
- **File:** `_components/binder/binder-tree.tsx`
- **Purpose:** tree view of binder items for the current book. Drag-drop to reorder. Click to make active.
- **Width:** w-60 (240px).
- **Top of panel:** the book title at top + a corkboard-mode toggle button.
- **Item types** rendered (each gets a distinct icon today):
  - `chapter` — narrative prose
  - `front_matter` — title page, copyright, dedication, etc. (has subtypes — see Prompt 2)
  - `back_matter` — about author, acknowledgments, etc. (subtypes)
  - `outline` — Kanban board
  - `research_note` — note editor
  - `character` — character profile
- **Per-item states:**
  - Default (text only)
  - Hover (background lightens, ⋯ menu appears)
  - Active (highlighted, current item being edited)
  - Pending rename (inline input, auto-focused)
  - Drag preview (during DnD)
- **Hierarchy:** items can have `parentId` — nested rendering with collapse/expand chevron (`binder-item.tsx`).

#### 1.2a Binder item ⋯ menu
- **File:** `_components/binder/binder-item-menu.tsx`
- **Purpose:** per-item actions dropdown. Appears on row hover or focus.
- **Items:** Rename · Duplicate · Delete (destructive). Possibly more.
- **States:** open / closed; hover on each item.

#### 1.2b Binder add menu (+ Add)
- **File:** `_components/binder/binder-add-menu.tsx`
- **Purpose:** primary "+ Add" button at the bottom (or top) of the binder. Opens a popover listing item types to create.
- **Items:** Chapter · Front Matter · Back Matter · Outline · Research Note · Character (or whatever subset). One click → creates the item, scrolls to it, opens inline rename.

### 1.3 Editor toolbar (top of center pane)
- **File:** `_components/editor/editor-toolbar.tsx`
- **Purpose:** TipTap formatting + view controls. Renders only on chapter / front_matter / back_matter items. Hidden in Front/Back Matter form mode (those have their own toolbar via `note-toolbar.tsx` or none).
- **Layout:** three zones — FORMAT (left) · spacer · VIEW (right).
- **FORMAT zone buttons** (lucide icons, ~14px, brand-yellow active):
  1. Bold · Italic · Strikethrough
  2. Heading 1 / 2 / 3
  3. Bullet list · Numbered list
  4. Blockquote · Horizontal rule
  5. Undo · Redo
  6. Underline · Highlight · Link
  7. Align left / center / right
  Separators between groups.
- **VIEW zone buttons:**
  1. Find & Replace (Search icon)
  2. Version history (Clock/History icon) — opens drawer (Prompt 3)
  3. Keyboard shortcuts (HelpCircle) — opens cheatsheet modal (Prompt 3)
  4. Editor theme toggle (Sun/Moon — light/dark for editor area only)
  5. Font size select (12/14/16/18/20/24)
  6. Export (Download + text label)
  7. Writing analysis (BarChart3)
  8. Focus mode (Maximize2 / Minimize2)
- **States per button:** default · hover · active (brand-yellow bg+text) · disabled (Undo/Redo can be disabled).
- **Tooltips:** each button has a shadcn Tooltip showing its name + shortcut. All icon-only buttons now have aria-labels too (SP6).

### 1.4 Editor body (center pane content area)
- **File:** `_components/editor/chapter-editor.tsx` (the chapter render path).
- **Purpose:** TipTap prose area inside a scrolling container. Max-width centered at ~3xl, `prose prose-invert prose-sm`, font-size from CSS var, line-height 1.8.
- **States:**
  - Default editable
  - Empty (Placeholder "Start writing…")
  - Read-only preview (during snapshot preview — body content is snapshot, banner above)
  - Loading skeleton (when activeChapter still null on item switch)
- **Notable:** the editor inherits `data-editor-theme` from a wrapper for light-mode CSS (SP4 pattern).

### 1.5 Editor status bar (bottom of editor pane) — **STRUCTURAL CHANGE PLANNED**
- **File:** `_components/editor/editor-status-bar.tsx`
- **Purpose:** persistent thin bar at the bottom of the editor showing save status, word count, word goal — AND (newly) the sprint timer.
- **NEW LAYOUT (Chris locked):**
  - **Left side:** all word-count things — save indicator · word count · word goal · edit goal.
  - **Right side:** sprint timer (start/pause/stop button + countdown display).
- **States:**
  - Save status: `Saved` (default) · `Saving…` (animate-pulse) · `Unsaved` (brand-yellow).
  - Word goal: unset → "Set word goal" link · set → "N% of M word goal · edit" · editing → inline number input + Save/Cancel buttons.
  - Sprint timer: idle ("Start sprint" button) · running (countdown + pause) · paused (resume + stop) · finished (toast + reset).
- **Light/dark:** flips with editor theme (SP5 added CSS for word-count side; new sprint side will need same treatment).
- **Implementation note:** the existing `SprintTimer` component (1.8) gets folded into this bar as the right-side cluster. The floating overlay is removed.

### 1.6 Right panel — Metadata mode (default)
- **File:** `_components/metadata/metadata-panel.tsx` (mounted via `_components/right-panel-slot.tsx`).
- **Width:** w-60. Hidden in focus mode, corkboard mode, or when history drawer is open.
- **Two sub-modes:**

#### 1.6a Empty placeholder
- Shown when active item is non-chapter (research_note, outline, character) OR no active item.
- Single centered line: "Select a chapter to see details."

#### 1.6b Chapter metadata (chapter / front_matter / back_matter)
- Sections, top → bottom:
  1. **Title** — click-to-edit inline input. Enter commits.
  2. **Status pills** — Idea · Outline · First Draft · Revised · Final. One active at a time.
  3. **Synopsis** — textarea, debounced save to `binderItems.content`.
  4. **Scene Planner** (collapsed by default, **only for `type === 'chapter'`**) — three textareas: Goal / Conflict / Outcome. Hidden on FM/BM (SP5).
  5. **Notes** — large textarea (private to author), saves to `chapters.notes`.
  6. **Publishing details** — collapsible expander pinned at the bottom of the panel. See 1.6c.

#### 1.6c Publishing details expander (bottom of metadata panel)
- **Inside:** `_components/metadata/metadata-panel.tsx` → `PublishingSection`.
- **Header:** "▸ Publishing details" + `Premium` badge + subtitle "Applies to the whole book, not just this chapter" (SP5).
- **Expanded content (premium-gated):** Subtitle · ISBN · Publisher name · Dedication · Edition · Author bio · Trim size (select).
- **States:** collapsed · expanded · loading · saving (top-right indicator) · upgrade-prompt (non-premium).

### 1.7 Error toasts
- **File:** `_components/error-toasts.tsx`
- **Purpose:** fixed-positioned toast container that shows transient flashes (`pushFlash` from provider). Used by save failures, restore confirmations, etc.
- **States:** appearing · dismissing.

### 1.8 Sprint timer — **MOVED INTO STATUS BAR (1.5)**
- **File:** `_components/editor/sprint-timer.tsx`
- **Status:** the floating overlay is being removed. Sprint timer becomes the right-side cluster of the bottom status bar (1.5). The component logic stays (countdown, start/pause/stop, sprint-end behavior), but the visual chrome is integrated into the status bar.
- **Implementation impact:** during Prompt 1's implementation, refactor `chapter-editor.tsx` so it no longer mounts `<SprintTimer>` as a sibling; instead `<EditorStatusBar>` renders the sprint controls inline on its right side.

> **NOTE:** the keyboard cheatsheet modal, version history drawer, preview banner, find-replace, writing analysis, and export modal all live as toolbar entry points but render as overlays/drawers/modals — those go in Prompt 3.

---

## Prompt 2: Specialized Editor Surfaces

When the active binder item is not a chapter, the center pane swaps from the TipTap chapter editor to a specialized editor. All four use the same architectural pattern: `binderItems.content` jsonb carries the subtype data, and `chapter-editor.tsx` branches in its `!isChapterType` block.

### 2.1 Front Matter / Back Matter forms
- **File:** `_components/front-back-matter/index.tsx` (renderer + dispatcher).
- **Subtypes (file each):**
  - `title-page-form.tsx` — book title, subtitle, author name, byline
  - `copyright-form.tsx` — copyright year, holder, edition, ISBN, publisher, rights statement
  - `dedication-form.tsx` — single rich-text or plain field
  - `acknowledgments-form.tsx` — long-form text
  - `about-author-form.tsx` — bio + photo + links
- **Shared affordances:**
  - `subtype-picker.tsx` — top-of-form selector to switch which subtype this binder item is
  - `save-status-badge.tsx` — small badge mirroring the editor's save status (SP3 B)
- **States per form:** default · saving · saved · validation errors (per field).
- **CHRIS HAS FLAGGED THIS FOR RESTYLE.**

### 2.2 Outline (Kanban board)
- **File:** `_components/outline/outline-board.tsx`
- **Children:**
  - `outline-column.tsx` — a status column (drag target)
  - `outline-card.tsx` — a single outline card (drag source); each card represents a chapter or beat
  - `chapter-link-popover.tsx` — popover for linking a card to an actual binder chapter
- **Purpose:** Kanban-style story planning. Cards in columns ("Act 1 / Act 2 / Act 3" or similar). Drag to reorder/recategorize.
- **States:**
  - Column: default · drop-target highlighted
  - Card: default · hover · being-dragged · linked-to-chapter (shows chapter title) · unlinked
- **CHRIS HAS FLAGGED THIS FOR RESTYLE.**

### 2.3 Research Notes
- **File:** `_components/notes/note-editor.tsx`
- **Children:**
  - `note-toolbar.tsx` — formatting toolbar specific to notes
  - `note-attribute-controls.tsx` — note attributes (tags, color, pin state, etc.)
- **Purpose:** standalone rich-text note for research, character bios, world-building.
- **States:** default · saving · saved.

### 2.4 Character profile
- **File:** `_components/editor/character-profile.tsx`
- **Purpose:** structured character sheet (name, role, appearance, motivations, arc, relationships).
- **States:** default · saving · saved · empty (just-created character).

### 2.5 Generic non-chapter fallback
- **File:** `_components/editor/chapter-editor.tsx` (the textarea fallback for unknown non-chapter types).
- **Purpose:** simple textarea for `activeItem.content` when no specialized renderer matches.
- **Likely deprecated once all types have a specialized renderer.**

---

## Prompt 3: Overlays · Modes · Modals

Everything that opens, drops down, or replaces the normal three-column composition.

### 3.1 Corkboard view (mode)
- **File:** `_components/corkboard-view.tsx`
- **Trigger:** corkboard toggle (likely in binder header or toolbar).
- **Layout:** replaces the center pane with a grid of chapter "index cards" — one card per chapter showing title + synopsis. Click a card → exits corkboard, opens that chapter.
- **States per card:** default · hover · active (the currently-selected chapter) · drag (rearrange).
- **Empty state:** "No chapters yet."

### 3.2 Focus mode (mode)
- **Trigger:** focus button in editor toolbar.
- **Effect:** hides BinderTree + RightPanelSlot via provider flag (`focusMode`). Editor takes full width.
- **No new component** — existing components return null when `focusMode` is true.
- **Exit:** click the same toolbar button (now Minimize2 icon).

### 3.3 Version history drawer
- **File:** `_components/editor/version-history-drawer.tsx`
- **Trigger:** History button in toolbar; mounted via `right-panel-slot.tsx` when `historyOpen`.
- **Width:** same w-60 as MetadataPanel.
- **Sections:**
  - Header: "Version history" + close (×).
  - List of up to 50 snapshots (newest first). Per row: date line ("Today 2:14 PM") + word count line.
  - Free-tier upsell card (when `PREMIUM_REQUIRED:version_history`).
  - Empty state ("No snapshots yet…").
  - Loading state.
- **Premium-gated.**

### 3.4 Snapshot preview banner
- **File:** `_components/editor/preview-banner.tsx`
- **Trigger:** clicking a snapshot row in the drawer.
- **Layout:** thin banner at top of editor pane: `[History icon] Previewing version from {date} · read-only` + `[Restore this version]` + `[Back to current]`.
- **Editor behavior while banner is up:** read-only, autosave gated.

### 3.5 Find & Replace overlay
- **File:** `_components/editor/find-replace.tsx`
- **Trigger:** Cmd/Ctrl+F or Find button in toolbar.
- **Layout:** thin bar between toolbar and editor body. Input + Prev / Next / Replace toggle / Replace / Replace all / Match case / Close.
- **States:** open · closed · no-results · N-of-M-matches.

### 3.6 Writing analysis panel
- **File:** `_components/editor/writing-analysis.tsx`
- **Trigger:** BarChart3 button in toolbar.
- **Layout:** right-side overlay/panel showing readability score, sentence-length distribution, pacing, adverb count, etc.
- **States:** open · closed · loading · empty (very short prose).

### 3.7 Keyboard cheatsheet modal
- **File:** `_components/editor/keyboard-cheatsheet.tsx`
- **Trigger:** Ctrl+/ OR HelpCircle button in toolbar (dispatches `beehive:toggle-cheatsheet` custom event).
- **Layout:** centered modal, dark card with shortcut list. 9 rows: Save · Find · Bold · Italic · Underline · Undo · Redo · Esc · This help.
- **Platform-aware:** ⌘ on Mac, Ctrl elsewhere.
- **States:** open · closed.

### 3.8 Export modal
- **File:** `_components/export-modal.tsx`
- **Trigger:** Export button in toolbar.
- **Purpose:** select export format (PDF / EPUB / DOCX / etc.) and preset (from `exportPresets` table).
- **States:** open · loading presets · format selected · exporting · done · error.

### 3.9 Create Hive button + modal — **IN SCOPE**
- **Files:** `_components/create-hive-button.tsx`, `_components/create-hive-modal.tsx`
- **Purpose:** entry point from the studio to create a Hive (writing group) tied to or referencing the current book.
- **Status:** Chris confirmed in scope for this design pass. Claude Design should propose where the button lives (likely in the studio chrome — book-title area or a primary actions cluster) and how the modal styles integrate with the new system.
- **States per modal:** open · loading · validation errors · submitting · success.

### 3.10 Empty / starting states
- **Inside:** `_components/editor/chapter-editor.tsx` → `EmptyStartChapter` function.
- **Two variants:**
  - First-time empty book: "Start your first chapter" card + button.
  - Has chapters, none selected: "Select a chapter to write" + arrow toward binder.

### 3.11 Book creation wizard — **DEFERRED (Prompt 0)**
- **Files:** `_components/create-book-wizard/{index,step-one,step-two,step-three,wizard-progress}.tsx` + `_components/create-book-modal.tsx`
- **Where:** the parent `/studio` index page (book grid), not /studio/[bookId].
- **Status:** Chris will design this as a separate later pass (Prompt 0) after the editor functionality + UI is locked. NOT in scope for Prompts 1–3.

---

## Cross-cutting concerns (for ALL three Claude Design prompts to honor)

1. **Mixed palette** — cream/paper for the writing surface (editor body, FM/BM forms, outline cards, note editor); dark chrome for the rest (nav, binder, toolbar, status bar, right panel chrome).
2. **Stacked-card / paper-layer language** — components should feel like physical layers: shadows, subtle edges, "card on desk" depth. Avoid flat slabs.
3. **Brand yellow** `#FFC300` stays as primary accent (active states, badges, save indicator when unsaved).
4. **Supporting palette** — Claude Design proposes a small set of secondary colors covering: chapter status pills (5 states), binder item-type icons (~6 types), validation states (error, success, warning), premium badge.
5. **Typography** — Comfortaa for headings / brand. Geist for body. Consider a serif option (?) for prose body / cards inside writing surfaces to lean into "book feel."
6. **Light/dark editor toggle** stays — light mode is the "writing-paper" experience. The chrome stays dark regardless.
7. **Density** — current design is fairly compact (w-60 panels, 14px icons). Claude Design can recommend more breathing room if it helps the "cozy" feel without losing function.
8. **Discoverability** — every menu, overlay, and modal needs a discoverable entry point (button, icon, keyboard). a11y aria-labels already in place; redesign must preserve them.

---

## Resolved scope (Chris confirmed 2026-05-26)

1. **App nav (1.1)** — OUT OF SCOPE. Chris will redesign separately.
2. **Item type taxonomy** — no new types planned. Six types locked.
3. **Sprint timer (1.8)** — moved into the bottom status bar (1.5). Word-count cluster on the left, sprint controls on the right. Floating overlay removed.
4. **Create Hive (3.9)** — IN SCOPE. Claude Design proposes integration point in the studio chrome.
5. **Book creation wizard (3.11)** — DEFERRED to a separate Prompt 0 later. Not in this three-prompt sequence.

---

## Next step

Inventory locked. Write Claude Design Prompt 1 brief next: the Studio Shell (sections 1.2–1.7 + 3.9 Create Hive integration). Polished standalone document — current screenshots, current behavior per surface, brand direction, deliverables expected, edge cases / states / modifier conditions, premium-gated affordances.

Prompts 2 and 3 follow after Prompt 1 ships and lands.
