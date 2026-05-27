# Studio Library Redesign Design Spec

> **Date:** 2026-05-27
> **Sub-project:** `/[locale]/studio` book-grid landing page redesign.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Redesign `/[locale]/studio` from a bare card grid into a richer "library" surface — bookshelf metaphor + productivity SaaS feel + room to breathe when populated. After this ships, a user landing on `/studio` sees a Continue-Writing hero for their most-recent book, productivity stats, sort/filter controls, and a grid of book cards with hover-progressive disclosure of dashboard data.

## 2. Context

`/studio` is the main authenticated landing surface. Users hit it after sign-in or via the Studio nav link. Currently a bare card grid + a floating-illustration empty state. The studio editor at `/studio/[bookId]` was fully redesigned over DP1-DP4; this landing page was not.

**Reference:** Chris's previous app at `C:\Code\personal\beehive-books-online` has a `/library` page (per `app/[locale]/(app)/library/page.tsx` + `components/library/book-grid.tsx`) with: tabs, search + sort + view-mode toggle, privacy filter chips with counts, grid (with placeholder fillers when sparse), pagination. The new /studio takes inspiration from this but leans further into the productivity-SaaS direction.

Locked decisions from the brainstorm:
1. Both empty and populated states redesigned.
2. Above the grid: Continue-Writing hero + 4-stat strip combined into one header section.
3. Cards minimal at rest; hover overlay reveals dashboard data.
4. Controls: search + sort dropdown + filter chips with counts (no grid/list toggle).
5. Empty state: rounded-card icon + "Start writing" + "Explore books" dual CTAs.
6. Paper-warm covers on cool gray chrome (reuses existing tokens — no new design system).
7. 4 stats: Total words / Books in progress / Words this week / Chapters published.

## 3. Non-goals

- No new tabs (My Books / Favourites split — Favourites isn't a current feature; deferred).
- No view-mode toggle (grid only; list view was barely used in the reference).
- No pagination at v1 — most users have <20 books, grid handles that fine. Add later if needed.
- No drag-to-reorder books.
- No multi-select / bulk actions.
- No book templates surface on the landing page (already in CreateBookModal).
- No daily-streak gamification (would require a new daily-goal-hit log; out of scope).
- No DB migrations.

## 4. Architecture

### 4.1 Page composition

`app/[locale]/(app)/studio/page.tsx` (server component, full rewrite):

```
StudioPage
├── Fetches in parallel:
│   ├── getUserBooksAction()           — existing, projection EXTENDED (see §4.5)
│   ├── getStudioStatsAction()         — NEW
│   └── bookTemplates query for CreateBookModal
├── if books.length === 0 → <StudioEmptyState locale templates />
└── else → <StudioShell locale books stats templates />

StudioShell composes:
├── StudioHeader (server-rendered)
│   ├── ContinueWritingHero (most-recently-edited book — books[0] when sorted by lastEditedAt DESC)
│   └── StudioStats
├── StudioControls (client component — owns search/sort/filter state)
└── BookGrid (client component — consumes filtered/sorted books from controls)
    └── BookCard[] with hover overlay
```

### 4.2 StudioHeader

Width: matches page (`max-w-6xl mx-auto`). Layout: flex row on `lg+`, stacks on smaller. Hero takes ~60% of the width; stats strip takes ~40%.

#### ContinueWritingHero
- 80×120 cover thumbnail on left.
- Right column: small "Continue writing" eyebrow label, book title (Comfortaa display, 24px), status pill, word count + progress bar (or just "12,340 words" if no goal), "Resume writing" brand-yellow CTA.
- Link wraps everything — clicking anywhere navigates into the book.

#### StudioStats
- 4 stat tiles in a 2×2 grid (or 1×4 on wide).
- Each tile: large number (Comfortaa, 28px) + small label below (`text-muted-foreground`).
- Tiles:
  - **Total words** — sum of chapter word counts across all user's books.
  - **Books in progress** — count of books without `publishedAt`.
  - **Words this week** — sum of word counts for chapters with `updatedAt > now - 7d`. Note: this counts words IN chapters touched this week, not "words added." Acceptable productivity proxy.
  - **Chapters published** — count of chapters in published books.

### 4.3 StudioControls

A horizontal control row between the header and the grid. Three elements:

1. **Search input** (`<input type="text">`): icon-prefixed, filters by title or genre substring (case-insensitive). Client-side state.
2. **Sort dropdown** (native `<select>`): options "Recent" (by `lastEditedAt` DESC, default), "A → Z" (by title), "Word count" (by `wordCount` DESC).
3. **Filter chips**: horizontal row of pill buttons with counts:
   - All (count = total books)
   - Drafting (count = books with status="Drafting")
   - Revised (count = books with status="Revised")
   - Published (count = books with `publishedAt`)

Chip counts derive from the same `summarizeBookStatus(book)` helper that drives card overlays, so they stay in sync.

Selecting a chip filters the grid; default = All.

### 4.4 BookGrid + BookCard

**BookGrid:** responsive grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`. Consumes the filtered/sorted books from StudioControls' state.

**BookCard** (the main visual change):

**At rest (matches current minimal design):**
- Aspect-2/3 cover area at top.
- Cover image OR placeholder SVG.
- Below cover: title + word count.
- `bg-card border border-border rounded-xl overflow-hidden`.
- Cover area paper-warm: the placeholder uses cream tint (`bg-paper-100` with `--paper-ink-strong` text/icon). Cover-image cards keep the image as-is. This is Q6's lock — paper-warm covers, cool chrome elsewhere.

**On hover:**
- Cover area shows a dark gradient overlay from the bottom up.
- Overlay reveals: status pill, last-edited timestamp, chapter count, genre pill, progress bar (or just word count if no goal).
- Smooth 200ms opacity transition. CSS-only (no JS state needed) — `group-hover` modifier on the card root, with the overlay using `opacity-0 group-hover:opacity-100`.

**Touch device behavior:** the overlay simply doesn't appear on touch. Card click still navigates into the book. Acceptable degradation per brainstorm Q3 risk note.

### 4.5 Data shape additions

Extend `BookSummary` returned by `getUserBooksAction`:

```ts
type BookSummary = {
  // existing:
  id: string
  title: string
  coverUrl: string | null
  wordCount: number
  // NEW:
  genre: string | null          // from books.genre
  lastEditedAt: Date            // MAX(chapters.updatedAt) for this book, falls back to books.updatedAt
  chapterCount: number          // COUNT(binderItems WHERE type='chapter' AND bookId=this)
  publishedAt: Date | null      // from books.publishedAt (already exists; pass through)
  status: BookSummaryStatus     // computed via summarizeBookStatus()
}

type BookSummaryStatus = 'Drafting' | 'Revised' | 'Published'
```

**`summarizeBookStatus(book)`** rollup logic:
1. If `book.publishedAt` is set → `Published`.
2. Else if all chapters in the book have status `REVISED` or `FINAL` → `Revised`.
3. Else (default, including books with no chapters) → `Drafting`.

Place the helper in `lib/books/summarize-status.ts` so both the card overlay and the filter-chip-count computation use it.

**`getStudioStatsAction`** (new in `lib/actions/book.actions.ts`):

```ts
type StudioStats = {
  totalWords: number
  booksInProgress: number
  wordsThisWeek: number
  chaptersPublished: number
}

export async function getStudioStatsAction(): Promise<ActionResult<StudioStats>>
```

Aggregates via 4 SQL queries. Cheap; can be cached via React Server `cache()` if it shows up in profiling.

### 4.6 StudioEmptyState

Replaces the existing floating-illustration empty state with the reference-style approach.

```tsx
<main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
  <div className="flex flex-col items-center justify-center py-28 text-center">
    <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
      <BookOpen className="w-9 h-9 text-muted-foreground" />
    </div>
    <h2 className="text-2xl font-bold mainFont mb-2">Your stories start here</h2>
    <p className="text-sm text-muted-foreground mb-5 max-w-sm">
      Write your own book or discover stories from other writers.
    </p>
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <CreateBookModal locale={locale} templates={templates}>
        <button className="px-5 py-2.5 rounded-full bg-brand text-brand-ink text-sm font-bold mainFont hover:bg-brand-hover transition-colors">
          Start writing
        </button>
      </CreateBookModal>
      <Link href={`/${locale}/discover`} className="px-5 py-2.5 rounded-full border border-border text-foreground text-sm font-medium hover:border-foreground/50 transition-colors">
        Explore books
      </Link>
    </div>
  </div>
</main>
```

No new floating illustration; reference's minimal approach matches the new design system.

### 4.7 Visual treatment

Reuses tokens shipped in DP1 + chrome retone:
- Cards: `bg-card border border-border` (cool chrome).
- Page background: `bg-background`.
- Text: `text-foreground` (chrome-100 — bright after the text-brightness fix).
- Subtext: `text-muted-foreground` (chrome-300).
- Brand yellow accents on: New Book CTA (top-right), Resume Writing CTA (hero), active filter chip, hover-active card edge.
- Cover placeholder: paper-warm (`bg-paper-100` + dark `--paper-ink-strong` placeholder icon). This is the only "warm" element on the page.

Status pills (in card overlay) use the `--status-*` palette from DP1 (5 tints — but only 3 used here: Drafting / Revised / Published).

## 5. Files

**New:**
- `app/[locale]/(app)/studio/_components/studio-header.tsx`
- `app/[locale]/(app)/studio/_components/continue-writing-hero.tsx`
- `app/[locale]/(app)/studio/_components/studio-stats.tsx`
- `app/[locale]/(app)/studio/_components/studio-controls.tsx`
- `app/[locale]/(app)/studio/_components/book-grid.tsx`
- `app/[locale]/(app)/studio/_components/book-card.tsx`
- `app/[locale]/(app)/studio/_components/studio-empty-state.tsx`
- `lib/books/summarize-status.ts`

**Modified:**
- `app/[locale]/(app)/studio/page.tsx` — full rewrite.
- `lib/actions/book.actions.ts` — extend `BookSummary` projection; add `getStudioStatsAction`.
- `AGENTS.md` — Resume Here + entry under "What Has Been Built."

**No new dependencies. No DB schema changes.**

## 6. Risks

1. **Continue-writing hero falls back gracefully when zero chapters have been touched.** Brand-new book with no edits → hero shows just title + "Open book" CTA instead of "Resume writing" + progress bar. Confirm during impl.

2. **`getStudioStatsAction` query cost.** 4 aggregate queries. For active users with ≤20 books and ≤100 chapters, sub-100ms total. Premature-optimization-prevention: don't cache until profiling shows it's needed.

3. **Hover overlay on touch.** CSS hover doesn't fire reliably on touch devices. Overlay just doesn't show; cards remain clickable. Acceptable v1 degradation.

4. **Status rollup ambiguity.** `summarizeBookStatus(book)` synthesizes a book-level status from chapter statuses. The mapping (`Drafting` / `Revised` / `Published`) collapses chapter statuses (`IDEA` / `OUTLINE` / `FIRST_DRAFT` / `REVISED` / `FINAL`). Card overlay AND filter-chip-count both use this; consistent by construction.

5. **Search/sort/filter state is client-only.** No URL persistence (refresh resets). YAGNI for v1; if users complain we add `?q=&sort=&status=` later.

6. **Books with no chapters** — chapterCount = 0, status defaults to "Drafting", wordCount = 0. The card displays cleanly; the hero falls back per risk 1.

7. **`wordsThisWeek` is an approximation** (sum of word counts for chapters touched this week, not "words added"). Document in the action's JSDoc.

## 7. Testing (manual)

1. New user (zero books) → `StudioEmptyState` renders with the rounded-icon design + dual CTAs.
2. Click "Start writing" → opens `CreateBookModal`. Click "Explore books" → navigates to `/discover`.
3. User with 1+ books → `StudioShell` renders header (hero + stats) + controls + grid.
4. Continue-writing hero shows the most-recently-edited book; clicking "Resume writing" navigates into it.
5. Stats show 4 real numbers; none are NaN. Mouse over each to verify the label is correct.
6. Hover any card → overlay reveals status pill, last edited timestamp, chapter count, genre pill, progress bar (or word count only if no goal).
7. Click a card → navigates to that book's `/studio/[bookId]` page.
8. Type in search → grid filters to matching titles/genres. Clear search → all books return.
9. Change sort dropdown → grid reorders (Recent / A-Z / Word count).
10. Click each filter chip → grid filters; chip count matches displayed cards. "All" returns everything.
11. "+ New Book" (top right) → opens `CreateBookModal`. Create a book → page refetches; new book appears.
12. Wide viewport (≥1280px) → 5-column grid. Narrow (~375px) → 2 columns.
13. `npx tsc --noEmit` clean. `npm test` clean (126).

## 8. Definition of Done

- ~5 atomic commits (header → controls → cards → empty state → page wire-up + AGENTS.md).
- All 13 manual tests pass.
- `tsc` clean. `npm test` clean (126).
- `getStudioStatsAction` returns valid data.
- `getUserBooksAction` projection extended with status / lastEditedAt / chapterCount / genre.
- `BookSummary` type updated.
- `summarizeBookStatus()` helper exists; used by card overlay AND filter chip counts.
- Hero + stats + controls + grid + hover overlay all wired.
- AGENTS.md Resume Here + Studio Library entry under "What Has Been Built."
- Pushed to origin/main.

## 9. Follow-ups (out of scope)

- Favourites tab (requires a `bookFavourites` table or extending an existing social table).
- View-mode toggle (grid/list) — defer until users ask.
- Pagination — defer until users have >20 books.
- URL persistence for search/sort/filter state — defer until users ask.
- Multi-select / bulk delete — defer.
- Daily writing streak — needs a `dailyGoalHits` log; future productivity polish.
