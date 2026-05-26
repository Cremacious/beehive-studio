# DP3 — Specialized Editor Surfaces Design Spec

> **Date:** 2026-05-26
> **Sub-project:** Design Port 3 of 4.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Port the non-chapter editor surfaces to match Claude Design's `specialized-surfaces` mockup. After DP3, every binder item type (chapter, front_matter, back_matter, outline, research_note, character) renders in a polished, on-brand surface — chapter editor was done in DP2; DP3 finishes the rest. The generic non-chapter textarea fallback is removed.

## 2. Context

DP1 + DP2 already shipped: tokens, fonts, shadcn bridge, persistent chrome. DP3 inherits the design system; no new tokens required.

Locked decisions from the brainstorm:
- **FM/BM:** full WYSIWYG rewrite. 5 new inline-edit page-preview components replace 5 deleted form components.
- **Outline:** beat-sheet only (story-arc deferred). Existing Kanban implementation replaced; existing user data flattened at render time.
- **Notes:** minimal visual port. No attribute-system expansion (tags/colors/pin stay as-is if currently implemented, but no new functionality).
- **Character profile:** sheet-style per mockup (`char-sheet` layout, not card-grid or narrative profile).
- **Generic fallback:** deleted entirely.
- **Execution order:** Notes → Character → FM/BM → Outline → close.
- **Verification:** eyeball side-by-side, same as DP2.

Mockup-derived findings:
- Outline ships with `.beat-sheet` and `.story-arc` view modes (story-arc deferred per Q2).
- Character uses `.char-sheet` layout (sheet direction).
- FM/BM previews use `.page` containers with inline-editable text.

## 3. Non-goals

- Story-arc outline view (deferred to a future pass).
- Note attribute-system expansion (tags, colors, pin). Visual port only; existing controls retain current behavior.
- DB migrations. All shape changes happen inside `binderItems.content` jsonb at render time.
- Adding new binder item types.
- Changing the chapter editor (DP2 done).
- Touching DP2 surfaces (binder, toolbar, status bar, metadata, etc.) — they stay as DP2 left them.
- Performance / a11y audits beyond what's already in place.

## 4. Architecture

### 4.1 Surfaces and execution order

| # | Surface | Files affected | Fidelity |
|---|---------|---------------|----------|
| Task 1 | Research Notes restyle | `notes/note-editor.tsx`, `notes/note-toolbar.tsx`, `notes/note-attribute-controls.tsx`, possibly `corkboard-or-editor.tsx` light-mode CSS | structural |
| Task 2 | Character profile sheet-style rewrite | `editor/character-profile.tsx`, possibly `corkboard-or-editor.tsx` | structural |
| Task 3 | FM/BM WYSIWYG rewrite (5 new previews, 5 old forms deleted) | `front-back-matter/{index, title-page-preview, copyright-preview, dedication-preview, acknowledgments-preview, about-author-preview, subtype-picker}.tsx` + delete 5 old form files | pixel-perfect (book pages) |
| Task 4 | Outline Kanban → beat-sheet | `outline/{outline-board, outline-card, chapter-link-popover}.tsx`, delete `outline/outline-column.tsx` | structural |
| Task 5 | Fallback removal + AGENTS.md + push | `editor/chapter-editor.tsx`, `AGENTS.md` | n/a |

### 4.2 Task 1 — Research Notes restyle

Visual port of existing files. Mockup target: a cleaner paper-card surface, mockup-spec heading + body typography (Newsreader for body if the mockup applies prose font to notes).

- `note-editor.tsx` — wrapper styling, title inline-rename, save-status badge integration, body container.
- `note-toolbar.tsx` — note-specific TipTap toolbar; reuse the DP2 `tbtnClass()` pattern from `editor-toolbar.tsx` for consistency.
- `note-attribute-controls.tsx` — existing tag/color/pin chips restyled to match mockup.

**Light-mode CSS:** if the note body needs explicit paper-ink colors that don't inherit from the `[data-editor-theme="light"]` cascade, add rules to `corkboard-or-editor.tsx`'s `<style>` tag for `[data-slot="note-body"]` or whatever data-slot the new structure uses.

**Functional behavior preserved:** title rename, debounced autosave, save status indicator, attribute controls onClick handlers.

### 4.3 Task 2 — Character profile (sheet-style)

Rewrite `editor/character-profile.tsx` to match the mockup's `char-sheet` layout. Expected structure per mockup:
- Header: avatar (uploaded image or initials placeholder) + name (large, inline-editable) + small meta line (role / age / pronouns).
- Sections (each is a labeled paper-card surface):
  - Appearance
  - Personality
  - Backstory
  - Arc
  - Relationships (with character-link affordance)
  - Notes (free-form)

**Data shape:** stored in `binderItems.content` jsonb. Confirmed shape during implementation:
```ts
type CharacterContent = {
  avatar?: string | null
  role?: string | null
  age?: string | null
  pronouns?: string | null
  appearance?: string | null
  personality?: string | null
  backstory?: string | null
  arc?: string | null
  relationships?: { targetCharacterId: string; relation: string }[] | null
  notes?: string | null
}
```

If existing character data uses a different shape, do a render-time read with sensible defaults; new edits write the new shape. No DB migration; old data slowly migrates as users edit.

**Avatar upload:** integrates with existing Cloudinary wiring (per AGENTS.md Phase 1). If avatar upload UI is new in DP3, scope it to: file picker → upload → save URL to `binderItems.content.avatar`. If too much for visual port, gate as a TODO and ship placeholder initials only — confirm during impl.

### 4.4 Task 3 — FM/BM WYSIWYG rewrite

5 subtypes, each a new component rendering a styled "book page" with inline-editable text. The user clicks text to edit; the rendered visual matches what will be exported.

#### 4.4a Common page chrome

Each preview shares a wrapper:
- Centered paper-card surface (`bg-paper-100` in light mode; `bg-canvas-dark-100` in dark mode), sized like a book page (taller than wide), comfortable padding around content.
- Subtle shadow under the page (mockup spec: paper elevation token from DP1).
- Subtype picker pinned at the top of the pane (above the page).
- Save-status badge in the top-right corner of the page (preserves `save-status-badge.tsx`).

#### 4.4b Subtype picker

A small pill-toolbar above the page. 5 buttons: Title Page · Copyright · Dedication · Acknowledgments · About Author. The active subtype is highlighted; clicking switches the rendered preview. Persists to `binderItems.content.subtype`.

If no subtype is chosen, the page shows "Choose a subtype to set up this page" + the picker is prominent.

#### 4.4c Title Page preview
- Centered vertically + horizontally.
- Inline-editable:
  - Book title (large, Comfortaa display)
  - Subtitle (smaller, italic, Newsreader)
  - "a novel by" / byline copy (small label, optional toggle)
  - Author name (medium-large, Newsreader)
- Saves to `binderItems.content.fields.{title, subtitle, byline, author}`.

#### 4.4d Copyright preview
- Smaller text, left-aligned or centered, copyright-block typography.
- Inline-editable fields: copyright year, copyright holder, edition, ISBN, publisher name, rights statement (multi-line textarea).
- Saves to `binderItems.content.fields.{year, holder, edition, isbn, publisher, rights}`.

#### 4.4e Dedication preview
- Centered, italic, generous whitespace.
- Single inline-editable text field — anything from one line to a short paragraph.
- Saves to `binderItems.content.fields.text`.

#### 4.4f Acknowledgments preview
- "Acknowledgments" heading (Comfortaa display) at top.
- Multi-paragraph rich text body below (TipTap mini-editor scoped to inline marks: bold, italic only — no headings, no lists).
- Saves to `binderItems.content.fields.body` (TipTap JSON).

#### 4.4g About Author preview
- "About the Author" heading.
- Avatar placeholder (or uploaded image) — same upload affordance as Character profile.
- Bio body (TipTap mini-editor).
- Optional links list (website / social, each a single-line input).
- Saves to `binderItems.content.fields.{bio, links, photoUrl}`.

#### 4.4h Inline-edit technical approach

- **Single-line text (titles, names, dates):** contenteditable spans with `onBlur` save.
- **Multi-paragraph rich text (acknowledgments, bio):** TipTap mini-editor instance configured with minimal extensions (StarterKit-bold/italic/paragraph only).
- **Selects (subtype picker):** buttons, not native `<select>`.

#### 4.4i Files

**Create:**
- `front-back-matter/title-page-preview.tsx`
- `front-back-matter/copyright-preview.tsx`
- `front-back-matter/dedication-preview.tsx`
- `front-back-matter/acknowledgments-preview.tsx`
- `front-back-matter/about-author-preview.tsx`
- `front-back-matter/subtype-picker.tsx` (replaces the existing one with new visual structure)

**Modify:**
- `front-back-matter/index.tsx` — dispatcher routes to previews instead of forms.

**Delete:**
- `front-back-matter/title-page-form.tsx`
- `front-back-matter/copyright-form.tsx`
- `front-back-matter/dedication-form.tsx`
- `front-back-matter/acknowledgments-form.tsx`
- `front-back-matter/about-author-form.tsx`

**Keep:**
- `front-back-matter/save-status-badge.tsx` — still useful.

### 4.5 Task 4 — Outline Kanban → beat-sheet

Mockup target: vertical list of beats. Each beat row has title + description + status pill + optional linked-chapter chip. Click a beat to edit inline; drag to reorder; "+ Add beat" at end.

#### 4.5a Structural

- `outline-board.tsx` becomes the beat-sheet container. Header (outline title + "+ Add beat" button) at the top; vertical list of beat rows below.
- `outline-card.tsx` becomes the beat-row component (title, description, status, link chip, drag handle).
- `outline-column.tsx` — DELETED (no columns in beat-sheet).
- `chapter-link-popover.tsx` — kept; visual port to match mockup styling.

#### 4.5b Data shape translation

Existing outline data in `binderItems.content`:
```ts
type LegacyOutlineContent = {
  columns: { id: string; title: string }[]
  cards: { id: string; columnId: string; title: string; description?: string; linkedChapterId?: string }[]
}
```

New shape:
```ts
type OutlineContent = {
  beats: {
    id: string
    title: string
    description?: string
    status?: 'idea' | 'drafting' | 'done'  // confirm exact enum during impl
    linkedChapterId?: string | null
  }[]
}
```

Render-time translation: when the saved content is in legacy shape, flatten `cards` (preserving order) into `beats` and drop `columns`. The next save writes the new shape, completing the migration. Lossy — column groupings are discarded. This loss is accepted per the brainstorm.

#### 4.5c Status pills

Beat status uses 3 simple values (idea / drafting / done) — these are NOT the chapter-status palette (which is 5 values). Use 3 distinct tints from the design system (e.g., `--status-idea`, `--status-first-draft`, `--status-final` — or pick from the palette during impl).

#### 4.5d Functional

Drag-drop preserved (existing @dnd-kit wiring stays — adapt sensors from "drag between columns" to "drag within a single sortable list"). Link to chapter: chapter-link-popover opens, user picks a chapter, beat row shows the linked-chapter chip. Inline title + description edit on click.

### 4.6 Task 5 — Fallback removal + close

`chapter-editor.tsx` currently has a `<textarea>` fallback for any item type without a renderer. After DP3, every known type renders; the fallback is dead code.

- Remove the fallback `<main>` block at the end of the `!isChapterType` branch.
- Replace with: `return null` (or throw a meaningful error in dev). The cleanest path is `return null` plus an `if (process.env.NODE_ENV !== 'production') console.warn(...)` for future debug.
- Also: delete `binder-item-menu.tsx`'s "Research note" / "Character" / etc. add buttons if they're stale references. Confirm during impl.

Update `AGENTS.md` Resume Here and add a DP3 entry under "What Has Been Built". Push to origin/main.

## 5. Risks

1. **FM/BM inline-edit complexity.** Contenteditable for single-line, TipTap for multi-paragraph. The mix means two patterns in the same surface family. Mitigation: keep TipTap configs minimal; document the pattern in code comments.

2. **Outline data shape break.** Flat-translation from columns+cards is lossy (loses column grouping). Acceptable per brainstorm. If a user complains post-ship, we add a one-time migration that preserves grouping as a tag.

3. **Character profile data shape break.** Existing character data may not have the new fields. Mitigation: read with defaults; new edits write new shape.

4. **Avatar upload scope.** If avatar upload isn't already wired in the existing `character-profile.tsx`, it's net-new feature work — bigger than visual port. Mitigation: if not wired, ship placeholder initials only and TODO the upload affordance.

5. **Existing dnd-kit wiring.** Switching from "between columns" to "single sortable list" should be cleaner, not more complex — but verify the existing sensors don't accidentally depend on a column-based hierarchy.

6. **Light-mode prose on book pages.** FM/BM previews need light-mode rules so paper pages render correctly with paper-ink text. The existing SP4 light-mode CSS targets `.tiptap.ProseMirror`; new TipTap mini-editors will emit the same class, so they should inherit. Verify during Task 3.

## 6. Testing (manual per task + final 14-item)

Per-task: visual side-by-side, functional verify (typing, saving, debounce, light/dark, drag-drop where applicable), no console errors, tsc clean, tests clean.

Final 14-item DP3 checklist (from §4 of the brainstorm):
1. `npm run dev` clean. Studio loads.
2. Create a Research Note → matches mockup; type → saves.
3. Create a Character → matches mockup; fill sections → saves.
4. Create a Front Matter → switch subtype → each preview renders distinctly.
5. Edit inline on a Title Page → text updates + saves.
6. Edit inline on a Dedication → text updates + saves.
7. Edit inline on an Acknowledgments (rich text) → marks work; saves.
8. Create a Back Matter → subtype-picker works; about-author renders.
9. Open an existing Outline (with Kanban data) → beats render flattened; user can edit, reorder, link.
10. Create new beats → add, edit, delete, link, reorder all functional.
11. Toggle light mode on each surface → paper flips correctly.
12. Fallback removed: no item type lands on a textarea.
13. `tsc` clean.
14. `npm test` clean (still 119).

## 7. Definition of Done

- 5 atomic commits (one per task) + AGENTS.md close-out commit.
- All 14 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- Side-by-side eyeball verification on all four surfaces.
- AGENTS.md Resume Here updated; DP3 entry added.
- Old FM/BM forms deleted (5 files).
- `outline/outline-column.tsx` deleted.
- Generic non-chapter fallback removed from chapter-editor.tsx.
- Pushed to origin/main.

## 8. Out-of-scope reminders

After DP3 ships, the remaining work in the design-port sequence:
- **DP4** — Overlays / Modes / Modals (corkboard, focus, history drawer, find/replace, writing analysis, cheatsheet, export, confirmation dialogs, empty states).
- **Then:** Phase 8 Stripe monetization.

Bonus pages (Landing / Sign In / Sign Up) and the app-level nav remain Chris's separate redesign passes — out of all four DP sub-projects.
