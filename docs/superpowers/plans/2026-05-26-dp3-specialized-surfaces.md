# DP3 Specialized Editor Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the non-chapter editor surfaces to match Claude Design's `specialized-surfaces` mockup. Five atomic tasks: Notes restyle → Character profile rewrite → FM/BM WYSIWYG rewrite → Outline Kanban→beat-sheet → fallback removal + close.

**Architecture:** Inherits tokens + design system from DP1/DP2 — no new tokens. Touches binder-item-content rendering only; no DB migrations. FM/BM gets 5 new inline-edit page-preview components replacing 5 deleted form components. Outline gets a flat-list rewrite of the existing Kanban board. Generic non-chapter textarea fallback is removed.

**Tech Stack:** Tailwind v4, React 19, TipTap v3 (for multi-paragraph rich text in Acknowledgments + About Author), lucide-react, shadcn/ui, @dnd-kit (sortable list in outline beat-sheet).

**Spec:** [`docs/superpowers/specs/2026-05-26-dp3-specialized-surfaces-design.md`](../specs/2026-05-26-dp3-specialized-surfaces-design.md)

**Visual reference:** [`designs/claude/specialized-surfaces/Specialized Surfaces.html`](../../../designs/claude/specialized-surfaces/Specialized%20Surfaces.html), [`designs/claude/specialized-surfaces/styles.css`](../../../designs/claude/specialized-surfaces/styles.css)

---

## File Structure

**Create (Task 3):**
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/title-page-preview.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/copyright-preview.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/dedication-preview.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/acknowledgments-preview.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/about-author-preview.tsx`

**Modify:**
- Task 1 Notes: `notes/note-editor.tsx`, `notes/note-toolbar.tsx`, `notes/note-attribute-controls.tsx`, possibly `corkboard-or-editor.tsx`
- Task 2 Character: `editor/character-profile.tsx`, possibly `corkboard-or-editor.tsx`
- Task 3 FM/BM: `front-back-matter/index.tsx`, `front-back-matter/subtype-picker.tsx` (full rewrite of dispatcher + picker)
- Task 4 Outline: `outline/outline-board.tsx`, `outline/outline-card.tsx`, `outline/chapter-link-popover.tsx`
- Task 5 Close: `editor/chapter-editor.tsx`, `AGENTS.md`

**Delete:**
- Task 3: `front-back-matter/title-page-form.tsx`, `copyright-form.tsx`, `dedication-form.tsx`, `acknowledgments-form.tsx`, `about-author-form.tsx`
- Task 4: `outline/outline-column.tsx`

**Keep:**
- `front-back-matter/save-status-badge.tsx`

**No DB changes. No new dependencies. No new server actions. No new types other than the local FM/BM content shape additions and the new beat-sheet OutlineContent type.**

**No new tests required** — manual side-by-side verification per task.

---

## Task 1: Research Notes restyle

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/notes/note-editor.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/notes/note-toolbar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/notes/note-attribute-controls.tsx`
- Possibly: `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` (light-mode CSS additions)

- [ ] **Step 1: Read existing files + mockup**

Read in order:
1. `notes/note-editor.tsx` — full file. Understand current container, title rename, save-status integration, TipTap container.
2. `notes/note-toolbar.tsx` — note's TipTap toolbar (probably a subset of chapter-editor's).
3. `notes/note-attribute-controls.tsx` — what attributes are currently rendered (tags, color, pin).
4. `designs/claude/specialized-surfaces/Specialized Surfaces.html` — grep for `note`, `Research`, `attributes` to find the mockup's note-section markup.
5. `designs/claude/specialized-surfaces/styles.css` — grep same terms for CSS selectors.

Note the mockup's structure: section paddings, title-input style, body container, attribute-chip styling.

- [ ] **Step 2: Restyle `note-editor.tsx`**

Apply mockup-spec wrapper, title styling (likely Comfortaa display, inline-edit input on click), save-status badge placement, and TipTap container.

Body container should use a similar paper-card aesthetic to the chapter editor body but smaller (notes feel more like index cards than book pages). Use `--font-prose` (Newsreader) for body OR `--font-ui` (Geist) — confirm by reading the mockup's note prose font.

Preserve all functional behavior:
- Title inline-rename pattern (existing).
- Debounced autosave.
- Save-status badge.
- TipTap onUpdate handler.

- [ ] **Step 3: Restyle `note-toolbar.tsx`**

Reuse DP2's `tbtnClass()` pattern from `editor-toolbar.tsx` for button styling consistency. Note toolbar should have a subset of buttons (likely Bold / Italic / Bullet / Numbered / Link — no headings, no align). Same active-state treatment (solid brand-yellow + brand-ink).

If `tbtnClass()` is exported from `editor-toolbar.tsx`, import + reuse. If not, copy the pattern verbatim — duplication is fine for now.

- [ ] **Step 4: Visual port of `note-attribute-controls.tsx`**

Restyle existing tag chips, color label swatches, pin toggle to match mockup. NO new behavior — preserve current onClick handlers.

If the mockup shows attributes that the current component doesn't render (e.g., pin button doesn't exist), DO NOT add functionality — note as a TODO comment and ship the visual treatment for what exists.

- [ ] **Step 5: Extend light-mode CSS if needed**

If note surfaces need explicit `[data-editor-theme="light"]` rules not covered by the existing chrome-or-paper inheritance, add to `corkboard-or-editor.tsx`'s `<style>` template literal. Match the DP2 pattern (target via data-slot attributes).

- [ ] **Step 6: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Open studio. Create or open a Research Note. Visual matches mockup.
2. Title rename inline; Enter commits.
3. Type body content; debounced save fires; save-status badge updates.
4. Toolbar buttons (bold/italic/list) work; active states correct.
5. Attribute controls (tags/colors/pin) render and interact correctly.
6. Toggle light mode → note surface flips paper-style.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/notes/" "app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx" 2>/dev/null || git add "app/[locale]/(app)/studio/[bookId]/_components/notes/"
git commit -m "feat(studio): Research Notes restyled per Claude Design (DP3 Task 1)

Visual port of note-editor + note-toolbar + note-attribute-controls
to match the specialized-surfaces mockup. Newsreader prose body
(or Geist per mockup), Comfortaa title inline-rename, save-status
badge integrated, attribute chips restyled.

No functional changes. tbtnClass() pattern from DP2 reused for
the note toolbar so it inherits the new design system."
```

---

## Task 2: Character profile sheet-style rewrite

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx`
- Possibly: `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx`

- [ ] **Step 1: Read existing + mockup**

Read:
1. `editor/character-profile.tsx` — full file. Note current data shape, sections rendered, save mechanism.
2. Mockup `.char-sheet` class structure in Specialized Surfaces.html + styles.css.

Note the mockup's section hierarchy: avatar/name header → labeled section cards (Appearance, Personality, Backstory, Arc, Relationships, Notes).

- [ ] **Step 2: Rewrite `character-profile.tsx` to sheet-style**

Implement the data shape per spec §4.3:

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

Read existing data with defaults; new edits write new shape.

Layout per mockup:
- **Header card:** avatar (square or circle), name (inline-editable, large), meta line (role · age · pronouns) — each meta field inline-editable.
- **Section cards:** each section labeled, textarea (single-line for short, larger for backstory). Debounce save via existing pattern from `metadata-panel.tsx` (handleMetaChange-style debounced write to `binderItems.content`).
- **Relationships section:** list of `{targetCharacterId, relation}` entries; "+ Add relationship" opens a character-link popover (build inline or defer if too much — confirm during impl).

- [ ] **Step 3: Avatar upload**

Check if existing `character-profile.tsx` has an avatar upload. If yes, preserve. If no, scope:
- Easiest: a file input that uploads via existing Cloudinary wiring (per AGENTS.md Phase 1). Confirm there's a server action like `uploadImageAction` already.
- Safest scope-control: ship placeholder initials only, with a TODO comment marking the upload affordance as future work.

Pick based on what's already wired. Document choice in the commit message.

- [ ] **Step 4: Light-mode CSS if needed**

Add rules to `corkboard-or-editor.tsx` if the sheet-card surfaces need explicit paper treatment beyond inheritance.

- [ ] **Step 5: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Open / create a Character.
2. Name inline-rename works; meta fields rename.
3. Each section card: type → debounced save.
4. Relationships section: add → renders; remove → renders.
5. Avatar: either upload works OR initials placeholder renders correctly.
6. Light mode flips paper-style.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx" "app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx" 2>/dev/null || git add "app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx"
git commit -m "feat(studio): Character profile sheet-style rewrite (DP3 Task 2)

Replaces existing character-profile layout with mockup's char-sheet:
avatar+name+meta header card + Appearance/Personality/Backstory/Arc/
Relationships/Notes section cards. Each section debounced-saves to
binderItems.content.

Data shape extended per spec §4.3; existing character data renders
with sensible defaults; new edits write the new shape (no DB migration).

Avatar: [SHIPPED / DEFERRED] — confirm in commit body."
```

---

## Task 3: FM/BM WYSIWYG rewrite

**Files:**
- Create: 5 preview components + new subtype-picker
- Modify: `front-back-matter/index.tsx` dispatcher
- Delete: 5 old form components

- [ ] **Step 1: Read existing + mockup**

Read in order:
1. `front-back-matter/index.tsx` — current dispatcher logic. Understand how it routes by subtype.
2. `front-back-matter/title-page-form.tsx` — for reference; note current field names + data shape under `binderItems.content.fields`.
3. `front-back-matter/copyright-form.tsx`, `dedication-form.tsx`, `acknowledgments-form.tsx`, `about-author-form.tsx` — same.
4. `front-back-matter/subtype-picker.tsx` — current picker.
5. `front-back-matter/save-status-badge.tsx` — kept; reuse as-is.
6. Mockup `.page` and subtype-specific selectors in styles.css.

Note the existing `binderItems.content` shape for FM/BM (subtype + fields object).

- [ ] **Step 2: Common page chrome utility**

Establish a shared visual pattern for "book page" wrapper. Either:
- A new `_components/front-back-matter/page-wrapper.tsx` exported component, OR
- A repeated className pattern duplicated across previews.

Go with the shared component — single source of truth for page chrome.

```tsx
// page-wrapper.tsx (new)
'use client'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  saveStatusBadge?: ReactNode
}

export function PageWrapper({ children, saveStatusBadge }: Props) {
  return (
    <div className="flex justify-center px-8 py-12 overflow-y-auto" style={{ minHeight: '100%' }}>
      <div
        className="relative bg-paper-100 rounded-md shadow-2xl px-16 py-20 w-full max-w-[680px] min-h-[800px]"
        style={{ fontFamily: 'var(--font-prose)', color: 'var(--paper-ink)' }}
      >
        {saveStatusBadge && (
          <div className="absolute top-4 right-4">{saveStatusBadge}</div>
        )}
        {children}
      </div>
    </div>
  )
}
```

Adapt sizes / paddings / colors per mockup. The wrapper enforces "book page" feel regardless of dark/light editor mode — book pages are always cream paper because they represent the printed page.

- [ ] **Step 3: Create `title-page-preview.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { PageWrapper } from './page-wrapper'
import { SaveStatusBadge } from './save-status-badge'
import { useBookEditor } from '../book-editor-provider'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

type Fields = {
  title?: string
  subtitle?: string
  byline?: string
  author?: string
}

type Props = { item: BinderItemRow }

export function TitlePagePreview({ item }: Props) {
  const { updateBinderItem } = useBookEditor()
  const fields = ((item.content as { fields?: Fields } | null)?.fields) ?? {}
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  function save(next: Fields) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus('unsaved')
    const newContent = { ...((item.content as object) ?? {}), fields: next }
    updateBinderItem(item.id, { content: newContent })
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      await updateBinderItemAction(item.id, { content: newContent })
      setSaveStatus('saved')
    }, 1500)
  }

  function handleBlur(field: keyof Fields, value: string) {
    save({ ...fields, [field]: value.trim() })
  }

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />}>
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
        <h1
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleBlur('title', e.currentTarget.textContent ?? '')}
          className="text-5xl font-bold mb-8 outline-none focus:bg-paper-200/40 px-4 py-2 rounded"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--paper-ink-strong)' }}
          data-placeholder="Book Title"
        >
          {fields.title || ''}
        </h1>
        <h2
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleBlur('subtitle', e.currentTarget.textContent ?? '')}
          className="text-xl italic mb-12 outline-none focus:bg-paper-200/40 px-4 py-1 rounded"
          style={{ color: 'var(--paper-ink-muted)' }}
          data-placeholder="Subtitle (optional)"
        >
          {fields.subtitle || ''}
        </h2>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleBlur('byline', e.currentTarget.textContent ?? '')}
          className="text-sm uppercase tracking-widest mb-3 outline-none focus:bg-paper-200/40 px-4 py-1 rounded"
          style={{ color: 'var(--paper-ink-muted)' }}
          data-placeholder="a novel by"
        >
          {fields.byline || 'a novel by'}
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleBlur('author', e.currentTarget.textContent ?? '')}
          className="text-2xl outline-none focus:bg-paper-200/40 px-4 py-2 rounded"
          style={{ color: 'var(--paper-ink-strong)' }}
          data-placeholder="Author Name"
        >
          {fields.author || ''}
        </div>
      </div>
    </PageWrapper>
  )
}
```

Use CSS `[data-placeholder]:empty::before { content: attr(data-placeholder); opacity: 0.4 }` in globals.css (add it) OR per-element with `:empty:before` pseudo if scoped. Confirm during impl — the placeholder text behavior is important.

Adapt `SaveStatusBadge` import + props to whatever the existing component takes.

- [ ] **Step 4: Create `dedication-preview.tsx`**

Centered, italic, single inline-editable text. Pattern is the same as title page but with one field (`text`).

- [ ] **Step 5: Create `copyright-preview.tsx`**

Smaller text, copyright-block typography. Multiple inline-editable fields: year, holder, edition, ISBN, publisher, rights. The fields read top-to-bottom as a copyright page would.

- [ ] **Step 6: Create `acknowledgments-preview.tsx`**

Heading "Acknowledgments" at top, then a TipTap mini-editor for the body.

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const editor = useEditor({
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({
      heading: false,    // no headings inside acknowledgments
      bulletList: false,
      orderedList: false,
      blockquote: false,
      horizontalRule: false,
      codeBlock: false,
    }),
  ],
  content: fields.body ?? null,
  onUpdate: ({ editor }) => save({ ...fields, body: editor.getJSON() }),
  // ... other config
})
```

This produces an inline-edit rich-text region with only bold/italic available.

- [ ] **Step 7: Create `about-author-preview.tsx`**

Heading "About the Author" + avatar placeholder (or upload affordance — match Character profile's choice from Task 2) + TipTap mini-editor for bio + optional links list.

- [ ] **Step 8: Create new `subtype-picker.tsx`**

Replace existing picker with a pill-toolbar:

```tsx
const SUBTYPES = [
  { id: 'title_page', label: 'Title Page' },
  { id: 'copyright', label: 'Copyright' },
  { id: 'dedication', label: 'Dedication' },
  { id: 'acknowledgments', label: 'Acknowledgments' },
  { id: 'about_author', label: 'About Author' },
]
```

Active button: solid brand-yellow + brand-ink. Inactive: chrome neutral. Clicking writes `binderItems.content.subtype` and re-routes the dispatcher.

- [ ] **Step 9: Rewrite `front-back-matter/index.tsx`**

The dispatcher now routes to previews:

```tsx
export function FrontBackMatterRenderer({ item }: { item: BinderItemRow }) {
  const subtype = (item.content as { subtype?: string } | null)?.subtype ?? null

  if (!subtype) {
    return (
      <div className="flex flex-col h-full">
        <SubtypePicker item={item} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Choose a subtype to set up this page.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <SubtypePicker item={item} />
      <div className="flex-1 overflow-y-auto">
        {subtype === 'title_page' && <TitlePagePreview item={item} />}
        {subtype === 'copyright' && <CopyrightPreview item={item} />}
        {subtype === 'dedication' && <DedicationPreview item={item} />}
        {subtype === 'acknowledgments' && <AcknowledgmentsPreview item={item} />}
        {subtype === 'about_author' && <AboutAuthorPreview item={item} />}
      </div>
    </div>
  )
}
```

Preserve `shouldUseFrontBackMatterRenderer` export if `chapter-editor.tsx` uses it as a guard.

- [ ] **Step 10: Delete old form files**

```bash
git rm "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/title-page-form.tsx"
git rm "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/copyright-form.tsx"
git rm "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/dedication-form.tsx"
git rm "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/acknowledgments-form.tsx"
git rm "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/about-author-form.tsx"
```

- [ ] **Step 11: Light-mode CSS for FM/BM pages**

Add to `corkboard-or-editor.tsx` `<style>` tag if needed. Note: FM/BM previews are ALWAYS cream paper regardless of editor theme — they represent the printed book page. So light-mode flip rules may NOT apply here; the page chrome stays cream in dark editor mode too. Confirm during impl.

If the page wrapper renders differently in dark vs light editor mode (e.g., page paper warmer in dark mode for cozy night-writing), add rules.

- [ ] **Step 12: Add placeholder CSS in globals.css**

```css
@layer utilities {
  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: var(--paper-ink-muted);
    opacity: 0.5;
    pointer-events: none;
  }
}
```

Place near the existing `.ProseMirror` rules.

- [ ] **Step 13: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Create a Front Matter binder item. Subtype picker shows; pick Title Page.
2. Title Page renders centered. Click title → contenteditable shows; type → blur saves.
3. Switch subtype to Copyright → fields render.
4. Switch to Dedication → single field.
5. Switch to Acknowledgments → TipTap mini-editor; bold/italic work.
6. Switch to About Author → bio editor + avatar.
7. Save status badge updates correctly.
8. Refresh page → fields persist.

- [ ] **Step 14: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/" app/globals.css
git commit -m "feat(studio): FM/BM WYSIWYG rewrite (DP3 Task 3)

Replaces 5 form components with 5 WYSIWYG inline-edit page previews:
title-page, copyright, dedication, acknowledgments, about-author.

Each renders a styled book page (cream paper + Newsreader serif) with
inline-editable text (contenteditable for single-line; TipTap mini-
editor for multi-paragraph acknowledgments + bio).

Shared PageWrapper component owns the page chrome. New SubtypePicker
pill-toolbar lets the user switch subtypes; the active subtype writes
to binderItems.content.subtype.

[contenteditable]:empty::before placeholder utility added to globals.css.

Deleted: title-page-form.tsx, copyright-form.tsx, dedication-form.tsx,
acknowledgments-form.tsx, about-author-form.tsx."
```

---

## Task 4: Outline Kanban → beat-sheet

**Files:**
- Modify: `outline/outline-board.tsx`
- Modify: `outline/outline-card.tsx`
- Modify: `outline/chapter-link-popover.tsx`
- Delete: `outline/outline-column.tsx`

- [ ] **Step 1: Read existing + mockup**

Read in order:
1. `outline/outline-board.tsx` — note Kanban container + DnD setup.
2. `outline/outline-card.tsx` — note current card props + behaviors.
3. `outline/outline-column.tsx` — confirm only used by outline-board.
4. `outline/chapter-link-popover.tsx` — note search + link-chapter behavior.
5. Mockup `.beat-sheet` markup + styles.

Note the mockup's beat-row structure: title + description + status pill + linked-chapter chip + drag handle.

- [ ] **Step 2: Data shape translator**

Add a helper at the top of `outline-board.tsx`:

```ts
type LegacyOutlineContent = {
  columns?: { id: string; title: string }[]
  cards?: { id: string; columnId: string; title: string; description?: string; linkedChapterId?: string }[]
}

type Beat = {
  id: string
  title: string
  description?: string
  status?: 'idea' | 'drafting' | 'done'
  linkedChapterId?: string | null
}

type OutlineContent = { beats: Beat[] }

function readBeats(raw: unknown): Beat[] {
  const c = (raw ?? {}) as LegacyOutlineContent & Partial<OutlineContent>
  if (Array.isArray(c.beats)) return c.beats
  // Legacy migration: flatten cards in column order.
  if (Array.isArray(c.cards) && Array.isArray(c.columns)) {
    const colOrder = c.columns.map(col => col.id)
    return [...c.cards]
      .sort((a, b) => colOrder.indexOf(a.columnId) - colOrder.indexOf(b.columnId))
      .map(card => ({
        id: card.id,
        title: card.title,
        description: card.description,
        status: 'idea' as const,
        linkedChapterId: card.linkedChapterId ?? null,
      }))
  }
  return []
}
```

- [ ] **Step 3: Rewrite `outline-board.tsx`**

Container: vertical sortable list. Header strip with outline title + "+ Add beat" button. Body: list of `<OutlineCard>` (now beat row).

DnD: use existing `@dnd-kit` pattern but with `SortableContext` strategy `verticalListSortingStrategy` instead of horizontal.

```tsx
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
```

- [ ] **Step 4: Rewrite `outline-card.tsx` as beat row**

Each row: drag handle (left) → title (inline-editable) + description (inline-editable smaller) → status pill (clickable, cycles through 3 values) → linked-chapter chip (clickable opens popover) → delete button.

Status pill colors: pick 3 tints from `--status-*` palette (idea=`--status-idea` blue, drafting=`--status-first-draft` warm, done=`--status-final` terracotta) OR introduce new tokens if mockup specifies different.

Inline title/description edits via contenteditable spans + onBlur save (same pattern as FM/BM previews).

- [ ] **Step 5: Restyle `chapter-link-popover.tsx`**

Visual port only. Preserve search + selection + linking behavior. Apply mockup's popover styling.

- [ ] **Step 6: Delete `outline/outline-column.tsx`**

```bash
git rm "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-column.tsx"
```

Verify no other file imports it via:

```bash
grep -rn "outline-column" "app/[locale]/(app)/studio/[bookId]/_components/" || echo "no references"
```

- [ ] **Step 7: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Open an existing Outline (with legacy Kanban data) → beats render flattened in column order.
2. "+ Add beat" → new beat row appears at bottom.
3. Inline-edit title → save.
4. Inline-edit description → save.
5. Click status pill → cycles through idea/drafting/done with color change.
6. Click linked-chapter chip → popover opens, search works, picking a chapter links.
7. Drag a beat to reorder → DnD works.
8. Delete a beat → confirm + removes.
9. Reload page → state persists; on next save the content shape becomes flat beats[].

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/"
git commit -m "feat(studio): Outline Kanban -> beat-sheet (DP3 Task 4)

Replaces Kanban (columns + cards) with vertical beat-sheet: flat list
of beats with title, description, status pill (idea/drafting/done),
linked-chapter chip, drag handle.

Render-time data shape translator flattens legacy {columns, cards}
into {beats}. Column groupings discarded (accepted per spec). Next
save writes the new shape, completing migration.

DnD swaps horizontalListSortingStrategy for verticalListSortingStrategy.
chapter-link-popover restyled; behavior preserved.

Deleted: outline-column.tsx (no longer used)."
```

---

## Task 5: Fallback removal + AGENTS.md + push

**Files:**
- Modify: `editor/chapter-editor.tsx`
- Modify: `AGENTS.md`

- [ ] **Step 1: Read chapter-editor.tsx**

Find the `!isChapterType` branch. After the FrontBackMatter / Outline / Note / Character routes, there's a generic `<main>` block with `<textarea>` fallback. That's what gets removed.

- [ ] **Step 2: Remove the fallback**

Replace the trailing fallback `<main>` block with:

```tsx
if (activeItem && !isChapterType) {
  if (activeItem.type === 'outline') return <OutlineBoard item={activeItem} />
  if (activeItem.type === 'research_note') return <NoteEditor item={activeItem} />
  if (activeItem.type === 'character') return <CharacterProfile item={activeItem} />
  // All known non-chapter types are routed above. If we hit this, it's a
  // bug — log in dev, return null in prod.
  if (process.env.NODE_ENV !== 'production') {
    console.warn('No specialized renderer for binder item type:', activeItem.type)
  }
  return null
}
```

(Adapt to the existing code shape — the actual file may have a different conditional order.)

- [ ] **Step 3: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke: with every binder item type, opening that item should land on its specialized renderer — never on a generic textarea.

- [ ] **Step 4: Run full DP3 final 14-item checklist**

Walk through (spec §6):

1. `npm run dev` clean. Studio loads.
2. Create / open a Research Note → mockup match; type → save.
3. Create / open a Character → mockup match; fill sections → save.
4. Create a Front Matter → subtype picker; each subtype renders distinctly.
5. Edit inline on Title Page → save.
6. Edit inline on Dedication → save.
7. Edit inline on Acknowledgments (rich text) → save.
8. Create Back Matter → subtype picker works; about-author renders.
9. Open existing Outline (legacy Kanban data) → beats render flattened.
10. Add / edit / delete / link / reorder beats → all functional.
11. Toggle light mode on each surface → paper flips.
12. Fallback removed: no textarea anywhere.
13. `tsc` clean.
14. `npm test` clean (119).

- [ ] **Step 5: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-26.
- Current focus: "DP3 Specialized Editor Surfaces complete; DP4 Overlays / Modes / Modals next."
- Last commit: `git log -1 --format=%s` (after AGENTS.md commit).
- Next concrete step: "invoke /brainstorming for DP4 Overlays / Modes / Modals — port corkboard view, focus mode, history drawer, find/replace, writing analysis, cheatsheet, export, confirmation dialogs, empty states."

Add a DP3 pattern entry to the Key Patterns block:

> **DP3 specialized-surfaces pattern:** Non-chapter binder items each get their own renderer. FM/BM uses WYSIWYG inline-edit page previews (5 subtypes) with shared `PageWrapper` chrome. Outline uses beat-sheet (vertical sortable list); legacy Kanban data flattened at render time. Character uses sheet-style (avatar + meta header + 6 section cards). Notes restyled in-place. Generic fallback removed — every binder type has a specialized renderer.

Add a DP3 entry under "What Has Been Built":

```markdown
### DP3 — Design Port Specialized Editor Surfaces ✅ COMPLETE (2026-05-26)
Third of four design-port sub-projects. Ported all non-chapter editor surfaces.

- **Research Notes:** restyled to match mockup. Newsreader prose body, paper-card aesthetic, attribute controls visually ported.
- **Character profile:** sheet-style rewrite. Avatar + name + meta header card; 6 section cards (Appearance / Personality / Backstory / Arc / Relationships / Notes). Debounced save to `binderItems.content`.
- **FM/BM WYSIWYG:** 5 new inline-edit page previews (title-page, copyright, dedication, acknowledgments, about-author) replace 5 deleted form components. Shared `PageWrapper` chrome. Contenteditable for single-line fields; scoped TipTap mini-editor for multi-paragraph rich text. New `[contenteditable][data-placeholder]:empty::before` utility added to globals.css.
- **Outline:** Kanban (columns + cards) replaced by beat-sheet (vertical sortable list). Render-time data translator flattens legacy Kanban shape into `{beats: [...]}`; column groupings discarded (accepted). Status pill cycles idea/drafting/done with `--status-*` tints.
- **Generic fallback removed:** `chapter-editor.tsx` no longer renders a textarea fallback for unknown types. Logs in dev, returns null in prod.

No DB migrations. No new dependencies. 119/119 tests, tsc clean.

**Next:** DP4 Overlays / Modes / Modals (corkboard, focus, history drawer, find/replace, writing analysis, cheatsheet, export, confirmations, empty states).
```

- [ ] **Step 6: Commit + push**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx" AGENTS.md
git commit -m "feat(studio): remove generic textarea fallback + DP3 close-out (Task 5)

After DP3, every binder item type has a specialized renderer. The
fallback <textarea> in chapter-editor.tsx is now dead code; removed.
Logs in dev / returns null in prod for any future unknown type.

AGENTS.md updated: DP3 marked complete; DP4 queued.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 5 atomic commits + AGENTS.md commit (6 total).
- All 14 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- Old FM/BM form components deleted (5 files).
- `outline/outline-column.tsx` deleted.
- Generic non-chapter fallback removed from `chapter-editor.tsx`.
- AGENTS.md Resume Here updated; DP3 entry added.
- Side-by-side eyeball verification on all four surfaces.
- Pushed to origin/main.
