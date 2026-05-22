# Studio Editor — Front/Back Matter Built-In Tools

**Date:** 2026-05-22
**Sub-project:** 3, Feature B (of 3 in SP3 Specialized Editors)
**Status:** Approved — ready for implementation plan

## Context

When a user adds a "Front matter" or "Back matter" item via the binder's
`+ Add` menu, the editor pane currently opens the same generic TipTap
editor used for chapters. There is no template, no structured fields,
and no guidance about what these pages should contain.

In conventional publishing, front matter (title page, copyright,
dedication, etc.) and back matter (acknowledgments, about the author)
have well-defined structure that a form gets right and free prose
struggles with — copyright symbols, ISBN formatting, centered title
hierarchy, attribution links. Users adding these items expect more
than a blank editor.

This spec defines the **specialized binder editor pattern** that Front
Matter and Back Matter will use. The same pattern will be applied in
the two following features of SP3: Outline editor (Feature C) and
Research notes UX (Feature D).

## Goal

Make Front Matter and Back Matter items materially different from a
generic chapter — with sub-type-specific forms that capture the right
fields and a dedicated template per sub-type that renders correctly on
export — without requiring a DB migration.

## In Scope

### 1. The specialized binder editor pattern

A `front_matter` or `back_matter` binder item carries a **sub-type** in
its `binderItems.content` jsonb column. The chapter-editor's render
path branches on `item.type === 'front_matter' || item.type === 'back_matter'`:

- **If sub-type is one of the M2 specialized values (see §3):** render
  the dedicated form component for that sub-type. Form data lives in
  `binderItems.content.fields`. The auto-created chapter row (from
  SP2 Task 4) is unused for these items.
- **If sub-type is `'custom'` or absent (legacy items created before
  this feature):** render today's TipTap editor on
  `chapters.content`. No changes from current behavior.

`binderItems.content` shape:

```ts
type FrontBackMatterContent = {
  subtype:
    | 'title_page'      // front
    | 'copyright'       // front
    | 'dedication'      // front
    | 'acknowledgments' // back
    | 'about_author'    // back
    | 'custom'          // either
    | null              // unset — picker is shown
  fields?: Record<string, unknown>  // shape depends on subtype, see §3
}
```

A `null` subtype represents a freshly-created item that hasn't yet
picked a sub-type — the editor pane shows the picker (§2) instead of
a form.

**Legacy disambiguation.** Front/back matter items created before this
feature ships have `binderItems.content === null` (no object at all).
A new item created by this feature's flow has `binderItems.content =
{ subtype: null, fields: {} }` (object exists, subtype not yet picked).
The render path distinguishes:

- `content === null` → **legacy item.** Skip the picker; render the
  TipTap editor on `chapters.content` (preserves any prose the user
  has already written).
- `content && content.subtype === null` → **new item, picker needed.**
- `content && content.subtype === 'custom'` → render TipTap.
- `content && content.subtype === <specialized>` → render that form.

New items created by `BinderAddMenu` for type `front_matter` or
`back_matter` must initialize `binderItems.content = { subtype: null,
fields: {} }` so the renderer can tell new from legacy.

**No DB migration is required.** `binderItems.content` is already a
`jsonb` column.

### 2. Creation flow (sub-type picker)

When a user clicks `+ Add → Front matter` (or Back matter), the existing
flow creates a binder item, opens it in the editor, and enters rename
mode. **No change to the creation server action.** The user names the
item, then the editor pane renders:

```
What kind of front matter is this?

┌─────────────────────────────────────────────────────────────┐
│ Title Page       Book title, author, publisher              │
│ Copyright        Copyright year, publisher, ISBN            │
│ Dedication       "For my wife"                              │
│ Custom           Free-form prose                            │
└─────────────────────────────────────────────────────────────┘
```

(Back matter picker shows Acknowledgments / About the Author / Custom.)

Each row is a button; clicking sets `binderItems.content.subtype` via
`updateBinderItemAction` and re-renders the editor pane with the
appropriate form.

Sub-type is **locked once chosen**. To change, the user deletes the
item and creates a new one. (Rationale: avoids the data-migration
complexity of transferring fields between incompatible schemas.)

### 3. The 5 specialized forms

Each form is a focused React component. All fields persist via the
existing `updateBinderItemAction({ content })` flow (the same path the
TipTap editor uses for chapter saves). Auto-save with the same 2-second
debounce. No schema or DB changes beyond what's already in place.

**`Title Page`** (`subtype: 'title_page'`)
- `bookTitle: string` — defaults to `books.title`
- `subtitle?: string`
- `authorName: string` — defaults to `userProfiles.displayName`
- `publisherName?: string`

**`Copyright`** (`subtype: 'copyright'`)
- `copyrightYear: number` — defaults to current year
- `copyrightHolder: string` — defaults to authorName from a Title Page
  item if present, otherwise `userProfiles.displayName`
- `publisherName?: string`
- `isbn?: string`
- `extraNotice?: string` — multi-line ("All rights reserved", etc.)

**`Dedication`** (`subtype: 'dedication'`)
- `text: string` — single multi-paragraph textarea, max ~500 chars

**`Acknowledgments`** (`subtype: 'acknowledgments'`)
- `text: string` — multi-paragraph textarea, no length limit

**`About the Author`** (`subtype: 'about_author'`)
- `bio: string` — multi-paragraph textarea
- `photoUrl?: string` — reuses the existing Cloudinary image-upload
  widget (no new infrastructure)
- `links?: Array<{ label: string; url: string }>` — array of label+url
  pairs (website, twitter, etc.), with add/remove rows

**`Custom`** (`subtype: 'custom'`) — front OR back
- No fields. The editor pane renders the existing TipTap editor on
  `chapters.content`. This is the behavior every front/back matter
  item has today; nothing changes for legacy items.

Defaults pull from `books.title` and `userProfiles.displayName` on
first form render so the user starts with sensible values, not blanks.

### 4. Export integration

The existing export route (`app/api/export/[bookId]/[format]/route.ts`)
iterates binder items and renders chapters via `chapter.content` (TipTap
JSON). This task adds a branch:

- If `item.type` is `front_matter` or `back_matter` AND
  `binderItems.content.subtype` is one of the specialized values:
  render from `binderItems.content.fields` using a fixed template per
  sub-type. Each sub-type has one template for docx and one for epub.
- Otherwise: render `chapter.content` as today.

Template functions are pure (`fields → docx XML` or `fields → HTML`),
testable in isolation. Estimated ~15 lines per template per format.
Total: 5 sub-types × 2 formats = 10 small functions.

`bookPublishingMetadata` is **untouched**. It continues to provide
book-file fields (trim size, edition) to the export route. FM/BM items
and `bookPublishingMetadata` are deliberately decoupled — keeps the
model simple. The metadata table's `dedication` and `authorBio` fields
become redundant for users who create FM/BM items but remain harmless
(can be cleaned up in a later sub-project).

## Out of Scope

- Changing the sub-type of an existing FM/BM item (delete + re-create)
- Other sub-types: Epigraph, Foreword, Preface, Also-by, Appendix,
  Bibliography. Users build these via `Custom (TipTap)`.
- Markdown/rich text inside dedication, acknowledgments, or extra-notice
  fields. Plain text only (these are short and conventional).
- Author photo upload polish — uses the existing Cloudinary widget as-is.
- Light-mode styling for the new forms — falls out of SP4.
- A "config wizard" that walks the user through which front/back matter
  items they need. The picker (§2) is enough.
- Reordering links in the About-the-Author form via drag-drop. Move up /
  move down arrows are enough for MVP.

## Testing

Mostly manual (UI-heavy).

### Automated (Vitest)

- One unit test file per export-template format: `tests/export/front-matter-templates.test.ts`. Each test feeds known field values into a template function and asserts the output string contains the expected key fragments (title text, ISBN string, etc.). Avoids snapshot tests — too brittle for HTML/docx XML.

### Manual checklist

- Create a Front matter item. Picker appears. Click "Title Page".
  Form renders with default `bookTitle` and `authorName` pre-filled.
  Edit a field, wait 2 seconds — confirm autosave indicator goes
  Unsaved → Saving → Saved.
- Reload the page. The Title Page form opens directly (no picker),
  fields populated with the saved values.
- Create a Back matter item. Picker shows Acknowledgments / About the
  Author / Custom (no front-only options leaked).
- Create one of each M2 sub-type. Export the book to .docx — confirm
  Title Page is centered + author below + publisher at bottom; Copyright
  has the © year and ISBN; Dedication is italicized centered text;
  Acknowledgments / About the Author render with multi-paragraph text.
- Same export to .epub. Same checks.
- Create a Custom front matter item. Picker → Custom → TipTap editor
  loads. Type prose. Same export, prose appears in the front of the
  book.
- `npm test` passes (including the new template tests).
- `npx tsc --noEmit` clean.

## Risks

- The `binderItems.content` jsonb is currently used by some existing
  binder types (research notes have a string content; character has a
  CharacterProfile object). The new shape (`{ subtype, fields }`) is
  scoped to FM/BM items only. Types must guard reads — never assume
  shape across binder types.
- Existing front/back matter items created before this feature ships
  have `binderItems.content === null`. The render path in §1 ("Legacy
  disambiguation") spells out exactly how to distinguish legacy vs new.
  Missing this guard would either crash on `.subtype` access or wrongly
  prompt the picker for users whose TipTap prose is already saved.
- The picker is rendered when `subtype` is null. Hitting browser-back
  after picking should NOT undo the picker selection (it's stored on
  the server). Confirm by reloading after picking — the form must show,
  not the picker.

## Definition of Done

- The picker renders for unconfigured FM/BM items; each of the 5 M2
  sub-types has a working form; auto-save indicator behaves correctly.
- Export to docx and epub produces correctly-formatted pages for each
  sub-type.
- All 8 manual checklist items pass.
- `npm test` clean (including new template tests).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here block reflects Feature B complete, points to
  Feature C (Outline editor) as next.
