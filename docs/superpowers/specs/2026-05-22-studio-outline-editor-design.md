# Studio Editor — Outline Editor (Kanban)

**Date:** 2026-05-22
**Sub-project:** 3, Feature C (of 3 in SP3 Specialized Editors)
**Status:** Approved — ready for implementation plan

## Context

When a user adds an "Outline" item via the binder's `+ Add → Research`
menu, the editor pane today falls through to the plain textarea
fallback — no structure, no special features. User feedback during
SP2 testing: "outline has no special features."

Feature C replaces that textarea with a **Kanban-style board**: the
user defines columns (e.g., "Act 1", "Act 2", "Act 3") and drags
cards between them. Each card has a title and an optional synopsis;
each card can optionally link to a chapter in the binder so clicking
the card jumps to that chapter.

This continues the **specialized binder editor pattern** established by
Feature B (Front/Back Matter), but is simpler: outlines have only one
"sub-type" (Kanban), so no picker is needed.

## Goal

Give writers a focused, visual planning surface inside the studio that
fits three-act novelists out of the box (default Act 1/2/3 columns)
while remaining flexible enough for any other structure (custom column
names, add/remove columns).

## In Scope

### 1. Render-path branching

In `chapter-editor.tsx`, add a branch at the `!isChapterType` check
that today handles `character` (CharacterProfile) and falls through to
the textarea:

```ts
if (activeItem.type === 'outline') {
  return <OutlineBoard item={activeItem} />
}
```

The `OutlineBoard` component (new) renders the Kanban UI.

### 2. Data model — `binderItems.content` (jsonb)

```ts
type OutlineContent = {
  columns: Array<{
    id: string                   // local cuid, drag-reorder key
    title: string                // user-editable, e.g. "Act 1"
    cards: Array<{
      id: string                 // local cuid, drag-reorder key
      title: string              // required, single-line
      synopsis?: string          // optional, multi-line
      linkedChapterId?: string   // optional FK to chapters.id
    }>
  }>
}
```

**No DB migration.** Reuses the same `binderItems.content` jsonb
column FM/BM uses.

**Legacy items** (`content === null` from before this feature, or
items whose old textarea content lives elsewhere): render the board
**seeded with three columns — "Act 1", "Act 2", "Act 3" — and no
cards**. No attempt to migrate prior textarea content; outlines were
effectively unusable before this feature so there's nothing real to
preserve.

`id` generation: use `@paralleldrive/cuid2` (already a project dep —
check `lib/utils` for `createId()` import). All `column.id` and
`card.id` values are client-generated cuids.

### 3. UI layout

**Board container:** `<main>` with horizontal scroll. Inside, a flex
row of column components and a trailing `+ Column` button.

**Column:**
- Header bar with column title (double-click to rename, same pattern as
  binder chapter titles) and a `⋯` menu (currently only "Delete
  column" with confirmation)
- Vertical list of cards
- `+ Add card` button at the bottom of the column

**Card:**
- Title input (single-line, click-to-edit inline)
- Synopsis area: shows 2-3 line clamp of synopsis text; clicking
  expands to a multi-line textarea
- If `linkedChapterId` is set: "→ View chapter" link below synopsis
- `⋯` menu: "Link to chapter…", "Unlink", "Delete card"

**Board header (above the column row):** outline title (already shown
by the binder; the editor pane shows just the `SaveStatusBadge`
component shipped in Feature B, top-right).

### 4. Interactions

**Add column:** click `+ Column` at far right of column row → new
empty-titled column appended → its title input is focused
(reuses the `pendingRenameId` mechanism conceptually, but locally;
no need to plumb through the provider for column-level state).

**Add card:** click `+ Add card` in a column → empty card appended →
its title input is focused.

**Rename column / card title:** double-click title → input → Enter
commits, Escape cancels.

**Edit synopsis:** click on the synopsis area → textarea appears →
blur or Escape commits.

**Delete column:** `⋯` → Delete → inline confirmation prompt ("Delete
column? Cards inside will be lost."). Yes deletes.

**Delete card:** `⋯` → Delete → no confirmation (cards are cheap to
recreate; column deletion is the destructive op).

**Drag & drop (using `@dnd-kit`):**
- Drag a card within its column → reorder within column
- Drag a card across columns → reparent + insert at drop position
- Drag a column horizontally → reorder columns

Use `DndContext` at board level with TWO `SortableContext`s nested:
the column-level context (for column reordering, horizontal strategy)
and per-column card contexts (for card reordering, vertical strategy).
Each drop commits via the same persistence path as edits (see §5).

### 5. Persistence

The whole `OutlineContent` object is written back via
`updateBinderItemAction({ content })` after edits, with a 2-second
debounce. Same pattern as FM/BM forms — including the visible
`SaveStatusBadge` ('idle' / 'unsaved' / 'saving' / 'saved').

Card edits, column edits, and drag-and-drop all go through a single
`setOutline(next)` helper that updates local state, sets `saveStatus`
to `'unsaved'`, and queues the debounced write.

### 6. Chapter linking

Card `⋯` menu → "Link to chapter…" opens a small popover listing all
binder items of type `chapter` in the current book (by title). Click
one → `card.linkedChapterId = chapter.id`. Saves via the standard
debounced path.

The card then renders a "→ View chapter" link. Clicking the link
calls `setActiveItemId(linkedChapterId)` to jump to that chapter in
the editor.

If a chapter is later deleted from the binder, its
`linkedChapterId` reference becomes a dangling ID. Render
"→ Chapter unavailable" instead of the link. **No cleanup pass** —
keeps the data model simple; the user can unlink manually.

### 7. Pure helper functions (testable)

Three pure functions live in a new `lib/outline/board.ts`:

```ts
export function seedOutline(): OutlineContent
// → { columns: [{ id, title: 'Act 1', cards: [] }, ..., 'Act 3'] }

export function moveCard(
  outline: OutlineContent,
  from: { columnId: string; cardId: string },
  to: { columnId: string; index: number },
): OutlineContent
// returns a new OutlineContent with the card relocated

export function moveColumn(
  outline: OutlineContent,
  columnId: string,
  toIndex: number,
): OutlineContent
// returns a new OutlineContent with the column relocated
```

These are pure (immutable input/output), easy to unit-test with
Vitest, and isolated from React. The board component calls them on
drag end before persisting.

## Out of Scope

- Inline rich text on cards (only plain title + plain synopsis)
- Card colors, labels, tags, due dates, assignees
- Multiple boards per outline item (one outline = one board)
- Column templates beyond the default 3-column seed (no "5-act" preset)
- Auto-import / heuristic detection of outline structure from prose
- Mobile / touch drag-and-drop — falls out of SP6 (responsive)
- Light-mode theming — falls out of SP4
- Linking from a chapter back to its outline card (reverse link)
- Card archive / "completed" state

## Testing

### Automated (Vitest)

A new `__tests__/outline/board.test.ts` covering the three pure
helpers:
- `seedOutline()` returns 3 columns titled "Act 1", "Act 2", "Act 3",
  each with empty `cards: []`.
- `moveCard` within a column: card relocated, others unchanged.
- `moveCard` across columns: card removed from source, inserted at
  target index in destination.
- `moveCard` with invalid IDs: returns input unchanged (no throw).
- `moveColumn` reorders columns, cards inside each column preserved.

### Manual checklist

1. Create an Outline item via `+ Add → Research → Outline`. Editor
   pane shows a board with three columns (Act 1, Act 2, Act 3), each
   empty.
2. Click `+ Add card` in Act 1 → empty card appended, title input
   focused. Type "Opening scene", Enter → committed.
3. Click the synopsis area of that card → textarea expands. Type a
   few sentences, Escape → committed. `SaveStatusBadge` flips
   Unsaved → Saving → Saved.
4. Reload the page. Card + synopsis persist.
5. Drag the card from Act 1 to Act 3 → lands at Act 3. Reload →
   still in Act 3.
6. Drag Act 3 to leftmost position → columns reorder. Reload →
   still reordered.
7. Click `+ Column` → empty column appended → title input focused.
   Type "Epilogue", Enter → committed.
8. Card `⋯` → "Link to chapter…" → popover lists chapters → pick
   one → "→ View chapter" link appears on the card.
9. Click "→ View chapter" → editor switches to that chapter.
10. Card `⋯` → "Delete card" → card removed (no prompt).
11. Column `⋯` → "Delete column" → confirmation prompt → confirm →
    column + its cards removed.
12. Delete a chapter that was linked. Re-open the outline → linked
    card now shows "→ Chapter unavailable".
13. `npm test` passes (existing 92 + new board helper tests).
14. `npx tsc --noEmit` clean.

## Risks

- The `OutlineContent` shape is local-only — `card.id` and
  `column.id` are client cuids, never persisted as DB foreign keys.
  `linkedChapterId` IS a DB chapter ID. The split is deliberate but
  must be kept clear in implementation. Don't confuse the two.
- `@dnd-kit` nested contexts (columns within board + cards within
  column) can interfere with each other if not configured carefully.
  Use distinct sensor activation distances and explicit collision
  detection strategies for each context.
- A user with hundreds of cards may hit perf issues from re-rendering
  the whole board on every edit. For MVP, accept this. Add
  memoization in SP6 if profiling shows it matters.
- The `setActiveItemId(linkedChapterId)` jump assumes the chapter
  binder item is still in `binderItems`. If not (deletion), the
  binder won't show selection; the editor pane will show its empty
  state. Acceptable degradation.

## Definition of Done

- A new Outline item opens directly into the Kanban board with three
  seeded columns and no picker.
- All 12 manual checklist items pass.
- `npm test` clean (with new board helper tests added).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here block reflects Feature C complete, points to
  Feature D (Research notes) as next.
