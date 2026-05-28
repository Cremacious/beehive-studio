# Linked Series

**Date:** 2026-05-28
**Status:** Design approved, ready for plan-phase

## Problem

The book creation wizard offers "Series" vs "Standalone" with no explanation. The choice writes `books.seriesName` + `books.seriesNumber` but those fields are never displayed anywhere — reader, library, discover, profile pages all ignore them. Authors fill in series info that vanishes into the database. The setup feels arbitrary and the value of the choice is invisible.

## Decision

Linked series. Series metadata becomes load-bearing across four reader/author surfaces, the library gets a "By series" sort with clustering, and the book reader page exposes previous/next navigation between books in the same series. Author-scoped matching with normalized series-key (case-insensitive, leading "The " stripped, whitespace collapsed) so authors don't have to be perfectly consistent across their own books.

## 1. Matching helper

No schema changes. Pure helper at `lib/books/series-key.ts`:

```ts
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

A book belongs to a series iff `normalizeSeriesKey(book.seriesName)` is non-null. Two books share a series iff they share the same `userId` AND the same normalized key.

Display name (the version shown in UI) is always the raw `book.seriesName` — normalization is matching-only.

## 2. Reader-facing surfaces

The series identity shows up wherever a book renders publicly:

| Surface | Treatment |
|---|---|
| Book reader page (`/[locale]/books/[bookId]`) | "Book 2 of *The Stormlight Archive*" line below the title in the hero. Mono uppercase 11px, matches existing genre/meta vocabulary. |
| Library card (`/[locale]/studio`) | "Book 2 · The Stormlight Archive" line in the existing hover-overlay meta row. |
| Discover card (`/[locale]/discover`) | Same line as library card, in the existing meta-row position. |
| Author profile (`/u/[username]`) | Same line on each published-book tile. |

When `seriesName` is set but `seriesNumber` is null, render "Part of *The Stormlight Archive*" (no number).

When `seriesName` is null, render nothing (no row).

## 3. Library grouping — "By series" sort

The library already supports sorting (Recent / A→Z / Word count). Add a fourth sort: **By series**.

When By series is active:
- Books that share a normalized series key cluster together
- Each cluster gets a subheader "*The Stormlight Archive* (3 books)" above its books
- Within a cluster, books order by `seriesNumber` ascending (nulls last)
- Standalone books (no series) cluster under a "Standalone (N)" subheader at the end

When any other sort is active: no clustering. Series info still appears on the card overlay as described in §2.

No filter chip changes — this is purely a sort variant.

## 4. Cross-book navigation — series footer

On the book reader page below the chapter list, render a footer section with previous/next links:

```
─────────────────────────────────────────
   ← Previous in series          Next in series →
       Book 1: Way of Kings      Book 3: Oathbringer
```

Rules:

- Match on `userId` + `normalizeSeriesKey(seriesName)`
- "Next" = the book with the smallest `seriesNumber` strictly greater than the current book's number; skips gaps (Book 1 with only Book 3 existing → Next jumps to Book 3)
- "Previous" = the book with the largest `seriesNumber` strictly less than the current
- A linked book renders ONLY if the viewer can read it (passes `canReadBook(book.id, viewerUserId)`). PRIVATE / FRIENDS-locked books are silently omitted — no teaser link to an inaccessible book
- A book with `seriesNumber === null` does NOT appear in prev/next sequences (no position to compare). If the current book has a null number but a series name, the footer renders "Part of *The Stormlight Archive*" with no prev/next pair
- The footer is hidden entirely when:
  - Current book has no `seriesName`
  - Current book has a series but no reader-visible neighbors exist for this viewer

Server-only helper: `lib/books/get-series-neighbors.ts` returns `{ previous, next, total }` for the reader page to consume. `previous` and `next` are `{ id, title, seriesNumber } | null`. `total` counts reader-visible books in the series (for future "Book 2 of 5" expansions — not used in the initial UI).

## 5. Wizard + Details page UX

Both surfaces get the same explanatory paragraph above the Standalone / Series toggle:

> **Series**
> Is this book part of a series? If so, the series name and number will appear on your book's reader page, library card, and any discoverable surface — and readers will be able to jump between books in the series.

- Wizard Step 3 — section heading + paragraph above the toggle
- Details page Structure section — same treatment

The two-button toggle itself doesn't change.

## 6. Implementation

**Pure helpers** (`lib/books/`):
- `series-key.ts` — `normalizeSeriesKey(name)` + 6 unit tests
- `get-series-neighbors.ts` (server-only, no `'use client'`) — `getSeriesNeighbors({ currentBook, viewerUserId })` returns `{ previous, next, total }`. Queries `books` where `userId = currentBook.userId AND seriesName IS NOT NULL`, applies the normalized-key filter in JS, picks neighbors, filters through `canReadBook`. ~5 unit tests with mocked DB.

**Server actions:** no signature changes. `BookSummary` projection already includes `seriesName` + `seriesNumber` (verify; add if missing).

**Components:**
- Book reader page (`(public)/books/[bookId]/page.tsx`) — call `getSeriesNeighbors`, render series line in hero, render footer if applicable
- Library book card (`(app)/studio/_components/book-card.tsx`) — add series line to hover meta
- Discover book card (`(public)/discover/_components/book-card.tsx`) — same
- Profile page (`(app)/u/[username]/page.tsx`) — add series line to published-book tiles
- Studio library page sort: add "By series" to existing sort dropdown; cluster + subheader when active
- Wizard Step 3 (`(app)/studio/_components/create-book-wizard/step-three.tsx`): add explanatory paragraph above the toggle
- Wizard Step 3 may also live as a variant in `(app)/studio/new/_components/book-creation-form.tsx` (Step 3 internal — verify during implementation)
- Details page Structure section in `(app)/studio/[bookId]/details/_components/book-details-form.tsx`: same paragraph

**Tests:**

`series-key.test.ts`:
- `null` returns `null`
- empty string returns `null`
- whitespace-only returns `null`
- "The Stormlight Archive" → "stormlight archive"
- "stormlight archive" → "stormlight archive"
- "  STORMLIGHT  ARCHIVE  " → "stormlight archive"
- "Book of the Dead" → "book of the dead" (preserves non-leading "the")

`get-series-neighbors.test.ts`:
- Book with no seriesName → `{ previous: null, next: null, total: 0 }`
- Sole book in series → `{ previous: null, next: null, total: 1 }`
- Book 2 with Book 1 + Book 3 visible → both populated; total 3
- Book 1 with Book 3 only (gap) → previous null, next = Book 3
- Book 2 with Book 1 visible but Book 3 PRIVATE for viewer → previous = Book 1, next = null
- Current book with seriesNumber null → previous null, next null (no position)

No E2E. Manual smoke covers the four surfaces.

## 7. Manual verification

1. Author creates Books 1, 2, 3 of "The Stormlight Archive" — each shows "Book N of The Stormlight Archive" on its reader page.
2. Library shows series line on hover for each book.
3. Library "By series" sort: all three cluster under a "Stormlight Archive (3 books)" subheader, in number order.
4. On Book 2's reader page, footer shows previous → Book 1, next → Book 3.
5. Author makes Book 3 PRIVATE. Incognito viewer on Book 2's reader page sees previous → Book 1, next → nothing (Book 3 omitted because not reader-visible).
6. Books with same series name but different authors do NOT link to each other (author-scoped matching).
7. Casing/leading-The variations on the same author's books all cluster correctly.
8. Discover + /u/[username] surfaces show the series line consistently.

## 8. Out of scope

- Series as a first-class entity (no new `series` table)
- Cross-author shared series / collaborations
- Series cover art / dedicated `/series/[key]` landing page
- Drag-to-reorder in "By series" sort (order strictly by `seriesNumber`)
- Auto-completion of series name in the wizard (suggesting existing series the author has)
- Reading-progress aggregation across a series ("You've read 2 of 3")
- Notifications on new book in a series ("Subscribe to series")
- Numbering uniqueness enforcement (author can enter Book 1 twice; both render)
