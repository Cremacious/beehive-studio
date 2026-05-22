# Studio Editor — Binder UX

**Date:** 2026-05-22
**Sub-project:** 2 of 5 (Studio Editor Audit)
**Status:** Draft from /design-critique findings — re-confirm via /brainstorming before implementation

## Context

After the Stability Pass (sub-project 1), the editor is safe to use but
not friendly to use. The binder panel (left sidebar) is the user's
primary navigation surface — yet its most common actions (rename a
chapter, create a new chapter, name a chapter you just created) are
hidden behind hover-only affordances or absent entirely.

This spec captures the binder-side outcomes from the 2026-05-22 design
critique. The user wants the create-book-to-first-keystroke flow to
take under 10 seconds and feel obvious.

## Goal

Make the binder's three primary user intentions — **find what I'm
writing, name it what I want, create more of it** — visible and reachable
without hovering, clicking ⋯ menus, or guessing.

## In Scope

### 1. Double-click chapter title to rename

**Current:** Rename requires hovering a row to reveal the `⋯` icon,
clicking it, then clicking "Rename" in a dropdown. Three discoverability
hops.

**Fix:** Double-click on the chapter title text in the binder enters
inline rename mode (same UI as today, just triggered differently). The
existing `⋯` → Rename path stays for menu-driven users.

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`

Add `onDoubleClick={() => setIsRenaming(true)}` to the title span
(line ~126).

### 2. Persistent "+ New Chapter" CTA in the binder

**Current:** The only "add" affordance is a small `+` icon in the binder
header (the `BinderAddMenu` dropdown). Easy to miss. Once the binder has
chapters, there is no obvious way to add another *at the bottom*.

**Fix:** Add a persistent footer button in the binder sidebar:
**`+ New Chapter`**. Full-width, brand-color text, sits below the tree.
Clicks create a new chapter at the end of the binder and immediately
enter rename mode on the new item.

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`

Insert a `<button>` below the scrollable tree (after line ~184), wired to
`createBinderItemAction({ bookId, type: 'chapter', title: 'Untitled
Chapter', order: <next> })`. On success, dispatch
`setActiveItemId(newItem.id)` and set the new item into rename mode (will
require lifting `isRenaming` state into the provider or using a
`pendingRenameId` flag).

### 3. New books land on an empty binder with a "Start your first chapter" CTA

**Current:** The create-book wizard auto-creates a `Chapter 1` binder
item (and underlying `chapter` row). User has no input on the name.

**Fix:**
- Stop auto-creating Chapter 1 in `createBookAction` (or in whichever
  server action handles wizard completion — confirm location during
  implementation).
- New books now load into the editor with zero binder items.
- The editor pane (`CorkboardOrEditor` → `ChapterEditor`) currently shows
  "Select a chapter from the binder to start writing." Replace that
  empty state with a richer one:
  - Large headline: **"Start your first chapter"**
  - Subtext: "Name it what you like — you can rename anytime."
  - Inline input + `Begin →` button. Submitting creates the chapter,
    opens it, drops the cursor in the editor.

**Files:**
- `lib/actions/book.actions.ts` — `createBookAction`: remove the
  auto-Chapter-1 insert if present
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
  — replace the `activeItemId === null` empty state with the new CTA

### 4. Book-level title rename from the binder header

**Current:** The binder header shows the book title as static
brand-yellow text. No way to rename the book from the studio surface
(must go back to the dashboard).

**Fix:** Double-click the book title in the binder header enters inline
rename. Persists via `updateBookAction({ title })`.

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`
(header section, around line ~150-154)

### 5. Brand color discipline

**Current:** Brand yellow (`#FFC300`) is used on three competing
surfaces: book title in binder header, active chapter row in tree, status
pills in metadata panel.

**Fix:** In the binder specifically:
- Demote the book title from `text-brand` to `text-foreground`, prefixed
  with a small brand-yellow `✦` (or similar) icon.
- Keep the active chapter row's brand-yellow background — that's the
  user's "you are here" anchor.

(Metadata panel brand-yellow stays in scope for sub-project 4.)

### 6. Binder-add menu: clearer types, grouping, and "Part" → "Collection" rename

**Current:** The `BinderAddMenu` dropdown lists eight item types
(`part`, `chapter`, `front_matter`, `back_matter`, `research_folder`,
`research_note`, `character`, `outline`) as bare labels with no
descriptions and no grouping. First-time users have no idea what most of
them mean or why they'd pick one over another. User feedback 2026-05-22:
"it's not clear what creating a 'part' means and what a research folder
is."

**Fix:**

**6a. Group the menu into two sections** — manuscript items (what gets
exported into the book) and research items (private, never exported):

```
── Manuscript ──
📄 Chapter              The actual prose. Opens in the editor.
📖 Collection           A group of chapters (e.g., "Part One").
📑 Front matter         Title page, dedication, copyright.
📑 Back matter          Acknowledgments, about the author.

── Research (private, not exported) ──
📁 Research folder      Container for your reference materials.
📝 Research note        Freeform notes — world-building, ideas, scraps.
👤 Character profile    Name, traits, backstory for one character.
📋 Outline              Outline of a chapter or arc.
```

Use a styled section header in the dropdown (`<DropdownMenuLabel>` or a
plain styled span) — not a separator. The one-line subtitle under each
option teaches as the user reads.

**6b. Rename "Part" → "Collection" (display-only).** "Part" is correct
Scrivener vocabulary but reads as ambiguous to non-Scrivener users
("part of what?"). "Collection" is plain English and aligns with the
beehive theme (a collection of related chapters, like cells in a hive).

**Implementation: display-only rename.** The DB type enum value stays
`'part'` — no migration, no Zod schema change. The change is purely
the user-facing label and icon:
- Wherever `'Part'` or `Add Part` is displayed in the UI (binder add
  menu, binder item menu's "Add Part" option, item-create modals, etc.),
  swap to `'Collection'` / `'Add Collection'`.
- Internal type identifier in code and DB remains `part`. This decouples
  data shape from naming and avoids a needless migration risk.

**Files:**
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`
  (the `ICONS` map — pick a `Collection`-appropriate icon)
- Any other files that hard-code the user-facing string `'Part'`.

### 7. "Add to Collection…" submenu on chapter items

**Current:** Moving a chapter under a Collection requires drag-drop in
the binder tree, which is finicky (especially into a collapsed
Collection).

**Fix:** Extend the chapter row's `⋯` context menu (in
`binder-item-menu.tsx`) with an "Add to Collection…" submenu listing
every existing Collection (and a "(Root level)" entry for un-nesting).
Selecting one updates the chapter's `parentId` via
`updateBinderItemAction`.

### 8. Friendlier label on the Research section header

**Current:** "Research (private — not exported)" reads as technical jargon.

**Fix:** Reword to **"Research (only you can see these)"** in
`binder-add-menu.tsx`.

### 9. Character profile: clearer title edit

**Current:** The character name in `CharacterProfile` is editable but the
affordance is unclear. User reports difficulty.

**Fix:** Match the same double-click-to-rename pattern from Task 1/2.
Single-click reveals subtle hover styling, double-click enters inline
rename. (Implementation depends on reading `CharacterProfile`'s current
markup — small surgical change.)

### 10. Create Hive explainer

**Current:** The "Create Hive" button in the binder sidebar appears with
no explanation. Users have no idea what a Hive is.

**Fix:** Add a short subtitle below the button: *"Invite readers to give
feedback on your drafts."* Plus a tooltip on hover.

## Out of Scope

- Drag-drop edge cases (dropping into collapsed folders, type
  promotion/demotion). Defer to a later iteration of this sub-project if
  needed — they're real but not blockers.
- Toolbar redesign → sub-project 3
- Light mode → sub-project 3
- Mobile/responsive → sub-project 5

## Testing

Primarily manual.

- Open a freshly created book → land on the empty-state "Start your
  first chapter" CTA → name it `My First Chapter` → submit → chapter
  exists in binder, cursor in editor.
- Double-click a chapter title in the binder → input appears, focus is
  in the input, full title is selected → Escape cancels, Enter commits.
- Click `+ New Chapter` in the binder footer → new chapter is added at
  the end with title `Untitled Chapter` → immediately in rename mode
  (input focused).
- Double-click the book title in the binder header → input appears →
  rename to `My Renamed Book` → reload page → title persists.
- Open the binder add menu → see "Manuscript" and "Research" section
  headers with grouped items + one-line descriptions → confirm "Part"
  is now labeled "Collection" everywhere user-facing → confirm DB still
  stores `type: 'part'` (e.g., inspect a created Collection via DevTools
  Network tab).
- `npm test` passes; `npx tsc --noEmit` clean.

## Risks

- Removing auto-Chapter-1 from `createBookAction` may break code paths
  that assume every book has at least one chapter (export, reading
  progress, etc.). Audit before removing.
- Lifting `isRenaming` state into the provider (or passing a
  `pendingRenameId` through context) adds context surface. Acceptable
  trade-off for the UX improvement.

## Definition of Done

- All five fixes land.
- Manual checklist above passes.
- AGENTS.md Resume Here updated to mark sub-project 2 complete.
- ~5 atomic commits.
