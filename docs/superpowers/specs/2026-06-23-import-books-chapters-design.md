# Import books / chapters from .docx, .pdf, .epub — Design Spec

**Issue:** #42
**Date:** 2026-06-23
**Status:** Approved (pending spec review)

## Summary

Let premium users create a book (or append chapters to an existing book) by uploading a
`.docx`, `.pdf`, or `.epub` file. The file is parsed, split into chapters, converted into the
app's TipTap JSON vocabulary, and persisted as real `books` + `binderItems` + `chapters` rows so
the imported manuscript reads correctly in the studio editor and the public reader.

Import is the **inverse of the existing export stack**. The export serializer
`lib/export/tiptap-to-html.ts` defines the canonical node/mark vocabulary; import must target the
SAME set so a doc exported from Beehive then re-imported preserves its supported formatting.

## Premium gating

- Reuse `getUserPremiumStatus(userId)` + `requirePremium(isPremium, 'import')` from `lib/premium.ts`
  (throws `PREMIUM_REQUIRED:import`).
- Premium is checked **before any parsing work** in every server entry point.
- Free users: the affordances render, but the click routes to an upgrade prompt (mirrors the
  `version-history-drawer.tsx` free-tier upsell card: brand-yellow Premium pill, short pitch,
  Upgrade button to `/${locale}/pricing`). A direct server call by a free user rejects with
  `PREMIUM_REQUIRED:import`.

## Architecture

Import is split so a **preview/confirm gate** sits between parsing and persistence — nothing is
written until the user confirms.

### New modules

| Module | Purpose |
| --- | --- |
| `lib/upload/validate-document.ts` | `validateDocumentFile(file, opts)` — single source of truth for type/extension + size validation. Mirrors `validate-image.ts`. |
| `lib/import/html-to-tiptap.ts` | `htmlToTiptap(html): TiptapDoc` — HTML → TipTap JSON, emitting ONLY the supported node/mark set. The inverse of `tiptap-to-html.ts`. Pure, unit-testable, no DB / network. |
| `lib/import/parse-document.ts` | `parseDocument(buffer, format): Promise<ParsedDocument>` — per-format extraction. Dynamic-imports heavy deps server-side (mammoth / pdfjs-dist / jszip). Returns normalized HTML (docx, epub) or plain text (pdf), plus a detected title where available. |
| `lib/import/split-chapters.ts` | `splitChapters(parsed): ImportedChapter[]` — heuristic splitting into `{ title, content (TipTap doc), wordCount }`. Pure, unit-testable. |
| `lib/import/import.actions.ts` | `parseImportAction` (validate + parse + split → preview payload, NO DB writes) and `commitImportAction` (atomic append-mode persistence). Both premium-gated + rate-limited. |

### Edits to existing code

| File | Change |
| --- | --- |
| `lib/rate-limit.ts` | Add `importLimiter` (slidingWindow, e.g. 10 / 1 h — parsing is CPU-heavy). |
| `lib/actions/book.actions.ts` | Extend `createBookAction` to accept an optional `importedChapters` payload; when present, bulk-insert the binderItems + chapters in the SAME transaction that creates the book (fully atomic new-book import). |
| `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` | Add a landing choice (Start from scratch / Import a manuscript). Import path parses + previews, pre-fills Title, and threads `importedChapters` into the final `createBookAction` call (Option B — user still walks Discovery / Structure / Sharing). |
| `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx` | Chapter item opens a secondary chooser (Blank chapter / Import from a file). Import opens `<ImportModal>` in append mode (docx + pdf only). |
| New: `.../studio/[bookId]/_components/import/import-modal.tsx` | Shared import modal, mirrors `export-modal.tsx` chrome. Used by append mode. |
| New: `.../studio/new/_components/import-wizard-panel.tsx` (or inline) | The wizard's import sub-flow (upload → parse → split-preview), reusing the shared preview component. |
| New: `.../studio/.../import/import-upsell.tsx` | Free-tier upsell card (shared by both entry points). |
| New: `.../studio/.../import/chapter-preview.tsx` | Shared split-preview list (titles + word counts + split toggle). |

## Data flow

```
File
  → validateDocumentFile()            (client pre-check + server re-validate)
  → parseDocument(buffer, format)     (server, dynamic import)
       docx  → mammoth → HTML
       epub  → jszip → OPF spine order → per-item XHTML body → HTML
       pdf   → pdfjs-dist → plain text
  → htmlToTiptap(html)  /  text→paragraphs    (server)
  → splitChapters()                    (server)
  → preview payload { chapters: {title, wordCount}[], parsed: ImportedChapter[], detectedTitle }
  ── USER CONFIRMS (split into N | single chapter) ──
  → new-book:  createBookAction({ ...meta, importedChapters })   (one tx)
  → append:    commitImportAction({ bookId, chapters })          (one tx)
```

The preview payload (including the full parsed TipTap chapter docs) is held client-side between
parse and commit. The commit step re-validates premium + ownership and re-applies the user's
split choice server-side, so a tampered client payload cannot bypass gates.

## Conversion fidelity (correctness core)

`htmlToTiptap` emits ONLY:

- **Nodes:** `doc`, `paragraph`, `heading` (levels 1-3; h4-h6 clamp to 3), `blockquote`,
  `bulletList`, `orderedList`, `listItem`, `horizontalRule`, `hardBreak`.
- **Marks:** `bold` (`<strong>`/`<b>`), `italic` (`<em>`/`<i>`), `underline` (`<u>`), `strike`
  (`<s>`/`<del>`), `highlight` (`<mark>`), `fontSize` (`<span style="font-size:…">`).

Everything outside this set is handled by **unwrapping to text content or dropping the node** —
never emitting an unknown node type that the editor / reader can't render. Specifically:

- Tables → flattened to paragraphs (cell text joined), or dropped if empty. (v1: flatten.)
- Images (`<img>`) → dropped (out of scope v1; documented loss).
- Footnotes / endnotes / comments / tracked-changes markup → stripped to plain text or dropped.
- `<a>` links → text preserved, link mark dropped (link is not in the editor's chapter mark set
  that we want to round-trip; href text is kept). NOTE: `tiptap-to-html` *does* emit `<a>` for a
  `link` mark, but the chapter editor's StarterKit config is the authority — confirm during W2
  whether `link` should be preserved; default v1 = preserve text, drop mark.

Whitespace-only paragraphs are collapsed. The result always has a valid `doc` root.

## Chapter splitting heuristics

- **DOCX:** split on top-level headings (`<h1>`, falling back to `<h2>` if no `<h1>` exists).
  Heading text → chapter title.
- **EPUB:** one chapter per spine item (reading order from the OPF spine). Title from the item's
  first heading or nav label, fallback `Chapter N`.
- **PDF:** split on lines matching a `Chapter N` / `CHAPTER N` regex or large gaps / form-feeds;
  fallback to a single chapter. Title from the matched heading line, fallback `Chapter N`.
- Every section → one `chapter`-type binderItem + `chapters` row. Empty-title fallback:
  `Chapter N`, then `Untitled`. Word counts via the existing `extractWordCount` helper.
- The preview defaults to **"Split into N chapters"** (user's locked decision). One-click fallback
  to "Import as a single chapter" merges all sections into one chapter doc.

## UI

### New-book mode — wizard landing choice (`/studio/new`, Option B)

1. Wizard opens to a new **landing choice** (two cards in the existing 1040px panel chrome):
   "Start from scratch" (current 4-step flow) and "Import a manuscript".
2. Import card → upload drop-zone (auto-detect format from extension) → parse spinner →
   split-preview (titles + word counts + split toggle). PDF shows a muted "text-only, formatting
   may need cleanup" note.
3. On Confirm: parsed chapters are stashed in wizard state, **Title pre-filled** from detected
   title or filename, user proceeds to Step 1 (Basics) onward as normal.
4. Final "Create your book" calls `createBookAction({ ...meta, importedChapters })` →
   book + chapters created in one transaction → redirect to editor.

### Append mode — editor binder (docx + pdf only)

1. Binder "+ Add" → Chapter → secondary chooser: "Blank chapter" (current behavior) /
   "Import from a file".
2. Import → `<ImportModal>` (append mode) → upload → parse → split-preview → Confirm.
3. `commitImportAction({ bookId, chapters })` appends chapters as root-level binderItems after the
   current max order → binder refreshes → toast "Imported N chapters."

### `<ImportModal>` chrome (mirrors `export-modal.tsx`)

560px card, `linear-gradient(180deg, --canvas-dark-250, --canvas-dark-200)`, `--r-card`,
`--sh-card`, brand-yellow title, brand-yellow confirm button only. State machine:
`pick → parsing → preview → writing → success | error`. Error reuses the existing red error block,
showing the real reason. Cancel disabled during parse/write. No em-dashes in any copy.

### Validation / limits / copy

- Allowed: `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`),
  `.pdf` (`application/pdf`), `.epub` (`application/epub+zip`). Append mode: docx + pdf only.
- Size cap: 25 MB.
- Brand-yellow restrained to modal title, confirm button, Premium pill. No em-dashes anywhere
  user-readable.

## Error handling (never 500)

| Condition | Behavior |
| --- | --- |
| Wrong type / extension | Toast + modal error: real reason ("Only DOCX, PDF, and EPUB files are supported."). |
| Oversized (> 25 MB) | Toast + modal error: "File must be 25 MB or smaller." |
| Free user (direct server call) | Throw `PREMIUM_REQUIRED:import`. |
| Encrypted / DRM epub | Detect (jszip read fails / encryption.xml present) → typed error "This EPUB is encrypted and can't be imported." |
| Image-only / scanned pdf | No extractable text → typed error "This PDF has no selectable text. Scanned PDFs aren't supported yet." |
| Malformed / corrupt file | Caught → typed error "We couldn't read this file. It may be corrupted." |
| Empty parse result | Typed error "No readable text found in this file." |
| Rate limit exceeded | Typed error "Too many imports. Please wait a bit and try again." |

All server entry points return `ActionResult<T>` (or a typed JSON error for the route variant);
no path throws an unhandled error to the client.

## Testing

- **Round-trip unit tests:** `htmlToTiptap(tiptapToHtml(doc))` preserves supported nodes/marks on
  shared fixtures (bold/italic/underline/strike/highlight/fontSize, headings, blockquote, lists,
  hr). Drops fixtures with unsupported nodes cleanly.
- **`split-chapters` tests:** docx heading split, epub spine split, pdf regex split, single-chapter
  fallback, empty-title fallbacks, word counts.
- **`validate-document` tests:** type + size matrix.
- `tsc --noEmit` clean; full `npm test` suite green.
- **Manual smoke:** import a real .docx, .epub, .pdf → verify chapters read correctly in the studio
  editor AND the public reader; verify append mode; verify free-user block; verify
  wrong-type/oversized failure messaging.

## New dependencies

- `mammoth` (docx → HTML).
- `pdfjs-dist` (pdf text extraction; Node/legacy build, dynamic-imported).
- `jszip` (already a dependency; reused for epub).

## Out of scope (v1, candidate follow-ups)

- OCR for scanned PDFs.
- Image extraction / re-hosting (Cloudinary).
- Markdown / `.txt` / Google Docs / Scrivener `.scriv` import.
- Auto-detecting front/back matter (title page, copyright, dedication) into the specialized FBM
  subtypes — v1 imports everything as plain chapters.
- Background-job / chunked parsing for very large manuscripts — v1 guards with the size cap and a
  clean failure if parsing exceeds limits.

## Build waves

- **W1** — `validate-document.ts`, `importLimiter`, premium gate + action skeletons.
- **W2** — `html-to-tiptap.ts` + `parse-document.ts` (docx/epub/pdf), server-only dynamic imports.
- **W3** — `split-chapters.ts` + preview/confirm UI (wizard landing card, editor chooser,
  `<ImportModal>`, upsell, chapter-preview).
- **W4** — atomic persistence: extend `createBookAction` (new-book) + `commitImportAction`
  (append).
- **W5** — round-trip + heuristic + validator tests, tsc, full suite, manual smoke, AGENTS.md
  handoff.
