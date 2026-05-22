# Studio Front/Back Matter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 specialized sub-type forms (Title Page, Copyright, Dedication, Acknowledgments, About the Author) plus a Custom fallback for Front/Back Matter binder items, with full export integration to docx and epub.

**Architecture:** A `binderItems.content = { subtype, fields }` jsonb shape, no DB migration. Picker UI shows in the editor pane when subtype is null; specialized form when subtype is set; existing TipTap editor when subtype is 'custom' or legacy. Export route gets per-subtype template functions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Vitest. The export route uses `html-to-docx` (docx) and a custom EPUB writer.

**Spec:** [`docs/superpowers/specs/2026-05-22-studio-front-back-matter-design.md`](../specs/2026-05-22-studio-front-back-matter-design.md)

---

## File Structure

**Create:**
- `lib/front-back-matter/types.ts` — shared TS types for subtype + per-subtype field shapes
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/subtype-picker.tsx` — picker shown for unconfigured items
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/title-page-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/copyright-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/dedication-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/acknowledgments-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/about-author-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/index.tsx` — renderer that switches on subtype
- `lib/export/front-back-matter-templates.ts` — 5 subtypes × 2 formats = 10 pure template functions
- `__tests__/export/front-back-matter-templates.test.ts` — unit tests for template functions

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx` — initialize `content = { subtype: null, fields: {} }` for `front_matter` and `back_matter` items
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — branch on type+subtype, render the new front-back-matter renderer for non-legacy FM/BM items
- `app/api/export/[bookId]/[format]/route.ts` — include FM/BM items in the export iteration, route each through the templates or chapter renderer

**No DB migration.** No schema changes.

---

## Task 1: Shared types + sub-type picker

**Files:**
- Create: `lib/front-back-matter/types.ts`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/subtype-picker.tsx`

- [ ] **Step 1: Create the types module**

Create `lib/front-back-matter/types.ts`:

```ts
// Sub-type discriminator for front_matter / back_matter binder items.
// Stored at binderItems.content.subtype.

export type FrontMatterSubtype =
  | 'title_page'
  | 'copyright'
  | 'dedication'
  | 'custom'

export type BackMatterSubtype =
  | 'acknowledgments'
  | 'about_author'
  | 'custom'

export type Subtype = FrontMatterSubtype | BackMatterSubtype

// Field shapes per specialized subtype. 'custom' has no fields.

export type TitlePageFields = {
  bookTitle: string
  subtitle?: string
  authorName: string
  publisherName?: string
}

export type CopyrightFields = {
  copyrightYear: number
  copyrightHolder: string
  publisherName?: string
  isbn?: string
  extraNotice?: string
}

export type DedicationFields = {
  text: string
}

export type AcknowledgmentsFields = {
  text: string
}

export type AboutAuthorFields = {
  bio: string
  photoUrl?: string
  links?: Array<{ label: string; url: string }>
}

// Discriminated union for binderItems.content (FM/BM only).
export type FrontBackMatterContent =
  | { subtype: null; fields: Record<string, never> }
  | { subtype: 'title_page'; fields: TitlePageFields }
  | { subtype: 'copyright'; fields: CopyrightFields }
  | { subtype: 'dedication'; fields: DedicationFields }
  | { subtype: 'acknowledgments'; fields: AcknowledgmentsFields }
  | { subtype: 'about_author'; fields: AboutAuthorFields }
  | { subtype: 'custom'; fields: Record<string, never> }

// Picker option descriptors (rendered in the SubtypePicker UI).

export type PickerOption = {
  subtype: Exclude<Subtype, 'custom'> | 'custom'
  label: string
  description: string
}

export const FRONT_MATTER_OPTIONS: PickerOption[] = [
  { subtype: 'title_page', label: 'Title Page', description: 'Book title, author, publisher' },
  { subtype: 'copyright',  label: 'Copyright',  description: 'Copyright year, publisher, ISBN' },
  { subtype: 'dedication', label: 'Dedication', description: '"For my wife"' },
  { subtype: 'custom',     label: 'Custom',     description: 'Free-form prose' },
]

export const BACK_MATTER_OPTIONS: PickerOption[] = [
  { subtype: 'acknowledgments', label: 'Acknowledgments',  description: 'Thank-you to people who helped' },
  { subtype: 'about_author',    label: 'About the Author', description: 'Bio, photo, links' },
  { subtype: 'custom',          label: 'Custom',           description: 'Free-form prose' },
]
```

- [ ] **Step 2: Create the picker component**

Create `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/subtype-picker.tsx`:

```tsx
'use client'

import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import {
  FRONT_MATTER_OPTIONS,
  BACK_MATTER_OPTIONS,
  type Subtype,
} from '@/lib/front-back-matter/types'

type Props = {
  itemId: string
  itemType: 'front_matter' | 'back_matter'
}

export function SubtypePicker({ itemId, itemType }: Props) {
  const { updateBinderItem } = useBookEditor()
  const options = itemType === 'front_matter' ? FRONT_MATTER_OPTIONS : BACK_MATTER_OPTIONS
  const heading = itemType === 'front_matter'
    ? 'What kind of front matter is this?'
    : 'What kind of back matter is this?'

  async function pick(subtype: Subtype) {
    const newContent = { subtype, fields: {} }
    // Optimistic
    updateBinderItem(itemId, { content: newContent })
    await updateBinderItemAction(itemId, { content: newContent })
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        <h2 className="text-lg font-semibold text-foreground mb-4 text-center">{heading}</h2>
        <div className="flex flex-col gap-2">
          {options.map(opt => (
            <button
              key={opt.subtype}
              onClick={() => pick(opt.subtype)}
              className="flex flex-col items-start gap-1 rounded-lg border border-border p-4 text-left hover:border-brand/40 hover:bg-surface-elevated transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add lib/front-back-matter/ "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/"
git commit -m "feat(studio): shared FM/BM types + sub-type picker UI

Adds the discriminated-union FrontBackMatterContent type that lives
on binderItems.content for front_matter and back_matter items, plus
the SubtypePicker component shown in the editor pane when an item
has subtype === null. Picker writes through updateBinderItemAction.
No DB migration."
```

---

## Task 2: BinderAddMenu — initialize FM/BM content shape

**File:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`

New items created by the `+ Add` menu need `content = { subtype: null, fields: {} }` for FM/BM types so the chapter-editor can distinguish them from legacy items.

- [ ] **Step 1: Modify `handleAdd`**

Find the `createBinderItemAction` call. Currently:
```tsx
const result = await createBinderItemAction({
  bookId,
  parentId: null,
  type: option.type,
  title: option.defaultTitle,
  order,
})
```

`createBinderItemAction` does not currently accept a `content` argument. Two paths:

**Path A (preferred):** Extend `createBinderItemAction` to accept an optional `content` and pass it through. Schema change in `lib/validations/book.ts` to `createBinderItemSchema` — add `content: z.record(z.string(), z.unknown()).optional().nullable()`.

**Path B:** Create the item, then immediately call `updateBinderItemAction` to set content.

Use Path A — one round-trip vs two. Edit `lib/validations/book.ts` to add the optional content field to `createBinderItemSchema`, edit `lib/actions/binder.actions.ts` to insert `content: parsed.data.content ?? null` in the binder insert.

- [ ] **Step 2: Pass content from BinderAddMenu**

In `handleAdd`, after determining `option`, add:
```tsx
const initialContent =
  option.type === 'front_matter' || option.type === 'back_matter'
    ? { subtype: null, fields: {} }
    : null
```

Then pass through to `createBinderItemAction`:
```tsx
const result = await createBinderItemAction({
  bookId,
  parentId: null,
  type: option.type,
  title: option.defaultTitle,
  order,
  content: initialContent,
})
```

Mirror the same `content` in the optimistic `addBinderItem` call.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add app/ lib/
git commit -m "feat(studio): initialize FM/BM items with { subtype: null, fields: {} }

New front_matter / back_matter items created via + Add now seed
binderItems.content = { subtype: null, fields: {} } so the
chapter-editor's render path can distinguish new items (show picker)
from legacy items (content === null → show TipTap).

createBinderItemAction now accepts an optional content payload; the
Zod createBinderItemSchema extended to validate it."
```

---

## Task 3: Chapter-editor render branching

**File:** `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`

The render path needs to detect FM/BM items and route them to the new renderer before falling through to TipTap.

- [ ] **Step 1: Create the renderer index**

Create `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/index.tsx`:

```tsx
'use client'

import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { FrontBackMatterContent } from '@/lib/front-back-matter/types'
import { SubtypePicker } from './subtype-picker'
// Form imports added in Task 4:
// import { TitlePageForm } from './title-page-form'
// import { CopyrightForm } from './copyright-form'
// import { DedicationForm } from './dedication-form'
// import { AcknowledgmentsForm } from './acknowledgments-form'
// import { AboutAuthorForm } from './about-author-form'

type Props = {
  item: BinderItemRow
}

// Returns null when this item should fall through to the TipTap editor
// (legacy item: content === null). Returns a React element for everything
// else (picker for null subtype, specialized forms for specialized subtypes,
// or null for subtype === 'custom' which also falls through to TipTap).
export function FrontBackMatterRenderer({ item }: Props): React.ReactElement | null {
  if (item.type !== 'front_matter' && item.type !== 'back_matter') return null
  if (item.content === null || item.content === undefined) return null  // legacy → TipTap

  const content = item.content as FrontBackMatterContent

  if (content.subtype === null) {
    return <SubtypePicker itemId={item.id} itemType={item.type} />
  }

  if (content.subtype === 'custom') return null  // → TipTap

  // Specialized forms — wired up in Task 4
  // For now, fallback to a placeholder so this file compiles before Task 4 forms exist.
  return (
    <main className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
      <p>Form for "{content.subtype}" — coming in Task 4.</p>
    </main>
  )
}
```

- [ ] **Step 2: Wire the renderer into `chapter-editor.tsx`**

In `chapter-editor.tsx`, add the import at the top:
```tsx
import { FrontBackMatterRenderer } from '../front-back-matter'
```

Then in the render path of `ChapterEditor`, BEFORE the `if (activeItem && !isChapterType)` branch, add:

```tsx
// Front/back matter items with new-style content render via the FM/BM
// renderer. Legacy items (content === null) fall through to TipTap.
if (activeItem && (activeItem.type === 'front_matter' || activeItem.type === 'back_matter')) {
  const fbm = <FrontBackMatterRenderer item={activeItem} />
  if (fbm !== null) return fbm
}
```

This guard ensures the existing TipTap path runs only when the renderer returns null (legacy items or `subtype: 'custom'`).

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/" "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx"
git commit -m "feat(studio): branch chapter-editor render for FM/BM items

ChapterEditor now routes front_matter / back_matter items through
the new FrontBackMatterRenderer. The renderer returns null for
legacy items (content === null) and for subtype === 'custom', both
of which fall through to the existing TipTap editor. New items with
subtype === null see the SubtypePicker. Specialized subtypes
render a placeholder for now (forms land in Task 4)."
```

---

## Task 4: The 5 form components

**Files (create each):**
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/title-page-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/copyright-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/dedication-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/acknowledgments-form.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/about-author-form.tsx`

All five share the same persistence pattern: 2-second debounced autosave via `updateBinderItemAction({ content: { subtype, fields: nextFields } })`. The save-status indicator (Saved / Saving / Unsaved) is the toolbar's existing one — these forms hook into it via `useBookEditor()` like the chapter editor does.

- [ ] **Step 1: Create `title-page-form.tsx`**

This is the template all 5 forms follow. Full code for Title Page:

```tsx
'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { TitlePageFields } from '@/lib/front-back-matter/types'

type Props = {
  itemId: string
  initialFields: Partial<TitlePageFields>
}

export function TitlePageForm({ itemId, initialFields }: Props) {
  const { bookTitle, updateBinderItem } = useBookEditor()
  const [fields, setFields] = useState<TitlePageFields>({
    bookTitle: initialFields.bookTitle ?? bookTitle,
    subtitle: initialFields.subtitle ?? '',
    authorName: initialFields.authorName ?? '',
    publisherName: initialFields.publisherName ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function patch(key: keyof TitlePageFields, value: string) {
    const next = { ...fields, [key]: value }
    setFields(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const newContent = { subtype: 'title_page' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      await updateBinderItemAction(itemId, { content: newContent })
    }, 2000)
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header>
          <h2 className="text-lg font-semibold text-foreground">Title Page</h2>
          <p className="text-xs text-muted-foreground mt-0.5">The opening page of your book.</p>
        </header>

        <Field label="Book title" value={fields.bookTitle} onChange={v => patch('bookTitle', v)} />
        <Field label="Subtitle (optional)" value={fields.subtitle ?? ''} onChange={v => patch('subtitle', v)} />
        <Field label="Author name" value={fields.authorName} onChange={v => patch('authorName', v)} />
        <Field label="Publisher (optional)" value={fields.publisherName ?? ''} onChange={v => patch('publisherName', v)} />
      </div>
    </main>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-brand/40 transition-colors"
      />
    </label>
  )
}
```

- [ ] **Step 2: Create `copyright-form.tsx`**

Same pattern. Fields: `copyrightYear` (number input, default `new Date().getFullYear()`), `copyrightHolder` (text), `publisherName?` (text), `isbn?` (text, monospace), `extraNotice?` (textarea, 4 rows). Header: "Copyright" / "Legal info shown after the title page."

- [ ] **Step 3: Create `dedication-form.tsx`**

Same pattern, single textarea field `text`, max 500 chars enforced via `maxLength` attribute. Header: "Dedication" / "A short note to whom this book is for."

- [ ] **Step 4: Create `acknowledgments-form.tsx`**

Same pattern, single textarea `text`, no max length, 12+ rows tall. Header: "Acknowledgments" / "Thank the people who helped."

- [ ] **Step 5: Create `about-author-form.tsx`**

More complex. Three fields:
- `bio` (textarea, 8 rows)
- `photoUrl` (optional) — wire to the existing Cloudinary widget. Reuse the image-upload component already used elsewhere in the codebase (find it via `grep -rn 'cloudinary' app/ lib/components/`).
- `links` — array of `{ label, url }` pairs. UI: a list of rows with two inputs each + a delete button per row, plus an "+ Add link" button at the bottom.

Header: "About the Author" / "A short bio with optional photo and links."

- [ ] **Step 6: Wire all 5 forms into the renderer index**

Update `app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/index.tsx`. Replace the placeholder `<main>` with:

```tsx
const sub = content.subtype
const fields = (content as { fields?: Partial<Record<string, unknown>> }).fields ?? {}

if (sub === 'title_page')      return <TitlePageForm      itemId={item.id} initialFields={fields as any} />
if (sub === 'copyright')       return <CopyrightForm      itemId={item.id} initialFields={fields as any} />
if (sub === 'dedication')      return <DedicationForm     itemId={item.id} initialFields={fields as any} />
if (sub === 'acknowledgments') return <AcknowledgmentsForm itemId={item.id} initialFields={fields as any} />
if (sub === 'about_author')    return <AboutAuthorForm    itemId={item.id} initialFields={fields as any} />

return null  // unknown subtype — fall through to TipTap
```

Add the corresponding form imports at the top.

- [ ] **Step 7: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/"
git commit -m "feat(studio): five M2 specialized forms for FM/BM items

Title Page, Copyright, Dedication, Acknowledgments, About the Author.
Each is a small focused component that loads initial values from the
binderItems.content.fields jsonb and autosaves via a 2-second
debounced updateBinderItemAction. Same persistence pattern as the
chapter editor.

About-the-Author form reuses the existing Cloudinary image upload
widget for the optional author photo, and renders an add/remove list
of label+url pairs for external links."
```

---

## Task 5: Export template functions + unit tests

**Files:**
- Create: `lib/export/front-back-matter-templates.ts`
- Create: `__tests__/export/front-back-matter-templates.test.ts`

10 pure functions: `(fields, format) → string`. Each renders an HTML fragment (the docx pipeline converts HTML to docx via `html-to-docx`; the epub pipeline embeds HTML directly).

- [ ] **Step 1: Write the failing test file**

Create `__tests__/export/front-back-matter-templates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  renderTitlePage,
  renderCopyright,
  renderDedication,
  renderAcknowledgments,
  renderAboutAuthor,
} from '@/lib/export/front-back-matter-templates'

describe('renderTitlePage', () => {
  it('produces centered HTML with title and author', () => {
    const html = renderTitlePage({
      bookTitle: 'The Sun Also Rises',
      authorName: 'Ernest Hemingway',
    })
    expect(html).toContain('The Sun Also Rises')
    expect(html).toContain('Ernest Hemingway')
    expect(html.toLowerCase()).toContain('text-align')
  })

  it('includes subtitle and publisher when provided', () => {
    const html = renderTitlePage({
      bookTitle: 'Book',
      subtitle: 'A Tale',
      authorName: 'Author',
      publisherName: 'Pub',
    })
    expect(html).toContain('A Tale')
    expect(html).toContain('Pub')
  })

  it('escapes HTML special chars in fields', () => {
    const html = renderTitlePage({ bookTitle: '<script>', authorName: 'A&B' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('A&amp;B')
  })
})

describe('renderCopyright', () => {
  it('includes copyright year and holder', () => {
    const html = renderCopyright({
      copyrightYear: 2026,
      copyrightHolder: 'Jane Doe',
    })
    expect(html).toContain('2026')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('©')
  })

  it('includes ISBN when provided', () => {
    const html = renderCopyright({
      copyrightYear: 2026,
      copyrightHolder: 'X',
      isbn: '978-0-13-468599-1',
    })
    expect(html).toContain('978-0-13-468599-1')
  })
})

describe('renderDedication', () => {
  it('renders dedication text in italic', () => {
    const html = renderDedication({ text: 'For my wife.' })
    expect(html).toContain('For my wife.')
    expect(html.toLowerCase()).toMatch(/italic|<em>/)
  })

  it('preserves paragraph breaks', () => {
    const html = renderDedication({ text: 'Line 1\n\nLine 2' })
    expect(html.match(/<p[^>]*>/g)?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('renderAcknowledgments', () => {
  it('renders the heading + paragraphs', () => {
    const html = renderAcknowledgments({ text: 'Thanks to my editor.' })
    expect(html.toLowerCase()).toContain('acknowledgments')
    expect(html).toContain('Thanks to my editor.')
  })
})

describe('renderAboutAuthor', () => {
  it('includes bio text', () => {
    const html = renderAboutAuthor({ bio: 'An author of many books.' })
    expect(html).toContain('An author of many books.')
  })

  it('includes photo when provided', () => {
    const html = renderAboutAuthor({
      bio: 'b',
      photoUrl: 'https://example.com/p.jpg',
    })
    expect(html).toContain('https://example.com/p.jpg')
    expect(html).toContain('<img')
  })

  it('renders links as a list', () => {
    const html = renderAboutAuthor({
      bio: 'b',
      links: [{ label: 'Website', url: 'https://a.com' }],
    })
    expect(html).toContain('Website')
    expect(html).toContain('https://a.com')
  })
})
```

Run:
```bash
npm test -- front-back-matter-templates
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement the templates**

Create `lib/export/front-back-matter-templates.ts`:

```ts
import { escapeHtml } from './tiptap-to-html'
import type {
  TitlePageFields,
  CopyrightFields,
  DedicationFields,
  AcknowledgmentsFields,
  AboutAuthorFields,
} from '@/lib/front-back-matter/types'

// Each function returns an HTML string. The docx pipeline (lib/export/docx.ts)
// converts HTML to docx via html-to-docx; the epub pipeline embeds HTML directly.

export function renderTitlePage(f: TitlePageFields): string {
  const parts: string[] = []
  parts.push(`<div style="text-align:center; page-break-after:always; padding-top:3in">`)
  parts.push(`<h1 style="font-size:24pt; margin:0 0 12pt 0">${escapeHtml(f.bookTitle)}</h1>`)
  if (f.subtitle) parts.push(`<h2 style="font-size:14pt; font-style:italic; margin:0 0 48pt 0">${escapeHtml(f.subtitle)}</h2>`)
  parts.push(`<p style="font-size:14pt; margin:0 0 48pt 0">${escapeHtml(f.authorName)}</p>`)
  if (f.publisherName) parts.push(`<p style="font-size:11pt; margin-top:96pt">${escapeHtml(f.publisherName)}</p>`)
  parts.push(`</div>`)
  return parts.join('\n')
}

export function renderCopyright(f: CopyrightFields): string {
  const parts: string[] = []
  parts.push(`<div style="page-break-after:always; padding-top:3in; font-size:10pt">`)
  parts.push(`<p>© ${f.copyrightYear} ${escapeHtml(f.copyrightHolder)}</p>`)
  if (f.publisherName) parts.push(`<p>Published by ${escapeHtml(f.publisherName)}</p>`)
  if (f.isbn) parts.push(`<p>ISBN: ${escapeHtml(f.isbn)}</p>`)
  if (f.extraNotice) {
    const escapedParagraphs = f.extraNotice.split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join('')
    parts.push(escapedParagraphs)
  } else {
    parts.push(`<p>All rights reserved.</p>`)
  }
  parts.push(`</div>`)
  return parts.join('\n')
}

export function renderDedication(f: DedicationFields): string {
  const paragraphs = f.text.split(/\n\n+/).map(p =>
    `<p style="text-align:center; font-style:italic; margin:12pt 0">${escapeHtml(p)}</p>`
  ).join('')
  return `<div style="page-break-after:always; padding-top:3in">${paragraphs}</div>`
}

export function renderAcknowledgments(f: AcknowledgmentsFields): string {
  const paragraphs = f.text.split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join('')
  return `<div style="page-break-after:always">
    <h1 style="font-size:14pt">Acknowledgments</h1>
    ${paragraphs}
  </div>`
}

export function renderAboutAuthor(f: AboutAuthorFields): string {
  const parts: string[] = []
  parts.push(`<div style="page-break-after:always">`)
  parts.push(`<h1 style="font-size:14pt">About the Author</h1>`)
  if (f.photoUrl) {
    parts.push(`<img src="${escapeHtml(f.photoUrl)}" alt="" style="max-width:2in; float:left; margin:0 12pt 6pt 0">`)
  }
  const bioParas = f.bio.split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join('')
  parts.push(bioParas)
  if (f.links && f.links.length > 0) {
    const linkItems = f.links
      .map(l => `<li>${escapeHtml(l.label)}: <a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></li>`)
      .join('')
    parts.push(`<ul>${linkItems}</ul>`)
  }
  parts.push(`</div>`)
  return parts.join('\n')
}
```

Run:
```bash
npm test -- front-back-matter-templates
```

Expected: all assertions pass.

- [ ] **Step 3: Commit**

```bash
git add lib/export/front-back-matter-templates.ts "__tests__/export/front-back-matter-templates.test.ts"
git commit -m "feat(studio): export templates for the 5 FM/BM subtypes

Pure functions: fields → HTML. Used by both docx (via html-to-docx
which converts HTML to docx) and epub (which embeds HTML directly).
All output HTML-escaped to prevent injection from user-supplied
fields. Page breaks via page-break-after:always on each section's
outer div. Vitest unit tests cover happy path + edge cases (HTML
escaping, optional fields, link rendering, photo embed)."
```

---

## Task 6: Wire templates into the export route

**File:** `app/api/export/[bookId]/[format]/route.ts`

Today the export route filters to `type === 'chapter'` only. Front/back matter items are not exported. This task changes that.

- [ ] **Step 1: Update the export iteration**

Modify the query and iteration in `route.ts` to include front_matter and back_matter items. Read the current file first.

The new flow:
1. Fetch all binder items + chapter content + binder content (already happens — `chapters.content` via leftJoin; add `binderItems.content`).
2. Split into three lists by type, preserving binder order:
   - `frontMatterItems = items where type === 'front_matter'`
   - `chapterItems = items where type === 'chapter'`
   - `backMatterItems = items where type === 'back_matter'`
3. Map each FM/BM item to a `ChapterInput` (existing shape: `{ title, content }`):
   - If `binderItems.content === null` OR `subtype === 'custom'` → use `chapter.content` (TipTap, existing behavior)
   - Otherwise → use the matching template's HTML output as a pre-rendered string. Need a new ChapterInput variant or a sibling input type that the renderer respects.

The cleanest path: extend `ChapterInput` to allow `htmlOverride?: string`. If present, the export pipeline emits it directly (skipping `tiptapToHtml`).

```ts
// lib/export/docx.ts
export type ChapterInput = {
  title: string
  content: unknown
  htmlOverride?: string  // when present, used instead of tiptap → html
}
```

Update `chaptersToHtml` in `docx.ts`:
```ts
function chaptersToHtml(chapters: ChapterInput[], css: string): string {
  const body = chapters
    .map(ch => {
      const content = ch.htmlOverride ?? tiptapToHtml(ch.content)
      return `<h1>${escapeHtml(ch.title)}</h1>${content || '<p></p>'}`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`
}
```

Mirror the same change in `lib/export/epub.ts` if it has a similar chaptersToHtml.

- [ ] **Step 2: Build the inputs in `route.ts`**

Replace the existing `chapterInputs` construction with:

```ts
import {
  renderTitlePage, renderCopyright, renderDedication,
  renderAcknowledgments, renderAboutAuthor,
} from '@/lib/export/front-back-matter-templates'

// Helper to map an FM/BM item to a ChapterInput
function fbmToInput(item: { title: string | null; binderContent: unknown; chapterContent: unknown }): ChapterInput | null {
  const c = item.binderContent as { subtype?: string; fields?: Record<string, unknown> } | null
  if (c === null || c === undefined) {
    // Legacy item: use TipTap content
    return { title: item.title ?? '', content: item.chapterContent }
  }
  if (c.subtype === 'custom' || !c.subtype) {
    return { title: item.title ?? '', content: item.chapterContent }
  }
  switch (c.subtype) {
    case 'title_page':      return { title: '', content: null, htmlOverride: renderTitlePage(c.fields as any) }
    case 'copyright':       return { title: '', content: null, htmlOverride: renderCopyright(c.fields as any) }
    case 'dedication':      return { title: '', content: null, htmlOverride: renderDedication(c.fields as any) }
    case 'acknowledgments': return { title: '', content: null, htmlOverride: renderAcknowledgments(c.fields as any) }
    case 'about_author':    return { title: '', content: null, htmlOverride: renderAboutAuthor(c.fields as any) }
    default:                return null  // unknown subtype — skip
  }
}

const frontInputs = rows
  .filter(r => r.type === 'front_matter')
  .map(r => fbmToInput({ title: r.title, binderContent: r.binderContent, chapterContent: r.chapterContent }))
  .filter((x): x is ChapterInput => x !== null)

const chapterInputs = rows
  .filter(r => r.type === 'chapter')
  .map(r => ({ title: r.title ?? 'Untitled', content: r.chapterContent }))

const backInputs = rows
  .filter(r => r.type === 'back_matter')
  .map(r => fbmToInput({ title: r.title, binderContent: r.binderContent, chapterContent: r.chapterContent }))
  .filter((x): x is ChapterInput => x !== null)

const allInputs = [...frontInputs, ...chapterInputs, ...backInputs]
```

Update the existing empty-chapter guard to use `chapterInputs.length === 0` (back matter without chapters still shouldn't be exportable on its own).

Update the calls to `generateDocx` and `generateEpub` to pass `allInputs` instead of `chapterInputs`.

You also need to extend the SELECT in the rows query to include `binderItems.content` (alias to `binderContent`) since it's currently not selected. Modify the `.select({...})` call.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 4: Commit**

```bash
git add app/api/export/ lib/export/
git commit -m "feat(studio): export route renders FM/BM items via subtype templates

The export iteration previously dropped front_matter / back_matter
items — only type === 'chapter' was exported. Now front-matter items
come first (correctly positioned), back-matter items come last, and
each is rendered through its subtype template (or via TipTap for
custom/legacy items).

Added htmlOverride to ChapterInput so the templates' pre-rendered
HTML bypasses the tiptap-to-html conversion."
```

---

## Task 7: Final manual verification + Resume Here update

- [ ] **Step 1: Manual checklist** (from spec §6)

Per-task verification already happened during dev. Re-run the spec's full checklist end-to-end:

1. Create a Front matter item via `+ Add`. Picker appears. Click "Title Page". Form renders with `bookTitle` and `authorName` pre-filled from book/user.
2. Edit `subtitle`, wait 2 seconds — toolbar save indicator: Unsaved → Saving → Saved.
3. Reload the page. The Title Page form opens directly (no picker); fields populated.
4. Create a Back matter item. Picker shows Acknowledgments / About the Author / Custom (no front-only options leaked).
5. Create one of each M2 sub-type. Export to .docx (open in Word or LibreOffice). Confirm:
   - Title Page centered, book title large, author below, publisher at bottom
   - Copyright shows © year + ISBN
   - Dedication italicized centered
   - Acknowledgments has heading + paragraphs
   - About the Author shows photo (if uploaded) + bio + link list
6. Export the same book to .epub (open in Calibre / Apple Books). Same visual checks.
7. Create a Custom front matter item. Picker → Custom → TipTap editor loads. Type prose. Export → prose appears.
8. Old book in DB with a legacy front_matter item (`content === null`, prose in `chapter.content`) → still opens in TipTap editor, no picker, no data loss.

- [ ] **Step 2: Automated checks**

```bash
npm test
npx tsc --noEmit
```

Both clean. 76 → ~82 tests passing (new template tests added in Task 5).

- [ ] **Step 3: Update AGENTS.md Resume Here**

Replace the Resume Here block to mark SP3 Feature B done and point to Feature C (Outline editor):

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** Studio Editor Audit — SP3 Feature C (Outline editor) — not started
> **Active branch:** `main`
> **Last commit:** <git log -1 --format=%s>
>
> 1. ~~SP1 Stability~~ DONE.
> 2. ~~SP2 Binder UX~~ DONE.
> 3. **SP3 Specialized Editors (IN FLIGHT)** — Feature B (Front/Back Matter) DONE; Feature C (Outline) next; Feature D (Notes) after.
> 4. SP4 Toolbar + modes.
> 5. SP5 Metadata + persistence.
> 6. SP6 New surfaces.
>
> **Next concrete step:** invoke `/brainstorming` for SP3 Feature C — Outline editor. Use `/design-critique` to compare C1 (nested list) vs C2 (card grid) vs C3 (Kanban board) layouts before locking.
```

- [ ] **Step 4: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs: mark SP3 Feature B (Front/Back Matter) complete"
```

---

## Definition of Done

- All 8 manual checklist items pass.
- `npm test` clean (~82 tests).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here reflects Feature B complete, Feature C next.
- ~7 atomic commits on `main`.
