# Book Editor — Design Spec
_Date: 2026-05-12_

## Overview

Phase 3 of Beehive Studio: the core writing experience. A three-panel editor layout — binder tree on the left, TipTap rich-text editor in the center, chapter metadata panel on the right. All server actions are already implemented (Phase 2); this phase is UI only.

---

## Layout

Three fixed panels inside `app/[locale]/(app)/studio/[bookId]/`:

| Panel | Width | Always visible |
|---|---|---|
| Binder (left) | ~240px | Yes |
| Editor (center) | Flex 1 | Yes |
| Metadata (right) | ~240px | Only when a chapter-type item is active |

The metadata panel renders nothing (or a muted placeholder) when no chapter is selected or a non-chapter item (research note, etc.) is active.

---

## File Structure

```
app/[locale]/(app)/studio/[bookId]/
  page.tsx                          # Server component — fetches binder tree + book, renders shell
  _components/
    book-editor-provider.tsx        # Client context — owns all shared state + auto-save
    binder/
      binder-tree.tsx               # Full binder sidebar: tree + header + add button
      binder-item.tsx               # Single row — icon, title, ⋯ menu, drag handle
      binder-item-menu.tsx          # Popover menu (rename, add below, delete)
      binder-add-menu.tsx           # Top-level add menu (Part, Chapter, Folder…)
    editor/
      chapter-editor.tsx            # TipTap instance + fixed toolbar + empty state
      editor-toolbar.tsx            # Bold, italic, headings, lists, blockquote, undo/redo
    metadata/
      metadata-panel.tsx            # Right panel shell
      status-selector.tsx           # IDEA → OUTLINE → FIRST_DRAFT → REVISED → FINAL pills
      chapter-notes.tsx             # Debounced textarea for author notes
```

---

## Component Architecture

### `page.tsx` — Server Component

Calls `getBinderTreeAction(bookId)` and `getBookAction(bookId)` in parallel. On failure from either, calls `notFound()`. Passes results as props to `BookEditorProvider`. Renders the three-panel shell with `<BinderTree>`, `<ChapterEditor>`, and `<MetadataPanel>` as children.

### `BookEditorProvider` — Client Context

`'use client'`. Wraps the editor page. Owns:

| State | Type | Description |
|---|---|---|
| `binderItems` | `BinderItemRow[]` | Flat list; tree derived via memo |
| `activeChapterId` | `string \| null` | Which chapter is open |
| `chapterCache` | `Map<string, ChapterData>` | Avoids re-fetching visited chapters |
| `saveStatus` | `'saved' \| 'saving' \| 'unsaved'` | Shown in toolbar |

Context value exposes: `binderItems`, `activeChapterId`, `setActiveChapterId`, `saveStatus`, `activeChapter` (derived from cache), plus mutation helpers: `addItem`, `renameItem`, `removeItem`, `reorderItems`.

---

## Data Flow

### Loading a Chapter

1. User clicks a chapter row → `setActiveChapterId(id)`.
2. Provider checks `chapterCache`. If hit: renders instantly.
3. If miss: calls `getChapterAction(chapterId)`, stores in cache, sets as active.
4. Editor shows a skeleton while loading.

### Auto-save

1. TipTap `onUpdate` fires on every keystroke → sets `saveStatus = 'unsaved'`.
2. Provider debounces 2 seconds.
3. After 2s idle: sets `saveStatus = 'saving'`, calls `saveChapterAction(chapterId, content)`.
4. On success: sets `saveStatus = 'saved'`, updates `wordCount` in cache from response.
5. On failure: shows red toast "Couldn't save. Retrying…". Next keystroke triggers another attempt.

The server action handles word count extraction and snapshot throttling (60s, premium only).

### Binder Mutations (Optimistic)

All binder actions (create, rename, delete, reorder) update `binderItems` in state immediately, then call the server action. On server error: roll back state update, show toast error.

### Drag-and-Drop Reordering

Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Items are sortable within their parent scope (chapters within a part; parts and root-level items at root). On drop: provider recalculates `order` values and calls `reorderBinderItemsAction`. Drag handle (`⠿` grip icon) appears on hover alongside the `⋯` menu.

---

## Binder Tree

### Tree Derivation

The flat `binderItems` array is memoized into a tree: root items (no `parentId`) sorted by `order`, each with a `children` array sorted the same way.

### Item Types

| Type | Icon | Behaviour |
|---|---|---|
| `part` | `▸ / ▾` chevron | Collapsible. ⋯ menu: Add Chapter, Rename, Delete |
| `chapter` | `📄` | Click to open in TipTap editor. Active chapter highlighted brand yellow |
| `front_matter` / `back_matter` | `📄` | Same as chapter |
| `research_folder` | `📁` | Collapsible. ⋯ menu: Add Note / Character / Outline, Rename, Delete |
| `research_note` / `character` / `outline` | `📝 / 👤 / 📋` | Click opens a plain `<textarea>` in the editor pane (no TipTap). Auto-saves via `updateBinderItemAction` on 2s debounce |

### ⋯ Menu Actions

- **Part:** Add Chapter, Rename, Delete _(confirmation required if has children)_
- **Chapter / front_matter / back_matter:** Rename, Delete _(confirmation required)_
- **Research folder:** Add Note, Add Character, Add Outline, Rename, Delete _(confirmation required if has children)_
- **Research note / character / outline:** Rename, Delete _(confirmation required)_

### Top-Level + Button

Sits in the binder header. Opens a small menu: Add Part, Add Chapter (root level), Add Research Folder.

### Inline Rename

Clicking Rename in the ⋯ menu replaces the title text with a focused `<input>`. Enter or blur confirms (calls `updateBinderItemAction`). Escape cancels and restores original title.

### Delete Confirmation

Clicking Delete in the ⋯ menu transforms the menu item into an inline confirmation: "Delete?" with **Yes** and **Cancel** buttons inside the same popover. No separate modal. Clicking Yes calls `deleteBinderItemAction`. Clicking Cancel or pressing Escape dismisses without action.

---

## TipTap Editor

### Setup

`useEditor` with `StarterKit` + `Placeholder`. Receives initial content from `chapterCache` as TipTap JSON. Uses `key={activeChapterId}` to destroy and recreate the editor on chapter switch, preventing stale content.

### Fixed Toolbar

Always visible above the editor. Button groups:

| Group | Buttons |
|---|---|
| Inline | Bold, Italic, Strikethrough |
| Block | H1, H2, H3 |
| Lists | Bullet list, Ordered list |
| Other | Blockquote, Horizontal rule |
| History | Undo, Redo |

Active format at cursor: button gets brand yellow background. Right edge of toolbar: save status indicator + word count.

### Save Status Indicator

`● Saved` (grey) / `○ Saving…` (animated pulse) / `● Unsaved` (yellow). Updates from `saveStatus` in context.

### Empty State

When `activeChapterId` is null: editor pane shows centred muted text — "Select a chapter from the binder to start writing." Toolbar is not rendered.

### Research Items

When a non-chapter binder item is active, the TipTap editor is replaced with a plain `<textarea>` (no toolbar). Auto-saves via `updateBinderItemAction` on the same 2-second debounce.

---

## Metadata Panel

Renders only when a chapter-type item (`chapter`, `front_matter`, `back_matter`) is active. Otherwise shows a muted placeholder: "Select a chapter to see details."

### Contents (top to bottom)

1. **Chapter title** — inline editable. Click to edit, blur/Enter saves via `updateBinderItemAction`.
2. **Status selector** — five pill buttons: `Idea · Outline · First Draft · Revised · Final`. Active pill: brand yellow fill. Click calls `updateChapterStatusAction`.
3. **Word count** — `1,204 words`. Synced from last save response.
4. **Author notes** — full-height `<textarea>`. Placeholder: "Private notes — only you can see these." Saves on 2s debounce via `updateChapterNotesAction`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Chapter save failure | Red toast bottom-right: "Couldn't save. Retrying…". Editor stays usable; next keystroke triggers retry. |
| Binder mutation failure | Optimistic update rolled back. Toast: "Couldn't [action]. Please try again." |
| Chapter load failure | Inline error in editor pane with a Retry button. |
| Research note save failure | Same toast pattern as chapter save. |

---

## Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop reordering (new, to be installed)
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` — already installed

---

## Out of Scope

- Version history / snapshot restore UI (Phase 5 — premium feature)
- Publishing metadata editor (Phase 5)
- Collaborative editing (not planned)
- Mobile layout (desktop-first for now)
- Keyboard shortcuts beyond TipTap defaults
