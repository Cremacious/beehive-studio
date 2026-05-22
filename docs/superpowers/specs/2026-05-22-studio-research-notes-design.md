# Studio Editor — Research Notes UX

**Date:** 2026-05-22
**Sub-project:** 3, Feature D (of 3 in SP3 Specialized Editors)
**Status:** Approved — ready for implementation plan

## Context

`research_note` items currently render the plain textarea fallback in
the editor pane — the same scratchpad behavior as
`research_folder`. User feedback from earlier testing: "notes have no
features that make it different than a chapter." Notes today are
indistinguishable from a chapter in either the binder display or the
editor surface, despite serving a fundamentally different purpose
(personal scratchpad, never exported, lives in the Research half of
the binder).

This is the final feature of SP3. After it ships, the audit moves on
to SP4 (Toolbar + modes).

## Goal

Make research notes visibly and functionally different from chapters —
without overbuilding into a full note-app. Three light affordances
(pin, color, favorite) plus a focused editor (stripped TipTap toolbar)
deliver the differentiation. Cross-note search and other heavier note-
app features stay out of scope.

## In Scope

### 1. Render-path branching

In `chapter-editor.tsx`, add a branch alongside the existing outline
and character branches:

```ts
if (activeItem.type === 'research_note') {
  return <NoteEditor item={activeItem} />
}
```

`NoteEditor` is a new component dedicated to research-note display +
editing.

### 2. Data shape on `binderItems.content` (jsonb)

```ts
export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple'

export type ResearchNoteContent = {
  text: unknown               // TipTap doc JSON
  pinned?: boolean
  color?: NoteColor | null
  favorited?: boolean
}
```

`binderItems.content` is already `jsonb` — **no DB migration**.

**Legacy handling.** Existing research_note rows have
`content: "plain text string"` (the old textarea fallback wrote
strings). On every read, run through a pure normalizer:

```ts
export function normalizeNoteContent(raw: unknown): ResearchNoteContent
```

Behavior:
- `raw === null || raw === undefined` → returns
  `{ text: emptyDoc(), pinned: false, color: null, favorited: false }`
- `typeof raw === 'string'` → returns `{ text: <tiptap doc with one
  paragraph wrapping the string>, pinned: false, color: null,
  favorited: false }`
- `typeof raw === 'object'` with a `text` field → returns the
  fully-defaulted object (missing optionals filled in with safe
  defaults)

The normalizer is a pure function and lives in
`lib/notes/note-content.ts`. Vitest tests cover each input case.

On first save after a legacy load, the normalized object replaces the
string in the DB — no batch migration, no script needed.

### 3. The NoteEditor component

`app/[locale]/(app)/studio/[bookId]/_components/notes/note-editor.tsx`

Layout (top to bottom):

**Header bar:**
- Note title — already rendered by SP2's double-click rename pattern;
  the existing `<h2>` from the textarea fallback moves into the new
  header. (The binder owns title rename; the editor just displays it.)
- Right side: 📌 Pin toggle · 🎨 Color picker · ⭐ Favorite toggle ·
  `SaveStatusBadge`

**Mini toolbar (below the header):**
- Bold · Italic · Bullet list · Numbered list

Four buttons total. NOT the existing `EditorToolbar` — a new
`<NoteToolbar>` component (separation matches the SP3 pattern; the
chapter toolbar is overweight for notes).

Headings, blockquote, link, align, find, etc. are not exposed —
keyboard shortcuts for them (Mod-B, Mod-I etc.) still work because the
StarterKit extensions are still loaded, but they aren't visible in
the toolbar. This avoids accidental document-like formatting in
scratchpad content.

**TipTap editor:**
- Same extensions as chapters MINUS the toolbar exposes
- `autofocus: 'end'` and the same `requestAnimationFrame`-deferred
  focus pattern from SP1 (`editor.isDestroyed` guard required for
  React 19 strict-mode — see existing chapter-editor.tsx pattern)
- Brand-yellow caret via existing `.ProseMirror { caret-color }` rule
- Save: same 2-second debounce as FM/BM forms, writing the whole
  `ResearchNoteContent` object via `updateBinderItemAction`

### 4. Pin / Color / Favorite controls

**Pin (📌):** Boolean toggle. Saved as `content.pinned`. Affects
binder sort order (§5).

**Color (🎨):** Popover with 5 swatches + a "Clear" option. Selected
color is rendered as a tiny dot in the binder row's icon position
(§6) AND as a small dot next to the 🎨 button in the editor header.
The note's editor body background does NOT change — only the
indicator dots.

The 5 colors are CSS custom properties or Tailwind tokens. Suggested
values (define once in a shared module
`lib/notes/note-colors.ts`):

| Color | Hex |
|---|---|
| yellow | `#FFC300` (brand) |
| blue | `#6BB6FF` |
| green | `#7CD994` |
| pink | `#FF9FBB` |
| purple | `#C99FFF` |

**Favorite (⭐):** Boolean toggle. Shown as a tiny ⭐ in the binder row
when set.

All three controls save via the same debounced
`updateBinderItemAction` path. The toggle/popover is optimistic —
local state updates instantly, server save happens async.

### 5. Binder sort — pinned floats to top

Currently `binder-tree.tsx`'s `buildTree` sorts children by `order`.
Modify it to add a **stable pin-priority pass**: within each parent
group, pinned items come first (preserving their `order` for
tie-breaking), then unpinned items.

A generic helper at the top of `binder-tree.tsx`:

```ts
function isItemPinned(item: BinderItemRow): boolean {
  const c = item.content
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false
  return (c as { pinned?: boolean }).pinned === true
}
```

The sort becomes:
```ts
nodes.sort((a, b) => {
  const aPin = isItemPinned(a) ? 1 : 0
  const bPin = isItemPinned(b) ? 1 : 0
  if (aPin !== bPin) return bPin - aPin   // pinned first
  return a.order - b.order
})
```

This change only affects items whose `content.pinned` is `true` —
chapters and everything else are unaffected because their content
shape doesn't have a `pinned` field (or `content` is null).

### 6. Binder row display for research notes

The existing `BinderItem` component renders an icon, title, and
sometimes a drag handle / context menu. For a research_note item with
non-default attributes, augment the row:

- If `content.color` is set → render a **6px colored dot** before the
  title, replacing the `📝` icon slot. Background uses the color from
  the palette in §4.
- If `content.color` is NOT set → keep the default `📝` icon.
- If `content.pinned` is true → render a tiny 📌 at the far right of
  the row, after the existing context-menu button.
- If `content.favorited` is true → render a tiny ⭐ at the far right
  of the row.

All of these new icons are 10–12px, muted color, low-emphasis. The
title remains the primary content.

`BinderItem` reads `node.content` to determine these. The same
helpers from `lib/notes/note-content.ts` (specifically the
`normalizeNoteContent` and individual field accessors) can be used to
avoid scattered null checks.

### 7. Save status indicator

Reuse the `SaveStatusBadge` component from Feature B. Place it in the
note editor's header bar (top-right, after the attribute controls).
Status flips via the same pattern as FM/BM forms.

## Out of Scope

- Cross-note search ("find all notes containing X") — SP6 territory.
- Note templates (preset starter content for "World-building note",
  "Character beat", etc.).
- Drag a note into a chapter to insert a reference / quote.
- Color-themed editor background (palette swatches only show as dots
  in the binder + editor header; the editor body keeps the default
  dark background — light-mode is SP4 territory anyway).
- A "favorites" sidebar listing all favorited notes across the book.
- Note tags beyond the 5 color values.
- Pin sort priority across DIFFERENT parents (a pinned chapter in
  one folder doesn't outrank an unpinned chapter in a sibling
  folder — pin is local to its parent group).
- Migration script for legacy string content. The on-read normalizer
  + on-write replacement covers it without a batch job.
- Mobile / touch behavior — SP6.

## Testing

### Automated (Vitest)

New unit tests in `__tests__/notes/note-content.test.ts` for
`normalizeNoteContent`:

- `null` → defaulted object
- `undefined` → defaulted object
- `"plain string"` → object whose `text` is a TipTap doc containing
  that string in one paragraph
- `""` (empty string) → empty paragraph in `text`, defaults for the
  rest
- `{ text: <doc>, pinned: true }` → object with all four fields
  present (pinned: true, color: null, favorited: false)
- `{ text: <doc>, pinned: true, color: 'blue', favorited: true }` →
  passes through unchanged
- `{ text: <doc>, color: 'invalid' }` → color falls back to `null`
  (only allow palette values)
- Snapshot the empty-paragraph doc shape so the test is explicit
  about what "empty TipTap doc" means in this codebase.

### Manual checklist

1. Create a research note via `+ Add → Research → Research note`. The
   editor pane shows the new NoteEditor (not the textarea fallback) —
   header with pin/color/favorite + SaveStatusBadge, mini toolbar
   below with B / I / UL / OL only.
2. Type some text, wait — SaveStatusBadge cycles Unsaved → Saving →
   Saved.
3. Reload the page. Text persists, attributes still default.
4. Click 📌 Pin → button highlights brand-yellow. Reload — the note
   floats to the top of its parent (Research folder) in the binder.
5. Click 🎨 → popover with 5 swatches + Clear. Pick blue. Header dot
   turns blue; binder row's icon slot shows a blue dot replacing 📝.
6. Click ⭐ Favorite → ⭐ appears at the far right of the binder row.
7. Pick another research note that was created BEFORE this feature
   (legacy with string content). It should open in the new editor
   with the original text intact in TipTap. Edit + save → DB now
   stores the normalized object shape (verify via dev tools network
   tab if curious).
8. Open a chapter, an outline, a front-matter — all unchanged
   behavior. Pin sort doesn't affect them (because their content
   doesn't have a `pinned` field).
9. `npm test` — passes (existing 104 + new normalizer tests).
10. `npx tsc --noEmit` — clean.

## Risks

- The 5-color palette uses specific hex values; they need to match
  the existing brand-yellow `#FFC300`. The other four are picked for
  legibility on the dark `#141414` background. Verify visually after
  shipping; tweak if any read as "too close" to brand or
  destructive.
- `BinderItem` already has a lot of conditional rendering. Adding
  3 more conditions (color dot, pin icon, favorite icon) for one
  item type (`research_note`) risks bloating it. Mitigation: pull the
  research-note row decorations into a small `<NoteRowDecorations>`
  subcomponent inside `binder-item.tsx`.
- The pin sort touches `binder-tree.tsx`'s build function, which
  affects every item type. The `isItemPinned` helper makes the
  short-circuit explicit (returns false for non-object content), but
  it's still a global behavior change. Test: confirm chapters /
  parts / outlines / etc. binders still order correctly after the
  change.
- Color popover positioning may collide with the toolbar if the
  editor pane is narrow. Use Radix Popover (already a dep via
  shadcn) so positioning is handled correctly.

## Definition of Done

- New research notes open in the NoteEditor; legacy research notes
  open in the NoteEditor with text intact.
- All 10 manual checklist items pass.
- `npm test` clean (~108 tests with the normalizer additions).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here block reflects SP3 COMPLETE (all three
  features), points to SP4 (Toolbar + modes) as next.
