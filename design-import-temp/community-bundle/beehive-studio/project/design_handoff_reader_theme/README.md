# Handoff: Chapter Reader — Reader Theme Toggle

## Overview
Adds a Kindle/Apple-Books-style **reader theme toggle** to the public chapter reader. The
reader can switch the prose surface between **Dark / White / Cream** backgrounds; the choice
persists across every chapter and book they open. The surrounding app chrome (top bar, footer
nav) stays dark on all three themes — only the prose "page" flips.

This bundle also carries a small visual refresh of the reader (paper-stack styling, Comfortaa
display type, Newsreader prose) and a color update to a softer "lifted dark gray" chrome.

## About the Design Files
`Reader Theme Toggle.html` is a **design reference created in HTML** — a prototype showing the
intended look and the toggle behavior. It is **not** production code to copy directly. The task
is to recreate this design inside the existing Beehive Studio Next.js app, using its established
patterns (App Router server components, drizzle queries, Tailwind arbitrary values + CSS custom
properties in `app/globals.css`). The toggle's JS in the prototype is a stand-in for a real
React hook described below.

## Fidelity
**High-fidelity.** Colors, type, spacing, and the toggle interaction are final. Recreate the UI
to match, using the codebase's existing styling approach.

---

## ⚠️ READ FIRST — the design is richer than the current code

The prototype shows several elements the **current codebase does not have any data for.** Do not
scaffold phantom data layers to support them. For this visual port, **omit** them:

| Shown in mockup | Status in codebase | Action |
|---|---|---|
| "Collection" eyebrow + brand-yellow collection labels (top bar, prose sub-eyebrow, prev/next) | No `collection` field exists | **Omit** every collection conditional |
| "Author's note" callout | No `authorNotes` field | **Omit**; keep the existing `ChapterContributionByline` |
| Comment section (composer + threads) | No `CommentSection` component, no comments data, no `chapterCommentsEnabled` | **Omit** entirely |
| "18 min read" reading-time | Not computed | Already removed from the design; use `wordCount` only |

If comments / collections are genuinely wanted, they are separate features (DB schema +
server actions) — out of scope for this visual port.

---

## Target File

```
app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx
```

This is an **async server component** — `export default async function ChapterReaderPage({ params }: Props)`.
There is **no** `components/library/chapter-reader.tsx`, no `ChapterReader({ bookId, data, basePath })`
signature, and no `ChapterData` type. Everything is fetched inline.

### Preserve verbatim (data, gating, side-effects)
- Signature `ChapterReaderPage({ params })`, `params: Promise<{ locale, bookId, chapterId }>`.
- The `auth.api.getSession` + `canReadBook(bookId, userId)` gate → `AccessDenied` / `notFound()`.
- All inline drizzle queries: `book` (+ owner profile), `allChapters` (binder items for nav),
  `chapter` (content/wordCount/status/author).
- `isChapterReaderVisible(chapter.status)` → `LockedChapterPlaceholder` branch.
- `prevChapter` / `nextChapter` derivation from the `allChapters` array; `chapterNumber`,
  `totalChapters`, `progressPercent`.
- Side-effect: `if (userId) await markChapterReadAction(bookId, current.binderItemId)`.
- Prose render: `const htmlContent = chapter.content ? tiptapToHtml(chapter.content) : ''`,
  rendered via `dangerouslySetInnerHTML` on a `.prose-chapter` element. **Do not** swap to a
  rich-text editor component.
- `showContributionByline` conditional + `<ChapterContributionByline …>` with its exact props.
- All `<Link>` hrefs: `/${locale}/books/${bookId}` and `/${locale}/books/${bookId}/read/${id}`.

### Map design → real fields
- Eyebrow → `Chapter {chapterNumber}` (from existing `chapterNumber` / `totalChapters`).
- Title → `current.title`.
- Meta line → `{(chapter.wordCount ?? 0).toLocaleString()} words`.
- Prev card → `prevChapter.title`; Next card → `nextChapter.title`; Back card → `book.title`.
- First chapter: render no Prev (the existing code already falls back to "Back to book").
- Last chapter: render no Next (existing fallback: "Finished ✓ Back to book").

---

## NET-NEW — Reader theme toggle

### 1. Client boundary
The page is a **server component**, so `localStorage` / `useState` cannot live in it. Extract the
prose surface + the toggle into a new client component:

```
app/[locale]/(public)/books/[bookId]/read/[chapterId]/_components/reader-surface.tsx
```

```tsx
'use client'
// Props: { htmlContent: string; chapterNumber: number; totalChapters: number;
//          title: string; wordCount: number; /* + any header bits you lift in */ }
// Renders the top-bar toggle + the .prose-chapter panel with data-reader-theme on the wrapper.
```

The server page keeps doing all data fetching and passes plain props into `<ReaderSurface … />`.

### 2. The hook
```
lib/hooks/use-reader-theme.ts
```
- `useReaderTheme(): [theme, setTheme]` where `theme` is `'dark' | 'white' | 'cream'`.
- SSR-safe: return `'dark'` on first render; read `localStorage` inside a `useEffect` after mount
  (avoids hydration mismatch / flash).
- Persist to `localStorage` key **`beehive:reader-theme`** on change.
- Because it's localStorage-backed, the choice applies to **every** chapter/book automatically.

```ts
'use client'
import { useEffect, useState } from 'react'
export type ReaderTheme = 'dark' | 'white' | 'cream'
const KEY = 'beehive:reader-theme'
export function useReaderTheme(): [ReaderTheme, (t: ReaderTheme) => void] {
  const [theme, set] = useState<ReaderTheme>('dark')
  useEffect(() => {
    const saved = localStorage.getItem(KEY) as ReaderTheme | null
    if (saved === 'dark' || saved === 'white' || saved === 'cream') set(saved)
  }, [])
  const setTheme = (t: ReaderTheme) => {
    set(t)
    try { localStorage.setItem(KEY, t) } catch {}
  }
  return [theme, setTheme]
}
```

### 3. Applying the theme
- Put `data-reader-theme={theme}` on the **prose panel wrapper only** — never on `<html>` or
  `<body>`. App chrome must stay dark.
- The three CSS token blocks below remap every `--prose-*` value under that attribute.

### 4. The toggle UI (in the top bar)
A 3-tile segmented control, each tile 32×32, `14px` radius, `1px solid` border, filled with the
prose-bg color of that theme and a single "Aa" glyph in that theme's prose-ink (so the tile
previews its own contrast):
- Dark: fill `#2d2e2f`, glyph `#e8e8e8` · tooltip "Dark mode"
- White: fill `#ffffff`, glyph `#1a1a1a` · tooltip "Paper"
- Cream: fill `#f5ecd7`, glyph `#3a2f1f` · tooltip "Cream paper"
- Active tile: `2px solid var(--brand)` + `box-shadow: 0 0 0 3px rgba(255,195,0,0.18)`.

---

## globals.css

Add these three blocks to `app/globals.css` **verbatim** (the file has no reader-theme tokens
yet). They drive only the prose surface.

```css
/* ===== Reader theme — DARK (default, lifted dark gray) ===== */
[data-reader-theme="dark"] {
  --prose-bg:           #2d2e2f;
  --prose-bg-elevated:  #36373a;
  --prose-ink:          #e8e8e8;
  --prose-ink-strong:   #ffffff;
  --prose-ink-muted:    rgba(255, 255, 255, 0.55);
  --prose-rule:         #3a3b3d;
  --prose-accent:       #FFC300;
}
/* ===== Reader theme — WHITE (pure paper) ===== */
[data-reader-theme="white"] {
  --prose-bg:           #ffffff;
  --prose-bg-elevated:  #fafafa;
  --prose-ink:          #1a1a1a;
  --prose-ink-strong:   #000000;
  --prose-ink-muted:    rgba(0, 0, 0, 0.55);
  --prose-rule:         #e5e5e5;
  --prose-accent:       #b8860b;   /* darker yellow — readable on white */
}
/* ===== Reader theme — CREAM (warm, sepia-leaning) ===== */
[data-reader-theme="cream"] {
  --prose-bg:           #f5ecd7;
  --prose-bg-elevated:  #efe4c8;
  --prose-ink:          #3a2f1f;
  --prose-ink-strong:   #1f1810;
  --prose-ink-muted:    rgba(58, 47, 31, 0.65);
  --prose-rule:         #d8c9a8;
  --prose-accent:       #8a5a00;   /* deep amber */
}
```

### App-chrome color note (important)
There are **no `--app-*` tokens** in this codebase. The reader chrome is currently **hardcoded
hex in the JSX** (`bg-[#141414]`, `#1a1a1a`, `#2a2a2a`, prose text `#ccc`). `app/globals.css`
already defines an oklch scale (`--chrome-*`, `--canvas-dark-*`) and **`--canvas-dark-100` is
literally `#262728`** — the exact "lifted dark gray" this refresh wants.

To get the softer chrome, prefer **reusing the existing scale** over inventing parallel tokens:

| Design value | Reuse | Was (hardcoded) |
|---|---|---|
| page bg `#262728` | `var(--canvas-dark-100)` | `#141414` |
| surface / prose-dark bg `#2d2e2f` | `var(--canvas-dark-150)` ≈ same | `#1a1a1a` |
| hover surface `#36373a` | `var(--canvas-dark-300)` ≈ same | `#252525` |
| hairline border `#3a3b3d` | `var(--canvas-dark-350)` ≈ same | `#2a2a2a` |

Do **not** modify `--chrome-*`, `--canvas-dark-*`, `--paper-*`, or `--brand`.

---

## Design Tokens (full reference)

### App chrome (always dark)
| Token | Value | Use |
|---|---|---|
| app bg | `#262728` | outermost page bg |
| app surface | `#2d2e2f` | cards, nav tiles |
| app surface hover | `#36373a` | hover state |
| app border | `#3a3b3d` | hairlines |
| app border hover | `rgba(255,195,0,0.32)` | hover border |
| ink | `#ffffff` | primary text |
| ink muted | `rgba(255,255,255,0.7)` | secondary |
| ink faint | `rgba(255,255,255,0.5)` | tertiary |

### Brand
`--brand #FFC300` · `--brand-soft rgba(255,195,0,0.6)` · `--brand-faint rgba(255,195,0,0.06)`
· `--brand-border rgba(255,195,0,0.20)`. Restrained: brand mark, hover affordances, chapter
eyebrows, active toggle tile, Post CTA, chevrons. Never a general chrome accent.

### Reader-theme prose tokens
See the three `[data-reader-theme]` blocks above.

### Radii & shadow
`--r-card 16px` · `--r-tile 14px` · `--r-pill 999px` · `--r-prose 20px`
Paper-stack shadow (crisp, no blur):
```
--sh-paper:       0 1px 0 rgba(255,255,255,0.04) inset, 0 3px 0 rgba(0,0,0,0.32);
--sh-paper-hover: 0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 0 rgba(0,0,0,0.38);
```

### Typography
| Role | Family | Notes |
|---|---|---|
| Display + brand | **Comfortaa** | headings, chapter title, UI labels |
| UI + metadata | **Geist** (system sans ok) | meta lines, buttons |
| Prose body | **Newsreader** (Source Serif 4 / Georgia) | chapter text only — never Comfortaa for body |
- Prose: 18px / 1.75. Chapter title Comfortaa 700 / 32px. H2 Comfortaa 700 / 24px.
- Eyebrows: mono, 10px, uppercase, `0.16em` tracking.

---

## Layout (per screen region)
- **Top bar**: sticky, `var(--app-bg)`, `border-bottom 1px`. 3-region grid: left back-to-book
  (chevron in brand + "To Book"), center chapter context (book title eyebrow + chapter title,
  truncated), right theme toggle.
- **Prose panel**: `max-width 760px`, `margin 32px auto`, `padding 56px 64px`,
  `background var(--prose-bg)`, `border 1px var(--prose-rule)`, `border-radius var(--r-prose)`.
  Carries `data-reader-theme`. Header (eyebrow, title, word-count meta, rule) then the
  `.prose-chapter` body, then a centered "End of chapter" divider.
- **Nav row**: dark chrome, `max-width 1080px`, 3-col grid. Paper-stack cards. Prev (chevron-left,
  brand-soft → brand on hover), Back-to-book (center, BookOpen icon), Next (mirrored). Omit
  Prev on first chapter / Next on last; keep the column so center stays centered.

## Interactions
- Toggle click → `setTheme()` → updates `data-reader-theme` + writes localStorage. CSS handles
  the rest via the token blocks; a `0.22s` transition on bg/color/border is a nice touch.
- Nav cards lift on hover (`--sh-paper` → `--sh-paper-hover`, border → brand-tinted).
- No loading/error states beyond the existing `AccessDenied` / `LockedChapterPlaceholder` /
  `notFound()` branches — preserve those.

## State Management
- Only net-new state is `useReaderTheme()` (localStorage-backed, client-side). No server state,
  no data fetching changes.

## Assets
- Icons: `lucide-react` (already a dependency) — `ChevronLeft`, `ChevronRight`, `BookOpen`.
  The prototype inlines equivalent SVGs; use the lucide components in React.
- Fonts: Comfortaa, Geist, Newsreader — wire through the project's existing font setup
  (next/font or the current `<link>` strategy). Confirm Newsreader is added.

## Files in this bundle
- `Reader Theme Toggle.html` — the hi-fi design reference (main mockup + a Dark/White/Cream
  comparison strip at the bottom for readability review).
- `README.md` — this document.

## Out of scope
Comment composer/threads, collections, author notes, auth flows, routing, new server actions,
DB/schema changes, mobile responsive (desktop-first; basic stacking is fine).

## When done
`npx tsc --noEmit` + `npm test`, report the diff summary. Do **not** commit — author will smoke first.
