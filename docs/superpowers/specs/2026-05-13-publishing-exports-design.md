# Phase 5 — Publishing & Exports Design

**Date:** 2026-05-13
**Status:** Approved

## Overview

Phase 5 adds file export (DOCX and EPUB) and a publishing metadata panel to the Studio. The target user is a hobbyist or aspiring writer who wants to get their draft out — most will never fill in an ISBN or publisher name. Export is fast and requires no metadata. Publishing details are optional, premium-gated, and hidden by default.

---

## Scope

**In scope:**
- Export modal (toolbar button) with DOCX and EPUB download
- DOCX generation: Manuscript and Basic styles
- EPUB generation: EPUB 3, one chapter per file
- PDF: disabled stub ("coming soon")
- Publishing metadata panel in the Studio sidebar (premium-gated, collapsed by default)

**Out of scope:**
- Print-ready PDF generation (Puppeteer/service dependency — deferred)
- Export queue or async job processing
- Export history or download tracking
- Billing UI for premium upsell (Phase 8)

---

## Architecture

### Export API Routes

```
GET /api/export/[bookId]/docx?style=manuscript|basic
GET /api/export/[bookId]/epub
GET /api/export/[bookId]/pdf   → 501 Not Implemented
```

All routes follow the same pattern:
1. Authenticate caller via `requireAuth()`
2. Verify book ownership (`assertBookOwner` logic inline or via helper)
3. Fetch all binder items for the book, ordered by `position`, with their chapters
4. Generate file
5. Return binary response with `Content-Disposition: attachment; filename="[title].[ext]"` and appropriate `Content-Type`

Routes live in `app/api/export/[bookId]/[format]/route.ts` using a single dynamic segment for format.

**No metadata required.** Export works on any book regardless of publishing metadata state. Title comes from `books.title`, author name from `userProfiles.displayName` (fallback: `userProfiles.username`).

### Dependencies

| Package | Purpose |
|---|---|
| `docx` | DOCX file generation |
| `jszip` | EPUB packaging (ZIP construction) |

No other new runtime dependencies. Both run server-side only.

---

## DOCX Generation

Uses the `docx` npm package. Chapter content is TipTap JSON (`{ type: 'doc', content: [...] }`) — converted to `docx` `Paragraph` and `TextRun` objects by walking the node tree.

**Node mapping:**
- `paragraph` → `Paragraph`
- `text` with marks → `TextRun` with `bold`, `italics`, `strike` as appropriate
- `hardBreak` → line break within paragraph
- `heading` (level 1–3) → `HeadingLevel.HEADING_1/2/3`
- `bulletList` / `orderedList` → `Paragraph` with `bullet` / `numbering`
- Empty paragraph → blank `Paragraph` (scene break)

**Manuscript style:**
- Font: Times New Roman, 12pt
- Line spacing: double (276 twips)
- Margins: 1 inch all sides (1440 twips)
- Running header: `Author Name / Title / Page #` (right-aligned)
- Chapter title rendered as Heading 1, centered, with 2 blank paragraphs before body
- First paragraph of each chapter: no indent. Subsequent paragraphs: 0.5" first-line indent

**Basic style:**
- Font: Calibri, 11pt
- Line spacing: single
- Margins: 1 inch all sides
- No running header
- Chapter title as bold paragraph
- No special indentation

Binder items exported in `position` order. Only items with an associated chapter (not folder nodes) produce content. Folder items produce a section divider paragraph with the folder name if they have a title.

---

## EPUB Generation

Hand-rolled EPUB 3 — no external EPUB library. Output is a ZIP file constructed with `jszip`.

**File structure:**
```
mimetype                          (uncompressed, must be first)
META-INF/container.xml
OEBPS/content.opf                 (manifest + spine)
OEBPS/nav.xhtml                   (navigation document)
OEBPS/styles.css                  (minimal stylesheet)
OEBPS/chapters/ch-001.xhtml
OEBPS/chapters/ch-002.xhtml
...
```

**TipTap JSON → XHTML:** Same node walk as DOCX but produces HTML strings. `<p>`, `<strong>`, `<em>`, `<s>`, `<h1>`–`<h3>`, `<ul>/<ol>/<li>`. Each chapter is a standalone XHTML file with a minimal `<!DOCTYPE html>` wrapper.

**OPF metadata** (from book record + user profile):
- `dc:title` — book title
- `dc:creator` — author display name
- `dc:language` — `en` (hardcoded for v1)
- `dc:identifier` — ISBN if set in publishing metadata, otherwise a UUID
- `dc:description` — book synopsis if set
- `meta name="cover"` — points to cover image if `books.coverUrl` is set (fetched and embedded as `cover.jpg`)

**Spine:** All chapters in binder position order. Folder items are skipped (not emitted as chapters).

**Response:** `Content-Type: application/epub+zip`, `Content-Disposition: attachment; filename="[slug].epub"`.

---

## Export Modal

Triggered by an "Export" button (↓ icon + label) in the Studio top toolbar, to the right of the autosave indicator.

**Modal layout:**
- Header: book cover thumbnail + title + word count
- Three format tabs: **DOCX** | **EPUB** | **PDF**
- Active tab shows format-specific content

**DOCX tab:**
- Two style options (Manuscript / Basic) rendered as a toggle/pill selector
- Description of selected style below the toggle
- "Download DOCX" button — triggers fetch to `/api/export/[bookId]/docx?style=manuscript|basic`, receives blob, triggers browser download

**EPUB tab:**
- Single "Download EPUB" button
- Short description: "For e-readers and self-publishing platforms"

**PDF tab:**
- Disabled state — grayed out content
- Label: "Print-ready PDF — coming soon"
- No button

**Download flow (client-side):**
```ts
const res = await fetch(`/api/export/${bookId}/docx?style=${style}`)
const blob = await res.blob()
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = filename  // from Content-Disposition header or derived from title
a.click()
URL.revokeObjectURL(url)
```

Loading state on the Download button during fetch. Error state if the request fails.

---

## Publishing Metadata Panel

Added to the existing Studio right-sidebar metadata panel (the panel that already shows chapter status, synopsis, notes, etc.). Rendered as a collapsible section at the bottom of that panel.

**Collapsed state:** A row reading "▸ Publishing details" with a small `Premium` badge. Collapsed by default on every session.

**Expanded state:** Six fields rendered as a simple form:

| Field | Input | Notes |
|---|---|---|
| Subtitle | Text input | Optional |
| Author bio | Textarea (3 rows) | Optional |
| Dedication | Text input | Optional |
| ISBN | Text input | Optional, no validation |
| Publisher name | Text input | Optional |
| Trim size | Select | 5×8 · 5.5×8.5 · 6×9 · (blank = unset) |

**Save behavior:** Autosaves on blur (each field individually) via `updatePublishingMetadataAction`. Free users receive `{ success: false, error: 'PREMIUM_REQUIRED:publishing_metadata' }` and see an inline upgrade prompt instead of saving. Premium users save silently.

**Load behavior:** `getPublishingMetadataAction(bookId)` called on panel expand (lazy — not on page load). Fields populate from the result.

---

## Files to Create / Modify

### New
- `app/api/export/[bookId]/[format]/route.ts` — unified export route handler
- `lib/export/docx.ts` — TipTap JSON → DOCX conversion
- `lib/export/epub.ts` — TipTap JSON → EPUB package
- `lib/export/tiptap-to-html.ts` — shared TipTap JSON → HTML string (used by EPUB)
- `app/[locale]/(app)/studio/[bookId]/_components/export-modal.tsx` — export modal UI
- `app/[locale]/(app)/studio/[bookId]/_components/publishing-metadata-panel.tsx` — publishing metadata form

### Modified
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-toolbar.tsx` (or equivalent toolbar file) — add Export button
- `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx` — add Publishing section at bottom

---

## Error States

| Condition | Behavior |
|---|---|
| Book has no chapters | Export returns empty document with just the title |
| Chapter content is null/empty | Chapter is skipped in export |
| Cover image fetch fails (EPUB) | Skip cover, continue without it |
| Export API auth fails | 401 response; modal shows "Sign in required" |
| Export API book-not-found or not-owner | 404 response; modal shows generic error |
| Fetch error client-side | Button resets, inline error message shown |
