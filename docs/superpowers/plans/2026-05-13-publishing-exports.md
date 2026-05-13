# Publishing & Exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DOCX and EPUB export (real file download) plus a collapsible publishing metadata panel to the Studio, via an Export modal launched from the editor toolbar.

**Architecture:** Three API routes (`/api/export/[bookId]/[format]`) return binary files generated server-side from TipTap JSON chapter content. The Export button in `editor-toolbar.tsx` opens a client modal that fetches and downloads the file as a Blob. Publishing metadata (subtitle, ISBN, etc.) is a collapsible section at the bottom of the existing `metadata-panel.tsx`, premium-gated on save.

**Tech Stack:** Next.js 16 API routes, `html-to-docx` (DOCX generation), `jszip` (EPUB packaging), `better-auth` session in API routes, Drizzle ORM, Vitest for unit tests.

---

## File Map

| Action | File |
|---|---|
| Create | `lib/export/tiptap-to-html.ts` |
| Create | `lib/export/__tests__/tiptap-to-html.test.ts` |
| Create | `lib/export/docx.ts` |
| Create | `lib/export/epub.ts` |
| Create | `app/api/export/[bookId]/[format]/route.ts` |
| Create | `app/[locale]/(app)/studio/[bookId]/_components/export-modal.tsx` |
| Modify | `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` |
| Modify | `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx` |

---

## Task 1: TipTap JSON → HTML converter

**Files:**
- Create: `lib/export/tiptap-to-html.ts`
- Create: `lib/export/__tests__/tiptap-to-html.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/export/__tests__/tiptap-to-html.test.ts
import { describe, it, expect } from 'vitest'
import { tiptapToHtml } from '../tiptap-to-html'

describe('tiptapToHtml', () => {
  it('converts a plain paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>Hello world</p>')
  })

  it('converts bold and italic marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><strong>Bold</strong> and <em>italic</em></p>')
  })

  it('converts headings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter One' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<h1>Chapter One</h1><h2>Section</h2>')
  })

  it('converts bullet and ordered lists', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] },
          ],
        },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<ul><li><p>Item A</p></li><li><p>Item B</p></li></ul>')
  })

  it('converts blockquote', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quote' }] }] },
      ],
    }
    expect(tiptapToHtml(doc)).toBe('<blockquote><p>A quote</p></blockquote>')
  })

  it('converts horizontal rule', () => {
    const doc = { type: 'doc', content: [{ type: 'horizontalRule' }] }
    expect(tiptapToHtml(doc)).toBe('<hr/>')
  })

  it('converts underline and strikethrough', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'under', marks: [{ type: 'underline' }] },
          { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p><u>under</u><s>strike</s></p>')
  })

  it('handles hardBreak', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'hardBreak' },
          { type: 'text', text: 'Line 2' },
        ],
      }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>Line 1<br/>Line 2</p>')
  })

  it('returns empty string for null or empty doc', () => {
    expect(tiptapToHtml(null)).toBe('')
    expect(tiptapToHtml(undefined)).toBe('')
    expect(tiptapToHtml({ type: 'doc', content: [] })).toBe('')
  })

  it('escapes HTML special characters in text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<b>not bold</b> & "quotes"' }] }],
    }
    expect(tiptapToHtml(doc)).toBe('<p>&lt;b&gt;not bold&lt;/b&gt; &amp; &quot;quotes&quot;</p>')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/export/__tests__/tiptap-to-html.test.ts
```

Expected: `FAIL — Cannot find module '../tiptap-to-html'`

- [ ] **Step 3: Implement `tiptapToHtml`**

```ts
// lib/export/tiptap-to-html.ts

type TiptapMark = { type: string }
type TiptapNode = {
  type: string
  text?: string
  marks?: TiptapMark[]
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(renderNode).join('')

    case 'paragraph':
      return `<p>${(node.content ?? []).map(renderNode).join('')}</p>`

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      return `<h${level}>${(node.content ?? []).map(renderNode).join('')}</h${level}>`
    }

    case 'text': {
      let html = escapeHtml(node.text ?? '')
      const marks = node.marks ?? []
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold':      html = `<strong>${html}</strong>`; break
          case 'italic':    html = `<em>${html}</em>`; break
          case 'underline': html = `<u>${html}</u>`; break
          case 'strike':    html = `<s>${html}</s>`; break
          case 'highlight': html = `<mark>${html}</mark>`; break
        }
      }
      return html
    }

    case 'hardBreak':
      return '<br/>'

    case 'horizontalRule':
      return '<hr/>'

    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map(renderNode).join('')}</blockquote>`

    case 'bulletList':
      return `<ul>${(node.content ?? []).map(renderNode).join('')}</ul>`

    case 'orderedList':
      return `<ol>${(node.content ?? []).map(renderNode).join('')}</ol>`

    case 'listItem':
      return `<li>${(node.content ?? []).map(renderNode).join('')}</li>`

    default:
      return (node.content ?? []).map(renderNode).join('')
  }
}

export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  return renderNode(doc as TiptapNode)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/export/__tests__/tiptap-to-html.test.ts
```

Expected: `PASS — 10 tests`

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (previous count + 10 new).

- [ ] **Step 6: Commit**

```bash
git add lib/export/tiptap-to-html.ts lib/export/__tests__/tiptap-to-html.test.ts
git commit -m "feat: TipTap JSON → HTML converter utility for exports"
```

---

## Task 2: DOCX generation utility

**Files:**
- Create: `lib/export/docx.ts`

`html-to-docx` is already installed (`html-to-docx@^1.8.0`). It accepts an HTML string and returns a `Buffer | Blob`. Check the package's type definitions at `node_modules/html-to-docx/dist/html-to-docx.d.ts` before implementing.

- [ ] **Step 1: Check the html-to-docx API**

```bash
cat node_modules/html-to-docx/dist/html-to-docx.d.ts 2>/dev/null || cat node_modules/html-to-docx/README.md | head -100
```

The typical API is:
```ts
HTMLtoDOCX(htmlString: string, headerHTMLString: string | null, options?: Options): Promise<Buffer | Blob>
```

- [ ] **Step 2: Implement `generateDocx`**

```ts
// lib/export/docx.ts
import { tiptapToHtml } from './tiptap-to-html'

export type DocxStyle = 'manuscript' | 'basic'

export type ChapterInput = {
  title: string
  content: unknown // TipTap JSON
}

const MANUSCRIPT_CSS = `
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2; margin: 72pt; }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 24pt; page-break-before: always; }
  p { margin: 0; text-indent: 0.5in; }
  p:first-of-type { text-indent: 0; }
`

const BASIC_CSS = `
  body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; margin: 72pt; }
  h1 { font-size: 13pt; margin-bottom: 12pt; page-break-before: always; }
  p { margin: 0 0 6pt 0; }
`

function chaptersToHtml(chapters: ChapterInput[], css: string): string {
  const body = chapters
    .map(ch => {
      const content = tiptapToHtml(ch.content)
      return `<h1>${ch.title}</h1>${content || '<p></p>'}`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`
}

export async function generateDocx(
  chapters: ChapterInput[],
  style: DocxStyle,
  bookTitle: string,
  authorName: string,
): Promise<Buffer> {
  // Dynamic import avoids shipping to client bundles
  const HTMLtoDOCX = (await import('html-to-docx')).default

  const css = style === 'manuscript' ? MANUSCRIPT_CSS : BASIC_CSS
  const html = chaptersToHtml(chapters, css)

  const headerHtml = style === 'manuscript'
    ? `<p style="text-align:right">${authorName} / ${bookTitle}</p>`
    : null

  const options = {
    header: style === 'manuscript',
    pageNumber: style === 'manuscript',
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch in twips
    font: style === 'manuscript' ? 'Times New Roman' : 'Calibri',
    fontSize: style === 'manuscript' ? 24 : 22, // half-points: 24 = 12pt, 22 = 11pt
  }

  const result = await HTMLtoDOCX(html, headerHtml, options)

  // html-to-docx may return Buffer or Blob depending on environment
  if (Buffer.isBuffer(result)) return result
  if (result instanceof Blob) {
    const arrayBuffer = await result.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  return Buffer.from(result as ArrayBuffer)
}
```

> **Note:** If `html-to-docx` exports differently (e.g., named export or CJS default), adjust the import accordingly. Check `node_modules/html-to-docx/dist/html-to-docx.d.ts` for the exact signature. The `options` object shape may differ — check the README for supported keys.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `lib/export/docx.ts`. Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/export/docx.ts
git commit -m "feat: DOCX generation utility (manuscript + basic styles)"
```

---

## Task 3: EPUB generation utility

**Files:**
- Create: `lib/export/epub.ts`

Uses `jszip` (already installed at `^3.10.1`) to hand-roll EPUB 3. No external EPUB library needed.

- [ ] **Step 1: Implement `generateEpub`**

```ts
// lib/export/epub.ts
import JSZip from 'jszip'
import { tiptapToHtml } from './tiptap-to-html'

export type EpubChapter = {
  title: string
  content: unknown // TipTap JSON
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function chapterXhtml(title: string, bodyHtml: string, cssPath: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="${cssPath}"/>
</head>
<body>
  <h1>${title}</h1>
  ${bodyHtml || '<p></p>'}
</body>
</html>`
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

function contentOpf(
  uid: string,
  title: string,
  author: string,
  isbn: string | null,
  chapterIds: string[],
): string {
  const identifier = isbn ? `urn:isbn:${isbn}` : `urn:uuid:${uid}`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    ...chapterIds.map(id =>
      `<item id="${id}" href="chapters/${id}.xhtml" media-type="application/xhtml+xml"/>`
    ),
  ].join('\n    ')

  const spineItems = chapterIds
    .map(id => `<itemref idref="${id}"/>`)
    .join('\n    ')

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${identifier}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
}

function navXhtml(chapters: { id: string; title: string }[]): string {
  const items = chapters
    .map(ch => `<li><a href="chapters/${ch.id}.xhtml">${ch.title}</a></li>`)
    .join('\n      ')

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head><meta charset="utf-8"/><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${items}
    </ol>
  </nav>
</body>
</html>`
}

const EPUB_CSS = `
body { font-family: Georgia, serif; font-size: 1em; line-height: 1.6; margin: 1em; }
h1 { font-size: 1.4em; margin: 2em 0 1em; }
p { margin: 0 0 0.75em; }
blockquote { margin: 1em 2em; font-style: italic; }
`

export async function generateEpub(
  chapters: EpubChapter[],
  bookTitle: string,
  authorName: string,
  isbn: string | null = null,
): Promise<Buffer> {
  const uid = crypto.randomUUID()
  const zip = new JSZip()

  // mimetype must be first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // META-INF
  zip.file('META-INF/container.xml', containerXml())

  // Build chapter list
  const chapterMeta: { id: string; title: string }[] = []
  const usedIds = new Set<string>()

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    let id = slugify(ch.title) || `chapter-${i + 1}`
    // Ensure unique ids
    if (usedIds.has(id)) id = `${id}-${i + 1}`
    usedIds.add(id)
    chapterMeta.push({ id, title: ch.title })

    const bodyHtml = tiptapToHtml(ch.content)
    zip.file(`OEBPS/chapters/${id}.xhtml`, chapterXhtml(ch.title, bodyHtml, '../styles.css'))
  }

  const chapterIds = chapterMeta.map(c => c.id)
  zip.file('OEBPS/content.opf', contentOpf(uid, bookTitle, authorName, isbn, chapterIds))
  zip.file('OEBPS/nav.xhtml', navXhtml(chapterMeta))
  zip.file('OEBPS/styles.css', EPUB_CSS)

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  return buffer
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. Fix any before continuing.

- [ ] **Step 3: Commit**

```bash
git add lib/export/epub.ts
git commit -m "feat: EPUB generation utility (hand-rolled EPUB 3 via jszip)"
```

---

## Task 4: Export API route

**Files:**
- Create: `app/api/export/[bookId]/[format]/route.ts`

Handles `GET /api/export/[bookId]/docx?style=manuscript|basic`, `GET /api/export/[bookId]/epub`, and `GET /api/export/[bookId]/pdf` (stub).

- [ ] **Step 1: Understand auth in API routes**

In this project, API route auth uses `better-auth`. The pattern is:
```ts
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const session = await auth.api.getSession({ headers: await headers() })
if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

Verify by running:
```bash
grep -r "auth.api.getSession" app/api --include="*.ts" -l
```

If no existing API routes use this, look at `lib/auth.ts` for the exported `auth` object and check `better-auth` docs for session retrieval in API routes. The import path is `@/lib/auth`.

- [ ] **Step 2: Understand the binder/chapter DB query**

The binder items are in the `binderItems` table. Each chapter-type item has a FK to `chapters` via `binderItemId`. The schema exports `binderItems` and `chapters` from `@/db/schema`. The query needs:
```ts
import { db } from '@/db'
import { books, binderItems, chapters, userProfiles } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
```

- [ ] **Step 3: Implement the route**

```ts
// app/api/export/[bookId]/[format]/route.ts
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { books, binderItems, chapters, userProfiles } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { generateDocx, type DocxStyle } from '@/lib/export/docx'
import { generateEpub } from '@/lib/export/epub'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; format: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { bookId, format } = await params

  // PDF stub
  if (format === 'pdf') {
    return Response.json({ error: 'Print-ready PDF coming soon' }, { status: 501 })
  }

  if (format !== 'docx' && format !== 'epub') {
    return Response.json({ error: 'Invalid format' }, { status: 400 })
  }

  // Verify ownership
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
  })
  if (!book) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch author name
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
    columns: { displayName: true, username: true },
  })
  const authorName = profile?.displayName ?? profile?.username ?? 'Unknown Author'

  // Fetch binder items with chapter content, ordered by position
  const rows = await db
    .select({
      id: binderItems.id,
      type: binderItems.type,
      title: binderItems.title,
      position: binderItems.position,
      chapterContent: chapters.content,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(eq(binderItems.bookId, bookId))
    .orderBy(asc(binderItems.position))

  // Only chapter-type items with content
  const chapterInputs = rows
    .filter(r => r.type === 'CHAPTER')
    .map(r => ({ title: r.title ?? 'Untitled', content: r.chapterContent }))

  const safeTitle = book.title.replace(/[^a-z0-9\s-]/gi, '').trim() || 'export'

  if (format === 'docx') {
    const url = new URL(request.url)
    const style = (url.searchParams.get('style') ?? 'manuscript') as DocxStyle
    const validStyle: DocxStyle = style === 'basic' ? 'basic' : 'manuscript'

    const buffer = await generateDocx(chapterInputs, validStyle, book.title, authorName)
    const filename = `${safeTitle}-${validStyle}.docx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // EPUB
  // Fetch ISBN from publishing metadata if available
  const meta = await db.query.bookPublishingMetadata.findFirst({
    where: eq(books.id, bookId), // bookPublishingMetadata.bookId = bookId
    columns: { isbn: true },
  }).catch(() => null)

  const buffer = await generateEpub(chapterInputs, book.title, authorName, meta?.isbn ?? null)
  const filename = `${safeTitle}.epub`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

> **Note:** Check that `bookPublishingMetadata` is exported from `@/db/schema`. If not, import it directly from `@/db/schema/books`. Adjust the `.where` clause for `bookPublishingMetadata` — the PK is `bookId`, so: `eq(bookPublishingMetadata.bookId, bookId)`.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "api/export" | head -20
```

Expected: no errors in the export route. Fix any type issues before continuing.

- [ ] **Step 5: Commit**

```bash
git add app/api/export/
git commit -m "feat: export API route for DOCX and EPUB downloads"
```

---

## Task 5: Export modal UI

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/export-modal.tsx`

Client component. Three tabs: DOCX, EPUB, PDF (stub). Download uses fetch + Blob.

- [ ] **Step 1: Implement the export modal**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/export-modal.tsx
'use client'

import { useState } from 'react'
import { useBookEditor } from './book-editor-provider'

type Format = 'docx' | 'epub' | 'pdf'
type DocxStyle = 'manuscript' | 'basic'

type Props = {
  open: boolean
  onClose: () => void
}

async function downloadFile(url: string, fallbackFilename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? fallbackFilename

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export function ExportModal({ open, onClose }: Props) {
  const { bookId, bookTitle, wordCount } = useBookEditor()
  const [format, setFormat] = useState<Format>('docx')
  const [docxStyle, setDocxStyle] = useState<DocxStyle>('manuscript')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleDownload() {
    setError(null)
    setLoading(true)
    try {
      if (format === 'docx') {
        await downloadFile(
          `/api/export/${bookId}/docx?style=${docxStyle}`,
          `manuscript.docx`,
        )
      } else if (format === 'epub') {
        await downloadFile(`/api/export/${bookId}/epub`, `book.epub`)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[420px] rounded-lg border border-[#2a2a2a] bg-[#161616] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">{bookTitle}</h2>
            <p className="text-[10px] text-[#555] mt-0.5">{wordCount.toLocaleString()} words</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#888] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {/* Format tabs */}
          <div className="mb-5">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-[#555]">Format</div>
            <div className="flex gap-2">
              {(['docx', 'epub', 'pdf'] as Format[]).map(f => (
                <button
                  key={f}
                  onClick={() => { if (f !== 'pdf') setFormat(f) }}
                  disabled={f === 'pdf'}
                  className={[
                    'flex-1 rounded-md border px-3 py-3 text-center text-sm font-medium transition-colors',
                    format === f
                      ? 'border-[#FFC300] bg-[#1f1a00] text-[#FFC300]'
                      : f === 'pdf'
                        ? 'border-[#2a2a2a] bg-[#111] text-[#444] cursor-not-allowed opacity-50'
                        : 'border-[#2a2a2a] bg-[#111] text-[#888] hover:border-[#3a3a3a] hover:text-[#aaa]',
                  ].join(' ')}
                >
                  <div className="text-base mb-1">
                    {f === 'docx' ? '📄' : f === 'epub' ? '📖' : '🖨'}
                  </div>
                  <div>{f.toUpperCase()}</div>
                  {f === 'pdf' && (
                    <div className="text-[9px] text-[#444] mt-0.5">Soon</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* DOCX style selector */}
          {format === 'docx' && (
            <div className="mb-5">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-[#555]">Style</div>
              <div className="flex gap-2">
                {(['manuscript', 'basic'] as DocxStyle[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setDocxStyle(s)}
                    className={[
                      'flex-1 rounded-md border px-3 py-2.5 text-left transition-colors',
                      docxStyle === s
                        ? 'border-[#FFC300] bg-[#1f1a00]'
                        : 'border-[#2a2a2a] bg-[#111] hover:border-[#3a3a3a]',
                    ].join(' ')}
                  >
                    <div className={`text-xs font-semibold ${docxStyle === s ? 'text-[#FFC300]' : 'text-[#aaa]'}`}>
                      {s === 'manuscript' ? 'Manuscript' : 'Basic'}
                    </div>
                    <div className="text-[10px] text-[#555] mt-0.5">
                      {s === 'manuscript'
                        ? 'Double-spaced · Times New Roman · Agent-ready'
                        : 'Single-spaced · Calibri · Clean formatting'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EPUB description */}
          {format === 'epub' && (
            <div className="mb-5 rounded-md border border-[#2a2a2a] bg-[#111] px-4 py-3">
              <div className="text-xs text-[#888]">
                For e-readers and self-publishing platforms. Includes a table of contents and chapter navigation.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full rounded-md bg-[#FFC300] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Preparing download…' : `↓ Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "export-modal" | head -20
```

Expected: no errors. Fix any before continuing.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(app\)/studio/\[bookId\]/_components/export-modal.tsx
git commit -m "feat: export modal UI (DOCX/EPUB/PDF stub)"
```

---

## Task 6: Wire Export button into toolbar

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

Add an "Export" button to the toolbar that toggles the `ExportModal`. The toolbar already has local state for `showAnalysis`, `showSounds`, etc. Add `showExport` alongside those.

Read the full file before editing:
```bash
cat "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
```

- [ ] **Step 1: Add the import and state**

At the top of `editor-toolbar.tsx`, add:

```ts
import { ExportModal } from '../export-modal'
```

In the component body (alongside existing `useState` calls), add:

```ts
const [showExport, setShowExport] = useState(false)
```

- [ ] **Step 2: Add the Export button to the toolbar JSX**

Find the right-side status section of the toolbar (where save status and word count live). Add the Export button before the font size dropdown or mode toggles — it should be clearly separated from the formatting buttons. Add after the save status indicator:

```tsx
<button
  onClick={() => setShowExport(true)}
  title="Export book"
  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors"
>
  ↓ Export
</button>
```

- [ ] **Step 3: Add the modal render at the end of the component return**

Inside the component's return statement, just before the closing tag, add:

```tsx
<ExportModal open={showExport} onClose={() => setShowExport(false)} />
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "editor-toolbar" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/studio/\[bookId\]/_components/editor/editor-toolbar.tsx
git commit -m "feat: Export button in Studio toolbar opens export modal"
```

---

## Task 7: Publishing metadata panel section

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`

Add a collapsible "Publishing details" section at the bottom of `metadata-panel.tsx`. The section is collapsed by default, lazy-loads metadata on expand, and saves per-field on blur. Free users see an upgrade prompt on save.

Read the full file before editing:
```bash
cat "app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx"
```

- [ ] **Step 1: Add imports at the top of `metadata-panel.tsx`**

```ts
import { useState, useRef } from 'react'
import {
  getPublishingMetadataAction,
  updatePublishingMetadataAction,
  type PublishingMetadata,
} from '@/lib/actions/publishing.actions'
```

> `useState` and `useRef` may already be imported — add only what's missing.

- [ ] **Step 2: Add the `PublishingSection` component to the bottom of the file (before exports)**

```tsx
function PublishingSection({ bookId }: { bookId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const [fields, setFields] = useState<Partial<PublishingMetadata>>({})

  async function handleExpand() {
    setExpanded(e => !e)
    if (!loaded) {
      const result = await getPublishingMetadataAction(bookId)
      if (result.success) setFields(result.data)
      setLoaded(true)
    }
  }

  async function handleBlur(field: keyof PublishingMetadata, value: string) {
    setSaving(true)
    setUpgradePrompt(false)
    const result = await updatePublishingMetadataAction(bookId, { [field]: value || null })
    setSaving(false)
    if (!result.success && result.error?.startsWith('PREMIUM_REQUIRED')) {
      setUpgradePrompt(true)
    }
  }

  return (
    <div className="border-t border-[#2a2a2a] mt-2">
      <button
        onClick={handleExpand}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#666]">
            {expanded ? '▾' : '▸'} Publishing details
          </span>
          <span className="rounded-sm bg-[#1f1a00] px-1.5 py-0.5 text-[9px] font-semibold text-[#FFC300] border border-[#3a2e00]">
            Premium
          </span>
        </div>
        {saving && <span className="text-[9px] text-[#555]">Saving…</span>}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {upgradePrompt && (
            <div className="rounded-md border border-[#3a2e00] bg-[#1a1200] px-3 py-2 text-[10px] text-[#FFC300]">
              Publishing details require a premium account.
            </div>
          )}

          {[
            { field: 'subtitle' as const, label: 'Subtitle', type: 'text' },
            { field: 'isbn' as const, label: 'ISBN', type: 'text' },
            { field: 'publisherName' as const, label: 'Publisher name', type: 'text' },
            { field: 'dedication' as const, label: 'Dedication', type: 'text' },
            { field: 'edition' as const, label: 'Edition', type: 'text' },
          ].map(({ field, label, type }) => (
            <div key={field}>
              <label className="block text-[10px] text-[#555] mb-1">{label}</label>
              <input
                type={type}
                defaultValue={fields[field] ?? ''}
                onBlur={e => handleBlur(field, e.target.value)}
                className="w-full rounded border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] placeholder-[#444] focus:border-[#3a3a3a] focus:outline-none"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            </div>
          ))}

          <div>
            <label className="block text-[10px] text-[#555] mb-1">Author bio</label>
            <textarea
              rows={3}
              defaultValue={fields.authorBio ?? ''}
              onBlur={e => handleBlur('authorBio', e.target.value)}
              className="w-full rounded border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] placeholder-[#444] focus:border-[#3a3a3a] focus:outline-none resize-none"
              placeholder="Enter author bio…"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#555] mb-1">Trim size</label>
            <select
              defaultValue={fields.trimSize ?? ''}
              onBlur={e => handleBlur('trimSize', e.target.value)}
              className="w-full rounded border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] focus:border-[#3a3a3a] focus:outline-none"
            >
              <option value="">— Select —</option>
              <option value="5x8">5 × 8</option>
              <option value="5.5x8.5">5.5 × 8.5</option>
              <option value="6x9">6 × 9</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Render `PublishingSection` inside `MetadataPanel`**

Find where `MetadataPanel` renders the chapter metadata (the `ChapterMetadata` component or similar). Add `PublishingSection` after it, at the bottom of the panel's scrollable area. You'll need the `bookId` — get it from the `useBookEditor()` context.

```tsx
// Inside MetadataPanel, after ChapterMetadata:
<PublishingSection bookId={bookId} />
```

The `bookId` is available from `useBookEditor()` which is already called in the panel.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "metadata-panel" | head -20
```

Expected: no errors. Fix any before continuing.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/\(app\)/studio/\[bookId\]/_components/metadata/metadata-panel.tsx
git commit -m "feat: publishing metadata panel section (premium-gated, collapsible)"
```

---

## Task 8: Final TypeScript check + push

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors. Fix any before continuing.

- [ ] **Step 2: Full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Confirm feature works end-to-end**

Open the Studio, open any book with chapters. Click the Export button in the toolbar. Verify:
- DOCX tab shows Manuscript / Basic toggle
- Clicking Download initiates a file download
- EPUB tab downloads an `.epub` file
- PDF tab shows disabled "Soon" state
- Publishing details section appears at the bottom of the metadata panel, collapsed by default
- Expanding it loads metadata fields
- Editing a field and blurring saves (premium users) or shows upgrade prompt (free users)
