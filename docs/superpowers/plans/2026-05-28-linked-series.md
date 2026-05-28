# Linked Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `books.seriesName` + `books.seriesNumber` load-bearing. Render "Book N of <Series>" wherever a book renders publicly (reader page hero, library card hover, discover card, /u/[username] tile). Add a "By series" sort that clusters books with subheaders. Add previous/next cross-book navigation to the book reader page, filtered through `canReadBook`. Author-scoped matching via a `normalizeSeriesKey` helper (case-insensitive, drops leading "The ", collapses whitespace). Wizard + Details page get explanatory copy about what the choice does.

**Architecture:** Two pure helpers in `lib/books/` (one for the normalized key, one for the server-side neighbor query). Surface components consume `seriesName` / `seriesNumber` from existing projections (`BookSummary` extended). Reader page renders the footer via a new `SeriesFooter` client component fed by a server-only `getSeriesNeighbors({ currentBook, viewerUserId })` call.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Tailwind v4, vitest. No DB / schema changes.

**Spec:** [docs/superpowers/specs/2026-05-28-linked-series-design.md](../specs/2026-05-28-linked-series-design.md)

**Pre-flight findings:**
- `BookSummary` projection (lib/actions/book.actions.ts:18) does NOT include `seriesName` / `seriesNumber`. Library + discover surfaces depend on this — needs extension.
- `getPublicBookAction` (`discover.actions.ts`) returns `seriesName` / `seriesNumber` already (verified `PublicBook` type includes them).
- Wizard Step 3 lives in `app/[locale]/(app)/studio/_components/create-book-wizard/step-three.tsx` AND there's a newer `book-creation-form.tsx` in `studio/new/_components/` — verify which is live during implementation. AGENTS.md notes the legacy `CreateBookWizard` is unused (no callers) so the active surface is the new one.
- Studio library page is at `app/[locale]/(app)/studio/page.tsx` — server component that renders a client component holding the sort dropdown + book grid.
- `canReadBook(bookId, viewerUserId)` exists at `lib/books/can-read.ts` — used by series-neighbor filtering.

---

### Task 1: `normalizeSeriesKey` helper + tests

**Files:**
- Create: `lib/books/series-key.ts`
- Create: `lib/books/__tests__/series-key.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeSeriesKey } from '../series-key'

describe('normalizeSeriesKey', () => {
  it('returns null for null input', () => {
    expect(normalizeSeriesKey(null)).toBe(null)
  })
  it('returns null for empty string', () => {
    expect(normalizeSeriesKey('')).toBe(null)
  })
  it('returns null for whitespace-only string', () => {
    expect(normalizeSeriesKey('   ')).toBe(null)
  })
  it('lowercases and drops leading "The "', () => {
    expect(normalizeSeriesKey('The Stormlight Archive')).toBe('stormlight archive')
  })
  it('produces same key as the no-leading-the version', () => {
    expect(normalizeSeriesKey('Stormlight Archive')).toBe('stormlight archive')
  })
  it('collapses internal whitespace and trims', () => {
    expect(normalizeSeriesKey('  STORMLIGHT  ARCHIVE  ')).toBe('stormlight archive')
  })
  it('preserves non-leading "the"', () => {
    expect(normalizeSeriesKey('Book of the Dead')).toBe('book of the dead')
  })
})
```

Run: `npm test -- series-key`. Expected: FAIL ("Cannot find module").

- [ ] **Step 2: Implement**

```ts
/**
 * Normalizes a series name for matching: lowercase, drops a leading "The ",
 * collapses internal whitespace, trims. Returns null for null / empty /
 * whitespace-only input.
 *
 * Used to match books in the same series despite author inconsistency
 * ("The Stormlight Archive" vs "stormlight archive" vs "  STORMLIGHT
 * ARCHIVE "). Display name in UI is always the raw `seriesName` — this
 * helper is for matching only.
 */
export function normalizeSeriesKey(name: string | null): string | null {
  if (!name) return null
  const normalized = name
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized.length === 0 ? null : normalized
}
```

- [ ] **Step 3: Run tests + tsc**

`npm test -- series-key && npx tsc --noEmit` — 7 pass, clean.

- [ ] **Step 4: Commit**

```bash
git add lib/books/series-key.ts lib/books/__tests__/series-key.test.ts
git commit -m "feat(books): normalizeSeriesKey helper + tests"
```

---

### Task 2: `getSeriesNeighbors` server-only helper + tests

**Files:**
- Create: `lib/books/get-series-neighbors.ts`
- Create: `lib/books/__tests__/get-series-neighbors.test.ts`

- [ ] **Step 1: Write failing tests** (mock DB; mock `canReadBook`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB + canReadBook before importing the unit under test.
vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}))
vi.mock('@/lib/books/can-read', () => ({
  canReadBook: vi.fn(),
}))

import { getSeriesNeighbors } from '../get-series-neighbors'

type Row = {
  id: string
  title: string
  userId: string
  seriesName: string | null
  seriesNumber: number | null
}

function mockBooksQuery(rows: Row[]) {
  const { db } = require('@/db')
  db.select.mockReturnValue({
    from: () => ({
      where: () => Promise.resolve(rows),
    }),
  })
}

async function mockCanRead(allowed: Set<string>) {
  const { canReadBook } = await import('@/lib/books/can-read')
  ;(canReadBook as ReturnType<typeof vi.fn>).mockImplementation(
    async (bookId: string) => ({
      ok: allowed.has(bookId),
      ...(allowed.has(bookId) ? {} : { reason: 'PRIVATE' }),
    } as { ok: boolean; reason?: string }),
  )
}

describe('getSeriesNeighbors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('book with no seriesName returns null neighbors', async () => {
    mockBooksQuery([])
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b1', userId: 'u1', seriesName: null, seriesNumber: null },
      viewerUserId: 'u1',
    })
    expect(r).toEqual({ previous: null, next: null, total: 0 })
  })

  it('sole book in series returns null neighbors but total=1', async () => {
    mockBooksQuery([
      { id: 'b1', title: 'Only', userId: 'u1', seriesName: 'Solo', seriesNumber: 1 },
    ])
    await mockCanRead(new Set(['b1']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b1', userId: 'u1', seriesName: 'Solo', seriesNumber: 1 },
      viewerUserId: 'u1',
    })
    expect(r).toEqual({ previous: null, next: null, total: 1 })
  })

  it('Book 2 with Book 1 + Book 3 visible returns both neighbors', async () => {
    mockBooksQuery([
      { id: 'b1', title: 'Way of Kings', userId: 'u1', seriesName: 'The Stormlight Archive', seriesNumber: 1 },
      { id: 'b2', title: 'Words of Radiance', userId: 'u1', seriesName: 'Stormlight Archive', seriesNumber: 2 },
      { id: 'b3', title: 'Oathbringer', userId: 'u1', seriesName: 'THE STORMLIGHT ARCHIVE', seriesNumber: 3 },
    ])
    await mockCanRead(new Set(['b1', 'b2', 'b3']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b2', userId: 'u1', seriesName: 'Stormlight Archive', seriesNumber: 2 },
      viewerUserId: 'u1',
    })
    expect(r.previous?.id).toBe('b1')
    expect(r.next?.id).toBe('b3')
    expect(r.total).toBe(3)
  })

  it('Book 1 with only Book 3 visible (gap) jumps to Book 3', async () => {
    mockBooksQuery([
      { id: 'b1', title: 'B1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      { id: 'b3', title: 'B3', userId: 'u1', seriesName: 'Saga', seriesNumber: 3 },
    ])
    await mockCanRead(new Set(['b1', 'b3']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      viewerUserId: 'u1',
    })
    expect(r.previous).toBe(null)
    expect(r.next?.id).toBe('b3')
  })

  it('next book that viewer cannot read is omitted', async () => {
    mockBooksQuery([
      { id: 'b1', title: 'B1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      { id: 'b2', title: 'B2', userId: 'u1', seriesName: 'Saga', seriesNumber: 2 },
      { id: 'b3', title: 'B3 (private)', userId: 'u1', seriesName: 'Saga', seriesNumber: 3 },
    ])
    await mockCanRead(new Set(['b1', 'b2']))  // b3 not readable
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b2', userId: 'u1', seriesName: 'Saga', seriesNumber: 2 },
      viewerUserId: 'u1',
    })
    expect(r.previous?.id).toBe('b1')
    expect(r.next).toBe(null)
    expect(r.total).toBe(2)  // total counts only reader-visible
  })

  it('current book with null seriesNumber returns null neighbors', async () => {
    mockBooksQuery([
      { id: 'b1', title: 'B1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      { id: 'b2', title: 'B2', userId: 'u1', seriesName: 'Saga', seriesNumber: null },
    ])
    await mockCanRead(new Set(['b1', 'b2']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b2', userId: 'u1', seriesName: 'Saga', seriesNumber: null },
      viewerUserId: 'u1',
    })
    expect(r.previous).toBe(null)
    expect(r.next).toBe(null)
    expect(r.total).toBe(2)
  })
})
```

Run: `npm test -- get-series-neighbors`. Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
import { db } from '@/db'
import { books } from '@/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { normalizeSeriesKey } from './series-key'
import { canReadBook } from './can-read'

export type SeriesNeighbor = {
  id: string
  title: string
  seriesNumber: number | null
}

export type SeriesNeighbors = {
  previous: SeriesNeighbor | null
  next: SeriesNeighbor | null
  total: number
}

type CurrentBookShape = {
  id: string
  userId: string
  seriesName: string | null
  seriesNumber: number | null
}

/**
 * Returns previous + next books in the same series, plus a reader-visible
 * total count.
 *
 * - Matches by same `userId` AND same `normalizeSeriesKey(seriesName)`.
 * - "Previous" = largest seriesNumber strictly less than current. "Next" =
 *   smallest seriesNumber strictly greater than current. Skips gaps.
 * - Filters every candidate through `canReadBook(bookId, viewerUserId)`.
 *   Books the viewer cannot read are silently omitted.
 * - Current book with `seriesNumber === null` has no position — returns
 *   null neighbors. `total` still counts reader-visible books in the series.
 * - Current book with no seriesName returns `{ previous: null, next: null,
 *   total: 0 }` without hitting the DB query path.
 */
export async function getSeriesNeighbors({
  currentBook,
  viewerUserId,
}: {
  currentBook: CurrentBookShape
  viewerUserId: string | null
}): Promise<SeriesNeighbors> {
  const key = normalizeSeriesKey(currentBook.seriesName)
  if (!key) return { previous: null, next: null, total: 0 }

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      userId: books.userId,
      seriesName: books.seriesName,
      seriesNumber: books.seriesNumber,
    })
    .from(books)
    .where(and(eq(books.userId, currentBook.userId), isNotNull(books.seriesName)))

  // Filter to same normalized key (in JS — normalization can't be done in SQL).
  const sameSeries = rows.filter(r => normalizeSeriesKey(r.seriesName) === key)

  // Filter to reader-visible only.
  const visible: typeof sameSeries = []
  for (const r of sameSeries) {
    const access = await canReadBook(r.id, viewerUserId)
    if (access.ok) visible.push(r)
  }

  const total = visible.length

  // If current book has no number, no positional neighbors possible.
  if (currentBook.seriesNumber === null) {
    return { previous: null, next: null, total }
  }

  // Books with numbers + not the current book.
  const numbered = visible
    .filter(r => r.seriesNumber !== null && r.id !== currentBook.id)
    .sort((a, b) => (a.seriesNumber as number) - (b.seriesNumber as number))

  let previous: SeriesNeighbor | null = null
  let next: SeriesNeighbor | null = null
  for (const r of numbered) {
    const n = r.seriesNumber as number
    if (n < currentBook.seriesNumber) previous = { id: r.id, title: r.title, seriesNumber: n }
    if (n > currentBook.seriesNumber && next === null) {
      next = { id: r.id, title: r.title, seriesNumber: n }
    }
  }

  return { previous, next, total }
}
```

- [ ] **Step 3: Run tests + tsc**

`npm test -- get-series-neighbors && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/books/get-series-neighbors.ts lib/books/__tests__/get-series-neighbors.test.ts
git commit -m "feat(books): getSeriesNeighbors server helper with canReadBook gating"
```

---

### Task 3: Extend `BookSummary` projection with series fields

**Files:**
- Modify: `lib/actions/book.actions.ts` — `BookSummary` type + `getUserBooksAction` (or whichever maps `BookSummary`)

- [ ] **Step 1: Extend the type**

In `lib/actions/book.actions.ts` around line 18:

```ts
export type BookSummary = {
  id: string
  title: string
  coverUrl: string | null
  wordCount: number
  genre: string | null
  lastEditedAt: Date
  chapterCount: number
  status: BookSummaryStatus
  isPublished: boolean
  seriesName: string | null      // NEW
  seriesNumber: number | null    // NEW
}
```

- [ ] **Step 2: Extend the projection / map**

Locate the `BookSummary[]` construction (around line 260 — `summaries: BookSummary[] = bookRows.map(...)`). Ensure the source `bookRows` already includes `seriesName` + `seriesNumber` from the `books.findMany` / `select(...)` call. If not, add them. Map them through:

```ts
{
  // ... existing fields ...
  seriesName: book.seriesName,
  seriesNumber: book.seriesNumber,
}
```

- [ ] **Step 3: Run tsc**

`npx tsc --noEmit`
Expected: any consumer that uses `BookSummary` and isn't extended yet might surface a missing-property error. Since the new fields are required by the type, every place that constructs a `BookSummary` literal must include them. Find with: `grep -rn "as BookSummary\|: BookSummary" app/ lib/`. Update each construction site (likely all already use `getUserBooksAction`'s mapped result — i.e. no new literals to write).

- [ ] **Step 4: Commit**

```bash
git add lib/actions/book.actions.ts
git commit -m "feat(books): BookSummary projection includes seriesName + seriesNumber"
```

---

### Task 4: Series line on cards — library, discover, profile

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/book-card.tsx` (library card)
- Modify: `app/[locale]/(public)/discover/_components/book-card.tsx` (discover card)
- Modify: `app/[locale]/(app)/u/[username]/page.tsx` (profile tiles)

- [ ] **Step 1: Add a shared `SeriesLine` component**

Create `components/book/series-line.tsx`:

```tsx
type Props = {
  seriesName: string | null
  seriesNumber: number | null
  className?: string
}

export function SeriesLine({ seriesName, seriesNumber, className }: Props) {
  if (!seriesName) return null
  return (
    <span className={className} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em' }}>
      {seriesNumber !== null
        ? <>Book {seriesNumber} · <span className="italic">{seriesName}</span></>
        : <>Part of <span className="italic">{seriesName}</span></>}
    </span>
  )
}
```

- [ ] **Step 2: Library card**

Read `app/[locale]/(app)/studio/_components/book-card.tsx`. Find the hover-overlay meta row (already shows status pill + last-edited + chapter count). Add `<SeriesLine seriesName={book.seriesName} seriesNumber={book.seriesNumber} />` in the meta row. Import the component.

- [ ] **Step 3: Discover card**

Same edit in `app/[locale]/(public)/discover/_components/book-card.tsx`. Discover's `book` projection is a `DiscoverBook` type — confirm it includes seriesName/seriesNumber; if not, extend the projection in `getDiscoverFeedAction` (`discover.actions.ts`).

- [ ] **Step 4: Profile tiles**

In `app/[locale]/(app)/u/[username]/page.tsx`, find the published-books grid. Each tile shows title + cover + genre — add the SeriesLine where the genre or meta row sits. Verify the published-books query returns seriesName/seriesNumber; extend if missing.

- [ ] **Step 5: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/book/series-line.tsx "app/[locale]/(app)/studio/_components/book-card.tsx" "app/[locale]/(public)/discover/_components/book-card.tsx" "app/[locale]/(app)/u/[username]/page.tsx"
# plus discover.actions.ts + user-profile.actions.ts if you extended projections
git commit -m "feat(series): show 'Book N of <Series>' on library / discover / profile cards"
```

---

### Task 5: Studio library "By series" sort + clustering

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/book-grid.tsx` (or wherever sort options + grid render live)

- [ ] **Step 1: Read the current sort logic**

Identify where the sort dropdown options are defined and where books are ordered. The library page already supports Recent / A→Z / Word count.

- [ ] **Step 2: Add "By series" as a sort option**

Add to the sort dropdown:

```tsx
<option value="series">By series</option>
```

- [ ] **Step 3: Implement clustering**

When the active sort is `series`, group books by `normalizeSeriesKey(book.seriesName)`. Render:

```tsx
import { normalizeSeriesKey } from '@/lib/books/series-key'

// when sortBy === 'series':
const clusters = (() => {
  const map = new Map<string, { displayName: string; books: BookSummary[] }>()
  let standalone: BookSummary[] = []
  for (const b of books) {
    const key = normalizeSeriesKey(b.seriesName)
    if (!key) {
      standalone.push(b)
      continue
    }
    const existing = map.get(key)
    if (existing) {
      existing.books.push(b)
    } else {
      map.set(key, { displayName: b.seriesName!, books: [b] })
    }
  }
  // Sort books within each cluster by seriesNumber asc, nulls last
  for (const c of map.values()) {
    c.books.sort((a, b) => {
      if (a.seriesNumber === null && b.seriesNumber === null) return 0
      if (a.seriesNumber === null) return 1
      if (b.seriesNumber === null) return -1
      return a.seriesNumber - b.seriesNumber
    })
  }
  return { series: Array.from(map.values()), standalone }
})()

// JSX
<>
  {clusters.series.map(cluster => (
    <section key={cluster.displayName}>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 italic">
        {cluster.displayName} ({cluster.books.length} {cluster.books.length === 1 ? 'book' : 'books'})
      </h3>
      <BookGrid books={cluster.books} />
    </section>
  ))}
  {clusters.standalone.length > 0 && (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        Standalone ({clusters.standalone.length})
      </h3>
      <BookGrid books={clusters.standalone} />
    </section>
  )}
</>
```

The exact JSX shape depends on the existing `book-grid.tsx`. If `BookGrid` already takes a `books` prop, reuse it inside each `<section>`. If not, extract the inner grid render into a helper and reuse.

- [ ] **Step 4: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/_components/"
git commit -m "feat(library): 'By series' sort clusters books with series subheaders"
```

---

### Task 6: Book reader page — series line + footer

**Files:**
- Create: `components/book/series-footer.tsx` (or co-locate in `(public)/_components/`)
- Modify: `app/[locale]/(public)/books/[bookId]/page.tsx`

- [ ] **Step 1: Add series line to the hero**

In the hero block of `books/[bookId]/page.tsx`, where the genre/author meta row renders, add the series line. The page already has `book.seriesName` + `book.seriesNumber` from `getPublicBookAction` (verify the PublicBook type — if missing, extend the action's select).

```tsx
{book.seriesName && (
  <div className="text-[11px] uppercase tracking-wider text-[#888] mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
    {book.seriesNumber !== null
      ? <>Book {book.seriesNumber} of <span className="italic text-[#aaa]">{book.seriesName}</span></>
      : <>Part of <span className="italic text-[#aaa]">{book.seriesName}</span></>}
  </div>
)}
```

- [ ] **Step 2: Call `getSeriesNeighbors`**

Near the existing data fetches:

```ts
import { getSeriesNeighbors } from '@/lib/books/get-series-neighbors'

const seriesNeighbors = await getSeriesNeighbors({
  currentBook: {
    id: book.id,
    userId: book.authorUserId,
    seriesName: book.seriesName,
    seriesNumber: book.seriesNumber,
  },
  viewerUserId: userId,
})
```

- [ ] **Step 3: Render `SeriesFooter`**

Create `app/[locale]/(public)/_components/series-footer.tsx`:

```tsx
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SeriesNeighbors } from '@/lib/books/get-series-neighbors'

type Props = {
  neighbors: SeriesNeighbors
  locale: string
}

export function SeriesFooter({ neighbors, locale }: Props) {
  const { previous, next } = neighbors
  if (!previous && !next) return null

  return (
    <div className="border-t border-[#2a2a2a] mt-8 pt-6 grid grid-cols-2 gap-4 px-6 pb-10">
      <div>
        {previous && (
          <Link
            href={`/${locale}/books/${previous.id}`}
            className="flex flex-col gap-1 hover:opacity-90 transition-opacity"
          >
            <span className="text-[10px] uppercase tracking-wider text-[#666] flex items-center gap-1">
              <ChevronLeft size={12} /> Previous in series
            </span>
            <span className="text-[14px] text-[#aaa]">
              {previous.seriesNumber !== null ? `Book ${previous.seriesNumber}: ` : ''}
              {previous.title}
            </span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link
            href={`/${locale}/books/${next.id}`}
            className="flex flex-col gap-1 items-end hover:opacity-90 transition-opacity"
          >
            <span className="text-[10px] uppercase tracking-wider text-[#666] flex items-center gap-1">
              Next in series <ChevronRight size={12} />
            </span>
            <span className="text-[14px] text-[#aaa]">
              {next.seriesNumber !== null ? `Book ${next.seriesNumber}: ` : ''}
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}
```

Render it in the page after the chapter list section:

```tsx
<SeriesFooter neighbors={seriesNeighbors} locale={locale} />
```

- [ ] **Step 4: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(public)/" lib/books/get-series-neighbors.ts
git commit -m "feat(reader): series line in hero + previous/next footer on book reader"
```

---

### Task 7: Wizard + Details page explanatory copy

**Files:**
- Modify: `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` (or wherever Step 3 lives in the active wizard)
- Modify: `app/[locale]/(app)/studio/[bookId]/details/_components/book-details-form.tsx` (Structure section)

- [ ] **Step 1: Wizard Step 3**

Locate the Series section (the Standalone/Series toggle). Above the toggle (after the section label), add:

```tsx
<p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
  Is this book part of a series? If so, the series name and number will appear on your book&apos;s reader page, library card, and any discoverable surface — and readers will be able to jump between books in the series.
</p>
```

- [ ] **Step 2: Details page Structure section**

Same paragraph above the Series fields in the Structure section of `book-details-form.tsx`.

- [ ] **Step 3: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/new/_components/" "app/[locale]/(app)/studio/[bookId]/details/_components/"
git commit -m "feat(wizard,details): explain what the Series choice controls"
```

---

### Task 8: AGENTS.md sync + final verification

- [ ] **Step 1: Add What Has Been Built entry**

Insert after the most recent entry:

```markdown
### Linked Series ✅ COMPLETE (2026-05-28)

Series metadata becomes load-bearing across four reader/author surfaces, the library gets a "By series" sort with clustering, the book reader page exposes previous/next navigation between books in the same series, and the wizard/Details page explain what the choice controls.

- **Matching helper** (`lib/books/series-key.ts`): `normalizeSeriesKey(name)` — lowercase, drops leading "The ", collapses whitespace, returns null for empty. 7 unit tests. Display name in UI is always the raw `seriesName`; this helper is matching-only.
- **Server-side neighbor query** (`lib/books/get-series-neighbors.ts`): `getSeriesNeighbors({ currentBook, viewerUserId })` returns `{ previous, next, total }`. Author-scoped (same `userId`), normalized-key match, gaps allowed (next jumps over missing numbers), every candidate filtered through `canReadBook` so PRIVATE/FRIENDS-locked books in the same series silently omit. 6 unit tests with mocked DB + canReadBook.
- **`BookSummary` projection extension**: `seriesName: string | null` + `seriesNumber: number | null` added so library + sorting can read them without a separate query.
- **Surfaces show "Book N of <Series>" / "Part of <Series>"**: reader page hero (mono uppercase under title), library card hover overlay, discover card meta row, /u/[username] profile tile. Shared `SeriesLine` component at `components/book/series-line.tsx`.
- **Library "By series" sort**: new option in the existing sort dropdown. When active, books cluster under series subheaders ("*The Stormlight Archive* (3 books)") in seriesNumber ascending order; standalone books cluster under a "Standalone (N)" subheader.
- **Reader page footer**: `<SeriesFooter>` renders below the chapter list with prev/next links (ChevronLeft / ChevronRight + "Book N: Title"). Hidden when no neighbors are reader-visible.
- **Wizard Step 3 + Details Structure section**: explanatory paragraph above the toggle explaining what the choice controls.

No DB / schema changes. 162 → 175 tests (+13 net: 7 series-key, 6 get-series-neighbors). tsc clean.
```

- [ ] **Step 2: Update Resume Here**

Bump Last updated, refresh Current focus to summarize Linked Series as shipped, update Last commit, refresh Next concrete step.

- [ ] **Step 3: Run full test suite + tsc**

`npm test && npx tsc --noEmit`
Expected: 175/175 pass, tsc clean.

- [ ] **Step 4: Manual verification** (Chris runs)

1. Create three books with seriesName "The Stormlight Archive" / "stormlight archive" / "STORMLIGHT ARCHIVE" and numbers 1/2/3 — they all link via normalized key.
2. Library sort dropdown → "By series" — three books cluster under "The Stormlight Archive (3 books)" (display name from first book) in number order. Standalone books below.
3. Reader page on Book 2 — hero shows "Book 2 of The Stormlight Archive"; footer shows previous → Book 1, next → Book 3.
4. Make Book 3 PRIVATE — incognito viewer on Book 2 sees previous → Book 1, next slot is empty.
5. Create a book with seriesName but no seriesNumber — reader page hero shows "Part of <Series>" with no number; footer hidden.
6. Two different authors create books in a series called "Chronicles" — neither sees the other's books linked (author-scoped).
7. Discover card + /u/[username] tile both show series line.
8. Wizard Step 3 + Details page show the explainer paragraph.

- [ ] **Step 5: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "docs: Linked Series ✅ COMPLETE — sync Resume Here + What Has Been Built"
```

---

## Self-Review

**Spec coverage:**
- §1 Matching helper → Task 1 ✅
- §2 Reader-facing surfaces → Tasks 4 (cards) + 6 (reader page hero) ✅
- §3 Library grouping → Task 5 ✅
- §4 Cross-book navigation → Task 6 (footer) + Task 2 (neighbor helper) ✅
- §5 Wizard + Details copy → Task 7 ✅
- §6 Implementation notes → Tasks 1-7 collectively ✅
- §7 Manual verification → Task 8 Step 4 ✅
- §8 Out of scope → respected ✅

**Placeholder scan:** no TBDs. Code blocks ship the actual code; commands are real.

**Type consistency:** `SeriesNeighbor` + `SeriesNeighbors` types shared from `lib/books/get-series-neighbors.ts` and consumed by `<SeriesFooter>`. `normalizeSeriesKey` signature consistent across all callers. `BookSummary` extension cascades naturally — TypeScript will flag any missed construction site.

**Risk:** Task 3 (BookSummary extension) might surface tsc errors in places that construct `BookSummary` literals. Mitigation: the plan includes a `grep` for "as BookSummary | : BookSummary" to find all sites. Most consumers should use the mapped result of `getUserBooksAction`, not literal construction.

**Decoupled tasks:** 1 + 2 are pure helpers; 3 is a projection-only change; 4-7 are independent surface changes. Order is sensible top-down because each consumer task depends on prior helpers/projections. Tasks 4-7 could ship as separate commits per the plan.
